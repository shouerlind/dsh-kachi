# 实现备忘(dsh-kachi)

## 运行时事实(0.1.2-rc.1 实测,~/.dsh/profiles/node_modules/@deepseek-ai/)

- 双面插件:`dsh.bundle.patch`(cordis.patch.yml `- insert: [{id, name: 包名}]`)+ `dsh.client{platform:'web'}` + `exports["./client"]`。只声明 `dsh.client` 不会被装载(client 图来自 host Loader entries 扫描)。
- client bundle 外壳:`window.__ModuleLoader__.load({id:"<包名>",factory:(require)=>{var module={exports:{}};var exports=module.exports; ...; return module.exports;}})`;externals 仅基线(react、cordis、client-store、ui-slots、ui-primitives)。
- A 层 allowlist 与 SPEC 研究一致;approval/user-questions 是 waterfall,**旁听必须 return next()**。
- B 层:`ctx.sessions.list`(SnapshotStore,含 jobsBySession)→ `binding(id).session.open()`(幂等,拉尾页)→ `eventSource`(change: replace/prepend/append;seq 门控防历史回放)。人类输入 = `message.source.kind === 'user'`;手动取消 = `turn.end.reason.reason.kind === 'user'`(0.1.2-rc.1 的 MessageSourceMap 是 user/plugin/model/tool)。
- C 层:`ctx.connection.generation`(getSnapshot/subscribe);jobs 经 `list.jobsBySession` diff。
- 设置:host `ctx.settings.register(ns, schemastery schema)`;client `ctx.settingsScope.bind({namespace})`;UI 槽位 `settings.general.item`(自绘行)。
- 资产:`/plugins` 只服务 JS。host 半 `ctx.webServer.register({kind:'prefix',path:'/dsh-kachi',handler})` 提供 WAV(已验证 200 + 穿越 404)。

## 已踩的坑

- `dsh plugin --profile web add .` 在带空格路径上会把路径按空格拆成多个依赖(写入 profile package.json),且**会重置 cordis.patch.yml**(用户注释丢失,已手工恢复)。正确姿势:手工写 profile package.json(`link:` 协议)+ 恢复 patch + pnpm install。
- 普通路径 `add` 对 pnpm 是 copy;`link:` 是 symlink(重建产物 HMR 直接可见)。开发期用 link。
- 新增 loader entry 在主实例(3080)上未热装载;独立 profile 实例(kachi-test,3099)验证一切正常。主 profile 需要一次 dsh 重启生效(用户用 restart-dsh.ps1,注意 dsh host 承载 agent 会话本身)。

## 测试实例

- `C:\dsh-kachi-dev` junction(避开空格路径 bug)→ 本仓库。
- kachi-test profile(~/.dsh/profiles/kachi-test,bundles: base + web-app + dsh-kachi)。
- 启动:`node "C:\Users\kona\AppData\Roaming\npm\node_modules\@deepseek-ai\dsh\lib\bin.js" --profile kachi-test --port 3099`(在 ~ 下执行)。
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
