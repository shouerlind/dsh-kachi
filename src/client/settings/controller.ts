/**
 * 设置控制器(client):ctx.settingsScope.bind 的消费封装 ——
 * 把 scope 快照(status/value)派生成完整 KachiSettings(默认值兜底),
 * 提供乐观写入(本地立即生效,host 回流后由订阅刷新收敛)。
 */
import type { KachiSettings } from '../../shared/settings.ts'
import { DEFAULT_SETTINGS, SETTINGS_NAMESPACE } from '../../shared/settings.ts'

/** SettingsScope 的最小结构面(0.1.2-rc.1 契约兼容)。 */
export interface SettingsScopeLike {
  getSnapshot(): { status: 'loading' | 'ready' | 'unavailable'; value: unknown }
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
}

export interface KachiSettingsController {
  getSnapshot(): KachiSettings
  subscribe(listener: () => void): () => void
  /** 字段写入:host settings 文档持久化 + 本地乐观生效。 */
  set<K extends keyof KachiSettings>(field: K, value: KachiSettings[K]): void
}

export function createSettingsController(scope: SettingsScopeLike): KachiSettingsController {
  let optimistic: Partial<KachiSettings> = {}
  const listeners = new Set<() => void>()

  function derive(): KachiSettings {
    const snapshot = scope.getSnapshot()
    const value = snapshot.value as Partial<KachiSettings> | undefined
    const base = value === undefined || typeof value !== 'object' ? DEFAULT_SETTINGS : { ...DEFAULT_SETTINGS, ...value }
    return { ...base, ...optimistic } as KachiSettings
  }

  let cache = derive()
  const notify = (): void => {
    cache = derive()
    for (const listener of [...listeners]) listener()
  }

  const detach = scope.subscribe(notify)

  return {
    getSnapshot(): KachiSettings {
      return cache
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set(field, value): void {
      optimistic = { ...optimistic, [field]: value }
      notify()
      void scope.set(field, value).catch(() => {})
    },
  }
}

/** bind 便捷入口:命名空间固定为 dsh-kachi。 */
export function bindKachiSettings(bind: <T>(spec: { namespace: string }) => SettingsScopeLike): KachiSettingsController {
  return createSettingsController(bind<KachiSettings>({ namespace: SETTINGS_NAMESPACE }))
}
