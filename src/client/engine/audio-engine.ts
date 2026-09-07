/**
 * 播放引擎(SPEC §3.3):单例 AudioContext(apply 即创建)、AudioBuffer 预解码
 * 缓存、master GainNode(总音量,滑条平方映射)与每槽位 GainNode 的两级总线、
 * Page Visibility 后台策略(hidden 仅介入级)、解锁前/停用事件丢弃不报错。
 */
import {
  DEFAULT_SLOT_SOUNDS,
  DEFAULT_SLOT_VOLUMES,
  EVENT_SOUNDS,
  INTERACTION_EVENT_IDS,
  INTERACTION_MIN_INTERVAL_MS,
  MONOPHONIC_MIN_INTERVAL_MS,
  MONOPHONIC_SLOTS,
  SLOT_IDS,
  soundUrl,
  type SlotId,
} from '../../shared/slots.ts'

/** 播放源节点最小结构(真 AudioBufferSourceNode 结构兼容;测试塞 fake)。 */
export interface SourceNodeLike {
  buffer: AudioBuffer | null
  connect(node: unknown): unknown
  start(when?: number): void
  stop(): void
}

/** 增益节点最小结构。 */
export interface GainNodeLike {
  gain: { value: number }
  connect(node: unknown): unknown
  disconnect(): void
}

export interface AudioContextLike {
  readonly state: string
  readonly destination: unknown
  resume(): Promise<void>
  close(): Promise<void>
  decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer>
  createBufferSource(): SourceNodeLike
  createGain(): GainNodeLike
}

/** 音效抓取器:真 fetch 的 Response 结构兼容此最小面;测试塞 fake。 */
export interface SoundFetcher {
  (url: string): Promise<{ ok: boolean; arrayBuffer(): Promise<ArrayBuffer> }>
}

export interface EngineOptions {
  createContext: () => AudioContextLike
  /** 音效路由前缀;默认 host 半注册的 /dsh-kachi。 */
  audioBase?: string
  fetchImpl?: SoundFetcher
  /** 前后台判定;默认 document.visibilityState。 */
  visibility?: () => 'visible' | 'hidden'
  /** 毫秒时钟(节流用);默认 performance.now()。 */
  now?: () => number
}

/** 槽位当前指向的音效文件(pack = 选自全包池,URL 走 /sounds/pack/ 前缀)。 */
export interface SlotFile {
  file: string
  pack: boolean
}

export interface Engine {
  /** 首次用户手势时调用;成功返回 true(幂等)。失败保持 suspended,后续手势可重试。 */
  unlock(): Promise<boolean>
  /** 播放一个映射事件。解锁前/后台/停用/文件缺失时静默丢弃,不报错。 */
  play(eventId: keyof typeof EVENT_SOUNDS): Promise<void>
  /** 总音量 0-100(平方映射到 master GainNode)。 */
  setMasterVolume(percent: number): void
  /** 槽位音量 0-100(平方映射到该槽位 GainNode)。 */
  setSlotVolume(slot: SlotId, percent: number): void
  /** 换槽位音效(工单 #14 选音);立即按需解码新文件。 */
  setSlotSound(slot: SlotId, file: SlotFile): Promise<void>
  /** 槽位当前文件名(设置策略防重复下发用)。 */
  currentSlotFile(slot: SlotId): string | undefined
  /** 节流时间窗(毫秒,同类同槽位去重;0 关闭)。 */
  setThrottleMs(ms: number): void
  /** 总开关(SPEC §6):false 时一切映射事件静默。 */
  setEnabled(enabled: boolean): void
  /** 设置页试听:绕过总开关/后台/节流,直连 master 总线(总音量仍生效)。 */
  preview(file: SlotFile): Promise<void>
  /** 卸载:关闭 AudioContext,丢弃缓存。之后 play 为空操作。 */
  dispose(): void
}

/** 滑条百分比的平方映射(人耳响度感知线性化,社区通行做法)。 */
export function volumeGain(percent: number): number {
  const v = Math.min(100, Math.max(0, percent)) / 100
  return v * v
}

function defaultVisibility(): 'visible' | 'hidden' {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden' ? 'hidden' : 'visible'
}

export function createEngine(options: EngineOptions): Engine {
  const audioBase = options.audioBase ?? '/dsh-kachi'
  const fetchImpl = options.fetchImpl ?? ((url: string) => fetch(url))
  const visibility = options.visibility ?? defaultVisibility
  const now = options.now ?? (() => performance.now())

  const ctx = options.createContext()

  const master = ctx.createGain()
  master.connect(ctx.destination)
  let masterVolume = 100
  master.gain.value = volumeGain(masterVolume)

  const slotGains = new Map<SlotId, GainNodeLike>()
  const slotVolumes = new Map<SlotId, number>()
  for (const slot of SLOT_IDS) {
    const gain = ctx.createGain()
    gain.connect(master)
    const percent = DEFAULT_SLOT_VOLUMES[slot]!
    gain.gain.value = volumeGain(percent)
    slotGains.set(slot, gain)
    slotVolumes.set(slot, percent)
  }

  const buffers = new Map<string, AudioBuffer>()
  const slotFiles = new Map<SlotId, SlotFile>()
  for (const slot of SLOT_IDS) {
    slotFiles.set(slot, { file: DEFAULT_SLOT_SOUNDS[slot]!, pack: false })
  }

  let unlocked = false
  let closed = false
  let enabled = true
  let throttleMs = 200
  const lastPlayedAt = new Map<SlotId, number>()
  const activeSources = new Map<SlotId, SourceNodeLike>()
  // 交互音事件闸:按事件 id 计时,不受 setThrottleMs 影响。
  const lastInteractionAt = new Map<string, number>()

  function bufferKey(slotFile: SlotFile): string {
    return slotFile.pack ? `pack/${slotFile.file}` : slotFile.file
  }

  async function ensureBuffer(slotFile: SlotFile): Promise<AudioBuffer | undefined> {
    if (closed) return undefined
    const key = bufferKey(slotFile)
    const cached = buffers.get(key)
    if (cached) return cached
    try {
      const data = await fetchImpl(soundUrl(slotFile.file, { pack: slotFile.pack, base: audioBase }))
      if (!data.ok) return undefined
      const bytes = await data.arrayBuffer()
      const buffer = await ctx.decodeAudioData(bytes)
      if (closed) return undefined
      buffers.set(key, buffer)
      return buffer
    } catch {
      return undefined
    }
  }

  // 启动即预解码全部默认槽位文件(SPEC §3.3),事件到达时零解码延迟。
  void Promise.all([...slotFiles.values()].map((f) => ensureBuffer(f))).catch(() => {})

  return {
    async unlock(): Promise<boolean> {
      if (unlocked) return true
      if (closed) return false
      try {
        await ctx.resume()
        unlocked = true
        return true
      } catch {
        // NotAllowedError / 持续 suspended:保持未解锁,不报错;降级路径见 wiring 层。
        return false
      }
    },

    async play(eventId): Promise<void> {
      if (closed || !unlocked || !enabled) return
      const mapping = EVENT_SOUNDS[eventId]
      if (!mapping) return
      // 后台策略:hidden 仅介入级(SPEC §4 白名单)。
      if (visibility() === 'hidden' && mapping.level !== 'intervention') return
      // 节流(SPEC §4):默认按槽位 200ms 去重(setThrottleMs 可调),闸后立即
      // 占位防并发同槽在解码窗内双响。两类例外:
      //  - 单声道槽位(菜单移动音):固定 50ms 最小间隔替代 200ms 去重;
      //  - 交互音事件:按事件 50ms 计闸 —— 确认槽与 tool/result 同槽,槽位
      //    200ms 去重会吞掉快速连点面板时的重开确认音(实机踩坑)。
      const monophonic = MONOPHONIC_SLOTS.has(mapping.slot)
      if (INTERACTION_EVENT_IDS.has(eventId)) {
        const lastAt = lastInteractionAt.get(eventId)
        if (lastAt !== undefined && now() - lastAt < INTERACTION_MIN_INTERVAL_MS) return
        lastInteractionAt.set(eventId, now())
      } else {
        const windowMs = monophonic ? MONOPHONIC_MIN_INTERVAL_MS : throttleMs
        const playedAt = lastPlayedAt.get(mapping.slot)
        if (windowMs > 0 && playedAt !== undefined && now() - playedAt < windowMs) return
        lastPlayedAt.set(mapping.slot, now())
      }
      const slotFile = slotFiles.get(mapping.slot)
      const slotGain = slotGains.get(mapping.slot)
      if (!slotFile || !slotGain) return
      const buffer = await ensureBuffer(slotFile)
      if (buffer === undefined || closed || ctx.state !== 'running') return
      const source = ctx.createBufferSource()
      source.buffer = buffer
      // 事件音量系数:同槽低于主档时的线性微降(槽位承载 SPEC §5 主档,
      // 平方映射;恒 100 时不接入)。
      if (mapping.volume < 100) {
        const shot = ctx.createGain()
        shot.gain.value = mapping.volume / 100
        shot.connect(slotGain)
        source.connect(shot)
      } else {
        source.connect(slotGain)
      }
      if (monophonic) {
        // 单声道打断:上一响立刻停,防快速扫选时音效叠加糊掉。
        const previous = activeSources.get(mapping.slot)
        if (previous !== undefined) {
          try {
            previous.stop()
          } catch {
            // 已停止的节点再 stop 个别实现会抛;单声道语义下忽略。
          }
        }
        activeSources.set(mapping.slot, source)
      }
      source.start()
    },

    setMasterVolume(percent): void {
      masterVolume = percent
      master.gain.value = volumeGain(percent)
    },

    setSlotVolume(slot, percent): void {
      slotVolumes.set(slot, percent)
      const gain = slotGains.get(slot)
      if (gain) gain.gain.value = volumeGain(percent)
    },

    async setSlotSound(slot, file): Promise<void> {
      slotFiles.set(slot, file)
      await ensureBuffer(file)
    },

    currentSlotFile(slot): string | undefined {
      return slotFiles.get(slot)?.file
    },

    setThrottleMs(ms): void {
      throttleMs = Math.max(0, ms)
    },

    setEnabled(value): void {
      enabled = value
    },

    async preview(file): Promise<void> {
      if (closed || !unlocked) return
      const buffer = await ensureBuffer(file)
      if (buffer === undefined || closed || ctx.state !== 'running') return
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(master)
      source.start()
    },

    dispose(): void {
      closed = true
      buffers.clear()
      void ctx.close().catch(() => {})
    },

  }
}
