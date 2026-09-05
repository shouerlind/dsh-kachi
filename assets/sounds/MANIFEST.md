# 音效资产清单(Switch 音效槽位 ↔ 文件)

对应工单:shouerlind/ns-notify#5;映射依据:工单 #4 的映射表 v1。

## 约定

- **目录**:本目录(`assets/sounds/`)。
- **格式**:WAV(源 rip 原生格式,浏览器全平台原生支持,无需转码;MP3 压缩仅在未来体积优化时考虑)。
- **来源**:仓库 [TOM-BadEN/Nintendo-Switch-Sounds-Effect](https://github.com/TOM-BadEN/Nintendo-Switch-Sounds-Effect)(211 个 Switch 官方音效 rip,按任天堂内部命名整理)。仅限个人自用,不入任何公开分发。
- **音量变体不另建文件**:同一文件按映射表以不同音量复用(如工具调用=按键音@低音量)。

## 槽位清单(13 个文件,已就位 ✅)

| 文件名 | 槽位 | 源文件(任天堂内部名) | 映射事件 |
|---|---|---|---|
| `boot.wav` | 开机音 | SeUnlockHome | 页面加载完成且音频解锁 |
| `notify-important.wav` | 通知重要音 | SeNtfInImage | 权限审批请求、agent 提问 |
| `task-complete.wav` | 任务完成音 | SeSuccess | 回合 completed;后台作业 completed@轻 |
| `error.wav` | 错误音 | SeWarning | 回合 error/max-tokens;工具失败@低;后台作业 failed |
| `menu-move.wav` | 菜单移动音 | SeBtnFocus | turn/start |
| `send.wav` | 发送音 | SeGiftSend | 用户发送消息 |
| `button.wav` | 按键音 | SeBtnDecide | tool/call@低音量;自家组件点击 |
| `confirm.wav` | 确认音 | SeSelectCheck | tool/result 成功@轻 |
| `cancel.wav` | 取消音 | SeFooterDecideBack | 用户手动中止回合 |
| `session-new.wav` | 新建音 | SeIconFloat | api-session/added |
| `session-close.wav` | 关闭音 | SeIconSink | api-session/removed |
| `reconnect.wav` | 恢复音 | SeVgc_Connect | 断线恢复 onConnected |
| `warn.wav` | 警示音 | SeWarning_Dtt | 断线 reconnecting |

## 状态

- [x] 13 个文件就位(2026-09-06,自上述仓库挑选入位)
- [x] 时长/体积核对:全部为短 UI 音效(313 B – 140 KB)
- [ ] 听感验收与逐槽位微调 → 归「映射表试听原型」工单 #6(不满意可换源文件重选,211 个备选充足)
