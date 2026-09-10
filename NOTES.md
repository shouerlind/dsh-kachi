# 实现备忘(dsh-kachi)

## 运行时事实(0.1.5-rc.1 实测;启动器有多个 home/版本,见「启动器、版本与 home」一节)

- 双面插件:`dsh.bundle.patch`(cordis.patch.yml `- insert: [{id, name: 包名}]`)+ `dsh.client{platform:'web'}` + `exports["./client"]`。只声明 `dsh.client` 不会被装载(client 图来自 host Loader entries 扫描)。
- client bundle 外壳:`window.__ModuleLoader__.load({id:"<包名>",factory:(require)=>{var module={exports:{}};var exports=module.exports; ...; return module.exports;}})`;externals 仅基线(react、cordis、client-store、ui-slots、ui-primitives)。
- A 层 allowlist 与 SPEC 研究一致;approval/user-questions 是 waterfall,**旁听必须 return next()**。
- B 层:`ctx.sessions.list`(SnapshotStore,含 jobsBySession)→ `binding(id).session.open()`(幂等,拉尾页)→ `eventSource`(change: replace/prepend/append;seq 门控防历史回放)。人类输入 = `message.source.kind === 'user'`;手动取消 = `turn.end.reason.reason.kind === 'user'`(0.1.2-rc.1 的 MessageSourceMap 是 user/plugin/model/tool)。
- C 层:`ctx.connection.state`(ConnectionStateSource:getSnapshot/subscribe,值 `connected|disconnected|connecting`)与 `generation`;jobs 经 `list.jobsBySession` diff。`state` 是公共多消费者订阅面 —— 断线/恢复音的唯一来源(早期「controller 私有→无通路」的结论已作废)。
- 设置:host `ctx.settings.register(ns, schemastery schema)`;client `ctx.settingsScope.bind({namespace})`;UI 槽位 `settings.general.item`(自绘行)。
- 资产:`/plugins` 只服务 JS。host 半 `ctx.webServer.register({kind:'prefix',path:'/dsh-kachi',handler})` 提供 WAV(已验证 200 + 穿越 404)。

## 已踩的坑

- `dsh plugin --profile web add .` 在带空格路径上会把路径按空格拆成多个依赖(写入 profile package.json),且**会重置 cordis.patch.yml**(用户注释丢失,已手工恢复)。正确姿势:手工写 profile package.json(`link:` 协议)+ 恢复 patch + pnpm install。
- 普通路径 `add` 对 pnpm 是 copy;`link:` 是 symlink(重建产物 HMR 直接可见)。开发期用 link。
- 新增 loader entry 在主实例(3080)上未热装载;独立 profile 实例(kachi-test,3099)验证一切正常。主 profile 需要一次 dsh 重启生效(用户用 restart-dsh.ps1,注意 dsh host 承载 agent 会话本身)。

## 测试实例

- `C:\dsh-kachi-dev` junction(避开空格路径 bug)→ 本仓库。
- kachi-test profile(~/.dsh/profiles/kachi-test,bundles: base + web-app + dsh-kachi)。
- 启动:`node "%APPDATA%\npm\node_modules\@deepseek-ai\dsh\lib\bin.js" --profile kachi-test --port 3099`(在 ~ 下执行)。
- 浏览器已验证:boot graph 含 dsh-kachi、点击解锁后 fetch boot.wav、无 console 错误。

## 通路差异与缺口(0.1.2-rc.1 实测,评审确认)

- **审批音**:journal 审计事件 `approval/asked`(该版本无 approval/request 的 $on 转发)。
- **提问专属音**:无插件可旁听通路(`question/requested` mux 帧镜像为 runtime 私有 pending,
  journal 无记录);提问时刻 tool/call 按键音仍响。dsh 恢复通路后可接。
- **断线警示音(reconnecting)**:连接状态是 ConnectionController 私有(单消费者 sinks),
  无旁听通路 → 未实现;**恢复音**经 journal 重连后 resync 的 replace 帧触发(5s 窗口去重,
  seq-gap 修复可能偶发误报,可接受)。
- **api-session/error**:无转发、无 journal 审计;错误面由 turn-end-error + jobs-failed 覆盖。
- **事件音量系数**(§5 音量列):per-shot GainNode 线性系数 ×(槽位²×总²平方映射)。

> **⚠️ 本节三条「无通路」的理由已过时(2026-09-10 复核,详见
> `research/dsh-missing-channels.md`,分支 `research-dsh-missing-channels`)。** 三条理由都是
> 在 `0.1.2-rc.1` 上得出的,而 profile 现在实际解析到 **`0.1.5-rc.1`**:`user-questions/request`
> 已在转发白名单(waterfall)、`api-session/error` 已转发、`ctx.connection.state` 已是公开
> client 服务。**缺口是「插件没接线」,不再是「dsh 无通路」** —— 该缺口已于 2026-09-10 接线，
> 见下方「三个缺口音接线」：本节四条「无通路/无审计」表述**全部作废**，保留仅作历史记录。
> 复核也纠正了版本口径:`dsh --version` 报的是 npm 全局包,不代表运行版本。

## 三个缺口音接线(2026-09-10)

三条都是**死条目** —— 事件 ID 早就定义在 `src/shared/slots.ts`(槽位/分级/音量/节流齐全),
`test/slots.test.ts` 也把它们钉进介入级白名单,但**全仓没有任何代码发射它们**。
改动只在接线层,数据层未动:

- **A 层(新模块 `src/client/wiring/layer-a.ts`)**:`ctx.remote.$on`
  - `user-questions/request`(SPEC §5 行 3):**waterfall，必须 `return next()` 放行** ——
    漏放行会阻断 agent 提问流，是本插件唯一会破坏 dsh 行为的接线点。
  - `api-session/error`(SPEC §5 行 7 的 A 半):emit，无 next。行 7 本就是双源合成行
    (`turn/end` error/max-tokens + `api-session/error`)，此前只实现了 B 半，
    这就是它「看起来已覆盖、实际没有」的原因。
- **C 层(`layer-c.ts` 新增 `wireConnection`)**:`ctx.connection.state.subscribe` —
  `connecting` → 警示音、`connected` → 恢复音。语义边界:首连不是断线(只有此前连上过
  `connecting` 才发声)，首条 `connected` 只建基线不响恢复音;`disconnected` 无映射(SPEC §5
  未列)静默，但**不复位已连上标记**，故断线后的重试照常发声;同值重发不算状态变化。
- **`layer-b.ts` 删掉旧恢复音路径**:原「第 2 次 replace 帧 + 5s 窗口去重」启发式整体移除,
  replace 现在只推进 seq 基线、不发声。这是**替换而非新增** —— 两条路径并存会双响,
  且旧路径有 seq-gap 误报史(见本节第 3 条)。`wireLayerB` 的 `opts.now` 参数随之删除。

刻意**不做**的事(免得日后被当成遗漏):

- **不把 `approval/request`、`api-session/added|removed` 迁到 `$on`**。它们虽同在 allowlist,
  但现有 journal / list 路径各自带 seq 门控与初始快照基线;换路径要重建这些门控,
  是独立工单。同一信号两条路径会双响,所以「只接缺口、不动既有」。
- **不给 `api-session/error` 新增去重机制**。它与 `turn-end-error` / `jobs-failed` 同槽
  (`error`),靠引擎既有的槽位节流窗(默认 200ms)防双响;若实机发现同一次失败的两路
  信号间隔超过节流窗而双响,再议加长窗口或加跨源去重。

验收:`test/layer-a.test.ts` 直接读 `@deepseek-ai/dsh-api-remotes` 的
`API_REMOTE_FORWARDED_EVENTS` 对账**事件名与模式**(名字/模式写错即红);
`test/layer-c.test.ts` 覆盖连接状态机(首连静默、断线发声、重连发声、disconnected 静默、
同值不重发、dispose 拆监听)。typecheck 干净、128/128 绿、build 过。
**待实机坐实**(静态链路完整 ≠ 运行必响,见 research 稿的保留):SPEC §9 第 8 条。


## 依赖升到 0.1.5-rc.1 + 产物入库(2026-09-10)

「适配最新版」的实质是**把编译期契约抬到运行时那一版**。

- 10 个 `@deepseek-ai/dsh-*` devDeps 从 `0.1.2-rc.1` 精确钉到 **`0.1.5-rc.1`**;
  `@deepseek-ai/cordis` 保持 `4.0.2`(运行时同为 4.0.2,无需动)。
- **必须整族一起升**:0.1.5-rc.1 各包把兄弟包声明为 peer(`dsh-api-remotes` 要
  `dsh-scope@^0.1.5-rc.1`),只改顶层 devDeps 会 `ERESOLVE`。npm 认为本地旧树冲突,解法是
  **换掉整棵树**(把 `node_modules` 改名腾位后重装),**不要** `--legacy-peer-deps` / `--force`
  —— 那会留下 0.1.2-rc.1 的 peer,类型与运行时对不上。peer 由 npm 自动补齐,不必手工登记。
- **结论:零代码改动**。typecheck 干净、128/128 绿、build 过 —— 说明 0.1.2-rc.1 的边界本来就够用,
  升版只是让类型面与运行时一致(消除「按旧类型写、到运行时才撞差异」这类风险)。

**`lib/` 入库(`.gitignore` 放行)** —— 为了能经 `github:` 安装:

- 启动器的**插件迁移只对 registry / git 来源生效**,`link:` 本地包不在其列(用户实测)。
- 而 git 依赖拿不到构建产物:仓库原本 ignore `lib/`、又**没有** `prepare`,装出来是空壳。
  **不加 `prepare` 是刻意的** —— 安装期脚本可能被启动器拦掉,或在 `--omit=dev` 下因缺 devDeps
  直接失败,两条都等于装不上;把产物提交进 git 则两种情况都能装。
- 代价:**改了 `src/` 必须 `npm run build` 并把 `lib/` 一起提交**,否则发出去的是旧产物
  (`.gitignore` 里写了这条注释)。为此加了闸门 **`npm run check:dist`**:重建后把「工作树 ≠ 索引」
  与「未入库的新产物」都对账出来,不一致即红并打印该 add 哪些文件。提交/发版前跑它。
- **sourcemap 不入库**(`lib/*.map` 进 `.gitignore`)—— 踩到的陷阱:map 内嵌源码原文,而本机
  `core.autocrlf=true`,`git checkout` 落盘的是 CRLF;esbuild 读**磁盘原文**,把 CRLF 一起嵌进
  `sourcesContent`,于是「已提交的 map」与「任何一次重建出的 map」**永远不同**;更糟的是
  `git status` 对源码判定**干净**(git 比对前会把 CRLF 归一化),从源码侧查不出原因。
  实测:map 内嵌的 `slots.ts` 含 CR、HEAD 版本不含,差 204 字节 = 该文件行数 —— 纯环境相关字节,
  不是真漂移。JS 产物不受影响(`lib/index.js`、`lib/client.js` 与 HEAD 逐字节相同)。
- `src/client/pack-manifest.json` 仍不入库:它被 `settings-ui.tsx` import,已内联进 `lib/client.js`,
  运行时不从包里读;`files` 里原有那条已删(git 安装时该文件不存在,留着是空指针式的隐患)。

## 启动器、版本与 home(2026-09-10 实测,推翻此前「运行时 = 某一版」的口径)

本机 dsh 由 **dsh 启动器**(`%APPDATA%/in.dsh-plug.dsh-launcher`)管理,**同时装着两个版本、两个 home**:

| 实例 | 版本 | home | 端口 | dsh-kachi |
|---|---|---|---|---|
| `0.1.2-rc.1` | 0.1.2-rc.1 | `~/.dsh`(用户默认) | 3080 | 有(`link:` 到仓库) |
| `0.1.5-rc.1` | 0.1.5-rc.1 | `.../homes/0.1.5-rc.1` | 未固定 | **无**(待装) |

- 真相来源:启动器 `config.json` 的 `homes` / `versions` / `instances` /
  `settings.last_instance_id`(= 最近用过的实例,当前是 **0.1.5-rc.1**)。
- 每个 home **各自**有 `profiles/<name>/package.json` 与 `node_modules`;
  `profiles/node_modules/@deepseek-ai/*` 是 symlink → `<该 home 对应版本>/node_modules/.pnpm/...`。
  **判版本要 `readlink` 看指向哪个版本目录**,不能只看包名 —— 同一条路径在不同时刻可能指向不同版本
  (本会话实测:`~/.dsh/profiles/node_modules/@deepseek-ai/dsh-api-remotes` 先读到 0.1.5-rc.1,
  十分钟后读到 0.1.2-rc.1;期间启动器在切换实例。未完全归因,故按「读一次不算数」处理)。
- 所以「插件装在哪个 dsh 上」= 装到**那个 home 的 profile** 里,不是全局。

## code-review 收尾(2026-09-10,793e06b..HEAD 两轴评审)

固定点 `793e06b`(即交接稿的基点),覆盖 `a153699`(三音)→ `471d6f0`(升版 + 产物入库 + 发 0.1.2)
→ `a4daa4b`(NOTES 补充)。剔除 `lib/**` 与 `package-lock.json` 两个生成物后 15 文件。

**Standards 轴 —— 无明文规范硬违规。** 改动与 CONTEXT 词表(警示音/恢复音/交互音)、
SPEC §3.2/§5、ADR-0001、以及 NOTES 的硬约定(勿手写 `cordis.patch.yml`、`lib/` 入库)一致;
新增的 `layer-a` / `wireConnection` 测试都是接口级,符合「非 DOM 胶水层一律接口级测试」。
两条判断题,均**不修**:

1. **Primitive Obsession(轻)**:`layer-c.ts` 的 `ConnectionStateLike.getSnapshot(): string | undefined`
   与 `wireConnection` 里的 `'connecting' | 'connected' | 'disconnected'` 裸字符串;同批的
   `layer-a.ts` 已用 `REMOTE_EVENTS` 集中事件名,风格不统一。
   _不修的理由_:这三个值是 dsh 公开类型 `ConnectionState` 的字面量,结构子集**刻意**不复刻上游类型
   (与本仓库 `JournalEventLike` / `EventSourceLike` 同源做法);再立一层本地枚举,只是多一处会漂的真相。
2. **不透明类型(轻)**:`layer-a.ts` 的 `RemoteListener = (...args: never[]) => unknown` 用 `never`
   封住调用面,初读费解。_不修的理由_:这是让 dsh 的泛型 `$on` 可结构化赋值、又不复刻上游 per-event
   声明的代价;同文件已写明原因,`test/layer-a.test.ts` 另用具名 `Waterfall`/`Emit` 把可调用形态还原出来。

**Spec 轴 —— 未发现漏项、范围蔓延或实现错误。** 逐条对账:

- §5 行 3:提问走 A 层 waterfall 且 `return next()` 放行;槽位 `notifyImportant`、介入级 100% ✓
- §5 行 7:A 半 `api-session/error`(emit,无 next)补齐 —— 该行本就是双源合成行 ✓
- §5 行 16/17:`connecting` → 警示音、`connected` → 恢复音;首连静默、`disconnected` 静默且不复位 ✓
- §3.2 三条硬约束全部满足;旧「replace 帧 + 5s 去重」恢复音路径整体移除(替换而非新增)✓
- SPEC 全文无残留「无通路 / 未实现」表述(漂移只留在本文「通路差异与缺口」段,且已标作废)✓

**一条误报已澄清并留证**(评审报告称「`slots.ts:136` `reconnecting` 音量 100,而 SPEC §5 行 16 规定 90%,
§9 第 1 条实际未达标」):**不成立**。SPEC 音量列由**槽位主档**承载 ——
`DEFAULT_SLOT_VOLUMES.warn = 90`(`slots.ts:59`);事件行 `volume` 只在「低于主档」时才写
(如 `tool-result-fail` 70 / `jobs-completed` 60),与主档一致时恒为 100,引擎也是
`if (mapping.volume < 100)` 才叠加(`audio-engine.ts:204`)。这正是 `slots.ts:112-118` 写明的
**单一承载层**约定,且 `test/slots.test.ts:103` 有一条专门钉它(「断线警示音量由 warn 槽默认承载 @90」)。
评审读的是事件行字段,不是等效音量。

**与 issue #19 的一处偏差(正确取舍,记录在案)**:#19 的「What to build」曾要求
「重连恢复音保持现有 journal 信号」;本次改为 `ctx.connection.state` **单源**。该条被违背,但符合
SPEC §3.2 硬约束 3 与研究稿 §2 的结论(权威信号 vs 启发式),而 #19 本身已是 `wontfix` 作废。

## 0.1.2 发版与安装验证(2026-09-10)

提交 `471d6f0`(main,已推),tag `v0.1.2`,Release
<https://github.com/shouerlind/dsh-kachi/releases/tag/v0.1.2>(资产 `dsh-kachi-0.1.2.tgz`,5.6MB / 232 文件)。

**已验证的**:

- 依赖树:`node_modules/@deepseek-ai/dsh-api-remotes|dsh-session|dsh-scope|dsh-client-connection`
  实测均为 **0.1.5-rc.1**;typecheck 干净、**128/128 绿**、build 过 —— 零代码改动。
- 远端确实带上了产物:`git clone --depth 1` 后 `ls lib/` = `client.js client.js.map index.js index.js.map`。
- **git 依赖会拿到的内容** = 在新鲜克隆里跑 `npm pack --dry-run`:`lib/*`(4 个)+ `cordis.patch.yml`
  + `assets/sounds/**`,合计 **232 文件** —— 与 tgz 一致。
- npm 能解析仓库:`npm view github:shouerlind/dsh-kachi` → `dist-tags.latest = 0.1.2`。

**未验证(交给用户实机)**:

- **(2026-09-10 晚复核:此条已作废)** 同一命令后来在 **17 秒内成功**,见本文末尾「安装协议与
  `github:` 简写的实测」;当时的「7 分钟无输出」是沙箱网络/代理的偶发问题,与认证无关 ——
  原条目的判断(「不是认证问题」)方向正确,但「预期可用」现已升级为**实测可用**。
  **端到端 `npm install github:…` 在本沙箱里挂住**:试了 `github:shouerlind/dsh-kachi` 与
  `git+https://github.com/shouerlind/dsh-kachi.git` 两种形式,各 7 分钟以上无输出被杀。
  同时 `git clone --depth 1` 只用了几秒、`npm view github:` 秒回 —— 所以**不是认证问题,
  更像 npm 走全量 clone 在这个代理网络下极慢**。启动器用的是它自己的包管理器与缓存,
  用户此前已用 `github:` 装过 `dsh-bookmate`,故预期可用;实在不成走 tgz 备用路径。
- 需要时可**钉标签**装:`git+https://github.com/shouerlind/dsh-kachi.git#v0.1.2`。

## 研究稿按惯例留在 research/* 分支(2026-09-10 复核)

- 仓库先例:`research/dsh-client-events`、`research/browser-audio-playback`(均 2026-09-05,远端长期保留)。
  `research/dsh-missing-channels`(`4f57dd4`)照此办理,**不进 main**。
- **这些分支是存档,不是待办**:它们各自只是在 main 之上加了一个文件,合并没有任何收益。
  交接稿曾把它描述成「落后 N 个提交、合并/变基必解冲突」,把存档误报成了 WIP ——
  本会话据此差点把它并进 main 又删掉(已回退),下次接手**别再为它开工**。

## 评审修复(code-review)

- 事件音量系数落地(play 读 mapping.volume);节流占位提前到解码前防并发双响。
- 选音器「默认」组改用 DEFAULT_SLOT_SOUNDS 固定取值(原实现引用当前值会漂移);
  选音 onChange 自动试听候选(§14 逐项试听)。
- own-click 接线:设置行容器 onClick → 按键音(§5 行 18)。
- 白名单改为字面量固定清单(§CONTEXT.md「固定清单/显式决议」),不再随 level 派生。
  _(2026-09-10 更新:集合常量已删,白名单的唯一真相回到「level === 'intervention'」
  事件集合;「显式决议」由 test/slots.test.ts 的字面量清单钉住 —— 清单漂移测试即红。
  见下方「架构加深落地」②。)_
- 移除调试脚手架(KachiTestRow/trackInject/__kachi* 探针)、死代码
  (ConnectionStateMachine/isRunning/makeInjectFace)。

## 主 profile 收尾步骤(用户执行)

1. 重启 dsh 主实例(restart-dsh.ps1)→ dsh-kachi 装载(host 半 + client 半)。
2. 走查 SPEC §9 五条(见工单 #15),音效试听:点击页面 → 开机音;
   发消息/工具调用/回合完成/审批弹窗各音;设置页(设置 → 通用设置底部)调音量/换音/试听。
3. 与 dsh-notifier 共存:两者都会对审批/完成出声,若刺耳,用本插件总开关调停(SPEC §8)。

## 验证环境清理(2026-09-06 验收后)

- kachi-test profile 与 C:\dsh-kachi-dev junction 已删除(启动器不再显示第三个 dsh)。
- 主力 web profile 配置就绪:dependencies link + bundles 注册 + cordis.patch.yml insert,
  重启主实例即装载。

## 收官(2026-09-06)

- 用户以 dsh 启动器启动主力 web profile(restart-dsh.ps1 非用户日常启动方式),走查 §9 五条全过;
  工单 #9–#15 全部关闭,项目交付。
- 日常开发注意:改代码后 `npm run build`(client.js 由 HMR 自动重载);改 host 半或 package.json
  才需经启动器重启 dsh。

## 踩坑:duplicate loader entry(2026-09-06,启动失败根因)

`dsh.profile.bundles` 里的包若自带 `dsh.bundle.patch`(cordis.patch.yml),bundle 层会
自动应用它的 insert;**再手写进 profile 顶层 cordis.patch.yml 就是同一 id 插两次**,
启动即崩:`duplicate loader entry id: dsh-kachi`。修复:顶层 patch 保持 `[]`,
装载只走 bundle 层(与 dsh-cost-meter 等插件同构)。profile 改完可用
`dsh --profile web --port 3081` 限时启动验证。

## 踩坑:交互音委托的两个 DOM 时序/结构坑(2026-09-06,实机走查发现)

1. **React 18 离散事件同步提交**:document **冒泡**阶段读触发器 `aria-expanded`
   读到的已是翻转后的值(React root 的监听先于 document 冒泡跑完),开/关判定
   会反。修复:click/mousedown 挂 **capture**,capture 阶段才是切换前状态。
2. **范围锚选错层级**:`[data-composer-card]` 只圈输入卡片;权限预设/工作区
   座席在卡片外的 hero 行(`wSkVaW_heroWorkspaceRow`),整组被排除成全静默。
   修复:改用 `[data-composer-seat]`(实机走查全页恰一个,圈住卡片 + 全部座席行)。
3. **portal 面板**:权限预设的共享 Menu(`createPortal` 到 body)不在座席子树
   内,条目须按「触发器打开的会话」放宽范围,并在各关闭路径回收会话,防止
   泄漏到设置页同名菜单。
4. **确认槽 200ms 去重吞交互音**:确认音槽位与 tool/result 同槽,槽位级去重
   会吞掉快速连点面板时的重开确认音(用户实测「开没声关有声」的最后一环)。
   修复:交互音事件(menu-*)绕开槽位去重,引擎按事件各自 50ms 计闸。
5. **共享 Menu 的点外关闭监听 pointerdown**(Menu.tsx),比 mousedown 先触发
   并同步卸载面板;外部点击取消音必须在 capture pointerdown 里判定。
6. **HMR 会在页面上叠监听器**:每次 `npm run build` 推送都是新一代 apply,
   旧一代委托监听不被清理,多代并存会按各自版本的逻辑同时发声(实测一页
   四代)。验证行为前必须先刷新页面,否则症状是「多代混合体」。
   (2026-09-08 实例:#20 全局推广后报「设置页没声」,实为页面未刷新仍跑
   旧代,硬刷新即愈;代码无罪。另:通用设置左列是 `<nav>` 一级导航,不在
   交互音锚点内,静默符合 SPEC。)
7. **启动器只认自己启动的实例**:外部(脚本/会话)拉起的 dsh 占着 3080 时,
   DSH 启动器显示「已停止」且点启动失败(抢不到端口),像「启动不了」。
   会话里拉起的实例用完要停掉,把端口还给启动器。

## 全站按钮泛化(2026-09-08,用户决议)

- 用户推翻 09-08「通用设置左列 nav 静默」结论:设置点击、侧边栏全部可点击
  与可悬停项、设置一级导航(点击+悬停)都要有声。采纳**全站泛化**方案:
  所有 `button,[role="button"]` 点击=按键音(`ui-click`)、悬停/键盘焦点=
  菜单移动音(`ui-hover`),侧边栏/设置导航/顶栏自动覆盖,新区域零维护。
- 排除集(各自路径权威,防双响):面板容器子树(条目权威)、自家设置行
  `.kachi-row`(own-click 权威)、座席按钮(差分兜底权威;触发器/条目在
  click 分流先命中)。
- 面板在场按到外部按钮:取消音照旧,当次 ui-click 抑制(一次按压一声,
  `pressItem` 起点清标记)。按压伴随 focus 静默镜像 #28(`pressUi`)。
- SPEC §2/§5 行 25-26/§5.1/§9-7 与 ADR-0001 同步;gh 未登录,未开 GitHub
  工单,推送时一并补。
- 会话列表接入(同日):常规会话行/分组行是 div[role=treeitem]+onClick
  (dsh ui-workspace Rows.tsx),搜索结果行是 button[role=treeitem];
  泛化锚扩为 UI_TARGET_SELECTOR = button,[role=button],[role=treeitem],
  行内嵌套动作按钮(行菜单 chevron 等)取最内命中不双响;treeitem 不进
  点外豁免集,面板在场按到会话行仍响取消音。顶栏「空白」排查结论:品牌区
  (logo+字标+HARNESS)整体是「新建会话」快捷按钮(.brand flex:1 占满
  logoRow),空区发声符合规则,非误响。

## code-review 收尾(2026-09-09,af86bba...HEAD 两轴评审)

- 采纳修复:BUTTON_SELECTOR 注释漂移(泛化锚实为 UI_TARGET_SELECTOR 超集,
  勿混用);CONTEXT.md 交互音词条补 ui-click/ui-hover 事件 ID;SPEC §5.1
  补两句边界(座席豁免仅限点击分流,悬停发声属预期;泛化路径无需 150ms
  抑制窗 —— portal 面板不位移布局,指针不会被动命中新按钮)。
- 误报澄清:评审称「设置页菜单行在 .kachi-row 内被排除悬停」不实 ——
  .kachi-row 仅自家注入两行(行内无 aria-haspopup),dsh 菜单行在其外,
  触发器悬停音已生效。
- 接受的边缘:面板在场按到自家设置行 = 取消音 + own-click 两声(own-click
  走 React onClick,不经交互状态机,跨路抑制不值当,低频可忍)。
- 保留:test 的 UI_TARGET_SELECTOR 字符串钉子 —— 规格锚,防锚点被改掉;
  node 环境无 DOM 测试,胶水层行为按仓库惯例实机走查。

## 0.1.1 发版(2026-09-10)

- 13 个提交推送至 origin/main(58b6b3d..9ba275f),含全站按钮泛化、会话列表
  接入、code-review 收尾。
- `npm pack` 出 `dsh-kachi-0.1.1.tgz`(101/101 测试过);tag `v0.1.1`。
- Release 已建:<https://github.com/shouerlind/dsh-kachi/releases/tag/v0.1.1>
  (资产 `dsh-kachi-0.1.1.tgz`;经 GH_TOKEN 一次性注入的 PAT 创建,未写入任何文件)。

## 文档漂移修复(2026-09-10,ask-matt 现状盘点产出)

- **README「安装」步骤是错的**(高危):步骤 2 只让加 `dependencies`,漏了
  `dsh.profile.bundles` 注册;步骤 3 教用户往 profile 的 `cordis.patch.yml`
  手写 `id: dsh-kachi` 的 insert —— 与本文「duplicate loader entry」踩坑直接冲突
  (包自带 `dsh.bundle.patch`,bundle 层已自动应用该 insert,顶层再写就插两次,
  启动即崩)。已改为「依赖 + bundles 两处」+ 明确「勿动 cordis.patch.yml」。
  证据链:dsh README.zh.md「`dsh.profile.bundles` 中各组合包的 patch → profile 自身
  的 `cordis.patch.yml`」;本机主力 profile 的 patch 正是 `[]` + 警告注释。
- README「功能」段同期校准:交互音已非 composer 局部,改为「全站交互音」。
- AGENTS.md issue tracker 段仓库名漂移:`shouerlind/ns-notify` → 实际 remote
  `shouerlind/dsh-kachi`;标题同步改 `dsh-kachi`(工作目录名 `ns-notify` 保留说明),
  并补 `gh` 需 `GH_CONFIG_DIR` 的本机提示(免再误判「未登录」)。
- CONTEXT.md 词表补漏(此前只在 SPEC/代码里流动的术语):音效池、单声道槽位、
  事件音量系数、未选中关闭、语义锚点、座席、泛化目标、自家行、差分兜底;
  原「## 词汇」拆成「音效与分级 / 节流与交互」两节,既有词条原文未动。
- 架构巡检(`/improve-codebase-architecture`)结论:工作树干净、101/101 测试绿、
  0 个 open issue。五个 deepening 候选(报告写在系统临时目录,未入库):
  ①合并「会不会响」的两道闸(交互层按身份去重 + 引擎按时间去重,同一批事件两本账);
  ②`INTERVENTION_EVENT_IDS` 是第二真相(生产只读 `mapping.level`,集合仅被测试断言);
  ③`bridge.ts` 透传壳无测试 vs `controller.ts` 可测核心漏测;
  ④设置形状三份拷贝(`KachiSettings`/`KachiSettingsLike`、`DEFAULT_SLOT_FILES`、`pack` 三处推导);
  ⑤`.kachi-row` 类名哑耦合(改名不报错 → 排除静默失效 → 双响)。
  首选 ①(顺带吃掉引擎里的 UI 词表);②近乎免费。**尚未动任何代码,等用户挑。**

## 架构加深落地(2026-09-10,五候选全做;行为保持)

用户决议「所有候选一条一条做」。全部为**行为保持**重构:SPEC 钉住的声音、闸窗、
锚点、设置效果、可见字符串一字未变;typecheck 干净,测试 101 → 117 全绿,build 通过。

- **① 节流规则改由事件行自述**:`EventSound` 增 `throttle: 'slot' | 'event'`(新类型
  `ThrottleKind`),引擎 `play` 改判 `mapping.throttle === 'event'` 取代
  `INTERACTION_EVENT_IDS.has(eventId)` —— 引擎不再认事件名/UI 类别。六个交互音事件
  (`menu-open/move/item-click/close`、`ui-click/hover`)声明 `'event'`,其余 `'slot'`。
  `INTERACTION_EVENT_IDS` 常量删除(其成员资格已逐行落表),`INTERACTION_MIN_INTERVAL_MS`
  保留(按事件计闸的间隔)。引擎内部 `lastInteractionAt` → `lastEventGateAt`。
  **与报告草图的偏差(有意)**:报告画的是每事件三值 `gate`(含 monophonic),实现只给
  两值 + 沿用槽位级 `MONOPHONIC_SLOTS` —— 因为 SPEC §4 例外① 是**按槽位授权**的
  (「menuMove 槽内全部事件适用」),把它拆成每事件值反而会引入 13 行冗余真相。评审
  也裁定此偏差是对 §4 例外① 的忠实实现而非缺口。
- **② 删第二真相**:`INTERVENTION_EVENT_IDS` 删除。白名单的唯一真相 = 「`level ===
  'intervention'` 的事件集合」(生产本就只读 `level`);test/slots.test.ts 改从 level
  派生后再与字面量清单比对,清单作为「变更需显式决议」的规格锚留下。
- **③ 设置域责任归位**:`src/client/settings/bridge.ts` 删除,其 12 行翻译内联进组合根
  `client/index.ts`(适配面本就该在缝上);新增 `test/controller.test.ts` 11 个接口级
  测试(注入假 scope:默认值派生、脏数据兜底、乐观写入、host 回流收敛、退订、set 失败不抛)。
  此前「可测却漏测的可测核心」缺口补上。
- **④ 设置形状单一来源**:`KachiSettingsLike` 由 `Pick<KachiSettings, ...>` 派生(字段改名
  会编译报错);新增 `SETTINGS_CONSUMPTION`(`Record<keyof KachiSettings, string>`,
  穷尽)—— 给 `KachiSettings` 加字段而不登记消费方即编译红,逼出「新设置有没有接线」的决议;
  配套两条测试(登记覆盖全部字段 / 登记为 apply 的字段确实写进引擎)。
  `DEFAULT_SLOT_FILES` 派生副本删除(JSX 直读 `DEFAULT_SLOT_SOUNDS`)。
  `SlotFile` 移到 `shared/slots.ts`,`toSlotFile(file)` 成为 pack 归属的**唯一判定点**;
  `settings-ui` 的 `preview(file, pack)` 收窄为 `preview(file)` —— 视图不再知道池的布局。
- **⑤ 行类名单一出处**:新增 `src/client/settings/row.ts`(`OWN_ROW_CLASS` +
  由它派生的 `OWN_ROW_SELECTOR`);`settings-ui` 的样式与两处 `className`、`interaction`
  的排除锚全部同源引用,`interaction.ts` 保持 re-export(对外面不变);加测试断言二者同源。
  类名字面量 `'kachi-row'` 全仓仅剩一处(定义处)。

### 两轴 code-review 结论(HEAD 6e2faca → 工作树)

- **Standards 轴**:无硬违规。唯一判断项:注释新用「门禁」一词而 CONTEXT.md 未定义 ——
  已按词表纪律处理:**不收词**,改回既有词「节流/节流规则」(给同一概念再立近义名正是
  词表要防的漂移);`slots.ts`、`audio-engine.ts`、`slots.test.ts` 与该段的措辞已统一。
  确认 `SETTINGS_CONSUMPTION` **不是** Speculative Generality(有测试驱动、有编译期守卫)。
- **Spec 轴**:五候选逐一交付,行为保持成立(闸窗/锚点/音量/可见字符串均未变);README/
  CONTEXT/AGENTS/NOTES 的文档改动属范围外但行为中性。
- **误报澄清**:Spec 轴称「`menu-move`/`ui-hover` 走按事件闸 → 绕过 menuMove 槽单声道打断」。
  不实 —— 打断在闸分支**之后**(`audio-engine.ts` 单声道段),与节流规则无关;
  既有测试「新响打断上一响:单声道不叠加」用的正是 `menu-move` 且断言旧源 stopped,
  本次运行仍绿,即证据。
- 未提交、未推;`lib/` 已重建(`npm run build`)。

## 0.1.3:IDM 拦截音效请求的修复(2026-09-10)

**症状**:装了 IDM(Internet Download Manager)的机器上,dsh 每次发声都触发下载。
插件启动即预解码 13 个默认槽,页面一加载连撞 13 次;设置页逐项试听再撞一串。

**根因**:旧 `/dsh-kachi/sounds/*.wav` 静态路由同时暴露两个 IDM 赖以认领下载的标记 ——
URL 里的 `.wav` 扩展名,与 `content-type: audio/wav` 响应头。

**修复**(JSON 封套,定义在 `src/shared/sound-envelope.ts`):

- host:`/dsh-kachi/sound?file=<相对路径>` 返回 `application/json` 的 `{ b64 }`;
  池归属编码进 `file` 参数(`pack/<name>.wav` 与裸 `<name>.wav`),白名单仍是
  `host/sound-files.ts` 的严格文件名正则;缓存头与 HEAD/404 语义与旧路由同级。
- client:引擎取 `json()` 而非 `arrayBuffer()`,base64 解回字节再 `decodeAudioData`;
  封套缺失 / 非法 base64 / JSON 解析失败一律无声丢弃,不报错。
- **旧 `.wav` 静态路由已删除**(客户端本无消费者),现在非 `/dsh-kachi/sound` 一律 404。

**为什么是 JSON 而不是「二进制 + application/octet-stream」**:后者只藏起扩展名与响应头,
字节流开头仍是 `RIFF....WAVE`,挡不住按内容嗅探的兜底。代价是传输量 +33%(13 个默认槽
0.87 MB → ≈1.16 MB,一次性启动成本;单文件最大 ≈1.05 MB → ≈1.4 MB)。

**顺带修掉一个被测试盲区掩盖的坑**:`SOUND_ROOT` 原本只写死产物布局
(`../assets/sounds/`,从 `lib/index.js` 出发正确),源码直跑时解析到不存在的
`src/assets/sounds` → 端点永远 404。而 `test/` 里**没有任何测试碰过 `webServer.register`
的处理函数**(只有 `resolveSoundFile` 纯函数测试),所以这个坑一直没人发现。现在
`SOUND_ROOT` 两种布局都认,并新增 `test/host-route.test.ts`。

**测试面**:新增 `test/sound-envelope.test.ts`(与 Node Buffer 逐字节对账)、
`test/host-route.test.ts`(9 条,真打到磁盘资产:字节往返对账、路径安全、旧路由已死、
IDM 三个标记都不在);`sound-files` / `slots` / `engine` 三处断言随路径形态更新;测试替身
新增 `okSoundFetcher`(`test/fakes.ts`),6 处内联 stub 收敛到它。

**接口变更记录**:`SoundFetcher` 由 `{ ok, arrayBuffer() }` 改为 `{ ok, json() }` ——
属测试面共享的最小结构面,非公开 API。`npm run typecheck` 干净,`npm test` 154/154 绿。

## 安装协议与 `github:` 简写的实测(2026-09-10)

修正 README 的一条旧结论。此前写「不要用 `github:` 简写、其 git 形态是 `git://` 或
`git+ssh://`」,隐含前提是**仓库私有**;转为公开后该前提消失。

实测环境:npm 11.17.0 / Node 24.19.0,Windows;`~/.ssh` 只有 `known_hosts`(无私钥);
无 `url.*.insteadOf` 改写;`credential.helper=manager`。

| 检查 | 结果 |
|---|---|
| `ssh -T git@github.com`(BatchMode) | `Permission denied (publickey)`,退出 255 |
| `git ls-remote git@github.com:shouerlind/dsh-kachi.git` | 同上,退出 255 |
| `git ls-remote git://github.com/shouerlind/dsh-kachi.git` | 连接超时(9418 不通),退出 128 |
| `git -c credential.helper= ls-remote https://…` | 成功,4 个 tag 全列出,退出 0 |
| `npm install --dry-run github:shouerlind/dsh-kachi` | **成功**,解析到 `dsh-kachi 0.1.3`,退出 0 |

本机既无 SSH 密钥、`git://` 又不通,简写仍然成功 —— 即 npm 走的是**匿名 https**。

`npm-package-arg` 的解析证实简写确实「不解析成显式 URL」,而且**不带版本钉子**:

| 参数 | `fetchSpec` | `gitCommittish` |
|---|---|---|
| `github:shouerlind/dsh-kachi` | `null` | `null` |
| `github:shouerlind/dsh-kachi#v0.1.3` | `null` | `v0.1.3` |
| `git+https://github.com/shouerlind/dsh-kachi.git#v0.1.3` | `https://…` | `v0.1.3` |

**结论**:README 改为「推荐显式 https + 钉 tag」,理由从「简写会失败」换成「简写不可复现」
(协议由 npm 自选,且不带 committish 时装的是默认分支当时的状态)。**可复现的判据是 committish,
不是 URL 的写法** —— 见下节的规范化行为。

**注**:此修正只改了 README 措辞,无代码改动,故未重发版本 —— `v0.1.3` tag 与 tgz 里的 README
仍是旧措辞快照;GitHub 首页渲染的是 main 的最新版。

## 0.1.3 在真实实例上的端到端验证(2026-09-10)

用户自己的运行实例(launcher home 的 `web` profile;原先 spec 为 `git+https://…` 不带 tag、
lock 钉在 `cbcbf7f`)已升级到 `#v0.1.3` 并重启。重启后实测端点行为(HTTP,无需凭据):

| 请求 | 结果 |
|---|---|
| `GET /dsh-kachi/sound?file=boot.wav` | 200 `application/json; charset=utf-8`,body `{"b64":"UklGRlI0AQBXQVZF…` —— base64 解出 `RIFF…WAVE`,与磁盘原文件一致 |
| `GET /dsh-kachi/sound?file=pack/SeNewsBad.wav` | 200 JSON 封套 |
| `GET /dsh-kachi/sounds/boot.wav`(旧路由) | **404** —— 已删 |
| `GET /dsh-kachi/sound?file=../package.json` | 404(路径安全) |
| `GET /dsh-kachi/sound?file=nope.wav` | 404 |

**重启前的对照**:同一实例在重启前 `sound?file=` 返回 404、旧 `/sounds/boot.wav` 返回 200 ——
证明 host 半是启动时载入内存的,**依赖升级后必须重启才生效**;升级完成到重启之间还存在一个
「新 client 问新端点、旧 host 只认旧路由」的静音窗口。

**操作细节**(留给下次):

- `pnpm add "git+https://github.com/shouerlind/dsh-kachi.git#v0.1.3"` 会把 spec **规范化成
  `github:shouerlind/dsh-kachi#v0.1.3`** 写回 profile 的 `package.json`;lockfile 钉到提交
  `ba3b901` + sha512。这印证了上节结论:判据是 committish,不是 URL 的写法。
- 该 profile 的 git 依赖传输走 `codeload.github.com`,本机对它有偶发超时 / ECONNRESET;
  加 `--fetch-timeout=900000 --fetch-retries=6` 后在 4m56s 内成功。失败时 pnpm 是事务性的,
  profile 不会被改坏(spec / lock / node_modules 均原样)。
- 该 profile 的 `.npmrc` 有 `auto-install-peers=false`,守住了「profile 不得自带核心包副本」——
  装完 `@deepseek-ai/schemastery` 确实不在 profile 的 node_modules 里。
- 升级前已备份 profile 的 `package.json` + `pnpm-lock.yaml` 到
  `profiles/web/.upgrade-backup-20260910-230345/`。

**另一套 profile 无需处理**:`~/.dsh/profiles/web` 用的是 `link:D:\deepseek harness\ns-notify`
(junction),直接指向本仓库,重建 `lib/` 后即为最新。
