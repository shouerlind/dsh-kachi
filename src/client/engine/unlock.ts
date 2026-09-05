/**
 * AudioContext 手势解锁(SPEC §3.3):首次 pointerdown/keydown(捕获,任意
 * 位置)尝试 resume;失败保留监听,下次手势重试;成功后移除监听。
 */

export function installUnlock(target: EventTarget, unlock: () => Promise<boolean>): () => void {
  let settled = false
  let inFlight = false
  const handler = (): void => {
    if (settled || inFlight) return
    inFlight = true
    void unlock()
      .then((ok) => {
        if (ok) {
          settled = true
          remove()
        }
      })
      .catch(() => {})
      .finally(() => {
        inFlight = false
      })
  }
  const remove = (): void => {
    target.removeEventListener('pointerdown', handler, true)
    target.removeEventListener('keydown', handler, true)
  }
  target.addEventListener('pointerdown', handler, true)
  target.addEventListener('keydown', handler, true)
  return remove
}
