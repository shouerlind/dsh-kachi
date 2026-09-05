import { describe, expect, it } from 'vitest'
import { createEngine, type AudioContextLike, type SourceNodeLike } from '../src/client/engine/audio-engine.ts'
import { FakeAudioContext, FakeGain, FakeSource } from './fakes.ts'

export { FakeAudioContext, FakeGain, FakeSource }

function makeEngine(ctx: FakeAudioContext, opts?: { visibility?: 'visible' | 'hidden' }) {
  return createEngine({
    createContext: () => ctx as unknown as AudioContextLike,
    audioBase: '/test-assets',
    fetchImpl: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
    visibility: () => opts?.visibility ?? 'visible',
  })
}

describe('引擎完整化:两级 GainNode 总线(工单 #10)', () => {
  it('创建 master GainNode 与 13 个槽位 GainNode,均接到总线上', async () => {
    const ctx = new FakeAudioContext()
    const engine = makeEngine(ctx)
    await engine.unlock()
    expect(ctx.gains.length).toBe(1 + 13)
    engine.dispose()
  })

  it('总音量平方映射:setMasterVolume(50) → master.gain = 0.25', async () => {
    const ctx = new FakeAudioContext()
    const engine = makeEngine(ctx)
    engine.setMasterVolume(50)
    expect(ctx.gains[0]!.gain.value).toBeCloseTo(0.25)
    engine.dispose()
  })

  it('槽位音量平方映射:setSlotVolume(button, 30) → 该槽 gain = 0.09', async () => {
    const ctx = new FakeAudioContext()
    const engine = makeEngine(ctx)
    await engine.unlock()
    engine.setSlotVolume('button', 30)
    await engine.play('tool-call')
    const slotGain = ctx.sources[0]!.connectedTo as FakeGain
    expect(slotGain.gain.value).toBeCloseTo(0.09)
    engine.dispose()
  })

  it('播放路径 source → slotGain → master → destination', async () => {
    const ctx = new FakeAudioContext()
    const engine = makeEngine(ctx)
    await engine.unlock()
    await engine.play('boot')
    const source = ctx.sources[0] as FakeSource
    const slotGain = source.connectedTo as FakeGain
    const master = slotGain.connectedTo as FakeGain
    expect(slotGain).not.toBe(master)
    expect(master).toBe(ctx.gains[0])
    expect(master.connectedTo).toBe(ctx.destination)
    engine.dispose()
  })

  it('启动即预解码 13 个默认音效(事件到达时零解码延迟)', async () => {
    const ctx = new FakeAudioContext()
    let fetched = 0
    const engine = createEngine({
      createContext: () => ctx as unknown as AudioContextLike,
      audioBase: '/t',
      fetchImpl: async () => {
        fetched++
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }
      },
    })
    // 预解码是后台任务,稍等其完成
    await new Promise((r) => setTimeout(r, 30))
    expect(fetched).toBe(13)
    engine.dispose()
  })
})

describe('后台策略(Page Visibility,工单 #10)', () => {
  it('hidden 时前台级事件静默,介入级照常发声', async () => {
    const ctx = new FakeAudioContext()
    const engine = makeEngine(ctx, { visibility: 'hidden' })
    await engine.unlock()
    await engine.play('tool-call') // 前台级 → 丢弃
    expect(ctx.sources).toHaveLength(0)
    await engine.play('approval-request') // 介入级 → 发声
    expect(ctx.sources).toHaveLength(1)
    engine.dispose()
  })

  it('visible 时全部发声', async () => {
    const ctx = new FakeAudioContext()
    const engine = makeEngine(ctx, { visibility: 'visible' })
    await engine.unlock()
    await engine.play('tool-call')
    await engine.play('approval-request')
    expect(ctx.sources).toHaveLength(2)
    engine.dispose()
  })
})

describe('source 节点生命周期', () => {
  it('并发事件各建各的 source,互不打断', async () => {
    const ctx = new FakeAudioContext()
    const engine = makeEngine(ctx)
    await engine.unlock()
    await Promise.all([engine.play('approval-request'), engine.play('session-added'), engine.play('boot')])
    expect(ctx.sources).toHaveLength(3)
    expect(new Set(ctx.sources.map((s) => (s as SourceNodeLike).buffer)).size).toBe(3)
    engine.dispose()
  })
})
