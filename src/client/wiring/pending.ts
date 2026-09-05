/**
 * 审批/提问音接线(0.1.2-rc.1 通路):审批与提问在运行时以 pending
 * interaction(mux 帧 approval/requested、question/requested)到达,镜像在
 * 每个会话 chat 快照的 `pending` 列表里(官方 ui-approval/ui-user-questions
 * 即渲染它)。本模块对每个会话的 chat target 订阅快照,按 wait.key 去重,
 * 新到达的 approval/question 各播放通知重要音;plan-review 在白名单外,静默。
 *
 * 去重契约:接线时的首个快照视为基线(页面加载时已挂起的旧请求不响);
 * 之后每个新 key 恰响一次 —— 断线重连的 baseline 重放按 key 幂等。
 */
import type { Engine } from '../engine/audio-engine.ts'
import { trackSessions, type SessionBindingLike, type SessionsLike } from './sessions-tracker.ts'

export interface ChatTargetLike {
  getSnapshot(): { pending?: ReadonlyArray<{ key: string; kind: string }> } | undefined
  subscribe(listener: () => void): () => void
}

export interface UiConversationLike {
  /** 参数放宽为 unknown:真实现接受 SessionId | SessionBinding,这里只传 binding 对象。 */
  binding(source: unknown): {
    target(name: 'chat'): ChatTargetLike | undefined
  }
}

/** pending kind → 映射事件;白名单外返回 undefined(静默)。 */
function pendingEvent(kind: string): 'approval-request' | 'questions-request' | undefined {
  if (kind === 'approval') return 'approval-request'
  if (kind === 'question') return 'questions-request'
  return undefined
}

export function wirePending(sessions: SessionsLike, uiConversation: UiConversationLike, engine: Engine): () => void {
  const cleanups = new Map<string, () => void>()

  const disposeTracker = trackSessions(sessions, {
    onAdded(binding) {
      const target = uiConversation.binding(binding).target('chat')
      if (target === undefined) return
      const seen = new Set<string>()
      let primed = false
      const push = (): void => {
        const pending = target.getSnapshot()?.pending ?? []
        for (const wait of pending) {
          if (seen.has(wait.key)) continue
          seen.add(wait.key)
          if (!primed) continue // 首个快照是基线:记录但不响
          const event = pendingEvent(wait.kind)
          if (event !== undefined) void engine.play(event)
        }
        primed = true
      }
      const detach = target.subscribe(push)
      push()
      cleanups.set(binding.sessionId, () => {
        detach()
        seen.clear()
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
