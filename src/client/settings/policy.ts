/**
 * 设置应用策略(SPEC §6):把 KachiSettings 快照应用到引擎。
 * 纯逻辑 —— 引擎以最小接口注入,便于测试与解耦。
 */
import type { KachiSettings } from '../../shared/settings.ts'
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

/**
 * applyKachiSettings 消费的字段:从 KachiSettings 取子集(Pick),不另立形状 ——
 * 字段改名会在此编译报错,不会留下悄悄漂移的第二份声明。
 */
export type KachiSettingsLike = Pick<
  KachiSettings,
  'enabled' | 'masterVolume' | 'throttleMs' | 'slotSounds' | 'slotVolumes'
>

/**
 * 设置字段消费登记:每个字段必须说明谁消费它。类型是穷尽的 Record<keyof
 * KachiSettings, ...> —— 给 KachiSettings 加字段而不在此登记,编译就红,
 * 逼出「这个新设置到底有没有接线」的显式决议。
 */
export const SETTINGS_CONSUMPTION: Record<keyof KachiSettings, string> = {
  enabled: 'applyKachiSettings + shouldPlayBoot',
  masterVolume: 'applyKachiSettings',
  bootSound: 'shouldPlayBoot',
  throttleMs: 'applyKachiSettings',
  slotSounds: 'applyKachiSettings',
  slotVolumes: 'applyKachiSettings',
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
