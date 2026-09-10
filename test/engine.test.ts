import { describe, expect, it, vi } from 'vitest'
import {
  createEngine,
  type AudioContextLike,
  type SoundFetcher,
} from '../src/client/engine/audio-engine.ts'
import { encodeBase64 } from '../src/shared/sound-envelope.ts'
import { FakeAudioContext, okSoundFetcher } from './fakes.ts'

function makeEngine(ctx: FakeAudioContext) {
  return createEngine({
    createContext: () => ctx as unknown as AudioContextLike,
    audioBase: '/test-assets',
    fetchImpl: okSoundFetcher,
    visibility: () => 'visible',
  })
}

describe('播放引擎(工单 #9 最小形态)', () => {
  it('解锁前事件被丢弃:不 resume 也不创建 source', async () => {
    const ctx = new FakeAudioContext()
    const engine = makeEngine(ctx)
    await engine.play('tool-call')
    expect(ctx.resumeCalls).toBe(0)
    expect(ctx.sources).toHaveLength(0)
    engine.dispose()
  })

  it('手势解锁成功后播放开机音', async () => {
    const ctx = new FakeAudioContext()
    const engine = makeEngine(ctx)
    await engine.unlock()
    expect(ctx.resumeCalls).toBe(1)
    await engine.play('boot')
    expect(ctx.sources).toHaveLength(1)
    expect(ctx.sources[0]!.started).toBe(1)
    engine.dispose()
  })

  it('重复播放同一槽位复用已解码 buffer(两次事件各一个 source)', async () => {
    const ctx = new FakeAudioContext()
    let t = 0
    const engine = createEngine({
      createContext: () => ctx as unknown as AudioContextLike,
      audioBase: '/test-assets',
      fetchImpl: okSoundFetcher,
      visibility: () => 'visible',
      now: () => t,
    })
    await engine.unlock()
    await engine.play('tool-call')
    t = 500 // 越过节流窗
    await engine.play('tool-call')
    expect(ctx.sources).toHaveLength(2)
    expect(ctx.sources[0]!.buffer).toBe(ctx.sources[1]!.buffer)
    engine.dispose()
  })

  it('dispose 后静默,AudioContext 关闭', async () => {
    const ctx = new FakeAudioContext()
    const engine = makeEngine(ctx)
    await engine.unlock()
    engine.dispose()
    await engine.play('boot')
    expect(ctx.sources).toHaveLength(0)
    expect(ctx.state).toBe('closed')
  })

  it('resume 失败:解锁未成功,不发声不抛错', async () => {
    const ctx = new FakeAudioContext()
    ctx.resumeResult = 'fail'
    const engine = makeEngine(ctx)
    await expect(engine.unlock()).resolves.toBe(false)
    await engine.play('boot')
    expect(ctx.sources).toHaveLength(0)
    engine.dispose()
  })
})

/** IDM 兼容改动后新增:音效走 JSON 封套,失败路径一律无声丢弃、不报错。 */
describe('音效封套(IDM 兼容)', () => {
  function engineWithFetcher(ctx: FakeAudioContext, fetchImpl: SoundFetcher) {
    return createEngine({
      createContext: () => ctx as unknown as AudioContextLike,
      audioBase: '/test-assets',
      fetchImpl,
      visibility: () => 'visible',
    })
  }

  it('请求 URL 不再含 .wav 路径、不再是音频资源形态', async () => {
    const ctx = new FakeAudioContext()
    const seen: string[] = []
    const engine = engineWithFetcher(ctx, async (url) => {
      seen.push(url)
      return okSoundFetcher()
    })
    await engine.unlock()
    await engine.play('boot')
    expect(seen.length).toBeGreaterThan(0)
    for (const url of seen) {
      expect(url).toContain('/test-assets/sound?file=')
      expect(url).not.toContain('/sounds/')
    }
    engine.dispose()
  })

  it('HTTP 非 2xx:不建 source', async () => {
    const ctx = new FakeAudioContext()
    const engine = engineWithFetcher(ctx, async () => ({ ok: false, json: async () => ({ b64: 'AAAAAA==' }) }))
    await engine.unlock()
    await engine.play('boot')
    expect(ctx.sources).toHaveLength(0)
    engine.dispose()
  })

  it('封套缺 b64 字段:不建 source', async () => {
    const ctx = new FakeAudioContext()
    const engine = engineWithFetcher(ctx, async () => ({ ok: true, json: async () => ({}) }))
    await engine.unlock()
    await engine.play('boot')
    expect(ctx.sources).toHaveLength(0)
    engine.dispose()
  })

  it('b64 不是字符串:不建 source', async () => {
    const ctx = new FakeAudioContext()
    const engine = engineWithFetcher(ctx, async () => ({ ok: true, json: async () => ({ b64: 42 }) }))
    await engine.unlock()
    await engine.play('boot')
    expect(ctx.sources).toHaveLength(0)
    engine.dispose()
  })

  it('body 不是对象:不建 source,不抛错', async () => {
    const ctx = new FakeAudioContext()
    const engine = engineWithFetcher(ctx, async () => ({ ok: true, json: async () => null }))
    await engine.unlock()
    await expect(engine.play('boot')).resolves.toBeUndefined()
    expect(ctx.sources).toHaveLength(0)
    engine.dispose()
  })

  it('base64 含非法字符:不建 source,不抛错', async () => {
    const ctx = new FakeAudioContext()
    const engine = engineWithFetcher(ctx, async () => ({ ok: true, json: async () => ({ b64: '!!!!' }) }))
    await engine.unlock()
    await expect(engine.play('boot')).resolves.toBeUndefined()
    expect(ctx.sources).toHaveLength(0)
    engine.dispose()
  })

  it('JSON 解析失败(响应不是 JSON):不建 source,不抛错', async () => {
    const ctx = new FakeAudioContext()
    const engine = engineWithFetcher(ctx, async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON')
      },
    }))
    await engine.unlock()
    await expect(engine.play('boot')).resolves.toBeUndefined()
    expect(ctx.sources).toHaveLength(0)
    engine.dispose()
  })

  it('封套往返:base64 解出的字节原样交给 decodeAudioData', async () => {
    const ctx = new FakeAudioContext()
    const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x01, 0x02, 0x03]) // 'RIFF' + 4
    const engine = engineWithFetcher(ctx, async () => ({ ok: true, json: async () => ({ b64: encodeBase64(wav) }) }))
    await engine.unlock()
    await engine.play('boot')
    expect(ctx.decoded.length).toBeGreaterThan(0)
    for (const buf of ctx.decoded) {
      expect(Array.from(new Uint8Array(buf))).toEqual(Array.from(wav))
    }
    engine.dispose()
  })
})

describe('手势解锁安装', () => {
  it('首次 pointerdown 解锁一次,移除监听后不再触发', async () => {
    const { installUnlock } = await import('../src/client/engine/unlock.ts')
    const target = new EventTarget()
    const unlock = vi.fn(async () => true)
    const remove = installUnlock(target, unlock)
    target.dispatchEvent(new Event('pointerdown'))
    target.dispatchEvent(new Event('pointerdown'))
    await vi.waitFor(() => expect(unlock).toHaveBeenCalledTimes(1))
    remove()
  })

  it('解锁失败(返回 false)时保留监听,下次手势重试', async () => {
    const { installUnlock } = await import('../src/client/engine/unlock.ts')
    const target = new EventTarget()
    let calls = 0
    const unlock = vi.fn(async () => {
      calls++
      return calls > 1
    })
    const remove = installUnlock(target, unlock)
    // 用真实 timer 等 promise 链(含 finally)完全沉降后再发下一次手势,
    // 避免撞上防重入窗口 —— 真实手势间隔远大于该窗口。
    const settle = () => new Promise((resolve) => setTimeout(resolve, 30))
    target.dispatchEvent(new Event('keydown'))
    await settle()
    expect(unlock).toHaveBeenCalledTimes(1)
    target.dispatchEvent(new Event('pointerdown'))
    await settle()
    expect(unlock).toHaveBeenCalledTimes(2)
    target.dispatchEvent(new Event('pointerdown'))
    await settle()
    expect(unlock).toHaveBeenCalledTimes(2)
    remove()
  })
})
