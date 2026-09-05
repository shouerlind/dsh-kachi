/**
 * 播放引擎(SPEC §3.3)。工单 #9 为最小形态:懒创建单例 AudioContext、
 * 手势解锁、解锁前事件丢弃;#10 完整化为 AudioBuffer 预解码缓存 +
 * master/槽位两级 GainNode + 后台策略 + 节流。
 */
import { DEFAULT_SLOT_SOUNDS, EVENT_SOUNDS, soundUrl, type SlotId } from '../../shared/slots.ts'

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

/** 槽位当前指向的音效文件(pack = 选自全包池,URL 走 /sounds/pack/ 前缀)。 */
export interface SlotFile {
  file: string
  pack: boolean
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
}

export interface Engine {
  /** 首次用户手势时调用;成功返回 true(幂等)。失败保留 suspended,后续手势可重试。 */
  unlock(): Promise<boolean>
  /** 播放一个映射事件。解锁前/停用/文件缺失时静默丢弃,不报错。 */
  play(eventId: keyof typeof EVENT_SOUNDS): Promise<void>
  /** 换槽位音效(工单 #14 选音);立即按需解码新文件。 */
  setSlotSound(slot: SlotId, file: SlotFile): Promise<void>
  /** 卸载:关闭 AudioContext,丢弃缓存。之后 play 为空操作。 */
  dispose(): void
  /** 测试与降级路径用:AudioContext 是否已创建并处于 running。 */
  isRunning(): boolean
}

export function createEngine(options: EngineOptions): Engine {
  const audioBase = options.audioBase ?? '/dsh-kachi'
  const fetchImpl = options.fetchImpl ?? ((url: string) => fetch(url))

  let ctx: AudioContextLike | undefined
  let unlocked = false
  let closed = false
  const buffers = new Map<string, AudioBuffer>()
  const slotFiles = new Map<SlotId, SlotFile>()
  for (const slot of Object.keys(DEFAULT_SLOT_SOUNDS) as SlotId[]) {
    slotFiles.set(slot, { file: DEFAULT_SLOT_SOUNDS[slot]!, pack: false })
  }

  function bufferKey(slotFile: SlotFile): string {
    return slotFile.pack ? `pack/${slotFile.file}` : slotFile.file
  }

  async function ensureBuffer(slotFile: SlotFile): Promise<AudioBuffer | undefined> {
    if (!ctx) return undefined
    const key = bufferKey(slotFile)
    const cached = buffers.get(key)
    if (cached) return cached
    try {
      const data = await fetchImpl(soundUrl(slotFile.file, { pack: slotFile.pack, base: audioBase }))
      if (!data.ok) return undefined
      const bytes = await data.arrayBuffer()
      const buffer = await ctx.decodeAudioData(bytes)
      buffers.set(key, buffer)
      return buffer
    } catch {
      return undefined
    }
  }

  return {
    async unlock(): Promise<boolean> {
      if (unlocked) return true
      if (closed) return false
      if (!ctx) ctx = options.createContext()
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
      const live = ctx
      if (!live || closed || !unlocked) return
      const mapping = EVENT_SOUNDS[eventId]
      if (!mapping) return
      const slotFile = slotFiles.get(mapping.slot)
      if (!slotFile) return
      const buffer = await ensureBuffer(slotFile)
      if (!buffer || closed || live.state !== 'running') return
      const source = live.createBufferSource()
      source.buffer = buffer
      source.connect(live.destination)
      source.start()
    },

    async setSlotSound(slot, file): Promise<void> {
      slotFiles.set(slot, file)
      await ensureBuffer(file)
    },

    dispose(): void {
      closed = true
      buffers.clear()
      void ctx?.close().catch(() => {})
      ctx = undefined
    },

    isRunning(): boolean {
      return ctx?.state === 'running' && unlocked
    },
  }
}
