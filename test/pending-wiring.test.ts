import { describe, expect, it, vi } from 'vitest'
import { wirePending, type ChatTargetLike } from '../src/client/wiring/pending.ts'
import { trackSessions } from '../src/client/wiring/sessions-tracker.ts'
import type { SessionBindingLike } from '../src/client/wiring/sessions-tracker.ts'

class FakeChatTarget implements ChatTargetLike {
  snapshot: { pending?: ReadonlyArray<{ key: string; kind: string }> } = {}
  private listeners = new Set<() => void>()
  getSnapshot(): { pending?: ReadonlyArray<{ key: string; kind: string }> } {
    return this.snapshot
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  emit(pending: ReadonlyArray<{ key: string; kind: string }>): void {
    this.snapshot = { pending }
    for (const l of [...this.listeners]) l()
  }
}

function makeHarness(initialIds: string[] = []) {
  const targets = new Map<string, FakeChatTarget>()
  const bindings = new Map<string, SessionBindingLike>()
  const store = {
    snapshot: { ids: initialIds },
    listeners: new Set<() => void>(),
    getSnapshot(): { ids: string[] } {
      return this.snapshot
    },
    subscribe(l: () => void): () => void {
      this.listeners.add(l)
      return () => this.listeners.delete(l)
    },
    emit(ids: string[]): void {
      this.snapshot = { ids }
      for (const l of [...this.listeners]) l()
    },
  }
  const uiConversation = {
    binding: (b: SessionBindingLike) => ({
      target: (name: string): ChatTargetLike | undefined => {
        if (name !== 'chat') return undefined
        let t = targets.get(b.sessionId)
        if (!t) {
          t = new FakeChatTarget()
          targets.set(b.sessionId, t)
        }
        return t
      },
    }),
  }
  const play = vi.fn(async () => {})
  const binding = (id: string): SessionBindingLike | undefined => bindings.get(id)
  const sessions = { list: store as never, binding }
  return {
    store,
    bindings,
    targets,
    play,
    add(id: string) {
      bindings.set(id, { sessionId: id })
      // 预创建 chat target(与 wire 时 get-or-create 同一实例)
      if (!targets.has(id)) targets.set(id, new FakeChatTarget())
      store.emit([...bindings.keys()])
    },
    remove(id: string) {
      bindings.delete(id)
      targets.delete(id) // 模拟真实:会话离开后 target 随 scope 拆除,重建时是新实例
      store.emit([...bindings.keys()])
    },
    wire() {
      return wirePending(sessions, uiConversation, { play } as never)
    },
  }
}

describe('pending 接线(工单 #10:审批/提问音,0.1.2-rc.1 通路)', () => {
  it('pending 出现 kind=approval 的等待 → 通知重要音', () => {
    const h = makeHarness()
    h.add('s1')
    const dispose = h.wire()
    h.targets.get('s1')!.emit([{ key: 'a:1', kind: 'approval' }])
    expect(h.play).toHaveBeenCalledWith('approval-request')
    dispose()
  })

  it('pending 出现 kind=question → 通知重要音;plan-review 不响(白名单外)', () => {
    const h = makeHarness()
    h.add('s1')
    const dispose = h.wire()
    h.targets.get('s1')!.emit([
      { key: 'q:1', kind: 'question' },
      { key: 'p:1', kind: 'plan-review' },
    ])
    expect(h.play).toHaveBeenCalledWith('questions-request')
    expect(h.play).not.toHaveBeenCalledWith(expect.stringContaining('plan'))
    dispose()
  })

  it('同一 key 只响一次(baseline 重放/重连不双响)', () => {
    const h = makeHarness()
    h.add('s1')
    const dispose = h.wire()
    const t = h.targets.get('s1')!
    t.emit([{ key: 'a:1', kind: 'approval' }])
    t.emit([{ key: 'a:1', kind: 'approval' }])
    expect(h.play).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('首次快照(基线)已有的 pending 不响 —— 只响新到达', () => {
    const h = makeHarness()
    h.add('s1')
    // 先让 target 携带历史 pending,再接线
    h.targets.get('s1')!.emit([{ key: 'old:1', kind: 'approval' }])
    const dispose = h.wire()
    expect(h.play).not.toHaveBeenCalled()
    // 之后新的到达才响
    h.targets.get('s1')!.emit([
      { key: 'old:1', kind: 'approval' },
      { key: 'new:2', kind: 'approval' },
    ])
    expect(h.play).toHaveBeenCalledWith('approval-request')
    expect(h.play).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('会话移除后清理订阅;再出现按新会话对待(重建基线不响)', () => {
    const h = makeHarness()
    h.add('s1')
    const dispose = h.wire()
    h.remove('s1')
    // 模拟重建:新 target 实例,基线快照在挂载前已带上旧 pending
    const rebuilt = new FakeChatTarget()
    rebuilt.emit([{ key: 'old:1', kind: 'approval' }])
    h.targets.set('s1', rebuilt)
    h.add('s1')
    expect(h.play).not.toHaveBeenCalled() // 重建后的首个快照是基线
    // 之后的新到达才响
    rebuilt.emit([
      { key: 'old:1', kind: 'approval' },
      { key: 'new:2', kind: 'approval' },
    ])
    expect(h.play).toHaveBeenCalledTimes(1)
    expect(h.play).toHaveBeenCalledWith('approval-request')
    dispose()
  })
})
