# dsh client 插件机制与可监听事件面(wayfinder research)

- 工单:[shouerlind/ns-notify#2](https://github.com/shouerlind/ns-notify/issues/2)
- 调查对象:dsh 主仓库 `D:\deepseek harness\deepseek-harness`(pnpm monorepo,基于 cordis 插件框架;当前版本 `0.1.2-alpha.1`)
- 日期:2026-09-05
- 用途:为「事件 → 音效映射表与通知分级」工单提供事实基础

---

## 0. 结论速览(TL;DR)

1. **client(浏览器)插件是标准 cordis 插件**:包声明 `dsh.client`(platform: 'web'),构建产物挂在 `exports["./client"]`,host 自动扫描并通过 `/plugins` 路由把 bundle 注入页面;插件体是 `export const inject = [...]` + `export function apply(ctx)`。
2. **client 插件能监听的事件分三层**:
   - **跨进程 host 事件(allowlist 限制)**:`ctx.remote.$on(event, listener)`,合法键集合硬编码在 `packages/api/remotes/src/remote-events.ts` 的 `API_REMOTE_FORWARDED_EVENTS`(共 14 个事件,含 `approval/request`、`api-session/status`、`api-session/error` 等)。
   - **会话日志流(Session journal)**:`remote.session.follow()` 实时 append 全量 `SessionEvent`(`turn/start|end`、`step/start|end`、`user/message`、`assistant/message`、`tool/call`、`tool/result`…),**不走 allowlist**,任何 client 插件都能拿到——这是音效插件最细粒度、最可靠的事件源。
   - **client 本地事件**:自己 React 组件里的 DOM 事件、`ctx.slots` 注入点、`ctx.inputTriggers`(/、@)、`commands`;**没有全局「UI 点击事件总线」**。
3. **host→client 通道是 API Gateway 的 WebSocket 多路复用端点 `/api/remote.mux`**(`packages/api/gateway/src/stream-protocol.ts:6`),unary RPC 走 `POST /api/*`;开发态 HMR 用 SSE(仅样式/bundle 热更,与业务事件无关)。
4. **版本号**:源码看根 `package.json`(当前 `0.1.2-alpha.1`);运行时 `dsh --version`(CLI 读 `apps/cli/package.json` 的 `version`)。
5. **对音效插件没有明显的不可行点**;唯一硬约束是浏览器自动播放策略(需用户手势解锁 AudioContext)与「事件不重放」(断线重连靠 baseline/查询补状态)。

---

## 1. dsh 版本号如何确定

| 途径 | 位置 | 当前值 |
| --- | --- | --- |
| 源码(monorepo 根) | `D:\deepseek harness\deepseek-harness\package.json` → `"name": "@deepseek-ai/dsh-root", "version": ...` | `0.1.2-alpha.1` |
| 运行时 | `dsh --version`;实现:`apps/cli/src/bin.ts` 的 `readVersion()` 读 `apps/cli/package.json` | `0.1.2-alpha.1` |
| 各 workspace 包 | 每个包的 `package.json`(由 `scripts/release/bump.ts --family dsh` 统一 bump) | 与根一致 |

注意:该仓库本机拷贝**不是 git 仓库**(无 `.git`),不能用 git tag 判版本;CLI 包版本即发行版本。

---

## 2. client 插件如何编写与注册

### 2.1 包声明(package.json)

以官方插件 `packages/client/ui-chat/package.json` 为样例:

```jsonc
{
  "name": "@deepseek-ai/dsh-client-ui-chat",
  "exports": {
    ".":       { "default": "./lib/index.js" },   // host/构建面入口
    "./client": { "default": "./lib/client.js" }  // 浏览器 bundle(host 会服务这个)
  },
  "dsh": {
    "client": {
      "platform": "web",
      "inject": [ /* 依赖的其他 client 包名(模块图边,先于本包加载) */ ],
      // 可选: "immediately": true —— stage-one 预取
      // 可选: "external": [...] —— 非基线模块请求
    }
  }
}
```

扫描与装载机制(`docs/subsystems/client-modules.md`,服务 `ctx.clientModules`,源 `packages/client/modules/src/index.ts`、`src/client/manifest.ts`):

- host 半扫描 Loader entries 里声明了 `dsh.client` 的包,组合出 `WebBootGraph` 并注入 `window.__DSH_BOOT__`;
- bundle 由 `GET /plugins/??<pkg>/client.js,...&rev=<rev>` 组合路由服务(immutable 缓存,HMR 用单资源 revisioned URL);
- 浏览器半(`ctx.modules`,`packages/client/modules/src/client/system.ts`)惰性 CJS:执行 bundle 只注册 factory,首次 import/物化才跑模块体;
- 基线共享模块表 `PLATFORM_MODULES`(React、cordis、静态 UI 库)由 shell 种下(`packages/client/web/src/platform.ts`),插件 externals 只能解析到基线或显式 `external` 请求;
- 扫描是增量的:每个 `internal/plugin` 事件标记 dirty 并微任务 flush,插件包的加载/卸载无需重启 fiber。

### 2.2 插件体(cordis 插件形态)

client 入口(如 `packages/client/ui-chat/src/client/index.ts` → `apply.ts`)的标准形态:

```ts
/** 浏览器半入口,经 tsdown 打成 lib/client.js */
import type { Context } from '@deepseek-ai/cordis'

/** 声明依赖的 client 服务(cordis 等待它们就绪后才跑 apply) */
export const inject = ['sessions', 'remote', 'uiSession', 'slots', 'locale']

export function apply(ctx: Context): void {
  // 1) 订阅远程事件(allowlist 内)
  ctx.remote.$on('approval/request', function (request, next) { /* ... */ })

  // 2) 注册 UI 槽位(往对话视图/设置页/输入框挂组件)
  ctx.slots.inject('conversation.composer', () => ctx.slots.register({ name: 'conversation.composer', /* ... */ }, MyPanel))

  // 3) 本地副作用(随插件卸载自动清理)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'my-plugin: dictionaries')
}
```

真实样例:
- `packages/client/ui-approval/src/client/index.ts` —— `ctx.remote.$on('approval/request', ...)` waterfall 消费 + `ctx.slots.inject('conversation.composer', ...)` 审批面板;**这是「client 插件监听 host 事件」的官方最小样例**;
- `packages/client/ui-chat/src/client/apply.ts` —— `ctx.uiSession.provide(...)` 提供 session 级 hooks、`ctx.uiConversation.binding(binding).target('chat')` 订阅会话快照(observable snapshot,`subscribe(listener)` 模式);
- 教程:`docs/cordis-tutorial/01-first-plugin.md`(插件骨架)、`04-events.md`(`declare module '@deepseek-ai/cordis' { interface Events }` 声明合并 + `ctx.emit`/`ctx.on`,dispatch 模式 emit/parallel/serial/bail/waterfall,API 参考 `docs/cordis-api/events.md`)。

### 2.3 两种部署形态

1. **静态插件包(npm 包 + Loader)**:按 2.1 声明 `dsh.client`,构建出 `lib/client.js`,随 host 进程启动被扫描装载。需要 `pnpm run build` 产出 bundle,缺 bundle 激活时响亮报错。
2. **动态 cordis 包(extensions 子系统)**:模型经 `cordis_define` / `cordis_run` / `cordis_stop` / `cordis_undefine` 工具定义和运行版本化包;host 半在进程内跑,浏览器半由 `packages/extensions/cordis-client-runner` 在页面里加载(纯 JS async function,无 TS/JSX/imports,只能用注入的 `React/console/styles/host`),`packages/extensions/ui-cordis` 提供审批面板与 `@pluginId` 输入源。相关事件:`cordis/request-run`、`cordis/request-run-resolved`、`cordis/dynamic-package`、`cordis/dynamic-retract`(均在 allowlist 中)。

---

## 3. host → client 通道(转发与广播)

### 3.1 物理通道

- **WebSocket mux:`/api/remote.mux`**(常量 `REMOTE_STREAM_MUX_PATH`,`packages/api/gateway/src/stream-protocol.ts:6`),由 `@deepseek-ai/dsh-api-gateway` 拥有;上面跑多条「逻辑流」(logical streams):`$events`(转发事件)、`remote.session.control`(全局控制快照流)、`remote.session.follow`(单会话 journal 流)、各 Remote namespace 流。
- unary RPC 走 `POST /api/*`(browser→host)。
- 认证:`?token=` 换签名的 HttpOnly cookie(30 天),回环/trustedHosts 校验(`packages/client/connection/README.md`)。
- 开发态 HMR 是独立 SSE 通道(`packages/client/hmr`),只管 bundle 热更,不承载业务事件。

### 3.2 事件转发链(emit 类)

```
host cordis ctx.emit('api-session/status', ...)
  → api-remotes host face 的 allowlist 监听器(packages/api/remotes/src/index.ts: remoteEventSource)
  → RemoteEventQueue(仅 JSON-safe 参数,assertJsonArgs)
  → ctx.typertGateway.registerRemoteEvents(...) 暴露的 $events 逻辑流
  → WebSocket /api/remote.mux
  → client gateway → ctx.remote.$on(event, listener) 分发
```

- 转发键集合 = `API_REMOTE_FORWARDED_EVENTS`(`packages/api/remotes/src/remote-events.ts`),**新增一个可转发事件只需要在这个数组加一项**(类型投影、消费键面、host 转发循环都由它派生)——但如果只做 client 插件(不改 dsh 源码),可监听集合就以这个数组为上限。
- waterfall 类(`approval/request`、`user-questions/request`)会把 client 的返回值带回 host 监听链(批准/拒绝决策即由此上行)。
- 连接代际:`$events` 流先发 `{ type: 'ready', clientId, host: { home } }` 再投事件;断流后 `ConnectionController` 退避重连(**事件不重放**,可靠恢复要靠打开时的 baseline 查询/`session.page`)。

### 3.3 会话日志流(不走 allowlist 的第二通道)

`remote.session.follow({ address }, signal)`(`packages/api/session-controller/src/client/transport.ts`,`SessionEventStream extends RemoteJournalStream`)按会话实时 append `SessionEvent`;`remote.session.control`(快照流)给全局队列/后台作业/投影 baseline + 增量(`SessionControlFrame`:baseline/queue/jobs/projection,`packages/api/session-controller/src/types.ts:504`)。client 侧由 `ctx.sessions` / `ctx.uiSession` / `ctx.uiConversation` 封装成 observable snapshot 供订阅。

---

## 4. client 可监听事件穷举

### 4.1 A 层:`ctx.remote.$on` 可监听的 host 事件(allowlist,全量)

来源:`packages/api/remotes/src/remote-events.ts` + `packages/api/session-controller/src/remote-events.ts` + `packages/api/session-controller/src/types.ts:511-545`。

| 事件 | 模式 | payload | 语义(对音效插件的价值) |
| --- | --- | --- | --- |
| `agent-preset/selected` | emit | 选中的 agent preset | 用户切换预设 |
| `approval/request` | **waterfall** | `{ toolName, callId?, reason?, signal? }`(经 `this` 携带 Agent scope) | **权限批准请求弹出**(可拦截;`next()` 放行)→ 审批提示音 |
| `api-session/added` | emit | `SessionSummary` | **会话开始/新建**(列表可见) |
| `api-session/removed` | emit | `sessionId` | **会话结束/关闭** |
| `api-session/status` | emit | `(sessionId, running: boolean)` | **agent 开始/停止运行** → 开始/结束提示音的主信号 |
| `api-session/activity` | emit | `(sessionId, updatedAt)` | 用户消息推进会话列表活跃时间 |
| `api-session/error` | emit | `(sessionId, message)` | **agent 会话外错误** → 错误音 |
| `commands/change` | emit | 命令注册表变化 | 命令集变更 |
| `credentials/reference-updated` | emit | 凭据引用更新 | 凭据变化 |
| `cordis/request-run` | emit | 动态插件运行请求 | 动态插件待审批 |
| `cordis/request-run-resolved` | emit | 运行请求结果 | 动态插件审批完成 |
| `cordis/dynamic-package` | emit | 动态包状态 | 动态插件包变化 |
| `cordis/dynamic-retract` | emit | 动态包撤销 | 动态插件卸载 |
| `cordis/inspect-query` / `cordis/inspect-query-resolved` | emit | inspect 查询 | 调试查询 |
| `llm/adapters-updated` | emit | provider 适配器变化 | 模型配置变化 |
| `settings/document-updated` | emit | 设置文档更新 | 设置变化 |
| `user-questions/request` | **waterfall** | 提问请求 | **agent 向用户提问** → 提示音(可拦截) |

类型面:`ctx.remote.$on` 的键类型由 `ApiRemoteForwardedEvent` 派生(`packages/api/remotes/src/types.ts`);监听器签名类型 `TypertClientEventListener<'事件名'>`(来自 `@deepseek-ai/dsh-typert-protocol`),事件签名来自 owner 包的 `./types` 声明合并。

### 4.2 B 层:会话日志 `SessionEvent`(任何 client 插件经 session 流实时可得,全量)

来源:`packages/core/session/src/types.ts:221-325`(`SessionEventMap`),经 `remote.session.follow` 实时 append、历史经 `remote.session.page`。

| 事件 | payload | 语义 |
| --- | --- | --- |
| `turn/start` | `{ turn }` | **一轮开始**(claim 输入前)→ 开始音 |
| `turn/end` | `{ turn, reason }` | **一轮结束**。`reason.kind`: `completed` / `aborted`(取消,含 user/parent/hook/disposed)/ `blocked` / `error`(含 LlmFailure)/ `max-tokens` / `interrupted`(崩溃恢复)→ **完成音 vs 错误音的分级依据** |
| `step/start` / `step/end` | `{ turn, step }` | 单次模型调用+工具执行段边界 |
| `user/message` | `UserMessage`(含 `source`:人类直接输入 / `agent.inject` 合成上下文 / goal 续轮) | **消息发送** |
| `assistant/chunk` | `{ turn, step, chunk }` | token 级流块(粒度过细,不适合音效) |
| `assistant/message` | `{ turn, step, message, usage?, interrupted? }` | **assistant 消息成型**(含 token 用量) |
| `tool/call` | `{ turn, step, callId, name, arguments }` | **工具调用开始** |
| `tool/result` | `{ turn, step, message, error?: {name, code}, meta? }` | **工具调用结束**(含失败身份) |
| `request/header` / `request/context` | log-only | 请求头/路由元数据(不适合 UI) |
| `session/end-seed` | `{}` | 构造种子边界标记(log-only) |

声明合并可扩展(`SessionEventType = keyof SessionEventMap`,插件可 merge 新事件类型);surface 相关类型(`user/message`、`assistant/message`、`tool/result` 可带 `surfaceOp`)在 `types.ts:335-380`。

### 4.3 C 层:控制流/连接/本地 UI

| 来源 | 事件/信号 | 说明 |
| --- | --- | --- |
| `remote.session.control` 快照流 | `baseline` / `queue` / `jobs` / `projection` | 每会话输入队列、后台作业状态(`running/stopping/completed/killed/failed`,适合作业完成音) |
| `ctx.connection`(`packages/client/connection`) | generation ready → `onConnected`、`reconnecting` | 断线/重连提示音 |
| UI 交互(本地) | 自家 React 组件的 onClick 等 DOM 事件 | **只有自己注入的组件**;无全局点击总线 |
| `ctx.slots` | 槽位注册(`conversation.view`、`conversation.composer`、`settings.general.item`、`details` 等) | 扩展 UI 的正道;样例见 ui-chat/ui-approval |
| `ctx.inputTriggers`(`packages/client/ui-input-trigger`) | `/`、`@` 触发源注册 | 输入触发菜单 |
| commands(`packages/interaction/commands`,client 侧经 `commandsRemote`) | 命令注册/执行 | 斜杠命令 |

### 4.4 音效插件视角的推荐映射(供下一工单)

| 通知分级 | 主信号(通道) | 备选/备注 |
| --- | --- | --- |
| 需要用户介入(最高) | `approval/request`(A,waterfall)、`user-questions/request`(A,waterfall) | 独立最高优先级音 |
| 回合完成(正常) | journal `turn/end` reason=completed(B) | `api-session/status` running=true→false(A)更粗粒度 |
| 回合失败/中断 | journal `turn/end` reason=error/aborted/max-tokens(B)+ `api-session/error`(A) | 分级不同音 |
| 会话生命周期 | `api-session/added` / `api-session/removed`(A) | — |
| 工具开始/结束 | journal `tool/call` / `tool/result`(B) | 可按 `tool/result.error` 或 `name` 细分 |
| 后台作业完成 | control 流 `jobs` 帧(C) | `status: completed/failed` |
| 消息发送(用户) | journal `user/message` source=human(B)或 `api-session/activity`(A) | — |

---

## 5. 对音效插件(ns-notify)的架构建议

1. **形态**:建议做静态 client 插件包(2.1 声明 + `./client` bundle),随 host 启动自动装载;动态 cordis 包适合试验(可热载,但浏览器半部受限纯 JS、且刷新即清)。
2. **事件接线**:一个 `apply(ctx)` 里同时接 A、B 两层:
   - `ctx.remote.$on('approval/request', ...)` / `api-session/*` —— 粗粒度、低噪音、天然分级;
   - `ctx.sessions`/`ctx.uiConversation` 的 observable snapshot 订阅拿 journal `turn/end` 的 `reason` —— 区分完成/失败/中断的关键。
3. **inject 清单**:`['remote', 'sessions', 'settingsScope', 'locale', 'slots']`(参照 ui-approval/ui-chat);设置页用 `slots.inject('settings.general.item', ...)` 挂开关,音量/开关存 `ctx.settingsScope` 命名空间(参照 ui-chat 的 `chat-settings.ts`)。
4. **风险/不可行点**:
   - **浏览器自动播放策略**:AudioContext 必须在用户手势后 resume;插件应在首次交互(如 composer 输入)时预热音频上下文,dsh 侧无法绕过。
   - **事件不重放**:断线重连后不会补发错过的 emit 事件(`packages/api/remotes/README.md` Known Limitations);错过一两声提示可接受,无需补偿逻辑。
   - **allowlist 是硬边界**:不改 dsh 源码就无法给 `$on` 增加 host 事件(如 `subagent/start`、`workflow/*` 不可直达);但工具调用/回合结束等所需信号都能从 B 层 journal 拿到,不构成阻塞。
   - **没有全局 UI 点击总线**:「用户点击任何 UI 元素」这类事件无法旁听,只能监听自己组件内的事件——音效插件通常也不需要。
   - `assistant/chunk` token 流与 `request/*` log-only 事件不适合也不需要消费。

## 6. 关键代码路径索引

- 转发 allowlist:`packages/api/remotes/src/remote-events.ts`;host 转发循环:`packages/api/remotes/src/index.ts`
- WebSocket 端点:`packages/api/gateway/src/stream-protocol.ts:6`(`/api/remote.mux`)
- 会话事件契约:`packages/core/session/src/types.ts:221`(SessionEventMap)、`:155`(TurnEndReasonMap)
- client 会话流适配:`packages/api/session-controller/src/client/transport.ts`;api-session 事件声明:`packages/api/session-controller/src/types.ts:511`
- 插件表:`packages/client/modules/src/index.ts`(host 半)、`src/client/system.ts`(浏览器半);wire:`src/client/manifest.ts`
- boot shell:`packages/client/web`(两阶段 boot、PLATFORM_MODULES)
- 样例插件:`packages/client/ui-approval`($on waterfall)、`packages/client/ui-chat`(slots/uiSession/settings)、`packages/client/ui-input-trigger`、`packages/client/ui-message-feedback`
- 动态插件:`packages/extensions/cordis-host-runner`、`cordis-client-runner`、`ui-cordis`
- 文档:`docs/subsystems/client-modules.md`、`docs/subsystems/web-server.md`、`docs/event-producer-consumer.md`(host 全事件矩阵)、`docs/cordis-tutorial/04-events.md`、`docs/cordis-api/events.md`
- 版本:`package.json`(根)、`apps/cli/package.json` + `apps/cli/src/bin.ts`(`dsh --version`)
