/**
 * 设置应用策略(SPEC §6):把 KachiSettings 快照应用到引擎。
 * 纯逻辑 —— 引擎以最小接口注入,便于测试与解耦。
 */
import { SLOT_IDS } from '../../shared/slots.ts'

export interface EngineSettingsApi {
  setEnabled(enabled: boolean): void
  setMasterVolume(percent: number): void
  setThrottleMs(ms: number): void
  setSlotVolume(slot: string, percent: number): void
  setSlotSound(slot: string, file: string): void
  /** 槽位当前指向的文件名(避免重复下发选音);未知返回 undefined。 */
  currentFile(slot: string): string | undefined
}

export type KachiSettingsLike = {
  enabled: boolean
  masterVolume: number
  throttleMs: number
  slotSounds: Record<string, string>
  slotVolumes: Record<string, number>
}

export function applyKachiSettings(settings: KachiSettingsLike, target: EngineSettingsApi): void {
  target.setEnabled(settings.enabled)
  target.setMasterVolume(settings.masterVolume)
  target.setThrottleMs(settings.throttleMs)
  for (const slot of SLOT_IDS) {
    const volume = settings.slotVolumes[slot]
    if (volume !== undefined) target.setSlotVolume(slot, volume)
    const file = settings.slotSounds[slot]
    if (file !== undefined && file !== target.currentFile(slot)) target.setSlotSound(slot, file)
  }
}

/** 开机音播放条件(SPEC §4:设置可关;总开关关闭时全静音)。 */
export function shouldPlayBoot(settings: { enabled: boolean; bootSound: boolean }): boolean {
  return settings.enabled && settings.bootSound
}
