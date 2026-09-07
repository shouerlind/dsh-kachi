/**
 * 槽位表与事件 → 音效映射(SPEC §5 v3 试听定稿)。
 * 双面共享:client 引擎按此消费,测试按此对账。
 */

/** 13 个 Switch 音效槽位(语义位,CONTEXT.md)。 */
export const SLOT_IDS = [
  'boot',
  'notifyImportant',
  'taskComplete',
  'error',
  'menuMove',
  'send',
  'button',
  'confirm',
  'cancel',
  'sessionNew',
  'sessionClose',
  'reconnect',
  'warn',
] as const

export type SlotId = (typeof SLOT_IDS)[number]

/** 通知分级:介入级(后台也响)/ 前台级(仅页面可见时响)。静默级不接线,不进本表。 */
export type Level = 'intervention' | 'foreground'

/** 各槽位默认音效文件(SPEC §5「默认文件」列;assets/sounds/ 根目录)。 */
export const DEFAULT_SLOT_SOUNDS: Record<SlotId, string> = {
  boot: 'boot.wav',
  notifyImportant: 'notify-important.wav',
  taskComplete: 'task-complete.wav',
  error: 'error.wav',
  menuMove: 'menu-move.wav',
  send: 'send.wav',
  button: 'button.wav',
  confirm: 'confirm.wav',
  cancel: 'cancel.wav',
  sessionNew: 'session-new.wav',
  sessionClose: 'session-close.wav',
  reconnect: 'reconnect.wav',
  warn: 'warn.wav',
}

/** 各槽位默认音量(SPEC §5 音量列;一槽多事件时取主事件档位)。 */
export const DEFAULT_SLOT_VOLUMES: Record<SlotId, number> = {
  boot: 100,
  notifyImportant: 100,
  taskComplete: 100,
  error: 100,
  menuMove: 40,
  send: 100,
  button: 30,
  confirm: 80,
  cancel: 90,
  sessionNew: 100,
  sessionClose: 100,
  reconnect: 100,
  warn: 90,
}

/**
 * 可发声事件 ID。静默级事件(assistant/message、A 层杂项)不在此表 ——
 * 接线层直接不消费它们。
 */
export const EVENT_IDS = [
  'boot',
  'approval-request',
  'questions-request',
  'turn-start',
  'user-message',
  'turn-end-completed',
  'turn-end-error',
  'turn-end-cancelled',
  'tool-call',
  'tool-result-ok',
  'tool-result-fail',
  'session-added',
  'session-removed',
  'session-error',
  'jobs-completed',
  'jobs-failed',
  'reconnecting',
  'reconnected',
  'own-click',
  'menu-open',
  'menu-move',
  'menu-item-click',
  'menu-close',
] as const

export type EventId = (typeof EVENT_IDS)[number]

/** 事件 → 槽位/分级/事件音量(同一文件按事件以不同音量复用,音量变体不另建文件)。 */
export const EVENT_SOUNDS: Record<EventId, { slot: SlotId; level: Level; volume: number }> = {
  boot: { slot: 'boot', level: 'foreground', volume: 100 },
  'approval-request': { slot: 'notifyImportant', level: 'intervention', volume: 100 },
  'questions-request': { slot: 'notifyImportant', level: 'intervention', volume: 100 },
  'turn-start': { slot: 'menuMove', level: 'foreground', volume: 100 },
  'user-message': { slot: 'send', level: 'foreground', volume: 100 },
  'turn-end-completed': { slot: 'taskComplete', level: 'intervention', volume: 100 },
  'turn-end-error': { slot: 'error', level: 'intervention', volume: 100 },
  'turn-end-cancelled': { slot: 'cancel', level: 'foreground', volume: 100 },
  'tool-call': { slot: 'button', level: 'foreground', volume: 30 },
  'tool-result-ok': { slot: 'confirm', level: 'foreground', volume: 60 },
  'tool-result-fail': { slot: 'error', level: 'foreground', volume: 70 },
  'session-added': { slot: 'sessionNew', level: 'foreground', volume: 100 },
  'session-removed': { slot: 'sessionClose', level: 'foreground', volume: 100 },
  'session-error': { slot: 'error', level: 'intervention', volume: 100 },
  'jobs-completed': { slot: 'taskComplete', level: 'foreground', volume: 60 },
  'jobs-failed': { slot: 'error', level: 'intervention', volume: 100 },
  reconnecting: { slot: 'warn', level: 'foreground', volume: 100 },
  reconnected: { slot: 'reconnect', level: 'foreground', volume: 100 },
  'own-click': { slot: 'button', level: 'foreground', volume: 100 },
  // composer 交互音(SPEC §5 行 21-24):volume 全 100,档位由槽位默认音量
  // 承接(confirm@80 / menuMove@40 / cancel@90;确认与取消刻意接近但保留
  // 取消略重 —— 用户决议「不要差太大,也要有点差距」)。
  'menu-open': { slot: 'confirm', level: 'foreground', volume: 100 },
  'menu-move': { slot: 'menuMove', level: 'foreground', volume: 100 },
  'menu-item-click': { slot: 'confirm', level: 'foreground', volume: 100 },
  'menu-close': { slot: 'cancel', level: 'foreground', volume: 100 },
}

/**
 * 介入级事件白名单 = 后台可发声的固定清单(CONTEXT.md「重要通知白名单」,
 * 变更需显式决议)。字面量固定清单,不随 level 字段自动派生。
 * 语义四类:审批请求、agent 提问、回合错误(回合/会话/作业失败)、任务完成。
 */
export const INTERVENTION_EVENT_IDS: ReadonlySet<EventId> = new Set<EventId>([
  'approval-request',
  'questions-request',
  'turn-end-completed',
  'turn-end-error',
  'session-error',
  'jobs-failed',
])

/** 音效文件 URL:host 半注册的 /dsh-kachi 前缀路由。 */
export function soundUrl(file: string, opts?: { pack?: boolean; base?: string }): string {
  const base = opts?.base ?? '/dsh-kachi'
  return opts?.pack ? `${base}/sounds/pack/${file}` : `${base}/sounds/${file}`
}

/** 槽位中文标签(设置页 UI)。 */
export const SLOT_LABELS: Record<SlotId, string> = {
  boot: '开机音',
  notifyImportant: '通知重要音',
  taskComplete: '任务完成音',
  error: '错误音',
  menuMove: '菜单移动音',
  send: '发送音',
  button: '按键音',
  confirm: '确认音',
  cancel: '取消音',
  sessionNew: '新建音',
  sessionClose: '关闭音',
  reconnect: '恢复音',
  warn: '警示音',
}

/**
 * 交互音事件(SPEC §5 行 21-24):绕开槽位 200ms 去重(那是给工具调用高频
 * 事件设计的,会吞掉快速连点面板的重开确认音),引擎按事件 50ms 最小间隔
 * 放行。菜单移动音另享单声道打断(引擎 MONOPHONIC_SLOTS)。
 */
export const INTERACTION_EVENT_IDS: ReadonlySet<EventId> = new Set<EventId>([
  'menu-open',
  'menu-move',
  'menu-item-click',
  'menu-close',
])

/** 是否 13 个默认槽位文件之一(根目录);否则视为 pack 池内文件。 */
export function isDefaultSound(file: string): boolean {
  return (Object.values(DEFAULT_SLOT_SOUNDS) as string[]).includes(file)
}
