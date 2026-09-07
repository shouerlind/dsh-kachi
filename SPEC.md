# SPEC:dsh 全操作 Switch 音效插件(dsh-kachi)

> 依据 wayfinder 地图 [shouerlind/ns-notify#1](https://github.com/shouerlind/ns-notify/issues/1) 全部决议收拢定稿(2026-09-06)。实现以本文为唯一依据;术语以 [CONTEXT.md](CONTEXT.md) 为准。

## 1. 概述

**dsh-kachi** 是 deepseek harness(dsh)的 client(浏览器)端音效插件:对 dsh 的所有操作与 agent 状态变化播放任天堂 Switch 系统同款音效,「事事有回应」。npm 包名 `dsh-kachi`,仓库 `shouerlind/ns-notify`(私有),纯个人自用。

- dsh 版本基准:主用最新版(当前 0.1.2-alpha.1),跨版本不设硬兼容约束。
- 界面基准:本地 web GUI;终端等非 web 界面不在范围内。
- 范围口径:先全操作面全上音效,后续按使用感受酌情瘦身。

## 2. 范围与非目标

**做**:web 界面操作确认音、agent 状态提示音、后台重要通知、设置页(含全包选音)、composer 交互音(二级面板悬停/点击/关闭,经 DOM 委托覆盖,见 [ADR-0001](docs/adr/0001-dsh-ui-sounds-dom-delegation.md);全局推广为后续工单 #20)。

**不做**:
- 公开分发 / 上架 dsh-market(版权音效仅限个人自用;仓库已私有);
- 非 web 界面的音效;
- 改 dsh 源码或要求 dsh 提供全局 UI 事件总线(交互音走插件内无源 DOM 委托,ADR-0001);
- 流式 token 级音效(assistant/chunk 静默级)。

## 3. 架构

### 3.1 插件形态

静态 client 插件包(参照 `packages/client/ui-approval`):

- 包根 `package.json`:`"dsh": { "client": { "platform": "web", "inject": [...] } }`,构建产物挂 `exports["./client"]` → `lib/client.js`;
- 插件体:`export const inject = [...]` + `export function apply(ctx)`;
- 安装:开发期 `dsh plugin --profile web add .`(仓库目录内执行);稳定后 `dsh plugin --profile web add github:shouerlind/ns-notify`;
- profile:主用 `web` profile 一份(`~/.dsh/profiles/web`);profiles 与 dsh 版本解耦,旧版 dsh 加载不了就旧版不装。

### 3.2 事件接线(三层,均已在工单 #2 研究中验证可行)

| 层 | 通道 | 消费的事件 |
|---|---|---|
| A:`ctx.remote.$on` | allowlist 转发(WebSocket `/api/remote.mux`) | `approval/request`、`user-questions/request`、`api-session/added`、`api-session/removed`、`api-session/error` |
| B:会话日志流 | `remote.session.follow()` 实时 append,不走 allowlist | `turn/start`、`turn/end`(按 `reason.kind` 分级:completed/error/max-tokens/aborted)、`tool/call`、`tool/result`(按 `error` 区分成败)、`user/message`(仅 `source` 为人类输入) |
| C:本地 | connection 流、control 流 `jobs` 帧、自家组件 DOM、document 级 DOM 委托 | `reconnecting`/`onConnected`、后台作业 `completed`/`failed`、注入组件点击、composer 交互音(ADR-0001) |

约束备忘:`$on` 可监听集合以 `API_REMOTE_FORWARDED_EVENTS` 为上限,不改 dsh 源码不扩 allowlist(B 层已覆盖全部所需信号);emit 事件不重放,断线错过一两声可接受,不做补偿;音效插件卸载/重载时随 cordis effect 清理全部监听器与 AudioContext。

### 3.3 播放引擎(Web Audio API)

- **单例 AudioContext**:插件首次 `apply` 创建,挂 `ctx.effect` 管理;
- **解锁流程**:首次用户手势(pointerdown/keydown)调用 `resume()`;解锁前排队事件丢弃不报错;`resume` 失败(NotAllowedError/suspended)降级为 Notification API 系统通知并提示点击页面(Notification `sound` 自定义音效不可靠,仅兜底);
- **结构**:所有音效文件启动时 `decodeAudioData` 预解码为 AudioBuffer 缓存;每次播放新建 AudioBufferSourceNode(天然重叠并发);母线一个 master GainNode 控总音量(滑条平方映射),每槽位独立 GainNode 控该槽位音量;
- **后台策略**:Page Visibility API 读 `visibilityState`——前台全响;后台(hidden)仅播白名单(介入级),其余静默。

## 4. 通知分级与播放策略

三级词汇(已落盘 CONTEXT.md):**介入级**(后台也响)/ **前台级**(仅页面可见时响)/ **静默级**(不响)。

- **重要通知白名单(介入级全集,变更需显式决议)**:权限审批请求、agent 提问、回合错误、任务完成;
- **节流**:同类音效 200ms 时间窗内去重(初值,可在设置中调整);适用于 button/confirm 等高频槽位。两类例外:①**按槽位授权**:menuMove 槽位不套 200ms 去重,改用「50ms 最小间隔 + 单声道打断」(新响立即停旧响,不叠加)——槽内全部事件适用,含菜单移动音(悬停/键盘移动的合法高频连响)与借用该槽位的回合开始音 `turn/start`;②交互音事件(§5.1 开/选项点击/取消)按事件各自 50ms 计闸 —— 确认槽与 tool/result 同槽,槽位去重会吞掉快速连点面板时的重开确认音;
- **开机音**:页面加载完成且 AudioContext 解锁成功时播放(每次页面加载,含刷新),设置可关。

## 5. 事件 → 音效映射表(v3 试听定稿)

| # | 事件 | 分级 | 音效槽位 | 默认文件(源名) | 音量 |
|---|---|---|---|---|---|
| 1 | 页面加载完成且音频解锁 | 前台 | 开机音 | `boot.wav`(SeDeviceFound_Dtt) | 100% |
| 2 | `approval/request`(A) | **介入** | 通知重要音 | `notify-important.wav`(SeKeyRecieved) | 100% |
| 3 | `user-questions/request`(A) | **介入** | 通知重要音 | 同上 | 100% |
| 4 | `turn/start`(B) | 前台 | 菜单移动音 | `menu-move.wav`(SeBtnFocus) | 40% |
| 5 | `user/message` 人类输入(B) | 前台 | 发送音 | `send.wav`(SeVgc_Connect_Recieve) | 100% |
| 6 | `turn/end` completed(B) | **介入** | 任务完成音 | `task-complete.wav`(SeVgc_Dialog_Check) | 100% |
| 7 | `turn/end` error/max-tokens(B)+ `api-session/error`(A) | **介入** | 错误音 | `error.wav`(SeNewsBad) | 100% |
| 8 | `turn/end` aborted 且用户手动取消(B) | 前台 | 取消音 | `cancel.wav`(SeFooterDecideBack) | 90% |
| 9 | `tool/call`(B) | 前台 | 按键音 | `button.wav`(SeBtnDecide) | 30% |
| 10 | `tool/result` 成功(B) | 前台 | 确认音 | `confirm.wav`(SeToggleBtnOn) | 80% |
| 11 | `tool/result` 失败(B) | 前台 | 错误音 | `error.wav` | 70% |
| 12 | `api-session/added`(A) | 前台 | 新建音 | `session-new.wav`(SeFlcIconFloat) | 100% |
| 13 | `api-session/removed`(A) | 前台 | 关闭音 | `session-close.wav`(SeFlcIconSink) | 100% |
| 14 | 后台作业 `jobs` completed(C) | 前台 | 任务完成音 | `task-complete.wav` | 60% |
| 15 | 后台作业 `jobs` failed(C) | **介入** | 错误音 | `error.wav` | 100% |
| 16 | 断线 `reconnecting`(C) | 前台 | 警示音 | `warn.wav`(SeWarning_Dtt) | 90% |
| 17 | 重连 `onConnected`(C) | 前台 | 恢复音 | `reconnect.wav`(SePage) | 100% |
| 18 | 自家注入组件点击 | 前台 | 按键音 | `button.wav` | 30% |
| 19 | `assistant/message` 成型(B) | 静默 | — | 不映射(turn/end 已覆盖) | — |
| 20 | A 层杂项(settings/credentials/llm-adapters 等) | 静默 | — | 不映射(无用户语义) | — |
| 21 | composer 菜单触发器点击·打开面板(权限设置/模型选择/推理等级) | 前台 | 确认音 | `confirm.wav`(SeToggleBtnOn) | 80% |
| 22 | 二级面板选项悬停 / 键盘焦点移动 | 前台 | 菜单移动音 | `menu-move.wav`(SeBtnFocus) | 40% |
| 23 | 二级面板选项点击(含 drill-in 行) | 前台 | 确认音 | `confirm.wav` | 80% |
| 24 | 二级面板未选中关闭(再点触发器/点面板外/Escape) | 前台 | 取消音 | `cancel.wav`(SeFooterDecideBack) | 90% |

### 5.1 交互音细则(§2 DOM 委托决议,ADR-0001)

- **锚点**:触发器 = `aria-haspopup="menu"` 且祖先含 `[data-composer-seat]`(座席容器;注意 `data-composer-card` 只圈输入卡片,权限/工作区座席在卡片外 hero 行);条目 = `role="menuitem"` / `role="menuitemradio"` / `role="option"`。类名是 CSS module 运行时哈希,不作锚点。座席内**无** `aria-haspopup` 标记的按钮(命令胶囊等)走**菜单差分兜底**:点击后等渲染落定(判定窗 50ms)按面板有无差分分类——面板挂载=开(确认音)、卸载=关(取消音)、都在=换面板开(确认音)、都没有=静默;按压落在这类按钮上不触发「点外关闭」取消音(其声音由差分路径负责,防双响)。范围仍限 composer 座席;全局推广见工单 #20,届时重估兜底范围。
- **悬停音**:每选项进入响一次(换行才算);50ms 最小间隔 + 单声道打断;面板打开后 150ms 内抑制首次悬停音,防与确认音叠;触发器本身无悬停音。
- **点击音**:触发器点击(打开)= 确认音;选项点击 = 确认音(已选中项的关闭性点击同样是确认按压,不另作取消)。
- **关闭音**:未选中关闭 = 取消音;选中关闭由选项点击的确认音覆盖,不双响。
- **键盘同权**:方向键移动焦点经 focus 事件响菜单移动音——与悬停**共用**换行去重(同一项不重复响)与互免去重(悬停响过的项,点击聚焦不双响);但**不受** 150ms 打开抑制窗约束:该窗防的是「指针恰好停在面板渲染位置、悬停被动命中」的叠音,dsh 两类面板打开时均不把焦点放入面板(焦点只经方向键或点击进入,均为用户显式动作),焦点路径不存在被动命中。
- **分级**:交互音恒为前台级,后台标签页一律静默。

## 6. 设置页

挂载:`ctx.slots.inject('settings.general.item', ...)`(参照 ui-chat);存储:`ctx.settingsScope` 插件命名空间。

| 设置项 | 说明 |
|---|---|
| 总开关 | 一键静音整个插件 |
| 总音量 | master GainNode,滑条平方映射 |
| 开机音开关 | 默认开 |
| 槽位音效选择 | **每个槽位可单独选音,可选范围为 `assets/sounds/pack/` 全包 211 个**(含原 13 个默认);提供试听按钮 |
| 槽位音量 | 每槽位独立音量(默认值见第 5 节) |
| 节流时间窗 | 默认 200ms |

## 7. 资产

- `assets/sounds/`:13 个默认槽位文件;`assets/sounds/pack/`:全包 211 个 WAV(选音池);
- 格式 WAV(源 rip 原生,浏览器原生支持;MP3 压缩仅为未来体积优化项);
- 来源 [TOM-BadEN/Nintendo-Switch-Sounds-Effect](https://github.com/TOM-BadEN/Nintendo-Switch-Sounds-Effect);**仅限个人自用,仓库私有,不公开分发**;
- 挑选注意:源包存在大量亚 50ms 微碎片,换音须「语义 + 时长 ≥0.1s」双筛;
- 完整对照表见 [assets/sounds/MANIFEST.md](assets/sounds/MANIFEST.md)。

## 8. 与既有插件的边界

本机已装 `@wingsky-1/dsh-notifier`(通知管道类)。ns-notify 是操作音效类,不消费/复制其通知流;两者对同一事件(如错误)可能各响各的——实现时确认 dsh-notifier 的默认行为,若重复刺耳,以本插件设置页的开关为调停手段,不改对方。

## 9. 验收标准

1. 第 5 节映射表中全部非静默事件真实触发时发声,映射与音量一致;
2. 后台标签页仅白名单四类(审批请求、agent 提问、回合错误、任务完成)发声,前台全响;
3. 设置页全部项目生效:总开关、总音量、开机音开关、槽位选音(范围=全包 211)、槽位音量、节流时间窗;
4. 首次手势前不发声不报错;解锁失败降级 Notification 不崩;
5. 断线重连不崩溃;插件重载/卸载后无残留监听器与音频资源(cordis disposer 全覆盖);
6. §5.1 交互音细则逐条过:悬停逐格连响不叠加、面板打开 150ms 内抑制、未选中关闭取消音、键盘焦点移动同权(共用换行去重,不受打开抑制窗)、composer 卡片外菜单不响;dsh 面板 aria 结构变更时插件静默不报错。

## 10. 后续增强(不在首版范围)

- 多会话并行的来源区分与「跳转到来源会话」提示;
- MP3 压缩版资产(体积优化);
- 按会话/按工具类型细分音效。

## 11. 决议档案

- 地图:[shouerlind/ns-notify#1](https://github.com/shouerlind/ns-notify/issues/1)(全部决策工单及理由);
- 研究报告:分支 `research/dsh-client-events`(事件面)、`research/browser-audio-playback`(音频约束);
- 试听原型:分支 `prototype/listen`;
- 资产对照:`assets/sounds/MANIFEST.md`;术语:`CONTEXT.md`;
- 交互音决议:[docs/adr/0001-dsh-ui-sounds-dom-delegation.md](docs/adr/0001-dsh-ui-sounds-dom-delegation.md)(2026-09-06 拷问定稿);全局推广:工单 [#20](https://github.com/shouerlind/ns-notify/issues/20)。
