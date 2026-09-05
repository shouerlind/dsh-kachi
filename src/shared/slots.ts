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
  confirm: 60,
  cancel: 100,
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
}

/** 介入级事件全集 = 后台白名单(CONTEXT.md「重要通知白名单」,变更需显式决议)。 */
export const INTERVENTION_EVENT_IDS: ReadonlySet<EventId> = new Set(
  EVENT_IDS.filter((id) => EVENT_SOUNDS[id].level === 'intervention'),
)

/** 音效文件 URL:host 半注册的 /dsh-kachi 前缀路由。 */
export function soundUrl(file: string, opts?: { pack?: boolean; base?: string }): string {
  const base = opts?.base ?? '/dsh-kachi'
  return opts?.pack ? `${base}/sounds/pack/${file}` : `${base}/sounds/${file}`
}
