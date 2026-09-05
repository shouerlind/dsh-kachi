import { describe, expect, it, vi } from 'vitest'
import { journalToEvent, wireLayerB, type EventSourceLike, type JournalEventLike } from '../src/client/wiring/layer-b.ts'

type ChangeKind = 'replace' | 'prepend' | 'append'
type Entry = { type: string; event?: JournalEventLike }

class FakeEventSource implements EventSourceLike {
  snapshot: { change: { kind: ChangeKind; entries: ReadonlyArray<Entry> } } | undefined = undefined
  private listeners = new Set<() => void>()
  getSnapshot(): { change: { kind: ChangeKind; entries: ReadonlyArray<Entry> } } | undefined {
    return this.snapshot
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  /** 模拟 eventSource 的窗口变更(订阅后由 session 服务驱动)。 */
  change(kind: ChangeKind, events: JournalEventLike[]): void {
    this.snapshot = { change: { kind, entries: events.map((event) => ({ type: 'event', event })) } }
    for (const l of [...this.listeners]) l()
  }
  /** 模拟 chunks 条目(无 event 字段)的 append。 */
  changeRaw(entries: ReadonlyArray<Entry>): void {
    this.snapshot = { change: { kind: 'append', entries } }
    for (const l of [...this.listeners]) l()
  }
}

describe('journal 事件映射(SPEC §5 行 4-11)', () => {
  it('turn/end completed → turn-end-completed(介入级)', () => {
    expect(journalToEvent({ type: 'turn/end', seq: 1, data: { turn: 0, reason: { kind: 'completed' } } })).toBe('turn-end-completed')
  })
  it('turn/end error / max-tokens → turn-end-error(介入级)', () => {
    expect(journalToEvent({ type: 'turn/end', seq: 1, data: { reason: { kind: 'error', error: {} } } })).toBe('turn-end-error')
    expect(journalToEvent({ type: 'turn/end', seq: 1, data: { reason: { kind: 'max-tokens' } } })).toBe('turn-end-error')
  })
  it('turn/end aborted 仅用户手动取消发声;parent/hook/disposed 静默', () => {
    expect(journalToEvent({ type: 'turn/end', seq: 1, data: { reason: { kind: 'aborted', reason: { kind: 'user' } } } })).toBe('turn-end-cancelled')
    expect(journalToEvent({ type: 'turn/end', seq: 1, data: { reason: { kind: 'aborted', reason: { kind: 'hook', reason: 'x' } } } })).toBeUndefined()
    expect(journalToEvent({ type: 'turn/end', seq: 1, data: { reason: { kind: 'aborted', reason: { kind: 'parent' } } } })).toBeUndefined()
    expect(journalToEvent({ type: 'turn/end', seq: 1, data: { reason: { kind: 'aborted', reason: { kind: 'disposed' } } } })).toBeUndefined()
  })
  it('blocked / interrupted 静默', () => {
    expect(journalToEvent({ type: 'turn/end', seq: 1, data: { reason: { kind: 'blocked' } } })).toBeUndefined()
    expect(journalToEvent({ type: 'turn/end', seq: 1, data: { reason: { kind: 'interrupted' } } })).toBeUndefined()
  })
  it('tool/result 按 error 分成败', () => {
    expect(journalToEvent({ type: 'tool/result', seq: 1, data: {} })).toBe('tool-result-ok')
    expect(journalToEvent({ type: 'tool/result', seq: 1, data: { error: { name: 'e', code: 'x' } } })).toBe('tool-result-fail')
  })
  it('user/message 仅人类输入(source.kind=user)发声', () => {
    expect(journalToEvent({ type: 'user/message', seq: 1, data: { source: { kind: 'user' } } })).toBe('user-message')
    expect(journalToEvent({ type: 'user/message', seq: 1, data: { source: { kind: 'plugin', plugin: 'x' } } })).toBeUndefined()
    expect(journalToEvent({ type: 'user/message', seq: 1, data: { source: { kind: 'model' } } })).toBeUndefined()
  })
  it('approval/asked 审计事件 → 通知重要音(0.1.2-rc.1 审批通路)', () => {
    expect(journalToEvent({ type: 'approval/asked', seq: 1, data: { id: 'a1', toolName: 'bash' } })).toBe('approval-request')
    expect(journalToEvent({ type: 'approval/decided', seq: 1, data: { id: 'a1', outcome: 'allowed-once' } })).toBeUndefined()
  })
  it('assistant/* 与 step/* 静默(SPEC 行 19)', () => {
    expect(journalToEvent({ type: 'assistant/message', seq: 1, data: {} })).toBeUndefined()
    expect(journalToEvent({ type: 'assistant/chunk', seq: 1, data: {} })).toBeUndefined()
    expect(journalToEvent({ type: 'step/start', seq: 1, data: {} })).toBeUndefined()
  })
})

describe('B 层 journal 接线(工单 #11)', () => {
  it('append 实时事件触发对应音效', () => {
    const h = makeHarness()
    const source = h.add('s1')
    const dispose = wireLayerB(h.sessions, { play: h.play })
    source.change('append', [
      { type: 'turn/start', seq: 10, data: {} },
      { type: 'tool/call', seq: 11, data: {} },
    ])
    expect(h.play).toHaveBeenCalledWith('turn-start')
    expect(h.play).toHaveBeenCalledWith('tool-call')
    dispose()
  })

  it('初始 replace(基线)与 prepend(翻页)不响,仅推进 seq 基线', () => {
    const h = makeHarness()
    const source = h.add('s1')
    const dispose = wireLayerB(h.sessions, { play: h.play })
    source.change('replace', [{ type: 'turn/start', seq: 99, data: {} }])
    source.change('prepend', [{ type: 'turn/start', seq: 5, data: {} }])
    expect(h.play).not.toHaveBeenCalled()
    // seq ≤ 基线的重放不响
    source.change('append', [{ type: 'turn/start', seq: 99, data: {} }])
    expect(h.play).not.toHaveBeenCalled()
    // seq 超过基线才响
    source.change('append', [{ type: 'turn/start', seq: 100, data: {} }])
    expect(h.play).toHaveBeenCalledWith('turn-start')
    dispose()
  })

  it('重连后的 replace 重放已响事件不双响', () => {
    const h = makeHarness()
    const source = h.add('s1')
    const dispose = wireLayerB(h.sessions, { play: h.play })
    source.change('replace', []) // 页面加载基线
    source.change('append', [{ type: 'tool/call', seq: 3, data: {} }])
    expect(h.play).toHaveBeenCalledTimes(1)
    source.change('replace', [
      { type: 'tool/call', seq: 2, data: {} },
      { type: 'tool/call', seq: 3, data: {} },
    ])
    expect(h.play).toHaveBeenCalledTimes(2) // 重连重放 → 恢复音
    expect(h.play).toHaveBeenLastCalledWith('reconnected')
    dispose()
  })

  it('重连恢复音在 5 秒窗口内跨会话去重(resync 风暴只响一次)', () => {
    // 自包含最小装配(避免跨用例状态泄漏干扰)
    let t = 1000
    const sources = new Map<string, FakeEventSource>()
    const bindings = new Map<string, { sessionId: string; eventSource: FakeEventSource }>()
    const store = {
      snapshot: { ids: [] as string[] },
      getSnapshot(): { ids: string[] } { return this.snapshot },
      subscribe(l: () => void): () => void { this.listeners.add(l); return () => this.listeners.delete(l) },
      listeners: new Set<() => void>(),
      emit(ids: string[]) { this.snapshot = { ids }; for (const l of [...this.listeners]) l() },
    }
    const add = (id: string): FakeEventSource => {
      bindings.set(id, { sessionId: id, eventSource: new FakeEventSource() })
      const s = bindings.get(id)!.eventSource
      sources.set(id, s)
      store.emit([...bindings.keys()])
      return s
    }
    const play = vi.fn(async () => {})
    const sessions = { list: store, binding: (id: string) => bindings.get(id) }
    const s1 = add('s1')
    const s2 = add('s2')
    const dispose = wireLayerB(sessions, { play }, { now: () => t })
    s1.change('replace', [])
    s2.change('replace', [])
    s1.change('replace', [{ type: 'turn/start', seq: 1, data: {} }])
    s2.change('replace', [{ type: 'turn/start', seq: 1, data: {} }])
    expect(play).toHaveBeenCalledWith('reconnected')
    expect(play).toHaveBeenCalledTimes(1)
    t += 6000
    s1.change('replace', [{ type: 'turn/start', seq: 1, data: {} }])
    expect(play).toHaveBeenCalledTimes(2)
    dispose()
  })

  it('chunks 条目(流式 token)静默', () => {
    const h = makeHarness()
    const source = h.add('s1')
    const dispose = wireLayerB(h.sessions, { play: h.play })
    source.changeRaw([{ type: 'chunks' }])
    expect(h.play).not.toHaveBeenCalled()
    dispose()
  })

  it('会话重建(新 eventSource)按新基线对待', () => {
    const h = makeHarness()
    const source = h.add('s1')
    const dispose = wireLayerB(h.sessions, { play: h.play })
    source.change('append', [{ type: 'turn/start', seq: 10, data: {} }])
    expect(h.play).toHaveBeenCalledTimes(1)
    // 会话离开(scope 拆除)
    h.remove('s1')
    // 会话重建:全新 eventSource,基线快照(replace)把 seq 重新喂到 10
    const rebuilt = h.add('s1')
    rebuilt.change('replace', [{ type: 'turn/start', seq: 10, data: {} }])
    expect(h.play).toHaveBeenCalledTimes(1)
    rebuilt.change('append', [{ type: 'turn/start', seq: 11, data: {} }])
    expect(h.play).toHaveBeenCalledTimes(2)
    dispose()
  })
})

function makeHarness(now?: () => number) {
  const sources = new Map<string, FakeEventSource>()
  const bindings = new Map<string, { sessionId: string }>()
  const store = {
    snapshot: { ids: [] as string[] },
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
  const play = vi.fn(async () => {})
  const sessions = {
    list: store,
    binding: (id: string): { sessionId: string; eventSource: FakeEventSource } | undefined => {
      const source = sources.get(id)
      return bindings.has(id) && source !== undefined ? { sessionId: id, eventSource: source } : undefined
    },
  }
  return {
    sources,
    play,
    sessions,
    add: (id: string): FakeEventSource => {
      bindings.set(id, { sessionId: id })
      const source = new FakeEventSource()
      sources.set(id, source)
      store.emit([id])
      return source
    },
    remove: (id: string): void => {
      bindings.delete(id)
      sources.delete(id) // 模拟真实:会话离开 → scope 拆除,eventSource 随之失效
      store.emit([...bindings.keys()])
    },
  }
}
