/**
 * A 层接线(SPEC §3.2 行 1-3):allowlist 转发事件 → 音效。
 *
 * 只接 journal / list 镜像覆盖不到的转发事件。`approval/request` 与
 * `api-session/added|removed` 虽同在 allowlist,仍走 layer-b / layer-c 的既有
 * 路径(各自带 seq 门控与初始快照基线),此处不重复接线 —— 同一信号两条
 * 路径会双响。
 *
 * 事件名与模式(waterfall / emit)以安装的 dsh-api-remotes 白名单为准;
 * `test/layer-a.test.ts` 直接读该白名单对账,名字或模式写错即红 ——
 * waterfall 漏 `return next()` 会阻断 agent 提问流,是本模块唯一的破坏性风险。
 */
import type { Engine } from '../engine/audio-engine.ts'

/**
 * ctx.remote 的最小消费面。listener 的具体形态由 dsh 侧 per-event 声明决定
 * (waterfall 带 `next`、emit 不带),这里不复刻上游签名以免与之漂移:
 * 形参以 `never` 兜底(不可被调用),实际形状由各接线处的显式标注给出。
 */
export type RemoteListener = (...args: never[]) => unknown

export interface RemoteLike {
  $on(event: string, listener: RemoteListener): () => void
}

/** 转发事件名(测试按此对账 allowlist —— 字面量只在这里出现一次)。 */
export const REMOTE_EVENTS = {
  questions: 'user-questions/request',
  sessionError: 'api-session/error',
} as const

export function wireLayerA(remote: RemoteLike, engine: Pick<Engine, 'play'>): () => void {
  // agent 提问请求(SPEC §5 行 3):waterfall —— 必须 return next() 放行,
  // 否则提问流被本插件阻断,agent 的问题弹不出来。
  const offQuestions = remote.$on(
    REMOTE_EVENTS.questions,
    async (_request: unknown, next: () => Promise<unknown>) => {
      void engine.play('questions-request')
      return next()
    },
  )

  // 会话级错误(SPEC §5 行 7 的 A 半):emit —— 单向通知,无 next,
  // 不存在阻断风险;与 turn-end-error / jobs-failed 同槽,靠槽位节流防双响。
  const offError = remote.$on(REMOTE_EVENTS.sessionError, (_sessionId: unknown, _message: unknown) => {
    void engine.play('session-error')
  })

  return () => {
    offQuestions()
    offError()
  }
}
