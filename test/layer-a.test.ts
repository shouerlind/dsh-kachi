import { describe, expect, it, vi } from 'vitest'
import { API_REMOTE_FORWARDED_EVENTS } from '@deepseek-ai/dsh-api-remotes'
import { REMOTE_EVENTS, wireLayerA, type RemoteLike, type RemoteListener } from '../src/client/wiring/layer-a.ts'

/** waterfall 监听器:请求 + next,返回放行结果。 */
type Waterfall = (request: unknown, next: () => Promise<unknown>) => Promise<unknown>
/** emit 监听器:单向通知,无 next。 */
type Emit = (sessionId: unknown, message: unknown) => void

function makeRemote() {
  const listeners = new Map<string, RemoteListener>()
  const offs: Array<() => void> = []
  const remote: RemoteLike = {
    $on(event, listener) {
      listeners.set(event, listener)
      const off = vi.fn()
      offs.push(off)
      return off
    },
  }
  // 注册面把 listener 收成不可调用的结构面(适配 dsh 的 per-event 声明),
  // 测试按白名单里的模式还原成可调用的具体形态再驱动。
  const waterfall = (event: string): Waterfall => listeners.get(event) as unknown as Waterfall
  const emit = (event: string): Emit => listeners.get(event) as unknown as Emit
  return { remote, listeners, offs, waterfall, emit }
}

describe('A 层事件与 dsh 白名单对账', () => {
  it('两个事件名都在转发白名单内,且模式与接线方式一致', () => {
    const byEvent = new Map(API_REMOTE_FORWARDED_EVENTS.map((entry) => [entry.event, entry.mode]))
    // 名字写错(或上游改名)即红 —— 转发白名单是唯一真相。
    expect(byEvent.get(REMOTE_EVENTS.questions)).toBe('waterfall')
    expect(byEvent.get(REMOTE_EVENTS.sessionError)).toBe('emit')
  })
})

describe('A 层接线(SPEC §5 行 3 / 行 7 的 A 半)', () => {
  it('提问请求:响通知重要音,并 return next() 放行提问流', async () => {
    const h = makeRemote()
    const play = vi.fn(async () => {})
    const dispose = wireLayerA(h.remote, { play })
    const next = vi.fn(async () => 'answered')
    const result = await h.waterfall(REMOTE_EVENTS.questions)({ questions: [] }, next)
    expect(play).toHaveBeenCalledWith('questions-request')
    expect(next).toHaveBeenCalledTimes(1)
    expect(result).toBe('answered') // 放行结果原样透传,不吞不换
    dispose()
  })

  it('提问请求:下游 next() 的拒绝原样传出(不吞错、不改写)', async () => {
    const h = makeRemote()
    const dispose = wireLayerA(h.remote, { play: vi.fn(async () => {}) })
    const boom = new Error('no answerer')
    await expect(h.waterfall(REMOTE_EVENTS.questions)({}, async () => Promise.reject(boom))).rejects.toBe(boom)
    dispose()
  })

  it('会话级错误:emit 形态只接 (sessionId, message),无 next 参与', () => {
    const h = makeRemote()
    const play = vi.fn(async () => {})
    const dispose = wireLayerA(h.remote, { play })
    const listener = h.listeners.get(REMOTE_EVENTS.sessionError)!
    expect(listener.length).toBe(2) // 多接一个 next 形参就是接错了模式
    h.emit(REMOTE_EVENTS.sessionError)('s1', 'boom')
    expect(play).toHaveBeenCalledWith('session-error')
    dispose()
  })

  it('两个监听器都是本次接线的,dispose 全部拆除', () => {
    const h = makeRemote()
    const dispose = wireLayerA(h.remote, { play: vi.fn(async () => {}) })
    expect([...h.listeners.keys()]).toEqual([REMOTE_EVENTS.questions, REMOTE_EVENTS.sessionError])
    expect(h.offs).toHaveLength(2)
    dispose()
    for (const off of h.offs) expect(off).toHaveBeenCalledTimes(1)
  })
})
