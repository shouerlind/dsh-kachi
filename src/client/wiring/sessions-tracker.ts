/**
 * 会话跟踪器:订阅 ctx.sessions.list 快照,把会话集合的变化派发给消费者
 * (pending 接线、B 层 journal 接线共用)。binding(id) 尚未就绪的会话
 * 在后续快照里自动补挂;派发契约:onAdded(binding) 每个存活会话恰好一次。
 */

/** 最小结构面(dsh 的 SnapshotStore 结构兼容)。 */
export interface ListStoreLike<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

export interface SessionBindingLike {
  readonly sessionId: string
}

export interface SessionsLike<B extends SessionBindingLike = SessionBindingLike> {
  /** 会话列表快照(ids/byId/…);binding 需要其 ids 字段。 */
  readonly list: ListStoreLike<{ ids: readonly string[] }>
  /** 纯解析 binding;未就绪返回 undefined。 */
  binding(id: string): B | undefined
}

export interface TrackerHooks<B extends SessionBindingLike> {
  onAdded(binding: B): void
  onRemoved(sessionId: string): void
}

export function trackSessions<B extends SessionBindingLike>(sessions: SessionsLike<B>, hooks: TrackerHooks<B>): () => void {
  const tracked = new Set<string>()
  const detach = sessions.list.subscribe(() => {
    const ids = sessions.list.getSnapshot().ids
    const next = new Set(ids)
    for (const id of ids) {
      if (tracked.has(id)) continue
      const binding = sessions.binding(id)
      if (binding === undefined) continue
      tracked.add(id)
      hooks.onAdded(binding)
    }
    for (const id of [...tracked]) {
      if (!next.has(id)) {
        tracked.delete(id)
        hooks.onRemoved(id)
      }
    }
  })
  // 首次派发在订阅挂上之后手动触发一次(订阅本身不回放)。
  const initial = sessions.list.getSnapshot().ids
  for (const id of initial) {
    const binding = sessions.binding(id)
    if (binding === undefined) continue
    tracked.add(id)
    hooks.onAdded(binding)
  }
  return () => {
    detach()
    tracked.clear()
  }
}
