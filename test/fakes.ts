/** 测试共用 fake:最小 AudioContext / Gain / Source 结构面。 */

export class FakeSource {
  buffer: AudioBuffer | null = null
  connectedTo: unknown = null
  started = 0
  connect(node: unknown): this {
    this.connectedTo = node
    return this
  }
  start(): void {
    this.started++
  }
  stop(): void {}
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

  async resume(): Promise<void> {
    this.resumeCalls++
    if (this.resumeResult === 'fail') throw new DOMException('denied', 'NotAllowedError')
    this.state = 'running'
  }

  async decodeAudioData(_data: ArrayBuffer): Promise<AudioBuffer> {
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
