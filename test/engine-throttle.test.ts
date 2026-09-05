import { describe, expect, it } from 'vitest'
import { createEngine, type AudioContextLike } from '../src/client/engine/audio-engine.ts'
import { FakeAudioContext } from './fakes.ts'

function makeEngine(ctx: FakeAudioContext, opts?: { now?: () => number }) {
  const clock = (): number => 0
  return createEngine({
    createContext: () => ctx as unknown as AudioContextLike,
    audioBase: '/t',
    fetchImpl: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
    visibility: () => 'visible',
    ...(opts?.now !== undefined ? { now: opts.now } : {}),
  })
}

describe('节流(工单 #11:同类音效时间窗去重)', () => {
  it('默认 200ms 内同槽位第二次播放被丢弃', async () => {
    const ctx = new FakeAudioContext()
    let t = 0
    const engine = makeEngine(ctx, { now: () => t })
    await engine.unlock()
    await engine.play('tool-call')
    t = 100
    await engine.play('tool-call')
    expect(ctx.sources).toHaveLength(1)
    t = 300
    await engine.play('tool-call')
    expect(ctx.sources).toHaveLength(2)
    engine.dispose()
  })

  it('节流按槽位独立:同窗口内不同槽位互不影响', async () => {
    const ctx = new FakeAudioContext()
    let t = 0
    const engine = makeEngine(ctx, { now: () => t })
    await engine.unlock()
    await engine.play('tool-call')
    await engine.play('tool-result-ok')
    expect(ctx.sources).toHaveLength(2)
    engine.dispose()
  })

  it('setThrottleMs(0) 关闭节流', async () => {
    const ctx = new FakeAudioContext()
    let t = 0
    const engine = makeEngine(ctx, { now: () => t })
    await engine.unlock()
    engine.setThrottleMs(0)
    await engine.play('tool-call')
    await engine.play('tool-call')
    await engine.play('tool-call')
    expect(ctx.sources).toHaveLength(3)
    engine.dispose()
  })

  it('setThrottleMs 实时生效(调大后窗口内静默)', async () => {
    const ctx = new FakeAudioContext()
    let t = 0
    const engine = makeEngine(ctx, { now: () => t })
    await engine.unlock()
    await engine.play('tool-call')
    engine.setThrottleMs(1000)
    t = 500
    await engine.play('tool-call')
    expect(ctx.sources).toHaveLength(1)
    t = 1600
    await engine.play('tool-call')
    expect(ctx.sources).toHaveLength(2)
    engine.dispose()
  })

  it('boot 音不受影响(解锁即播,距上次同槽远)', async () => {
    const ctx = new FakeAudioContext()
    let t = 0
    const engine = makeEngine(ctx, { now: () => t })
    await engine.unlock()
    await engine.play('boot')
    t = 50
    await engine.play('boot')
    expect(ctx.sources).toHaveLength(1)
    engine.dispose()
  })
})
