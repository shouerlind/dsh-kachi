/**
 * dsh-kachi 浏览器半入口:装配播放引擎、手势解锁(含 Notification 降级)、
 * journal 接线(B 层,含审批 asked 事件)、生命周期/连接/交互音接线(C 层,
 * 交互音为 document 级 DOM 委托,ADR-0001)、设置页(SPEC §6 全部六项)。
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { KachiSettings } from '../shared/settings.ts'
import { SETTINGS_NAMESPACE } from '../shared/settings.ts'
import { createEngine } from './engine/audio-engine.ts'
import { installUnlock } from './engine/unlock.ts'
import { wireLayerB } from './wiring/layer-b.ts'
import { wireLayerC } from './wiring/layer-c.ts'
import { wireInteraction } from './wiring/interaction.ts'
import { bindKachiSettings } from './settings/controller.ts'
import { engineSettingsTarget } from './settings/bridge.ts'
import { applyKachiSettings, shouldPlayBoot } from './settings/policy.ts'
import { KachiGeneralRow, KachiSlotsRow, type KachiInject } from './settings/settings-ui.tsx'

export const inject = ['sessions', 'settingsScope', 'slots', 'locale']

export function apply(ctx: Context): void {
  const engine = createEngine({ createContext: () => new AudioContext() })

  const controller = bindKachiSettings((spec) => ctx.settingsScope.bind<KachiSettings>(spec))
  const injectFace: KachiInject = {
    settings: controller,
    preview: (file, pack) => {
      void engine.preview({ file, pack })
    },
    // 自家注入组件点击 → 按键音(SPEC §5 行 18)。
    click: () => {
      void engine.play('own-click')
    },
  }

  // 设置快照 → 引擎(总开关/总音量/节流窗/槽位音量/槽位选音)。
  const settingsTarget = engineSettingsTarget(engine)
  ctx.effect(
    () => {
      const detach = controller.subscribe(() => applyKachiSettings(controller.getSnapshot(), settingsTarget))
      applyKachiSettings(controller.getSnapshot(), settingsTarget)
      return detach
    },
    'dsh-kachi: settings apply',
  )

  // 手势解锁;成功后按设置播开机音,失败走 Notification 降级。
  const removeUnlock = installUnlock(window, async () => {
    const ok = await engine.unlock()
    if (ok) {
      removeHint()
      if (shouldPlayBoot(controller.getSnapshot())) void engine.play('boot')
      return true
    }
    notifyFallback()
    return false
  })

  // 行组件的 locale namespace 需先注册字典(slots.register 的 locale 契约)。
  ctx.effect(() => ctx.locale.register('dsh-kachi', { zh: { title: 'Switch 音效' }, en: { title: 'Switch sounds' } }), 'dsh-kachi: dictionaries')

  ctx.effect(() => wireLayerB(ctx.sessions, engine), 'dsh-kachi: journal wiring')

  ctx.effect(() => wireLayerC(ctx.sessions, engine), 'dsh-kachi: lifecycle wiring')

  // 交互音委托:composer 二级面板悬停/点击/关闭(ADR-0001)。
  ctx.effect(() => wireInteraction(window.document, engine), 'dsh-kachi: interaction wiring')

  // 设置页两行(slots.inject 挂调用方 fiber,官方插件均为顶层调用)。
  const settingsUIDisposers = [
    ctx.slots.inject('settings.general.item', () =>
      ctx.slots.register(
        { name: 'settings.general.item', id: 'dsh-kachi-general', order: 60, locale: 'dsh-kachi', inject: () => injectFace },
        KachiGeneralRow,
      ),
    ),
    ctx.slots.inject('settings.general.item', () =>
      ctx.slots.register(
        { name: 'settings.general.item', id: 'dsh-kachi-slots', order: 61, locale: 'dsh-kachi', inject: () => injectFace },
        KachiSlotsRow,
      ),
    ),
  ]

  ctx.effect(
    () => () => {
      removeUnlock()
      removeHint()
      for (const dispose of settingsUIDisposers) dispose()
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
