import { describe, expect, it, vi } from 'vitest'
import { createEngine, type AudioContextLike } from '../src/client/engine/audio-engine.ts'
import { FakeAudioContext } from './fakes.ts'

function makeEngine(ctx: FakeAudioContext) {
  return createEngine({
    createContext: () => ctx as unknown as AudioContextLike,
    audioBase: '/test-assets',
    fetchImpl: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
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
      fetchImpl: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
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
