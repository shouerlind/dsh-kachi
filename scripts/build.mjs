// dsh-kachi 构建:两个产物
//  - lib/index.js  host 半(ESM,node)
//  - lib/client.js 浏览器半:esbuild cjs bundle,外面包上 window.__ModuleLoader__
//    的模块工厂外壳(外壳契约见 packages/client/tsdown.client.ts;factory 的
//    require 只解析基线模块:react、cordis、client-store、ui-slots、ui-primitives)。
import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'

mkdirSync('lib', { recursive: true })

await build({
  entryPoints: ['src/host/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  packages: 'external',
  logLevel: 'info',
})

const CLIENT_ID = 'dsh-kachi'
await build({
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2022', 'chrome110'],
  sourcemap: true,
  // 基线共享模块(host 种进浏览器模块表),其余源码全部打包进来。
  external: [
    'react',
    'react/jsx-runtime',
    'react-dom',
    'react-dom/client',
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-client-store',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-ui-primitives',
  ],
  banner: {
    js:
      `window.__ModuleLoader__.load({ id: ${JSON.stringify(CLIENT_ID)}, factory: (require) => {\n` +
      `var module = { exports: {} }; var exports = module.exports;`,
  },
  footer: { js: `return module.exports; } });` },
  logLevel: 'info',
})
