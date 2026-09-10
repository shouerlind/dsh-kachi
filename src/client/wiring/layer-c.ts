/**
 * C 层接线(SPEC §5 行 12-18):
 *  - 会话生命周期:ctx.sessions.list 快照 diff → added/removed 音
 *    (0.1.2-rc.1 无 api-session/* 的 $on 转发;list 即这些事件的镜像);
 *    初始快照的既有会话是基线,不响新建音。
 *  - 后台作业:list.jobsBySession diff → completed(前台)/failed(介入);
 *    首见即终态(基线/错过)不响,killed 静默。
 *  - 连接状态:ctx.connection.state(公共多消费者订阅面)→ 断线警示音 /
 *    恢复音。旧实现走 journal 重连 replace 帧的启发式,已由本模块替换
 *    (见「通路差异与缺口」:state 才是权威信号,replace 帧会因 seq-gap 误报)。
 */
import type { Engine } from '../engine/audio-engine.ts'
import { trackSessions, type SessionsLike } from './sessions-tracker.ts'

export interface JobLike {
  readonly id: string
  readonly status: string
}

/** ctx.connection.state 的最小消费面(ConnectionStateSource 的结构子集)。 */
export interface ConnectionStateLike {
  /** 首个 outcome 之前可能为 undefined。 */
  getSnapshot(): string | undefined
  subscribe(listener: () => void): () => void
}

/**
 * 连接音(SPEC §5 行 16/17):重试进入 `connecting` → 警示音;
 * 重连成功回到 `connected` → 恢复音。
 *
 * 首连不是断线:`connecting` 只在「此前连上过」之后才发声,首条 `connected`
 * 也只建立基线不响恢复音(页面加载时本就该静默)。`disconnected` 无映射
 * (SPEC §5 未列),静默 —— 但它不重置已连上标记,故断线后的重试照常发声。
 */
export function wireConnection(state: ConnectionStateLike, engine: Pick<Engine, 'play'>): () => void {
  let last: string | undefined
  let everConnected = false
  const push = (): void => {
    const next = state.getSnapshot()
    if (next === last) return // 同值重发不是状态变化
    last = next
    if (next === 'connecting') {
      if (everConnected) void engine.play('reconnecting')
      return
    }
    if (next === 'connected') {
      if (everConnected) void engine.play('reconnected')
      everConnected = true
    }
  }
  const detach = state.subscribe(push)
  push() // 首快照:建立基线,不响
  return detach
}

/**
 * 作业状态 diff:seen 携带跨快照状态(调用方持有)。
 * 首见即 completed/failed/killed(基线或错过)不报告;
 * running/stopping → completed/failed 各报告一次;killed 静默。
 */
export function diffJobs(
  state: { seen: Map<string, string> },
  jobs: ReadonlyArray<JobLike>,
): { completed: string[]; failed: string[] } {
  const completed: string[] = []
  const failed: string[] = []
  const present = new Set<string>()
  for (const job of jobs) {
    present.add(job.id)
    const prev = state.seen.get(job.id)
    if (prev === undefined) {
      if (job.status === 'running' || job.status === 'stopping') state.seen.set(job.id, job.status)
      continue
    }
    if (job.status === 'completed') {
      completed.push(job.id)
      state.seen.delete(job.id)
    } else if (job.status === 'failed') {
      failed.push(job.id)
      state.seen.delete(job.id)
    } else if (job.status === 'killed') {
      state.seen.delete(job.id)
    } else {
      state.seen.set(job.id, job.status)
    }
  }
  for (const id of [...state.seen.keys()]) {
    if (!present.has(id)) state.seen.delete(id)
  }
  return { completed, failed }
}

export function wireLayerC(sessions: SessionsLike, engine: Pick<Engine, 'play'>): () => void {
  // 会话生命周期 + 作业(同一 list 快照驱动)。
  const jobState = { seen: new Map<string, string>() }
  const disposeTracker = trackSessions(sessions, {
    onAdded(_binding, initial) {
      if (!initial) void engine.play('session-added')
    },
    onRemoved() {
      void engine.play('session-removed')
    },
  })
  const jobsListener = (): void => {
    const snapshot = sessions.list.getSnapshot() as {
      jobsBySession?: Record<string, ReadonlyArray<JobLike>>
    }
    const jobs = Object.values(snapshot.jobsBySession ?? {}).flat()
    const report = diffJobs(jobState, jobs)
    for (const _ of report.completed) void engine.play('jobs-completed')
    for (const _ of report.failed) void engine.play('jobs-failed')
  }
  const detachList = sessions.list.subscribe(jobsListener)
  jobsListener()

  return () => {
    disposeTracker()
    detachList()
  }
}
