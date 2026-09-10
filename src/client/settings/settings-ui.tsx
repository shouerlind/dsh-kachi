/**
 * 设置页 UI(SPEC §6):settings.general.item 两条自绘行 ——
 *  1. dsh-kachi-general:总开关 / 总音量 / 开机音 / 节流窗;
 *  2. dsh-kachi-slots:13 槽位的选音(13 默认 + 全包 211,含时长标注)、
 *     逐项试听与独立音量。
 * 控件用原生元素 + kachi- 前缀内联样式;注入面走非 hooks 成员(原样进 props)。
 */
import { useSyncExternalStore } from 'react'
import { DEFAULT_SLOT_SOUNDS, SLOT_IDS, SLOT_LABELS } from '../../shared/slots.ts'
import type { KachiSettingsController } from './controller.ts'
import { OWN_ROW_CLASS } from './row.ts'
import packManifest from '../pack-manifest.json'

export interface KachiInject {
  settings: KachiSettingsController
  /** 试听文件名;池归属由注入面自己判定(视图不关心 pack 布局)。 */
  preview(file: string): void
  /** 自家组件点击 → 按键音(SPEC §5 行 18)。 */
  click(): void
}

interface PackEntry {
  file: string
  dur: number | null
  bytes: number
}

const PACK = packManifest as PackEntry[]

let styleInjected = false
function ensureStyle(): void {
  if (styleInjected) return
  styleInjected = true
  const style = document.createElement('style')
  style.textContent = [
    `.${OWN_ROW_CLASS}{display:flex;flex-direction:column;gap:10px;padding:10px 0;font:13px/1.5 system-ui,sans-serif;}`,
    '.kachi-title{font-weight:600;}',
    '.kachi-field{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
    '.kachi-field .kachi-name{min-width:72px;color:var(--dsw-text-secondary, #888);}',
    '.kachi-val{min-width:42px;text-align:right;font-variant-numeric:tabular-nums;}',
    '.kachi-slot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
    '.kachi-slotname{min-width:72px;font-weight:500;}',
    '.kachi-slot select{max-width:230px;}',
    '.kachi-slot .kachi-val{min-width:36px;}',
  ].join('\n')
  document.head.append(style)
}

function GeneralRow({ settings, click }: KachiInject): JSX.Element {
  ensureStyle()
  const settingsView = useSyncExternalStore(settings.subscribe, settings.getSnapshot)
  return (
    <div className={OWN_ROW_CLASS} onClick={click}>
      <label className="kachi-field">
        <input
          type="checkbox"
          checked={settingsView.enabled}
          onChange={(e) => settings.set('enabled', e.target.checked)}
        />
        <span className="kachi-title">启用 Switch 音效(dsh-kachi)</span>
      </label>
      <div className="kachi-field">
        <span className="kachi-name">总音量</span>
        <input
          type="range"
          min={0}
          max={100}
          value={settingsView.masterVolume}
          onChange={(e) => settings.set('masterVolume', Number(e.target.value))}
        />
        <span className="kachi-val">{settingsView.masterVolume}%</span>
      </div>
      <div className="kachi-field">
        <label className="kachi-field">
          <input
            type="checkbox"
            checked={settingsView.bootSound}
            onChange={(e) => settings.set('bootSound', e.target.checked)}
          />
          <span>开机音</span>
        </label>
        <span className="kachi-name">节流窗</span>
        <input
          type="number"
          min={0}
          max={2000}
          step={50}
          value={settingsView.throttleMs}
          onChange={(e) => settings.set('throttleMs', Math.max(0, Number(e.target.value) || 0))}
        />
        <span>ms(同类音效去重)</span>
      </div>
    </div>
  )
}

function durLabel(dur: PackEntry['dur']): string {
  return dur === null ? '' : dur < 0.1 ? `(<0.1s)` : `(${dur.toFixed(2)}s)`
}

function SlotsRow({ settings, preview, click }: KachiInject): JSX.Element {
  ensureStyle()
  const settingsView = useSyncExternalStore(settings.subscribe, settings.getSnapshot)
  const setSlotSound = (slot: string, file: string): void => {
    settings.set('slotSounds', { ...settingsView.slotSounds, [slot]: file })
    // 选音即试听候选(SPEC §14「逐项试听」):切音立即听新音效。
    preview(file)
  }
  const setSlotVolume = (slot: string, percent: number): void => {
    settings.set('slotVolumes', { ...settingsView.slotVolumes, [slot]: percent })
  }
  const previewSlot = (slot: string): void => {
    const file = settingsView.slotSounds[slot]
    if (file !== undefined) preview(file)
  }
  return (
    <div className={OWN_ROW_CLASS} onClick={click}>
      <div className="kachi-title">音效槽位(选音 / 试听 / 音量;标注时长,选音须语义与时长 ≥0.1s 兼顾)</div>
      {SLOT_IDS.map((slot) => {
        const current = settingsView.slotSounds[slot] ?? ''
        const volume = settingsView.slotVolumes[slot] ?? 100
        return (
          <div key={slot} className="kachi-slot">
            <span className="kachi-slotname">{SLOT_LABELS[slot]}</span>
            <select value={current} onChange={(e) => setSlotSound(slot, e.target.value)}>
              <optgroup label="默认(13 槽位)">
                {SLOT_IDS.map((s) => {
                  const def = DEFAULT_SLOT_SOUNDS[s]
                  return (
                    <option key={s} value={def}>
                      {SLOT_LABELS[s]} · {def}
                    </option>
                  )
                })}
              </optgroup>
              <optgroup label={`全包(${PACK.length})`}>
                {PACK.map((entry) => (
                  <option key={entry.file} value={entry.file}>
                    {entry.file} {durLabel(entry.dur)}
                  </option>
                ))}
              </optgroup>
            </select>
            <button type="button" onClick={() => previewSlot(slot)}>
              试听
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setSlotVolume(slot, Number(e.target.value))}
            />
            <span className="kachi-val">{volume}%</span>
          </div>
        )
      })}
    </div>
  )
}

export { GeneralRow as KachiGeneralRow, SlotsRow as KachiSlotsRow }
