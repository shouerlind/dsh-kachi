/**
 * dsh-kachi 浏览器半入口。工单 #9(tracer bullet):单例 AudioContext +
 * 首次手势解锁 + 解锁成功播开机音。事件接线随 #10-#12 逐层补齐。
 */
import type { Context } from '@deepseek-ai/cordis'
import { createEngine } from './engine/audio-engine.ts'
import { installUnlock } from './engine/unlock.ts'

export const inject: string[] = []

export function apply(ctx: Context): void {
  const engine = createEngine({ createContext: () => new AudioContext() })

  // 解锁成功 → 开机音(SPEC §4:每次页面加载,含刷新;设置开关在 #13 接入)。
  const removeUnlock = installUnlock(window, async () => {
    const ok = await engine.unlock()
    if (ok) {
      void engine.play('boot')
      return true
    }
    return false
  })

  ctx.effect(
    () => () => {
      removeUnlock()
      engine.dispose()
    },
    'dsh-kachi: engine lifecycle',
  )
}
