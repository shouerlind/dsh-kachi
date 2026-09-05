import { describe, expect, it, vi } from 'vitest'
import { trackSessions } from '../src/client/wiring/sessions-tracker.ts'

/** 最小 SnapshotStore fake。 */
class FakeListStore {
  private listeners = new Set<() => void>()
  constructor(public snapshot: { ids: string[] }) {}
  getSnapshot(): { ids: string[] } {
    return this.snapshot
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  emit(ids: string[]): void {
    this.snapshot = { ids }
    for (const listener of this.listeners) listener()
  }
}

describe('会话跟踪器(工单 #10/#11 共用)', () => {
  it('初始快照的会话逐个 onAdded(binding, initial=true)', () => {
    const store = new FakeListStore({ ids: ['a', 'b'] })
    const bindings = new Map([
      ['a', { sessionId: 'a' }],
      ['b', { sessionId: 'b' }],
    ])
    const onAdded = vi.fn()
    const onRemoved = vi.fn()
    const dispose = trackSessions(
      { list: store, binding: (id: string) => bindings.get(id) },
      { onAdded, onRemoved },
    )
    expect(onAdded).toHaveBeenCalledTimes(2)
    expect(onAdded).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'a' }), true)
    expect(onAdded).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'b' }), true)
    dispose()
  })

  it('binding 尚未就绪时延后,后续快照再补挂(此时 initial=false)', () => {
    const store = new FakeListStore({ ids: ['a'] })
    const bindings = new Map<string, { sessionId: string }>()
    const onAdded = vi.fn()
    const dispose = trackSessions({ list: store, binding: (id: string) => bindings.get(id) }, { onAdded, onRemoved: () => {} })
    expect(onAdded).not.toHaveBeenCalled()
    bindings.set('a', { sessionId: 'a' })
    store.emit(['a'])
    expect(onAdded).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'a' }), false)
    dispose()
  })

  it('会话移除触发 onRemoved;重复快照不重复派发', () => {
    const store = new FakeListStore({ ids: ['a'] })
    const bindings = new Map([['a', { sessionId: 'a' }]])
    const onRemoved = vi.fn()
    const onAdded = vi.fn()
    const dispose = trackSessions({ list: store, binding: (id) => bindings.get(id) }, { onAdded, onRemoved })
    store.emit(['a'])
    expect(onAdded).toHaveBeenCalledTimes(1)
    store.emit([])
    expect(onRemoved).toHaveBeenCalledWith('a')
    dispose()
  })

  it('dispose 后停止派发', () => {
    const store = new FakeListStore({ ids: [] })
    const onAdded = vi.fn()
    const dispose = trackSessions({ list: store, binding: () => undefined }, { onAdded, onRemoved: () => {} })
    dispose()
    store.emit(['x'])
    expect(onAdded).not.toHaveBeenCalled()
  })
})
