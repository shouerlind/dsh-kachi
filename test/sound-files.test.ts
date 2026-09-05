import { describe, expect, it } from 'vitest'
import { resolveSoundFile } from '../src/host/sound-files.ts'

describe('host 音效文件解析(路径安全)', () => {
  it('接受合法文件名,pack 文件带 pack/ 前缀返回', () => {
    expect(resolveSoundFile('/dsh-kachi/sounds/boot.wav')).toBe('boot.wav')
    expect(resolveSoundFile('/dsh-kachi/sounds/pack/SeNewsBad.wav')).toBe('pack/SeNewsBad.wav')
    expect(resolveSoundFile('/dsh-kachi/sounds/pack/SeVgc_Dialog_Check-1.2.wav')).toBe(
      'pack/SeVgc_Dialog_Check-1.2.wav',
    )
  })

  it('拒绝目录穿越、分隔符与非法字符', () => {
    expect(resolveSoundFile('/dsh-kachi/sounds/../package.json')).toBeUndefined()
    expect(resolveSoundFile('/dsh-kachi/sounds/pack/%2e%2e/x.wav')).toBeUndefined()
    expect(resolveSoundFile('/dsh-kachi/sounds/a/b.wav')).toBeUndefined()
    expect(resolveSoundFile('/dsh-kachi/sounds/a\\b.wav')).toBeUndefined()
    expect(resolveSoundFile('/dsh-kachi/sounds/..\\boot.wav')).toBeUndefined()
    expect(resolveSoundFile('/dsh-kachi/sounds/boot.txt')).toBeUndefined()
    expect(resolveSoundFile('/dsh-kachi/sounds/.wav')).toBeUndefined()
    expect(resolveSoundFile('/dsh-kachi/other/boot.wav')).toBeUndefined()
    expect(resolveSoundFile('/dsh-kachi/sounds/pack/sub/x.wav')).toBeUndefined()
  })
})
