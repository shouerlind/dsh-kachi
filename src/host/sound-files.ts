/**
 * /dsh-kachi/sounds 请求路径 → 相对 assets/sounds 的安全文件路径。
 * 只接受 `sounds/<name>.wav` 与 `sounds/pack/<name>.wav` 两层结构,
 * 文件名严格白名单,杜绝目录穿越 —— 返回 undefined 即 404。
 */
const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.wav$/
const PREFIX = '/dsh-kachi/sounds/'

export function resolveSoundFile(pathname: string): string | undefined {
  if (!pathname.startsWith(PREFIX)) return undefined
  const rest = pathname.slice(PREFIX.length)
  if (rest.startsWith('pack/')) {
    const file = rest.slice('pack/'.length)
    return FILE_RE.test(file) ? `pack/${file}` : undefined
  }
  return FILE_RE.test(rest) ? rest : undefined
}
