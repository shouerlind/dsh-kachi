/**
 * C 层接线(SPEC §3.2/§5 行 12-18):
 *  - 会话生命周期:ctx.sessions.list 快照 diff → added/removed 音
 *    (0.1.2-rc.1 无 api-session/* 的 $on 转发;list 即这些事件的镜像);
 *    初始快照的既有会话是基线,不响新建音。
 *  - 后台作业:list.jobsBySession diff → completed(前台)/failed(介入);
 *    首见即终态(基线/错过)不响,killed 静默。
 *  - 连接:ctx.connection.generation — defined→undefined 警示音、
 *    undefined→defined 恢复音;页面加载的首次连接不是「重连」。
 */
import type { Engine } from '../engine/audio-engine.ts'
import { trackSessions, type SessionsLike } from './sessions-tracker.ts'

export interface JobLike {
  readonly id: string
  readonly status: string
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

/** 连接代际状态机:从页面加载视角区分「首次连接」「断线」「重连」。 */
export class ConnectionStateMachine {
  private phase: 'init' | 'connected' | 'disconnected' = 'init'

  advance(hasGeneration: boolean): 'reconnecting' | 'reconnected' | undefined {
    if (hasGeneration) {
      const was = this.phase
      this.phase = 'connected'
      return was === 'disconnected' ? 'reconnected' : undefined
    }
    const was = this.phase
    if (was === 'connected') this.phase = 'disconnected'
    return was === 'connected' ? 'reconnecting' : undefined
  }
}

interface GenerationLike {
  getSnapshot(): unknown
  subscribe(listener: () => void): () => void
}

export function wireLayerC(
  sessions: SessionsLike,
  connection: { generation: GenerationLike },
  engine: Pick<Engine, 'play'>,
): () => void {
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

  // 连接音。
  const machine = new ConnectionStateMachine()
  const connectionListener = (): void => {
    const event = machine.advance(connection.generation.getSnapshot() !== undefined)
    if (event === 'reconnecting') void engine.play('reconnecting')
    else if (event === 'reconnected') void engine.play('reconnected')
  }
  const detachGeneration = connection.generation.subscribe(connectionListener)
  connectionListener()

  return () => {
    disposeTracker()
    detachList()
    detachGeneration()
  }
}
