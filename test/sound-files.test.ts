import { describe, expect, it } from 'vitest'
import { resolveSoundFile } from '../src/host/sound-files.ts'

describe('host 音效文件解析(file= 取值 → 相对路径,路径安全)', () => {
  it('接受合法文件名,pack 文件保留 pack/ 前缀', () => {
    expect(resolveSoundFile('boot.wav')).toBe('boot.wav')
    expect(resolveSoundFile('pack/SeNewsBad.wav')).toBe('pack/SeNewsBad.wav')
    expect(resolveSoundFile('pack/SeVgc_Dialog_Check-1.2.wav')).toBe('pack/SeVgc_Dialog_Check-1.2.wav')
  })

  it('拒绝目录穿越:点号开头、上级目录、内嵌分隔符', () => {
    expect(resolveSoundFile('')).toBeUndefined()
    expect(resolveSoundFile('../package.json')).toBeUndefined()
    expect(resolveSoundFile('pack/../package.json')).toBeUndefined()
    expect(resolveSoundFile('pack/..%2Fx.wav')).toBeUndefined() // 未解码形态也拒
    expect(resolveSoundFile('a/b.wav')).toBeUndefined()
    expect(resolveSoundFile('a\\b.wav')).toBeUndefined()
    expect(resolveSoundFile('..\\boot.wav')).toBeUndefined()
    expect(resolveSoundFile('pack/sub/x.wav')).toBeUndefined()
    expect(resolveSoundFile('/etc/passwd')).toBeUndefined()
    expect(resolveSoundFile('C:\\Windows\\win.ini')).toBeUndefined()
  })

  it('拒绝非 wav 与空文件名', () => {
    expect(resolveSoundFile('boot.txt')).toBeUndefined()
    expect(resolveSoundFile('.wav')).toBeUndefined()
    expect(resolveSoundFile('..wav')).toBeUndefined()
    expect(resolveSoundFile('pack/')).toBeUndefined()
    expect(resolveSoundFile('pack/.wav')).toBeUndefined()
    expect(resolveSoundFile('wav')).toBeUndefined()
  })

  it('旧静态路由形态不再被接受(该路由已随 IDM 兼容改动删除)', () => {
    expect(resolveSoundFile('/dsh-kachi/sounds/boot.wav')).toBeUndefined()
    expect(resolveSoundFile('/dsh-kachi/sounds/pack/SeNewsBad.wav')).toBeUndefined()
    expect(resolveSoundFile('/dsh-kachi/other/boot.wav')).toBeUndefined()
  })
})
