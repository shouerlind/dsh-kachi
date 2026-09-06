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

describe('单声道槽位(SPEC §4 交互例外:菜单移动音 50ms + 打断)', () => {
  it('50ms 最小间隔:窗口内丢弃,窗外放行', async () => {
    const ctx = new FakeAudioContext()
    let t = 0
    const engine = makeEngine(ctx, { now: () => t })
    await engine.unlock()
    await engine.play('menu-move')
    t = 30
    await engine.play('menu-move')
    expect(ctx.sources).toHaveLength(1)
    t = 60
    await engine.play('menu-move')
    expect(ctx.sources).toHaveLength(2)
    engine.dispose()
  })

  it('不随 setThrottleMs 变化(调大后 50ms 窗外仍放行)', async () => {
    const ctx = new FakeAudioContext()
    let t = 0
    const engine = makeEngine(ctx, { now: () => t })
    await engine.unlock()
    engine.setThrottleMs(1000)
    await engine.play('menu-move')
    t = 100
    await engine.play('menu-move')
    expect(ctx.sources).toHaveLength(2)
    engine.dispose()
  })

  it('新响打断上一响:单声道不叠加', async () => {
    const ctx = new FakeAudioContext()
    let t = 0
    const engine = makeEngine(ctx, { now: () => t })
    await engine.unlock()
    await engine.play('menu-move')
    t = 100
    await engine.play('menu-move')
    expect(ctx.sources).toHaveLength(2)
    expect(ctx.sources[0]!.stopped).toBe(1)
    expect(ctx.sources[1]!.stopped).toBe(0)
    engine.dispose()
  })

  it('turn-start 共享该槽位:连发也走 50ms 闸而非 200ms 去重', async () => {
    const ctx = new FakeAudioContext()
    let t = 0
    const engine = makeEngine(ctx, { now: () => t })
    await engine.unlock()
    await engine.play('turn-start')
    t = 100
    await engine.play('turn-start') // <200ms 但 ≥50ms → 放行(旧行为会去重丢弃)
    expect(ctx.sources).toHaveLength(2)
    engine.dispose()
  })
})

describe('交互音事件闸(SPEC §5.1:绕开槽位 200ms 去重,按事件 50ms)', () => {
  it('100ms 后重开面板:确认音放行(槽位去重会吞掉它)', async () => {
    const ctx = new FakeAudioContext()
    let t = 0
    const engine = makeEngine(ctx, { now: () => t })
    await engine.unlock()
    await engine.play('menu-open')
    t = 100
    await engine.play('menu-open')
    expect(ctx.sources).toHaveLength(2)
    engine.dispose()
  })

  it('50ms 内连点仍被闸掉', async () => {
    const ctx = new FakeAudioContext()
    let t = 0
    const engine = makeEngine(ctx, { now: () => t })
    await engine.unlock()
    await engine.play('menu-open')
    t = 30
    await engine.play('menu-open')
    expect(ctx.sources).toHaveLength(1)
    engine.dispose()
  })

  it('同槽不同事件各自计闸:选项点击后紧接重开,两声都响', async () => {
    const ctx = new FakeAudioContext()
    let t = 0
    const engine = makeEngine(ctx, { now: () => t })
    await engine.unlock()
    await engine.play('menu-item-click')
    t = 100
    await engine.play('menu-open')
    expect(ctx.sources).toHaveLength(2)
    engine.dispose()
  })

  it('setThrottleMs 调大不影响交互音事件闸', async () => {
    const ctx = new FakeAudioContext()
    let t = 0
    const engine = makeEngine(ctx, { now: () => t })
    await engine.unlock()
    engine.setThrottleMs(5000)
    await engine.play('menu-close')
    t = 100
    await engine.play('menu-close')
    expect(ctx.sources).toHaveLength(2)
    engine.dispose()
  })
})
