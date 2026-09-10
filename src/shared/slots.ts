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

/** 各槽位默认音量:SPEC §5 音量列的槽位主档位(唯一承载层;行级低于主档由事件 volume 微降)。 */
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
  'ui-click',
  'ui-hover',
] as const

export type EventId = (typeof EVENT_IDS)[number]

/**
 * 节流规则种类(SPEC §4):事件行自述它走哪条规则,引擎不再按事件名分类。
 *  - `slot`:按槽位去重,窗口 = 节流窗(setThrottleMs 可调)。
 *  - `event`:按事件各自 50ms 计闸,不受节流窗影响(SPEC §4 例外②:确认槽
 *    与 tool/result 同槽,槽位去重会吞掉快速连点面板的重开确认音)。
 * 单声道打断不在此列 —— 那是槽位级授权(SPEC §4 例外①,MONOPHONIC_SLOTS)。
 */
export type ThrottleKind = 'slot' | 'event'

export interface EventSound {
  slot: SlotId
  level: Level
  volume: number
  throttle: ThrottleKind
}

/**
 * 事件 → 槽位/分级/事件音量/节流规则。音量承载约定(单一承载层):
 * 槽位默认音量承载 SPEC §5 音量列的槽位主档位;事件 volume 仅作
 * 「同槽低于主档」的线性微降(如 tool-result-fail 70 / jobs-completed 60),
 * 与主档一致时恒为 100,不得与槽位叠乘。
 * 同一文件按事件以不同音量复用,音量变体不另建文件。
 */
export const EVENT_SOUNDS: Record<EventId, EventSound> = {
  boot: { slot: 'boot', level: 'foreground', volume: 100, throttle: 'slot' },
  'approval-request': { slot: 'notifyImportant', level: 'intervention', volume: 100, throttle: 'slot' },
  'questions-request': { slot: 'notifyImportant', level: 'intervention', volume: 100, throttle: 'slot' },
  'turn-start': { slot: 'menuMove', level: 'foreground', volume: 100, throttle: 'slot' },
  'user-message': { slot: 'send', level: 'foreground', volume: 100, throttle: 'slot' },
  'turn-end-completed': { slot: 'taskComplete', level: 'intervention', volume: 100, throttle: 'slot' },
  'turn-end-error': { slot: 'error', level: 'intervention', volume: 100, throttle: 'slot' },
  'turn-end-cancelled': { slot: 'cancel', level: 'foreground', volume: 100, throttle: 'slot' },
  'tool-call': { slot: 'button', level: 'foreground', volume: 100, throttle: 'slot' },
  'tool-result-ok': { slot: 'confirm', level: 'foreground', volume: 100, throttle: 'slot' },
  'tool-result-fail': { slot: 'error', level: 'foreground', volume: 70, throttle: 'slot' },
  'session-added': { slot: 'sessionNew', level: 'foreground', volume: 100, throttle: 'slot' },
  'session-removed': { slot: 'sessionClose', level: 'foreground', volume: 100, throttle: 'slot' },
  'session-error': { slot: 'error', level: 'intervention', volume: 100, throttle: 'slot' },
  'jobs-completed': { slot: 'taskComplete', level: 'foreground', volume: 60, throttle: 'slot' },
  'jobs-failed': { slot: 'error', level: 'intervention', volume: 100, throttle: 'slot' },
  reconnecting: { slot: 'warn', level: 'foreground', volume: 100, throttle: 'slot' },
  reconnected: { slot: 'reconnect', level: 'foreground', volume: 100, throttle: 'slot' },
  'own-click': { slot: 'button', level: 'foreground', volume: 100, throttle: 'slot' },
  // composer 交互音(SPEC §5 行 21-24):volume 全 100,档位由槽位默认音量
  // 承接(confirm@80 / menuMove@40 / cancel@90;确认与取消刻意接近但保留
  // 取消略重 —— 用户决议「不要差太大,也要有点差距」)。节流一律按事件
  // 各自计闸(SPEC §4 例外②)。
  'menu-open': { slot: 'confirm', level: 'foreground', volume: 100, throttle: 'event' },
  'menu-move': { slot: 'menuMove', level: 'foreground', volume: 100, throttle: 'event' },
  'menu-item-click': { slot: 'confirm', level: 'foreground', volume: 100, throttle: 'event' },
  'menu-close': { slot: 'cancel', level: 'foreground', volume: 100, throttle: 'event' },
  // 全站按钮泛化(2026-09-08,§5 行 25/26):点击=按键音,悬停/键盘焦点=
  // 菜单移动音;音量由槽位默认档承接(button@30 / menuMove@40)。
  'ui-click': { slot: 'button', level: 'foreground', volume: 100, throttle: 'event' },
  'ui-hover': { slot: 'menuMove', level: 'foreground', volume: 100, throttle: 'event' },
}

/** 槽位当前指向的音效文件(pack = 选自备选池,URL 走 /sounds/pack/ 前缀)。 */
export interface SlotFile {
  file: string
  pack: boolean
}

/**
 * 音效文件 URL:host 半注册的 /dsh-kachi 前缀路由下的 JSON 封套端点
 * (见 sound-envelope.ts:不用 .wav 路径、不用 audio 响应头,免被下载管理器拦截)。
 * 池归属编码进 file 参数(`pack/<name>.wav` 与裸 `<name>.wav`),与
 * host/sound-files.ts 的白名单同源。
 */
export function soundUrl(file: string, opts?: { pack?: boolean; base?: string }): string {
  const base = opts?.base ?? '/dsh-kachi'
  const rel = opts?.pack ? `pack/${file}` : file
  return `${base}/sound?file=${encodeURIComponent(rel)}`
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
 * 单声道槽位(SPEC §4 节流例外①,按槽位授权):menuMove 槽内全部事件
 * (菜单移动音、借用该槽位的回合开始音)不套 200ms 去重,改用固定 50ms
 * 最小间隔,且新响立即打断上一响(不叠加)。
 */
export const MONOPHONIC_SLOTS: ReadonlySet<SlotId> = new Set<SlotId>(['menuMove'])
export const MONOPHONIC_MIN_INTERVAL_MS = 50

/** 按事件计闸的最小间隔(ms):事件行 throttle === 'event' 时各自计闸,不受节流窗影响。 */
export const INTERACTION_MIN_INTERVAL_MS = 50

/** 是否 13 个默认槽位文件之一(根目录);否则视为备选池内文件。 */
export function isDefaultSound(file: string): boolean {
  return (Object.values(DEFAULT_SLOT_SOUNDS) as string[]).includes(file)
}

/**
 * 文件名 → 播放目标。池归属(默认池根目录 / 备选池 pack 子目录)只在这里
 * 判定一次:调用方拿文件名字符串即可,不必各自推导 pack。
 */
export function toSlotFile(file: string): SlotFile {
  return { file, pack: !isDefaultSound(file) }
}
