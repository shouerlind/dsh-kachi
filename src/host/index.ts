/**
 * dsh-kachi host 半:一个 cordis host 插件,负责三件事 ——
 *  1. 注册 /dsh-kachi/sounds 静态路由,把包内 assets/sounds 的 WAV 提供给
 *     浏览器半(/plugins 路由只服务 JS bundle,不服务静态资产);
 *  2. 向 ctx.settings 注册插件命名空间 schema,client 半的 settingsScope
 *     才有可读写的文档层,设置也呈现在 dsh 的设置文档里;
 *  3. (预留)host 侧读取同名设置,供未来 host 半增强使用。
 */
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-settings'
import { KACHI_SETTINGS_NAMESPACE, kachiSettingsSchema } from './settings-schema.ts'
import { resolveSoundFile } from './sound-files.ts'

export const inject = ['settings', 'webServer']

const SOUND_ROOT = fileURLToPath(new URL('../assets/sounds/', import.meta.url))

export function apply(ctx: Context): void {
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: '/dsh-kachi',
        handler: (req, res) => {
          void serveSound(req, res)
        },
      }),
    'dsh-kachi: sound routes',
  )

  ctx.effect(() => {
    // namespace 注册不可逆注入(跟随 settings 服务生命周期);无独立 disposer。
    ctx.settings.register(KACHI_SETTINGS_NAMESPACE, kachiSettingsSchema)
    return () => {}
  }, 'dsh-kachi: settings namespace')
}

async function serveSound(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const rel = resolveSoundFile(url.pathname)
  if (rel === undefined) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('not found')
    return
  }
  const filePath = join(SOUND_ROOT, rel)
  let fileStat
  try {
    fileStat = await stat(filePath)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('not found')
    return
  }
  if (!fileStat.isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('not found')
    return
  }
  res.writeHead(200, {
    'content-type': 'audio/wav',
    'content-length': fileStat.size,
    'cache-control': 'public, max-age=86400',
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  const stream = createReadStream(filePath)
  stream.pipe(res)
  stream.on('error', () => {
    res.destroy()
  })
}
