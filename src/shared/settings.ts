/** 设置形状(SPEC §6)与默认值。双面共享:host schema 与 client 消费共用。 */
import { DEFAULT_SLOT_SOUNDS, DEFAULT_SLOT_VOLUMES } from './slots.ts'

export const SETTINGS_NAMESPACE = 'dsh-kachi'

export interface KachiSettings {
  /** 总开关:一键静音整个插件。 */
  enabled: boolean
  /** 总音量 0-100(平方映射 master GainNode)。 */
  masterVolume: number
  /** 开机音开关(每次页面加载,含刷新)。 */
  bootSound: boolean
  /** 节流时间窗毫秒(同类同槽位去重)。 */
  throttleMs: number
  /** 每槽位选音:SlotId → 文件名(13 默认或 pack 池内文件名)。 */
  slotSounds: Record<string, string>
  /** 每槽位音量:SlotId → 0-100。 */
  slotVolumes: Record<string, number>
}

export const DEFAULT_SETTINGS: KachiSettings = {
  enabled: true,
  masterVolume: 100,
  bootSound: true,
  throttleMs: 200,
  slotSounds: { ...DEFAULT_SLOT_SOUNDS },
  slotVolumes: { ...DEFAULT_SLOT_VOLUMES },
}
