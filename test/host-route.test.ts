/**
 * host 音效端点 /dsh-kachi/sound 的路由层测试。
 *
 * 改动前 test/ 里没有任何测试碰过 webServer.register 注册的处理函数 ——
 * 只有 resolveSoundFile 的纯函数测试。IDM 兼容改动把响应从「静态 .wav 流」
 * 换成「JSON 封套」,值得在这里钉住:真实文件字节往返、路径安全、旧路由已死、
 * 以及 IDM 赖以识别下载的两个标记(URL 扩展名 / audio 类型 / RIFF 魔数)都不在。
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { apply } from '../src/host/index.ts'
import { decodeBase64 } from '../src/shared/sound-envelope.ts'

const SOUND_ROOT = fileURLToPath(new URL('../assets/sounds/', import.meta.url))

interface RouteOptions {
  kind: string
  path: string
  handler: (req: unknown, res: unknown) => void
}

interface Reply {
  status: number
  headers: Record<string, string>
  body: string
}

/** 装配 host 插件并捕获它注册的路由(不需要真 cordis 运行时)。 */
function mountRoute(): RouteOptions {
  let captured: RouteOptions | undefined
  const ctx = {
    effect: (fn: () => unknown) => {
      fn()
      return () => {}
    },
    webServer: {
      register: (opts: RouteOptions) => {
        captured = opts
      },
    },
    settings: { register: () => {} },
  }
  apply(ctx as unknown as Parameters<typeof apply>[0])
  if (captured === undefined) throw new Error('host 未注册音效路由')
  return captured
}

/** 用假 req/res 打一次路由,返回完整响应。 */
function request(target: string, method = 'GET'): Promise<Reply> {
  const route = mountRoute()
  return new Promise<Reply>((resolve, reject) => {
    const reply: Reply = { status: 0, headers: {}, body: '' }
    const res = {
      writeHead(status: number, headers?: Record<string, string>) {
        reply.status = status
        Object.assign(reply.headers, headers ?? {})
      },
      end(body?: string) {
        reply.body = body ?? ''
        resolve(reply)
      },
      destroy() {
        reject(new Error('响应被 destroy'))
      },
    }
    route.handler({ url: target, method }, res)
  })
}

function envelopeBytes(body: string): Uint8Array {
  return decodeBase64((JSON.parse(body) as { b64: string }).b64)
}

async function assetBytes(rel: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(join(SOUND_ROOT, rel)))
}

describe('host 音效端点 /dsh-kachi/sound(IDM 兼容改动)', () => {
  it('默认池文件:200 + JSON 封套,解出的字节与磁盘原文件逐字节一致', async () => {
    const res = await request('/dsh-kachi/sound?file=boot.wav')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('application/json; charset=utf-8')
    expect(Array.from(envelopeBytes(res.body))).toEqual(Array.from(await assetBytes('boot.wav')))
  })

  it('pack 池文件同样可取(池归属走 file 参数的 pack/ 前缀)', async () => {
    const res = await request('/dsh-kachi/sound?file=pack/SeNewsBad.wav')
    expect(res.status).toBe(200)
    expect(Array.from(envelopeBytes(res.body))).toEqual(Array.from(await assetBytes('pack/SeNewsBad.wav')))
  })

  it('解出的字节是真 WAV(RIFF 头 + WAVE 标记)', async () => {
    const bytes = envelopeBytes((await request('/dsh-kachi/sound?file=boot.wav')).body)
    const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to))
    expect(ascii(0, 4)).toBe('RIFF')
    expect(ascii(8, 12)).toBe('WAVE')
  })

  it('IDM 赖以认领下载的标记一个都不在:非 audio 类型、body 不以 RIFF 开头、无 content-disposition', async () => {
    const res = await request('/dsh-kachi/sound?file=boot.wav')
    expect(res.headers['content-type']).not.toContain('audio')
    expect(Object.keys(res.headers).join(',')).not.toContain('content-disposition')
    expect(res.body.startsWith('{"b64":"')).toBe(true)
    // base64 文本里不会出现 'RIFF' 字面量:内容嗅探的兜底也失效。
    expect(res.body.slice(0, 64)).not.toContain('RIFF')
  })

  it('保留与旧静态路由同级的缓存头与 content-length', async () => {
    const res = await request('/dsh-kachi/sound?file=cancel.wav')
    expect(res.headers['cache-control']).toBe('public, max-age=86400')
    expect(Number(res.headers['content-length'])).toBe(Buffer.byteLength(res.body))
  })

  it('HEAD 返回同样的头但不带 body', async () => {
    const head = await request('/dsh-kachi/sound?file=boot.wav', 'HEAD')
    const get = await request('/dsh-kachi/sound?file=boot.wav')
    expect(head.status).toBe(200)
    expect(head.body).toBe('')
    expect(head.headers['content-length']).toBe(get.headers['content-length'])
    expect(head.headers['content-type']).toBe(get.headers['content-type'])
  })

  it('目录穿越、绝对路径、非法文件名一律 404,不泄漏仓库文件', async () => {
    const targets = [
      '/dsh-kachi/sound?file=../package.json',
      '/dsh-kachi/sound?file=pack/../package.json',
      '/dsh-kachi/sound?file=..%2Fpackage.json',
      '/dsh-kachi/sound?file=/etc/passwd',
      '/dsh-kachi/sound?file=C:\\Windows\\win.ini',
      '/dsh-kachi/sound?file=pack/sub/x.wav',
      '/dsh-kachi/sound?file=boot.txt',
      '/dsh-kachi/sound?file=.wav',
      '/dsh-kachi/sound',
    ]
    for (const target of targets) {
      const res = await request(target)
      expect(res.status, target).toBe(404)
      expect(res.body, target).toBe('not found')
    }
  })

  it('不存在的文件 404(与非法取值同形,不泄漏磁盘细节)', async () => {
    const res = await request('/dsh-kachi/sound?file=definitely-missing.wav')
    expect(res.status).toBe(404)
    expect(res.body).toBe('not found')
  })

  it('旧 /dsh-kachi/sounds/*.wav 静态路由已删除 —— 连同其它路径一律 404', async () => {
    for (const target of [
      '/dsh-kachi/sounds/boot.wav',
      '/dsh-kachi/sounds/pack/SeNewsBad.wav',
      '/dsh-kachi/',
      '/dsh-kachi/anything',
    ]) {
      const res = await request(target)
      expect(res.status, target).toBe(404)
    }
  })
})
