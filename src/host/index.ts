/**
 * dsh-kachi host 半:一个 cordis host 插件,负责三件事 ——
 *  1. 注册 /dsh-kachi/sound 端点,把包内 assets/sounds 的 WAV 以 JSON 封套
 *     (base64,见 shared/sound-envelope.ts)提供给浏览器半(/plugins 路由只
 *     服务 JS bundle,不服务静态资产);
 *  2. 向 ctx.settings 注册插件命名空间 schema,client 半的 settingsScope
 *     才有可读写的文档层,设置也呈现在 dsh 的设置文档里;
 *  3. (预留)host 侧读取同名设置,供未来 host 半增强使用。
 *
 * 为什么不是静态 `.wav` 路由:旧的 `/dsh-kachi/sounds/*.wav` 同时暴露 `.wav`
 * 扩展名与 `audio/wav` 响应头,IDM 等下载管理器据此认领下载 —— 插件启动预解码
 * 13 个默认槽,页面一加载连撞 13 次。旧路由已**删除**(客户端已无消费者),
 * 现在任何非 `/dsh-kachi/sound` 的路径一律 404。理由与代价见 sound-envelope.ts。
 */
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-settings'
import { encodeBase64, type SoundEnvelope } from '../shared/sound-envelope.ts'
import { KACHI_SETTINGS_NAMESPACE, kachiSettingsSchema } from './settings-schema.ts'
import { resolveSoundFile } from './sound-files.ts'

export const inject = ['settings', 'webServer']

/**
 * 音效资产根目录。两种布局都必须认:
 *  - 产物布局 `<pkg>/lib/index.js` → `../assets/sounds/`(dsh 运行时走这条);
 *  - 源码布局 `<repo>/src/host/index.ts` → `../../assets/sounds/`(vitest 直接
 *    跑 TS 源码时走这条)。
 * 只写死产物那一条,源码直跑时会解析到不存在的 `src/assets/sounds`,端点在测试里
 * 一律 404 —— 这正是此前 test/ 完全没有路由层测试所掩盖的坑;测试现在真的打到
 * 磁盘上的资产,所以两套布局都得能解析。
 */
const SOUND_ROOT = (() => {
  const candidates = ['../assets/sounds/', '../../assets/sounds/'] as const
  for (const rel of candidates) {
    const dir = fileURLToPath(new URL(rel, import.meta.url))
    if (existsSync(dir)) return dir
  }
  return fileURLToPath(new URL(candidates[0], import.meta.url))
})()

const SOUND_PATH = '/dsh-kachi/sound'

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

function notFound(res: ServerResponse): void {
  res.writeHead(404, { 'content-type': 'text/plain' })
  res.end('not found')
}

async function serveSound(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname !== SOUND_PATH) {
    notFound(res)
    return
  }
  const rel = resolveSoundFile(url.searchParams.get('file') ?? '')
  if (rel === undefined) {
    notFound(res)
    return
  }
  // 不存在、是目录(EISDIR)或读不动,一律 404,不泄漏磁盘细节。
  const bytes = await readFile(join(SOUND_ROOT, rel)).catch(() => undefined)
  if (bytes === undefined) {
    notFound(res)
    return
  }
  const body = JSON.stringify({ b64: encodeBase64(bytes) } satisfies SoundEnvelope)
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    // 与旧静态路由同级:文件身份即整个 URL(file 参数),可放心长缓存。
    'cache-control': 'public, max-age=86400',
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  res.end(body)
}
