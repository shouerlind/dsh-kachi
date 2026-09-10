# dsh 三个「缺口」事件通路调研（只读）

> **本稿是 2026-09-10 的只读核查快照。** 文中三条建议已在 **v0.1.2** 落地
> （A 层 `$on` 接提问与 `api-session/error`、C 层 `connection.state` 接断线与恢复，
> 见 NOTES「三个缺口音接线」）—— 保留原文是为了留住当时的证据链（文件:行号），
> **不代表现状**；判现状请看 SPEC 与 NOTES。
>
> 该稿原在分支 `research-dsh-missing-channels`（提交 `4f57dd4`）；结论落地后已并入
> `main`，分支于 2026-09-10 删除（如需取回：`git push origin 4f57dd4:refs/heads/research-dsh-missing-channels`）。

本次调研所依据的 dsh 版本：**本地插件运行时**为 profile `node_modules/@deepseek-ai/dsh-*` **0.1.5-rc.1**（`dsh-api-remotes` / `dsh-user-questions` / `dsh-api-session-controller` / `dsh-client-connection` 均为 0.1.5-rc.1，位于 `C:/Users/kona/.dsh/profiles/node_modules/@deepseek-ai/`）；**插件构建/类型边界**为仓库 `node_modules/@deepseek-ai/` **0.1.2-rc.1**（即 NOTES 所引版本，二者在本仓库 `node_modules` 下内容一致）；**dsh 本体 CLI**（`AppData\Roaming\npm`）为 **0.1.1-rc.2**（仅供启动，运行时实际装载 profile 包）。**远端最新版本：未能确认**——本环境 `npm view @deepseek-ai/dsh` 网络超时（详见「未能确认的事项」）；但本地 profile 已为 0.1.5-rc.1，较 NOTES 的 0.1.2-rc.1 更新。

> 一句话结论：NOTES「通路差异与缺口」段与 gh issue #19（CLOSED / `wontfix`）所断言的「三个无通路」事件，在**当前安装的各版本 dsh 包（0.1.2-rc.1 仓库边界 + 0.1.5-rc.1 运行时）中均已存在可旁听通路**。下文逐条给出静态证据（文件:行号），全部来自主源（本机 dsh 包实现 + 本仓库 `node_modules` 插件面 API 包），未运行真实会话、未改任何文件、未碰 git。

---

## 1. agent 提问请求（`user-questions/request`）

**判定：已有通路**（NOTES「提问专属音：无插件可旁听通路」为过时结论）。

证据：

- 该事件**在转发白名单内**，且为 `waterfall` 模式（插件必须 `return next()` 才能放行提问流）：
  - `D:/deepseek harness\ns-notify\node_modules\@deepseek-ai\dsh-api-remotes\lib\index.js:17-90`（`API_REMOTE_FORWARDED_EVENTS` 数组）→ `:87` `{ event: "user-questions/request", mode: "waterfall" }`。
  - 类型层同样将其列为 `ctx.remote.$on` 的合法键：`D:/deepseek harness\ns-notify\node_modules\@deepseek-ai\dsh-api-remotes\lib\types\remote-events.d.ts:64`。
  - profile 0.1.5-rc.1 同一白名单含相同条目（已核验）。
- **主机确实发射该事件**（不是死条目）：`ask_user_question` 工具经 `@deepseek-ai/dsh-user-questions` 包以 waterfall 发出，见 `C:/Users/kona/.dsh/profiles/node_modules/@deepseek-ai/dsh-user-questions/lib/index.js:69`：`this.ctx.waterfall("user-questions/request", request, noAnswerer)`（无 agent 时）/`this.ctx.waterfall(scopeTarget(agent, agent), "user-questions/request", …)`。
- **waterfall 事件确实被转发到客户端**（不是只列不转）：`D:/deepseek harness\ns-notify\node_modules\@deepseek-ai\dsh-api-remotes\lib\index.js:104-120`（`remoteEventSource` 对 `mode === "waterfall"` 走 `forwardWaterfall`）；`:178-195` 的 `forwardWaterfall` 把 waterfall 作为 pending 帧推入网关队列，客户端 `$on` 监听器被调用且需 `return next()` 才能推进。
- **客户端已处理该 waterfall 帧**：`D:/deepseek harness\ns-notify\node_modules\@deepseek-ai\dsh-client-connection\lib\client.js:4066-4072`（`questionInvocation` fixture 印证客户端连接解析 `user-questions/request` waterfall 帧）。
- 参数形态（仅作接线参考）：`D:/deepseek harness\ns-notify\node_modules\@deepseek-ai\dsh-scope\lib\invariant.js:36` 断言 `args[0]["agent"]`；fixture 显示 `request.questions` 为问题数组。

dsh-kachi 该怎么接：`ctx.remote.$on('user-questions/request', async (request, next) => { engine.play('notify-important'); return next() })` —— 它是 **waterfall**，`return next()` 不可省略，否则会阻断 agent 的提问流；接 `request.questions` 取问题内容。可替代现有 layer-b 对 journal `approval/asked` 风格的旁听，独立覆盖「agent 向用户提问」这一刻（介入级，SPEC §5 行 3）。

---

## 2. 连接状态变化（断线 `reconnecting`）

**判定：已有通路**（NOTES「连接状态为 ConnectionController 私有（单消费者 sinks），无旁听通路」混淆了私有 owner sinks 与公共订阅面）。

证据：

- `ctx.connection` 是**公共**服务，且其中 `state` 与 `generation` 是多消费者只读订阅面（不是单消费者）：
  - `D:/deepseek harness\ns-notify\node_modules\@deepseek-ai\dsh-client-connection\lib\client.js:4825`：`ctx.provide("connection", handle)`。
  - `:4765-4772`：`handle.state = { getSnapshot, subscribe }`，底层 `stateListeners` 是普通 `Set`，任意插件可 `add`，与单消费者 owner 无关；`:4756-4763` 的 `generation` 同理。
  - 类型定义：`D:/deepseek harness\ns-notify\node_modules\@deepseek-ai\dsh-client-connection\lib\types\client\index.d.ts:32-37`（`ConnectionStateSource`：`getSnapshot(): ConnectionState | undefined` + `subscribe(listener)`），`:82`（`readonly state: ConnectionStateSource`）。
  - `ConnectionState` 取值：`D:/deepseek harness\ns-notify\node_modules\@deepseek-ai\dsh-client-connection\lib\types\client\connection.d.ts:25` —— `'connected' | 'disconnected' | 'connecting'`。**`connecting` 即断线重连那一刻**。
- **重连时刻确实进入 `connecting` 态并发布**：`D:/deepseek harness\ns-notify\node_modules\@deepseek-ai\dsh-client-connection\lib\client.js:148`：`this.emitState("connecting")`（每次重试前）；`:216-219` `emitState` → `publishState` → 通知 `stateListeners`。恢复成功时 `:204` `emitState("connected")`。
- **单消费者部分是 owner 的 `sinks`，而非订阅面**：`handle.start(sinks, config)` 在 `:4788` 标注「the stream loop is already owned by another consumer」（仅 API Gateway 持有 loop），`ConnectionSinks`（`onConnected`/`onStateChange`/`onReconnectRequested`）见 `connection.d.ts:27-34` 是 owner 私有回调。但 `state`/`generation` 公共订阅面与之解耦，插件无需成为 owner 即可监听。
- profile 0.1.5-rc.1 同结构：`connection.d.ts:17`（`ConnectionState` 含 `connecting`）、`index.d.ts:78`（`readonly state`）、`client.js` 含 `stateListeners` Set。

dsh-kachi 该怎么接：`ctx.connection.state.subscribe(() => { const s = ctx.connection.state.getSnapshot(); if (s === 'connecting') engine.play('warn'); else if (s === 'connected') engine.play('reconnect') })` —— 只读公共订阅面，**无需**成为 loop owner，也**无需** `return next()`；`connecting`=断线警示音（SPEC §5 行 16，前台级 90%），`connected`=恢复音（行 17）。注意三种态 `connecting`/`connected`/`disconnected` 及首 outcome 前快照为 `undefined`；恢复音现有 layer-b 走 journal replace 帧的去重逻辑可保留或改用此 `connected` 信号。

---

## 3. 会话级错误（`api-session/error`）

**判定：已有通路**（NOTES「无转发、无 journal 审计」——「无 journal 审计」属实，但「无转发」不实）。

证据：

- 该事件**在转发白名单内**，为 `emit` 模式（普通发射，无需 `return next()`）：
  - `D:/deepseek harness\ns-notify\node_modules\@deepseek-ai\dsh-api-remotes\lib\index.js:17-90` → `:35` `{ event: "api-session/error", mode: "emit" }`；类型层 `lib\types\remote-events.d.ts:25`。profile 0.1.5-rc.1 同含。
  - `emit` 的转发实现：`D:/deepseek harness\ns-notify\node_modules\@deepseek-ai\dsh-api-remotes\lib\index.js:105-110`（`ctx.on(event, (...args) => queue.push(...))`）。
- **主机确实发射该事件**：`C:/Users/kona/.dsh/profiles/node_modules/@deepseek-ai/dsh-api-session-controller/lib/index.js:2759`：`this.ctx.emit("api-session/error", agent.id, errorChain(error))`；`:2781`：`if ("error" in result) this.ctx.emit("api-session/error", sessionId, result.error.message)`。类型层 `lib\types\index.js:228` 同样 `ctx.emit('api-session/error', …)`。
- **客户端已消费该事件**（印证 `$on` 面可用）：`C:/Users/kona/.dsh/profiles/node_modules/@deepseek-ai/dsh-api-session-controller/lib/client.js:3519`：`ctx.remote.$on("api-session/error", (sessionId, message) => { … })`（dsh 自身 client 即如此接收，插件用同一 API）。

dsh-kachi 该怎么接：`ctx.remote.$on('api-session/error', (sessionId, message) => { engine.play('error') })` —— `emit` 模式，**无需** `return next()`；接 `(sessionId, message)` 两个参数；对应 SPEC §5 行 7 的会话级错误音（介入级）。NOTES 称「错误面由 turn-end-error + jobs-failed 覆盖」仍可保留作兜底，但本事件已可直接旁听，可与 `turn/end` error 去重避免双响。

---

## 未能确认的事项

- **远端最新 dsh 版本**：本环境执行 `npm view @deepseek-ai/dsh version/versions --json` 连续超时（疑似沙箱网络受限，无报错仅 SIGTERM）。按指令「找不到就说找不到」——远端版本未能确认。仅能确认本地 profile 已为 0.1.5-rc.1，比 NOTES 的 0.1.2-rc.1 更新；无法核对 0.1.5-rc.1 之后是否有更新的稳定/rc 版及其 changelog 是否提及事件转发。
- **运行时实际触发未经活体验证**：上述三条均基于**安装包源码的静态分析**（白名单条目存在 + 主机发射点存在 + 客户端/公共订阅面存在 + 转发逻辑存在）。本环境未运行真实 dsh 会话，未能 100% 确认这些事件在真实连接/会话中确实到达插件监听器。静态链路完整，但「代码存在」≠「运行必响」，最终需一次实机走查坐实。
- **与 NOTES / gh issue #19 的直接矛盾未完全解释**：NOTES（标 0.1.2-rc.1）与 issue #19（CLOSED `wontfix`，「dsh 升级恢复通路后再补」）均断言这三事件在 0.1.2-rc.1「无通路」，但本仓库 `node_modules` 下的 **0.1.2-rc.1** 包与 profile 的 **0.1.5-rc.1** 包内**均含**对应白名单条目 / 公共 `state` 订阅面 / 主机发射点。issue #19 的「What to build」反而引用「0.1.2-alpha.1 研究：allowlist 含 user-questions/request、api-session/error；connection.generation 可订阅」——即上游研究本就认为这些通路存在。可能的版本/发布态错位（0.1.2-rc.1 标签被重发、或用户当年实测的 profile 为更早构建）**无法从静态分析判定**，列为最不确定点。
- **`user-questions/request` 参数完整形态**：仅核对了 `dsh-scope` invariant 的 `args[0]["agent"]` 与 fixture 的 `request.questions`，未逐字段核对 `request` 全貌（对「能否旁听」判定无影响，但影响接线时取哪些字段）。
- **实现取舍未做评判**：本调研只判定「能否旁听」，未评估 dsh-kachi 应改为 `$on` 这些事件、还是保留现有 journal/快照镜像方案（如 layer-b 用 `approval/asked`、layer-c 用 `sessions.list` 镜像、`api-session/added/removed` 同样在白名单内却未用 `$on`）。这是实现层决策，超出只读调研范围。
