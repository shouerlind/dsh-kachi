/**
 * dsh-kachi 浏览器半入口:装配播放引擎、手势解锁(含 Notification 降级)、
 * journal 接线(B 层,含审批 asked 事件)。设置页随工单 #13/#14 补齐。
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import { createEngine } from './engine/audio-engine.ts'
import { installUnlock } from './engine/unlock.ts'
import { wireLayerB } from './wiring/layer-b.ts'

export const inject = ['sessions']

export function apply(ctx: Context): void {
  const engine = createEngine({ createContext: () => new AudioContext() })

  const removeUnlock = installUnlock(window, async () => {
    const ok = await engine.unlock()
    if (ok) {
      removeHint()
      void engine.play('boot')
      return true
    }
    // resume 失败:Notification 系统通知兜底 + 页面提示(SPEC §3.3)。
    notifyFallback()
    return false
  })

  ctx.effect(() => wireLayerB(ctx.sessions, engine), 'dsh-kachi: journal wiring')

  ctx.effect(
    () => () => {
      removeUnlock()
      removeHint()
      engine.dispose()
    },
    'dsh-kachi: engine lifecycle',
  )
}

/* ---- 解锁失败降级:Notification + 页内提示条 ---- */

const HINT_ID = 'dsh-kachi-unlock-hint'
let hintShown = false
let notified = false

function notifyFallback(): void {
  showHint()
  if (notified) return
  notified = true
  try {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'granted') {
      new Notification('dsh-kachi 音效未启用', { body: '点击 dsh 页面任意处以解锁 Switch 音效。' })
    } else if (Notification.permission === 'default') {
      void Notification.requestPermission()
        .then((p) => {
          if (p === 'granted') new Notification('dsh-kachi 音效未启用', { body: '点击 dsh 页面任意处以解锁 Switch 音效。' })
        })
        .catch(() => {})
    }
  } catch {
    // 通知不可用就只留页内提示。
  }
}

function showHint(): void {
  if (hintShown || typeof document === 'undefined') return
  hintShown = true
  const style = document.createElement('style')
  style.textContent =
    '#dsh-kachi-unlock-hint{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);' +
    'z-index:2147483000;padding:6px 14px;border-radius:8px;background:rgba(30,30,34,.88);' +
    'color:#f4f4f6;font:13px/1.5 system-ui,sans-serif;pointer-events:none;}'
  const hint = document.createElement('div')
  hint.id = HINT_ID
  hint.textContent = '点按页面任意处以启用 Switch 音效(dsh-kachi)'
  document.head.append(style)
  document.body.append(hint)
}

function removeHint(): void {
  document.getElementById(HINT_ID)?.remove()
  hintShown = false
}
