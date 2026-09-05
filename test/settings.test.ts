import { describe, expect, it, vi } from 'vitest'
import { createEngine, type AudioContextLike, volumeGain } from '../src/client/engine/audio-engine.ts'
import { applyKachiSettings, shouldPlayBoot } from '../src/client/settings/policy.ts'
import { DEFAULT_SETTINGS, SETTINGS_NAMESPACE } from '../src/shared/settings.ts'
import { DEFAULT_SLOT_SOUNDS } from '../src/shared/slots.ts'
import { FakeAudioContext, FakeGain, FakeSource } from './fakes.ts'

describe('共享设置形状(工单 #13/#14)', () => {
  it('namespace 与默认值与 SPEC §5/§6 一致', () => {
    expect(SETTINGS_NAMESPACE).toBe('dsh-kachi')
    expect(DEFAULT_SETTINGS.enabled).toBe(true)
    expect(DEFAULT_SETTINGS.masterVolume).toBe(100)
    expect(DEFAULT_SETTINGS.bootSound).toBe(true)
    expect(DEFAULT_SETTINGS.throttleMs).toBe(200)
    expect(DEFAULT_SETTINGS.slotSounds).toEqual({ ...DEFAULT_SLOT_SOUNDS })
    for (const slot of Object.keys(DEFAULT_SLOT_SOUNDS)) {
      expect(DEFAULT_SETTINGS.slotVolumes[slot]).toBeGreaterThan(0)
    }
  })
})

describe('引擎:总开关与试听(工单 #13/#14)', () => {
  function makeEngine(ctx: FakeAudioContext) {
    return createEngine({
      createContext: () => ctx as unknown as AudioContextLike,
      audioBase: '/t',
      fetchImpl: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
      visibility: () => 'visible',
      now: () => 0,
    })
  }

  it('setEnabled(false) 后事件静默,恢复后发声', async () => {
    const ctx = new FakeAudioContext()
    const engine = makeEngine(ctx)
    await engine.unlock()
    engine.setEnabled(false)
    await engine.play('boot')
    expect(ctx.sources).toHaveLength(0)
    engine.setEnabled(true)
    await engine.play('boot')
    expect(ctx.sources).toHaveLength(1)
    engine.dispose()
  })

  it('preview 绕过总开关/后台/节流,直连 master 总线', async () => {
    const ctx = new FakeAudioContext()
    let t = 0
    const engine = createEngine({
      createContext: () => ctx as unknown as AudioContextLike,
      audioBase: '/t',
      fetchImpl: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
      visibility: () => 'hidden',
      now: () => t,
    })
    await engine.unlock()
    engine.setEnabled(false)
    await engine.preview({ file: 'SeNewsBad.wav', pack: true })
    expect(ctx.sources).toHaveLength(1)
    expect((ctx.sources[0] as FakeSource).connectedTo).toBe(ctx.gains[0]) // master
    t = 0
    await engine.preview({ file: 'SeNewsBad.wav', pack: true })
    expect(ctx.sources).toHaveLength(2)
    engine.dispose()
  })
})

describe('设置应用策略(工单 #13/#14)', () => {
  it('把 enabled/master/throttle 与槽位音量、选音应用到引擎', () => {
    const calls: string[] = []
    const target = {
      setEnabled: (v: boolean) => calls.push(`enabled:${v}`),
      setMasterVolume: (v: number) => calls.push(`master:${v}`),
      setThrottleMs: (v: number) => calls.push(`throttle:${v}`),
      setSlotVolume: (s: string, v: number) => calls.push(`slotVol:${s}:${v}`),
      setSlotSound: (s: string, f: string) => calls.push(`slotSnd:${s}:${f}`),
      currentFile: () => undefined,
    }
    applyKachiSettings(
      {
        ...DEFAULT_SETTINGS,
        enabled: false,
        masterVolume: 50,
        throttleMs: 350,
        slotVolumes: { ...DEFAULT_SETTINGS.slotVolumes, button: 15 },
        slotSounds: { ...DEFAULT_SETTINGS.slotSounds, error: 'SeNewsBad.wav' },
      },
      target,
    )
    expect(calls).toContain('enabled:false')
    expect(calls).toContain('master:50')
    expect(calls).toContain('throttle:350')
    expect(calls).toContain('slotVol:button:15')
    expect(calls).toContain('slotSnd:error:SeNewsBad.wav')
  })

  it('未变更的默认选音不重复下发', () => {
    const setSound = vi.fn()
    applyKachiSettings(DEFAULT_SETTINGS, {
      setEnabled: () => {},
      setMasterVolume: () => {},
      setThrottleMs: () => {},
      setSlotVolume: () => {},
      setSlotSound: setSound,
      currentFile: (slot) => DEFAULT_SLOT_SOUNDS[slot as keyof typeof DEFAULT_SLOT_SOUNDS],
    })
    expect(setSound).not.toHaveBeenCalled()
  })

  it('开机音条件 = enabled && bootSound', () => {
    expect(shouldPlayBoot({ ...DEFAULT_SETTINGS })).toBe(true)
    expect(shouldPlayBoot({ ...DEFAULT_SETTINGS, bootSound: false })).toBe(false)
    expect(shouldPlayBoot({ ...DEFAULT_SETTINGS, enabled: false })).toBe(false)
  })
})

describe('音量映射', () => {
  it('volumeGain 平方映射并夹取 0-100', () => {
    expect(volumeGain(100)).toBe(1)
    expect(volumeGain(50)).toBeCloseTo(0.25)
    expect(volumeGain(0)).toBe(0)
    expect(volumeGain(150)).toBe(1)
    expect(volumeGain(-5)).toBe(0)
    expect(new FakeGain().gain.value).toBe(1)
  })
})
