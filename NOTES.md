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
7. **启动器只认自己启动的实例**:外部(脚本/会话)拉起的 dsh 占着 3080 时,
   DSH 启动器显示「已停止」且点启动失败(抢不到端口),像「启动不了」。
   会话里拉起的实例用完要停掉,把端口还给启动器。
