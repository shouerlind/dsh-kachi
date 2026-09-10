import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { decodeBase64, encodeBase64 } from '../src/shared/sound-envelope.ts'

describe('音效封套 base64 编解码', () => {
  it('编码与 Node Buffer 逐字节一致(覆盖三种补齐长度与边界长度)', () => {
    const lengths = [0, 1, 2, 3, 4, 5, 6, 7, 8, 255, 256, 1024, 4097]
    for (const len of lengths) {
      const bytes = new Uint8Array(len)
      for (let i = 0; i < len; i++) bytes[i] = (i * 37 + 11) & 0xff
      const expected = Buffer.from(bytes).toString('base64')
      expect(encodeBase64(bytes), `len=${len}`).toBe(expected)
      expect(Array.from(decodeBase64(expected)), `len=${len}`).toEqual(Array.from(bytes))
    }
  })

  it('往返覆盖全部 256 个字节值', () => {
    const bytes = new Uint8Array(256)
    for (let i = 0; i < 256; i++) bytes[i] = i
    expect(Array.from(decodeBase64(encodeBase64(bytes)))).toEqual(Array.from(bytes))
  })

  it('接受无补齐的合法 base64', () => {
    expect(Array.from(decodeBase64('AAAA'))).toEqual([0, 0, 0])
    expect(Array.from(decodeBase64('AA'))).toEqual([0])
  })

  it('非法字符抛错(URL 安全变体 -/_ 不受支持)', () => {
    expect(() => decodeBase64('!!!!')).toThrow()
    expect(() => decodeBase64('ab-c')).toThrow()
    expect(() => decodeBase64('ab_c')).toThrow()
    expect(() => decodeBase64('中文')).toThrow()
  })

  it('空串往返为空', () => {
    expect(encodeBase64(new Uint8Array(0))).toBe('')
    expect(decodeBase64('')).toHaveLength(0)
  })
})
