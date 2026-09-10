import { describe, expect, it, vi } from 'vitest'
import {
  bindKachiSettings,
  createSettingsController,
  type SettingsScopeLike,
} from '../src/client/settings/controller.ts'
import { DEFAULT_SETTINGS, SETTINGS_NAMESPACE } from '../src/shared/settings.ts'
import { DEFAULT_SLOT_SOUNDS } from '../src/shared/slots.ts'

/** 假 scope:手工拨动快照 + 记录 set 调用(controller 的接口依赖,不窥内部)。 */
function makeScope(initial?: { status: 'loading' | 'ready' | 'unavailable'; value: unknown }) {
  let snapshot = initial ?? { status: 'ready' as const, value: undefined }
  const listeners = new Set<() => void>()
  const sets: Array<{ field: string; value: unknown }> = []
  const scope: SettingsScopeLike = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set: (field, value) => {
      sets.push({ field, value })
      return Promise.resolve()
    },
  }
  return {
    scope,
    sets,
    /** 模拟 host 回流:换快照并通知订阅者。 */
    push(value: unknown): void {
      snapshot = { status: 'ready', value }
      for (const listener of [...listeners]) listener()
    },
    listenerCount: (): number => listeners.size,
  }
}

describe('设置控制器:派生子默认值(SPEC §6)', () => {
  it('scope 尚无值时落到 DEFAULT_SETTINGS', () => {
    const { scope } = makeScope({ status: 'loading', value: undefined })
    expect(createSettingsController(scope).getSnapshot()).toEqual(DEFAULT_SETTINGS)
  })

  it('scope 值非对象(脏数据)时同样落到默认值', () => {
    const { scope } = makeScope({ status: 'ready', value: 'nope' })
    expect(createSettingsController(scope).getSnapshot()).toEqual(DEFAULT_SETTINGS)
  })

  it('部分字段与默认值合并(缺字段补齐)', () => {
    const { scope } = makeScope({ status: 'ready', value: { masterVolume: 42 } })
    const view = createSettingsController(scope).getSnapshot()
    expect(view.masterVolume).toBe(42)
    expect(view.enabled).toBe(DEFAULT_SETTINGS.enabled)
    expect(view.slotSounds).toEqual({ ...DEFAULT_SLOT_SOUNDS })
  })

  it('host 回流后快照收敛,并通知订阅者', () => {
    const { scope, push } = makeScope({ status: 'ready', value: { masterVolume: 10 } })
    const controller = createSettingsController(scope)
    const seen: number[] = []
    controller.subscribe(() => seen.push(controller.getSnapshot().masterVolume))
    push({ masterVolume: 77 })
    expect(controller.getSnapshot().masterVolume).toBe(77)
    expect(seen).toEqual([77])
  })
})

describe('设置控制器:乐观写入', () => {
  it('set 立即本地生效(不等 host 回流),并写向 scope', () => {
    const { scope, sets } = makeScope()
    const controller = createSettingsController(scope)
    controller.set('masterVolume', 30)
    expect(controller.getSnapshot().masterVolume).toBe(30)
    expect(sets).toEqual([{ field: 'masterVolume', value: 30 }])
  })

  it('乐观值覆盖 host 快照的旧值,直到 host 回流同一字段', () => {
    const { scope, push } = makeScope({ status: 'ready', value: { masterVolume: 10 } })
    const controller = createSettingsController(scope)
    controller.set('masterVolume', 30)
    push({ masterVolume: 10 }) // host 还没写进去,回流仍是旧值
    expect(controller.getSnapshot().masterVolume).toBe(30)
    push({ masterVolume: 30 }) // 写完回流,收敛(乐观值同样为 30)
    expect(controller.getSnapshot().masterVolume).toBe(30)
  })

  it('多次 set 累积不互相覆盖', () => {
    const { scope, sets } = makeScope()
    const controller = createSettingsController(scope)
    controller.set('enabled', false)
    controller.set('throttleMs', 500)
    expect(controller.getSnapshot().enabled).toBe(false)
    expect(controller.getSnapshot().throttleMs).toBe(500)
    expect(sets).toHaveLength(2)
  })

  it('scope.set 失败不抛(持久化失败只损失跨会话记忆,本地已生效)', async () => {
    const failing: SettingsScopeLike = {
      getSnapshot: () => ({ status: 'ready', value: undefined }),
      subscribe: () => () => {},
      set: () => Promise.reject(new Error('boom')),
    }
    const controller = createSettingsController(failing)
    expect(() => controller.set('masterVolume', 5)).not.toThrow()
    expect(controller.getSnapshot().masterVolume).toBe(5)
    await Promise.resolve() // 让 catch 落地,不产生 unhandled rejection
  })

  it('退订后不再收到通知', () => {
    const { scope, push, listenerCount } = makeScope()
    const controller = createSettingsController(scope)
    const listener = vi.fn()
    const unsubscribe = controller.subscribe(listener)
    expect(listenerCount()).toBe(1) // controller 自身也订了 scope
    push({ masterVolume: 20 })
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    push({ masterVolume: 21 })
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('bind 入口', () => {
  it('以固定 namespace 调 bind', () => {
    const seen: string[] = []
    const controller = bindKachiSettings((spec) => {
      seen.push(spec.namespace)
      return makeScope().scope
    })
    expect(seen).toEqual([SETTINGS_NAMESPACE])
    expect(controller.getSnapshot()).toEqual(DEFAULT_SETTINGS)
  })
})
