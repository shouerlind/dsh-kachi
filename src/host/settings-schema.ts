/**
 * dsh-kachi 设置 schema(SPEC §6)。host 半注册到 ctx.settings,使
 * client 半的 settingsScope 有可读写的文档层,并把设置呈现在 dsh 的
 * 设置文档里。字段默认值与 shared/settings.ts 的 DEFAULT_SETTINGS 一致。
 */
import Schema from '@deepseek-ai/schemastery'
import { DEFAULT_SETTINGS, SETTINGS_NAMESPACE } from '../shared/settings.ts'

export const KACHI_SETTINGS_NAMESPACE = SETTINGS_NAMESPACE

export const kachiSettingsSchema = Schema.object({
  enabled: Schema.boolean().default(true).description('总开关:一键静音整个插件'),
  masterVolume: Schema.number().min(0).max(100).default(100).description('总音量(0-100,平方映射)'),
  bootSound: Schema.boolean().default(true).description('开机音(每次页面加载播放)'),
  throttleMs: Schema.number().min(0).max(2000).default(200).description('节流时间窗(毫秒)'),
  slotSounds: Schema.dict(Schema.string()).default(DEFAULT_SETTINGS.slotSounds).description('每槽位选音(文件名)'),
  slotVolumes: Schema.dict(Schema.number()).default(DEFAULT_SETTINGS.slotVolumes).description('每槽位音量(0-100)'),
}).description('dsh-kachi Switch 音效')
