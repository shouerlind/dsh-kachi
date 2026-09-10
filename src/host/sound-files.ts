/**
 * `/dsh-kachi/sound?file=` 的取值 → 相对 assets/sounds 的安全文件路径。
 * 只接受 `<name>.wav` 与 `pack/<name>.wav` 两种形态(与 shared/slots.ts 的
 * soundUrl 同源),文件名严格白名单,杜绝目录穿越 —— 返回 undefined 即 404。
 *
 * 入参是 URLSearchParams 已解码后的原文;这里仍按最坏情况校验:点号开头的、
 * 含分隔符(`/` 或 `\`)的、非 `.wav` 结尾的一律拒绝,所以 `../`、`pack/../`、
 * 乃至未解码的 `..%2F` 都进不来。
 */
const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.wav$/

export function resolveSoundFile(rel: string): string | undefined {
  if (rel.startsWith('pack/')) {
    const file = rel.slice('pack/'.length)
    return FILE_RE.test(file) ? `pack/${file}` : undefined
  }
  return FILE_RE.test(rel) ? rel : undefined
}
