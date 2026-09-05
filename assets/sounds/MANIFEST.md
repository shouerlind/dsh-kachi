# 音效资产清单(Switch 音效槽位 ↔ 文件)

对应工单:shouerlind/ns-notify#5;映射依据:工单 #4 的映射表 v1。

## 约定

- **目录**:本目录(`assets/sounds/`),文件名见下表,扩展名 `.mp3`(优先 192–320 kbps;`.wav` 亦可接受,后续统一转 MP3)。
- **来源**:任天堂 Switch 系统音效 rip,仅限个人自用,不入任何公开分发。
- **音量变体不另建文件**:同一文件按映射表以不同音量复用(如工具调用=按键音@低音量)。

## 槽位清单(13 个文件)

| 文件名 | 槽位 | 映射事件 | 备注 |
|---|---|---|---|
| `boot.mp3` | 开机音 | 页面加载完成且音频解锁 | 标志性开机一声 |
| `notify-important.mp3` | 通知重要音 | 权限审批请求、agent 提问 | 介入级,需穿透后台 |
| `task-complete.mp3` | 任务完成音 | 回合 completed;后台作业 completed@轻 | 介入级 |
| `error.mp3` | 错误音 | 回合 error/max-tokens;工具失败@低;后台作业 failed | 介入级 |
| `menu-move.mp3` | 菜单移动音 | turn/start | 很轻 |
| `send.mp3` | 发送音 | 用户发送消息 | — |
| `button.mp3` | 按键音 | tool/call@低音量;自家组件点击 | 高频,务必短促 |
| `confirm.mp3` | 确认音 | tool/result 成功@轻 | 高频,短促 |
| `cancel.mp3` | 取消音 | 用户手动中止回合 | — |
| `session-new.mp3` | 新建音 | api-session/added | — |
| `session-close.mp3` | 关闭音 | api-session/removed | 与取消音可同源不同调 |
| `reconnect.mp3` | 恢复音 | 断线恢复 onConnected | — |
| `warn.mp3` | 警示音 | 断线 reconnecting | — |

## 待办

- [ ] 13 个文件就位(等待用户提供 rip 文件)
- [ ] 就位后:核对时长(<2s 为佳,boot 可放宽)、响度大致一致
- [ ] 更新本清单状态,关闭工单 #5
