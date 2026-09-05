import { describe, expect, it, vi } from 'vitest'
import { createEngine, type AudioContextLike } from '../src/client/engine/audio-engine.ts'

/** 最小 fake AudioContext:记录 source 创建/启动与 resume 调用。 */
class FakeAudioContext implements AudioContextLike {
  state: 'suspended' | 'running' | 'closed' = 'suspended'
  destination = { fake: true }
  resumeCalls = 0
  sources: FakeSource[] = []
  resumeResult: 'ok' | 'fail' = 'ok'
  readonly gains: FakeGain[] = []

  async resume(): Promise<void> {
    this.resumeCalls++
    if (this.resumeResult === 'fail') throw new DOMException('denied', 'NotAllowedError')
    this.state = 'running'
  }

  async decodeAudioData(_data: ArrayBuffer): Promise<AudioBuffer> {
    return { duration: 0.1 } as unknown as AudioBuffer
  }

  createBufferSource(): FakeSource {
    const sources = this.sources
    const src = new FakeSource()
    sources.push(src)
    return src
  }

  createGain(): FakeGain {
    const gain = new FakeGain()
    this.gains.push(gain)
    return gain
  }

  async close(): Promise<void> {
    this.state = 'closed'
  }
}

class FakeSource {
  buffer: AudioBuffer | null = null
  connectedTo: unknown = null
  started = 0
  connect(node: unknown): this {
    this.connectedTo = node
    return this
  }
  start(): void {
    this.started++
  }
  stop(): void {}
}

class FakeGain {
  gain = { value: 1 }
  connectedTo: unknown = null
  connect(node: unknown): this {
    this.connectedTo = node
    return this
  }
  disconnect(): void {}
}

function makeEngine(ctx: FakeAudioContext) {
  const engine = createEngine({
    createContext: () => ctx as unknown as AudioContextLike,
    audioBase: '/test-assets',
    fetchImpl: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
  })
  return engine
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
    // boot 事件由 unlock 成功回调之外的调用方触发;这里直接验证事件播放
    await engine.play('boot')
    expect(ctx.sources).toHaveLength(1)
    expect(ctx.sources[0]!.started).toBe(1)
    engine.dispose()
  })

  it('重复播放同一槽位复用已解码 buffer(两次事件各一个 source)', async () => {
    const ctx = new FakeAudioContext()
    const engine = makeEngine(ctx)
    await engine.unlock()
    await engine.play('tool-call')
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
