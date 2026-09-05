import { describe, expect, it, vi } from 'vitest'
import { diffJobs, wireLayerC } from '../src/client/wiring/layer-c.ts'

describe('jobs diff(工单 #12:后台作业完成/失败)', () => {
  it('基线中已终态的作业不响(页面加载不回放)', () => {
    const report = diffJobs(
      { seen: new Map() },
      [{ id: 'j1', status: 'completed' }, { id: 'j2', status: 'failed' }],
    )
    expect(report).toEqual({ completed: [], failed: [] })
  })

  it('running → completed / failed 触发对应报告', () => {
    const state = { seen: new Map([['j1', 'running'], ['j2', 'running']]) }
    const report = diffJobs(state, [
      { id: 'j1', status: 'completed' },
      { id: 'j2', status: 'failed' },
      { id: 'j3', status: 'running' },
    ])
    expect(report.completed).toEqual(['j1'])
    expect(report.failed).toEqual(['j2'])
  })

  it('killed 静默;stopping → completed 也报告', () => {
    expect(diffJobs({ seen: new Map([['j1', 'stopping']]) }, [{ id: 'j1', status: 'killed' }])).toEqual({
      completed: [],
      failed: [],
    })
    expect(diffJobs({ seen: new Map([['j2', 'stopping']]) }, [{ id: 'j2', status: 'completed' }]).completed).toEqual(['j2'])
  })

  it('报告后作业离开 seen(终态只报一次);作业消失清理', () => {
    const state = { seen: new Map([['j1', 'running']]) }
    expect(diffJobs(state, [{ id: 'j1', status: 'completed' }]).completed).toEqual(['j1'])
    expect(diffJobs(state, [{ id: 'j1', status: 'completed' }]).completed).toEqual([])
  })
})

describe('C 层接线', () => {
  function makeHarness() {
    const jobsBySession: Record<string, Array<{ id: string; status: string }>> = {}
    let snapshot = { ids: [] as string[], jobsBySession }
    const listListeners = new Set<() => void>()
    const sessions = {
      list: {
        getSnapshot: () => snapshot,
        subscribe: (l: () => void) => {
          listListeners.add(l)
          return () => listListeners.delete(l)
        },
      },
      binding: (id: string) => (snapshot.ids.includes(id) ? { sessionId: id } : undefined),
    }
    let hasGeneration = false
    const genListeners = new Set<() => void>()
    const connection = {
      generation: {
        getSnapshot: () => (hasGeneration ? { generation: 1 } : undefined),
        subscribe: (l: () => void) => {
          genListeners.add(l)
          return () => genListeners.delete(l)
        },
      },
    }
    const play = vi.fn(async () => {})
    const emitList = (): void => {
      for (const l of [...listListeners]) l()
    }
    return {
      sessions,
      connection,
      play,
      emitList,
      addJob(sessionId: string, job: { id: string; status: string }): void {
        ;(jobsBySession[sessionId] ??= []).push(job)
        emitList()
      },
      setGeneration(up: boolean): void {
        hasGeneration = up
        for (const l of [...genListeners]) l()
      },
      addSession(id: string): void {
        snapshot = { ids: [...snapshot.ids, id], jobsBySession }
        emitList()
      },
      setIds(ids: string[]): void {
        snapshot = { ids, jobsBySession }
        emitList()
      },
    }
  }

  it('初始快照中的既有会话不响新建音;新增会话响', () => {
    const h = makeHarness()
    h.setIds(['a']) // 页面加载时已有会话 a(初始基线)
    const dispose = wireLayerC(h.sessions as never, { play: h.play } as never)
    expect(h.play).not.toHaveBeenCalled()
    h.addSession('b')
    expect(h.play).toHaveBeenCalledWith('session-added')
    dispose()
  })

  it('会话移除响关闭音', () => {
    const h = makeHarness()
    h.addSession('a')
    const dispose = wireLayerC(h.sessions as never, { play: h.play } as never)
    expect(h.play).not.toHaveBeenCalled()
    // 模拟移除:快照回到不含 a 的状态
    const snap = h.sessions.list.getSnapshot()
    h.sessions.list.getSnapshot = () => ({ ...snap, ids: snap.ids.filter((x) => x !== 'a') })
    h.emitList()
    expect(h.play).toHaveBeenCalledWith('session-removed')
    dispose()
  })

  it('作业 running → completed 响 jobs-completed;failed 响 jobs-failed(介入级)', () => {
    const h = makeHarness()
    const dispose = wireLayerC(h.sessions as never, { play: h.play } as never)
    h.addJob('s1', { id: 'j1', status: 'running' })
    expect(h.play).not.toHaveBeenCalled()
    h.addJob('s1', { id: 'j1', status: 'completed' })
    expect(h.play).toHaveBeenCalledWith('jobs-completed')
    h.addJob('s1', { id: 'j2', status: 'running' })
    h.addJob('s1', { id: 'j2', status: 'failed' })
    expect(h.play).toHaveBeenCalledWith('jobs-failed')
    dispose()
  })

  it('dispose 后一切静默', () => {
    const h = makeHarness()
    const dispose = wireLayerC(h.sessions as never, { play: h.play } as never)
    dispose()
    h.setGeneration(false)
    h.setGeneration(true)
    h.addSession('x')
    expect(h.play).not.toHaveBeenCalled()
  })
})
