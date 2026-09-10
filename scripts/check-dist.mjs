// 校验已入库的 lib/ 产物与当前源码一致。
//
// 为什么需要:`lib/` 的 JS 产物自 2026-09-10 起**入库**(见 NOTES「依赖升到 0.1.5-rc.1 +
// 产物入库」),因为 dsh 启动器的插件迁移只认 registry / git 来源,而 git 依赖拿不到
// 安装期构建产物。代价是「改了 src/ 忘了 build」会静默推出去旧产物 ——
// 类型检查与测试都不会红。本脚本重建后对账,有差异即红。
//
// 对账口径:比较「重建结果」与**索引**(= 此刻提交会写进的东西),而不是与工作树比 ——
// 这样「已 add 的新产物」不会被误报,而「add 了旧产物、工作树是新的」会被正确拦下。
// 只对账 JS:sourcemap 不入库(它内嵌源码原文,受 core.autocrlf 影响,见 .gitignore)。
import { execFileSync } from 'node:child_process'

const run = (file, args) => execFileSync(file, args, { stdio: 'inherit' })
const capture = (file, args) => execFileSync(file, args, { encoding: 'utf8' })

run('node', ['scripts/gen-pack-manifest.mjs'])
run('node', ['scripts/build.mjs'])

const changed = capture('git', ['diff', '--name-only', '--', 'lib']).trim()
const untracked = capture('git', ['ls-files', '--others', '--exclude-standard', '--', 'lib']).trim()

if (changed !== '' || untracked !== '') {
  console.error('\n✗ lib/ 与当前源码不一致 —— 此刻提交会推出旧产物:')
  if (changed !== '') console.error(`  待重提交(工作树 ≠ 索引):\n${changed.split('\n').map((f) => `    ${f}`).join('\n')}`)
  if (untracked !== '') console.error(`  未入库的新产物:\n${untracked.split('\n').map((f) => `    ${f}`).join('\n')}`)
  console.error('\n请 `git add lib` 后一起提交(理由见 NOTES「产物入库」)。')
  process.exit(1)
}

console.log('✓ lib/ 与当前源码一致')
