# dsh 三个缺口音的旁听通路核查(2026-09-10)

- 工单:[shouerlind/dsh-kachi#19](https://github.com/shouerlind/dsh-kachi/issues/19)(曾以 `wontfix` 关闭;本次为准入复核,不预设结论)
- 调查对象:**本机实际运行的运行时 0.1.5-rc.1**(不是 NOTES / 工单里写的 `0.1.2-rc.1`)
- 日期:2026-09-10
- 用途:回答「三条缺口音现在能不能接」,为接线工单提供事实基础

---

## 0. 结论速览(TL;DR)

**三条通路全部开放,`wontfix` 的前提已被运行版本推翻。** 工单 #19 的三条「无通路」理由(`user-questions/request` 无 `$on` 转发、连接状态为 controller 私有、`api-session/error` 无转发无审计)在当前运行时逐条不成立。

| 缺口音(事件 ID) | 信道 | 0.1.5-rc.1 | 证据 |
| --- | --- | --- | --- |
| 提问专属音 `questions-request` | `ctx.remote.$on('user-questions/request')`,mode `waterfall` | ✅ 可接 | 白名单 `remote-events.d.ts:67`;host 侧另有 waterfall→pending 桥(`dsh-api-remotes/lib/index.js:182`) |
| 会话级错误音 `session-error` | `ctx.remote.$on('api-session/error')`,mode `emit`,签名 `(sessionId, message)` | ✅ 可接 | 白名单 `remote-events.d.ts:19`;签名 `dsh-api-session-controller/lib/types/types.d.ts:571` |
| 断线警示音 `reconnecting` | `ctx.connection.state`(`ConnectionStateSource`:`getSnapshot()` / `subscribe()`,值 `'connected' \| 'reconnecting'`) | ✅ 可接 | `dsh-client-connection/lib/types/client/index.d.ts:31-34`(类型)、`:77-78`(`ConnectionHandle.state`);实现 `provide("connection", handle)`(`lib/client.js`) |

三条音的槽位与音量**早已在 `src/shared/slots.ts` 就绪**(`questions-request` → `notifyImportant`/`intervention`:122 行;`session-error` → `error`/`intervention`:133 行;`reconnecting` → `warn`/`foreground`:136 行),接线是纯增量。

### 0.1 附带发现(不在 #19 范围,同源)

1. **`api-session/added|removed|status|activity` 亦全部转发** → `src/client/wiring/layer-c.ts` 头注「0.1.2-rc.1 无 api-session/\* 的 $on 转发;list 即这些事件的镜像」已过时,`sessions.list` 快照 diff 变通可退役。
2. **`ctx.connection.generation.subscribe()`** 提供 generation 的建立/替换/丢失 → 恢复音(`reconnected`)可用真信号替换 `layer-b` 的「重连 replace 帧 + 5s 窗口去重」启发式,NOTES 里「seq-gap 修复可能偶发误报」随之消失。
3. `api-session/error` 可接后,错误面不再是「turn-end-error + jobs-failed 覆盖」的全集 —— 与 #19 原文措辞需要对齐(见 §2.2)。

---

## 1. 版本口径(此前的误判来源)

| 口径 | 值 | 说明 |
| --- | --- | --- |
| **profile 实际解析** | **`0.1.5-rc.1`** | `~/.dsh/profiles/node_modules/@deepseek-ai/*` 全部 symlink 到 `%APPDATA%/in.dsh-plug.dsh-launcher/versions/0.1.5-rc.1/node_modules/.pnpm/...` |
| 全局 npm 包 | `0.1.1-rc.2` | `~/AppData/Roaming/npm/node_modules/@deepseek-ai/dsh`;其 `lib/` 只有 5 个 js,业务代码在依赖包内 —— **`dsh --version` 不能代表运行版本**(它读的是这个 npm 装出来的包) |
| 本机源码树 | `0.1.2-alpha.1` | `D:\deepseek harness\deepseek-harness`,落后运行时两个 rc,仅可作参照 |

**教训**:NOTES 与 #19 写的「0.1.2-rc.1 实测」既不是当前 profile 的解析结果,也没在本次复核中复现;判断运行时能力必须看 `~/.dsh/profiles/node_modules/` 的解析(或用 launcher 版本目录),不能看 `dsh --version`。

---

## 2. 证据明细

### 2.1 转发白名单(`0.1.5-rc.1` 的 `API_REMOTE_FORWARDED_EVENTS` 全量)

`dsh-api-remotes/lib/types/remote-events.d.ts`:19 条,其中与本插件相关:

- `approval/request` (waterfall) —— 已用 journal `approval/asked` 实现,可保留(B 层更稳);
- `api-session/activity|added|error|removed|status` (emit);
- `user-questions/request` (**waterfall**);
- `settings/document-updated`、`commands/change`、`llm/adapters-updated` 等其余条目与本插件无关。

### 2.2 待实机验证项(静态核查不覆盖)

1. **waterfall 经 `$on` 的到达性**:`user-questions/request` 的签名是 `(this: Scoped<Agent>, request, next: () => Promise<AskUserQuestionAnswer>)`(`dsh-user-questions/lib/types/types.d.ts:77`)。需实机确认 client 插件拿到的是否只读镜像、是否**必须**调用 `next`(监听者不调用会不会卡住提问流程)。这是接线前唯一可能翻车的点。
2. **`ctx.connection.state` 的冷启动语义**:首连前 `getSnapshot()` 为 `undefined`,`ConnectionStateSource` 注释写明「owned loop 的恢复生命周期」。警示音只在 `'connected' → 'reconnecting'` 跃迁时响,不能把首连前的 `undefined` 当断线。
3. **`ctx.connection` 注入时序**:该服务由 `dsh-client-connection` 在 `inject: []`(wire root)下 `provide`,插件需把 `'connection'` 加进 `inject` 数组;gateway 未 `start()` 时快照是否恒为 `undefined` 待实测。
4. **重复响度**:`session-error`(介入级)与 `turn-end-error`/`jobs-failed`(均介入级)在同一故障下可能连响 —— 这是行为取舍(SPEC §5 行 7/16 的关系),须由用户裁定,不是技术缺口。
5. **同刻双响**:#19 原文已指出「提问时刻 `tool/call` 按键音仍响」。提问音落地后需决定是否抑制该刻按键音。

---

## 3. 建议下一步(按序)

1. **`/grill-with-docs`**:先定行为口径 —— 首连 `undefined` / 重连 5s 抖动如何验收;`session-error` 与既有错误音的重叠是否接受;提问音与按键音同刻是否抑制。技术面无阻塞,阻塞全在行为契约。
2. **开一条新工单**(#19 已 `wontfix` 关闭,重开成本高于新开,历史理由需保留)承载三条接线;拆三个 commit,沿用既有「文件不重叠」分组:事件行 + `inject` + 接线一份。
3. **`api-session/*` 变通退役**另起一单(纯重构,不与接线混在一起),同批可把恢复音从 journal 启发式切到 `generation.subscribe()`。
4. 验收按仓库惯例:接口级测试 + 实机走查(重启 dsh → **硬刷新页面** → 断网/拔流触发 `reconnecting`),结论记 `NOTES.md`。

## 4. 未做的事

- 未实机跑通(本次是源码/类型面静态核查),§2.2 五条待验证项一个都没结。
- 未改任何代码,未动 `SPEC.md`,未重开 #19。
- 结论只对 **0.1.5-rc.1** 成立;运行时升级后需复核白名单与 `ConnectionHandle` 形状。
