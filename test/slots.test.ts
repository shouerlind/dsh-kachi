import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SLOT_SOUNDS,
  DEFAULT_SLOT_VOLUMES,
  EVENT_SOUNDS,
  INTERVENTION_EVENT_IDS,
  SLOT_IDS,
  soundUrl,
} from '../src/shared/slots.ts'

describe('槽位表', () => {
  it('恰好 13 个槽位,无重复', () => {
    expect(SLOT_IDS).toHaveLength(13)
    expect(new Set(SLOT_IDS).size).toBe(13)
  })

  it('每个槽位都有默认文件与 0-100 的默认音量', () => {
    for (const slot of SLOT_IDS) {
      expect(DEFAULT_SLOT_SOUNDS[slot]).toMatch(/\.wav$/)
      const vol = DEFAULT_SLOT_VOLUMES[slot]
      expect(vol).toBeGreaterThan(0)
      expect(vol).toBeLessThanOrEqual(100)
    }
  })

  it('默认槽位音量与 SPEC §5 一致(主事件档位)', () => {
    expect(DEFAULT_SLOT_VOLUMES.menuMove).toBe(40)
    expect(DEFAULT_SLOT_VOLUMES.button).toBe(30)
    // 确认/取消接近但保留取消略重(用户决议:不要差太大,也要有点差距)。
    expect(DEFAULT_SLOT_VOLUMES.confirm).toBe(80)
    expect(DEFAULT_SLOT_VOLUMES.cancel).toBe(90)
    expect(DEFAULT_SLOT_VOLUMES.warn).toBe(90)
    expect(DEFAULT_SLOT_VOLUMES.taskComplete).toBe(100)
    expect(DEFAULT_SLOT_VOLUMES.error).toBe(100)
    expect(DEFAULT_SLOT_VOLUMES.boot).toBe(100)
  })
})

describe('事件 → 音效映射(SPEC §5)', () => {
  it('工具三音档位:主档由槽位承载,行级微降走事件系数(单一承载层)', () => {
    // tool-call 30% / tool-result-ok 80%:槽位主档已承载,事件系数恒 100;
    // tool-result-fail 70%:error 槽主档 100,行级低于主档走事件系数微降。
    expect(EVENT_SOUNDS['tool-call']).toMatchObject({ slot: 'button', volume: 100, level: 'foreground' })
    expect(DEFAULT_SLOT_VOLUMES.button).toBe(30)
    expect(EVENT_SOUNDS['tool-result-ok']).toMatchObject({ slot: 'confirm', volume: 100, level: 'foreground' })
    expect(DEFAULT_SLOT_VOLUMES.confirm).toBe(80)
    expect(EVENT_SOUNDS['tool-result-fail']).toMatchObject({ slot: 'error', volume: 70, level: 'foreground' })
    expect(DEFAULT_SLOT_VOLUMES.error).toBe(100)
  })

  it('介入级白名单 = 全部介入级事件:审批请求、agent 提问、回合错误(回合/会话/作业)、任务完成', () => {
    // 白名单四类是语义概括;事件面实例以 SPEC §5 各行「介入」标记为准。
    // 作业失败归入错误语义类(SPEC §5 行 15 介入级)。
    expect([...INTERVENTION_EVENT_IDS].sort()).toEqual(
      [
        'approval-request',
        'jobs-failed',
        'questions-request',
        'session-error',
        'turn-end-completed',
        'turn-end-error',
      ].sort(),
    )
  })

  it('回合完成是介入级,手动取消是前台级', () => {
    expect(EVENT_SOUNDS['turn-end-completed']).toMatchObject({ slot: 'taskComplete', level: 'intervention', volume: 100 })
    expect(EVENT_SOUNDS['turn-end-cancelled']).toMatchObject({ slot: 'cancel', level: 'foreground', volume: 100 })
  })

  it('后台作业完成是前台级 @60,失败是介入级 @100', () => {
    expect(EVENT_SOUNDS['jobs-completed']).toMatchObject({ slot: 'taskComplete', level: 'foreground', volume: 60 })
    expect(EVENT_SOUNDS['jobs-failed']).toMatchObject({ slot: 'error', level: 'intervention', volume: 100 })
  })

  it('所有事件的音量都在 1-100,槽位都在槽位表内', () => {
    for (const [id, mapping] of Object.entries(EVENT_SOUNDS)) {
      expect(SLOT_IDS, `event ${id}`).toContain(mapping.slot)
      expect(mapping.volume, `event ${id}`).toBeGreaterThanOrEqual(1)
      expect(mapping.volume, `event ${id}`).toBeLessThanOrEqual(100)
      expect(['intervention', 'foreground'], `event ${id}`).toContain(mapping.level)
    }
  })

  it('断线警示音量由 warn 槽默认承载 @90,重连恢复 @100', () => {
    expect(EVENT_SOUNDS.reconnecting).toMatchObject({ slot: 'warn', volume: 100 })
    expect(DEFAULT_SLOT_VOLUMES.warn).toBe(90)
    expect(EVENT_SOUNDS.reconnected).toMatchObject({ slot: 'reconnect', volume: 100 })
  })
})

describe('soundUrl', () => {
  it('默认文件走根目录,pack 文件走 pack 子目录', () => {
    expect(soundUrl('boot.wav')).toBe('/dsh-kachi/sounds/boot.wav')
    expect(soundUrl('SeNewsBad.wav', { pack: true })).toBe('/dsh-kachi/sounds/pack/SeNewsBad.wav')
  })
})
