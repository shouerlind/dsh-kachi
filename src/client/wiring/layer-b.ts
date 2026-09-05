/**
 * B 层接线(SPEC §3.2):会话日志(journal)实时事件 → 音效。
 * 0.1.2-rc.1 中 journal 经 ctx.sessions.binding(id).eventSource 暴露
 * (ObservableSnapshot<SessionEventWindow>);本模块按会话订阅,对
 * append 变更逐条 seq 门控后映射发声 —— replace(基线/重连重放)与
 * prepend(翻页)只推进基线不响,杜绝页面加载与重连时的历史回放。
 * 审批请求经 journal 审计事件 approval/asked(该版本无 $on 转发)。
 */
import type { EventId } from '../../shared/slots.ts'
import type { Engine } from '../engine/audio-engine.ts'
import { trackSessions, type SessionBindingLike, type SessionsLike } from './sessions-tracker.ts'

/** journal 事件的最小消费面(SessionEvent 的结构子集)。 */
export interface JournalEventLike {
  readonly type: string
  readonly seq: number
  readonly data?: {
    readonly turn?: unknown
    readonly step?: unknown
    readonly reason?: {
      readonly kind?: string
      readonly reason?: { readonly kind?: string } & Record<string, unknown>
      readonly error?: unknown
    }
    readonly error?: unknown
    readonly source?: { readonly kind?: string } & Record<string, unknown>
    [key: string]: unknown
  }
}

/** SessionEventLikeEntry 的最小消费面(type:'event' 才携带 journal 事件)。 */
export type EventEntryLike = { readonly type: string; readonly event?: JournalEventLike }

export interface EventSourceLike {
  /** 会话窗口未开(open 前)返回 undefined;否则 change 必有。 */
  getSnapshot():
    | { change: { kind: 'replace' | 'prepend' | 'append'; entries: ReadonlyArray<EventEntryLike> } }
    | undefined
  subscribe(listener: () => void): () => void
}

export interface JournalBindingLike extends SessionBindingLike {
  readonly eventSource: EventSourceLike
}

/**
 * journal 事件 → 映射事件(SPEC §5 行 4-11、19)。
 * turn/end 按 reason.kind 分级;aborted 仅用户手动取消(kind==='user')发声;
 * user/message 仅人类输入(source.kind==='user')发声;其余静默。
 */
export function journalToEvent(event: JournalEventLike): EventId | undefined {
  switch (event.type) {
    case 'turn/start':
      return 'turn-start'
    case 'turn/end': {
      const reason = event.data?.reason
      switch (reason?.kind) {
        case 'completed':
          return 'turn-end-completed'
        case 'error':
        case 'max-tokens':
          return 'turn-end-error'
        case 'aborted':
          return reason.reason?.kind === 'user' ? 'turn-end-cancelled' : undefined
        default:
          return undefined // blocked / interrupted / 未知
      }
    }
    case 'tool/call':
      return 'tool-call'
    case 'tool/result':
      return event.data?.error !== undefined ? 'tool-result-fail' : 'tool-result-ok'
    case 'user/message':
      return event.data?.source?.kind === 'user' ? 'user-message' : undefined
    case 'approval/asked':
      // 审批请求的 log-only 审计事件(0.1.2-rc.1 无 approval/request 的 $on 转发)。
      return 'approval-request'
    default:
      return undefined // assistant/*、step/*、request/* 等静默(SPEC 行 19/20)
  }
}

export function wireLayerB(sessions: SessionsLike<JournalBindingLike>, engine: Pick<Engine, 'play'>): () => void {
  const cleanups = new Map<string, () => void>()

  const disposeTracker = trackSessions(sessions, {
    onAdded(binding) {
      const source = binding.eventSource
      let lastSeq = -1
      let primed = false
      const push = (): void => {
        const snapshot = source.getSnapshot()
        if (snapshot === undefined) {
          primed = true
          return
        }
        const { kind, entries } = snapshot.change
        if (kind === 'replace') {
          // 基线或重连重放:仅推进基线,不响。
          for (const entry of entries) {
            if (entry.type !== 'event' || entry.event === undefined) continue
            lastSeq = Math.max(lastSeq, entry.event.seq)
          }
          primed = true
          return
        }
        if (kind !== 'append') {
          primed = true // prepend(翻页):历史,忽略
          return
        }
        for (const entry of entries) {
          if (entry.type !== 'event' || entry.event === undefined) continue
          const seq = entry.event.seq
          if (seq <= lastSeq) continue
          lastSeq = seq
          if (!primed) continue
          const event = journalToEvent(entry.event)
          if (event !== undefined) void engine.play(event)
        }
        primed = true
      }
      const detach = source.subscribe(push)
      push() // 首快照:建立 seq 基线,不响
      cleanups.set(binding.sessionId, () => {
        detach()
      })
    },
    onRemoved(sessionId) {
      cleanups.get(sessionId)?.()
      cleanups.delete(sessionId)
    },
  })

  return () => {
    disposeTracker()
    for (const cleanup of cleanups.values()) cleanup()
    cleanups.clear()
  }
}
