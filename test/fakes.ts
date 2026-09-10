/** 测试共用 fake:最小 AudioContext / Gain / Source 结构面。 */

export class FakeSource {
  buffer: AudioBuffer | null = null
  connectedTo: unknown = null
  started = 0
  stopped = 0
  connect(node: unknown): this {
    this.connectedTo = node
    return this
  }
  start(): void {
    this.started++
  }
  stop(): void {
    this.stopped++
  }
}

export class FakeGain {
  gain = { value: 1 }
  connectedTo: unknown = null
  /** 调试标记:slot 槽位 id 或 'master'。 */
  slot?: string
  connect(node: unknown): this {
    this.connectedTo = node
    return this
  }
  disconnect(): void {}
}

export class FakeAudioContext {
  state: string = 'suspended'
  destination = { fakeDestination: true }
  resumeCalls = 0
  resumeResult: 'ok' | 'fail' = 'ok'
  readonly sources: FakeSource[] = []
  readonly gains: FakeGain[] = []
  /** 交给 decodeAudioData 的字节(封套往返断言用)。 */
  readonly decoded: ArrayBuffer[] = []

  async resume(): Promise<void> {
    this.resumeCalls++
    if (this.resumeResult === 'fail') throw new DOMException('denied', 'NotAllowedError')
    this.state = 'running'
  }

  async decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer> {
    this.decoded.push(data)
    return { duration: 0.1 } as unknown as AudioBuffer
  }

  createBufferSource(): FakeSource {
    const src = new FakeSource()
    this.sources.push(src)
    return src
  }

  createGain(): FakeGain {
    const gain = new FakeGain()
    this.gains.push(gain)
    return gain
  }

  async close(): Promise<void> {
    this.state = 'closed'
  }
}

/**
 * 音效端点 fake:返回合法 base64 封套(4 字节 0x00 → `AAAAAA==`)。
 * 引擎只把解出的字节交给 decodeAudioData,内容无所谓;这里保证封套可解码。
 * 计数/自定义行为的需求直接 `return okSoundFetcher()` 包一层。
 */
export async function okSoundFetcher(): Promise<{ ok: boolean; json(): Promise<unknown> }> {
  return { ok: true, json: async () => ({ b64: 'AAAAAA==' }) }
}
