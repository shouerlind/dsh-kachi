// 扫描 assets/sounds/pack/*.wav,解析 RIFF 头生成时长/字节清单,
// 供设置页选音列表按时长筛选与标注(SPEC §7:源包有大量亚 50ms 微碎片)。
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const PACK_DIR = 'assets/sounds/pack'
const OUT = 'src/client/pack-manifest.json'

/** 解析 WAV 时长(秒);解析失败返回 undefined。 */
function wavDuration(bytes) {
  try {
    if (bytes.length < 12) return undefined
    if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') return undefined
    let offset = 12
    let byteRate
    let dataSize
    while (offset + 8 <= bytes.length) {
      const id = bytes.toString('ascii', offset, offset + 4)
      const size = bytes.readUInt32LE(offset + 4)
      if (id === 'fmt ' && offset + 8 + 16 <= bytes.length) {
        byteRate = bytes.readUInt32LE(offset + 8 + 8)
      } else if (id === 'data') {
        dataSize = size
      }
      offset += 8 + size + (size % 2)
    }
    if (!byteRate || dataSize === undefined || byteRate === 0) return undefined
    return Math.round((dataSize / byteRate) * 100) / 100
  } catch {
    return undefined
  }
}

const files = readdirSync(PACK_DIR).filter((f) => f.toLowerCase().endsWith('.wav')).sort()
const entries = files.map((file) => {
  const bytes = readFileSync(`${PACK_DIR}/${file}`)
  return { file, dur: wavDuration(bytes), bytes: bytes.length }
})

mkdirSync('src/client', { recursive: true })
writeFileSync(OUT, JSON.stringify(entries))
console.log(`pack manifest: ${entries.length} files → ${OUT}`)
