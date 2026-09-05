/**
 * 引擎设置适配:把 EngineSettingsApi(policy 消费的最小接口)桥到引擎实例。
 */
import type { SlotId } from '../../shared/slots.ts'
import { isDefaultSound } from '../../shared/slots.ts'
import type { Engine } from '../engine/audio-engine.ts'
import type { EngineSettingsApi } from './policy.ts'

export function engineSettingsTarget(engine: Engine): EngineSettingsApi {
  return {
    setEnabled: (enabled) => engine.setEnabled(enabled),
    setMasterVolume: (percent) => engine.setMasterVolume(percent),
    setThrottleMs: (ms) => engine.setThrottleMs(ms),
    setSlotVolume: (slot, percent) => engine.setSlotVolume(slot as SlotId, percent),
    setSlotSound: (slot, file) => {
      void engine.setSlotSound(slot as SlotId, { file, pack: !isDefaultSound(file) })
    },
    currentFile: (slot) => engine.currentSlotFile(slot as SlotId),
  }
}
