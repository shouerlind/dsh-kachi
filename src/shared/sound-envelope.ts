/**
 * 音效封套:音效字节在 HTTP 上的传输形态 —— base64 装进 JSON(`{ b64 }`)。
 * 双面共享:host 半编码,client 半解码;wire 形状只在这里定义一次。
 *
 * 存在理由只有一个:让音效请求在网络上不留下任何下载管理器能识别的媒体标记。
 * 旧的 `/dsh-kachi/sounds/*.wav` 静态路由同时暴露两个标记 —— URL 里的 `.wav`
 * 扩展名与 `audio/wav` 响应头 —— IDM 之类下载管理器据此认领下载;而插件启动
 * 就预解码 13 个默认槽,页面一加载必然连撞 13 次(设置页逐项试听再撞一串),
 * 表现为每声都被自动下载/弹下载框。
 *
 * JSON 封套把两个标记一起去掉;body 也不再以 RIFF/WAVE 魔数开头,连「按内容
 * 嗅探」的兜底一并规避 —— 这是它胜过「二进制 + application/octet-stream」的
 * 地方:后者只是藏起扩展名与响应头,字节流开头仍是 `RIFF....WAVE`。
 *
 * 代价:base64 让传输量涨约 33%(13 个默认槽 0.87 MB → ≈1.16 MB,一次性启动
 * 成本;单文件最大 ≈1.05 MB → ≈1.4 MB)。
 */

/** 音效端点的响应体形状。 */
export interface SoundEnvelope {
  b64: string
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * 编码字节为 base64(标准字母表,`=` 补齐,无换行)。
 * 纯实现(不依赖 Buffer/atob):双面共用一份,测试可与 Node Buffer 逐字节对账。
 */
export function encodeBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!
    const b1 = bytes[i + 1]
    const b2 = bytes[i + 2]
    out += ALPHABET[b0 >> 2]!
    out += ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)]!
    out += b1 === undefined ? '=' : ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)]!
    out += b2 === undefined ? '=' : ALPHABET[b2 & 0x3f]!
  }
  return out
}

/** 字符码 → 6 bit 值;非法字符为 -1。 */
const LOOKUP = (() => {
  const table = new Int16Array(128).fill(-1)
  for (let i = 0; i < ALPHABET.length; i++) table[ALPHABET.charCodeAt(i)] = i
  return table
})()

/**
 * 解码 base64 为字节。非法字符(含 URL 安全变体的 `-`/`_`)抛错 ——
 * 调用方(播放引擎)在 try/catch 内使用,失败即丢弃该次发声,不报错。
 */
export function decodeBase64(text: string): Uint8Array {
  let end = text.length
  while (end > 0 && text.charCodeAt(end - 1) === 0x3d /* = */) end--
  const out = new Uint8Array((end * 3) >> 2)
  let acc = 0
  let bits = 0
  let written = 0
  for (let i = 0; i < end; i++) {
    const code = text.charCodeAt(i)
    const value = code < 128 ? LOOKUP[code]! : -1
    if (value < 0) throw new Error(`invalid base64 character at ${i}`)
    acc = (acc << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[written++] = (acc >> bits) & 0xff
    }
  }
  return out
}
