# 音效资产清单(Switch 音效槽位 ↔ 文件)

对应工单:shouerlind/ns-notify#5(就位)、#6(试听定稿 v3);映射依据:工单 #4 映射表 v1 经试听修订。

## 约定

- **目录**:`assets/sounds/`(在用 13 个)+ `assets/sounds/pack/`(全包 211 个,设置页选音池)。
- **格式**:WAV(源 rip 原生格式,浏览器全平台原生支持,免转码)。
- **来源**:[TOM-BadEN/Nintendo-Switch-Sounds-Effect](https://github.com/TOM-BadEN/Nintendo-Switch-Sounds-Effect)(211 个 Switch 官方 rip,按任天堂内部命名整理)。仅限个人自用;仓库已转私有,不做公开分发。
- **选音坑**:源包内大量亚 50ms「微碎片」文件(如 SeNtfInImage 0.00s、SeGiftReceive 0.00s),挑选时须用「语义 + 时长 ≥0.1s」双筛。
- **音量变体不另建文件**:同一文件按映射表以不同音量复用(如工具调用=按键音@30%)。

## 最终槽位表(v3 试听定稿,13 个)

| 文件名 | 槽位 | 源文件(任天堂内部名) | 时长 | 映射事件 |
|---|---|---|---|---|
| `boot.wav` | 开机音 | SeDeviceFound_Dtt | 0.82s | 页面加载完成且音频解锁 |
| `notify-important.wav` | 通知重要音 | SeKeyRecieved | 0.70s | 权限审批请求、agent 提问(介入级) |
| `task-complete.wav` | 任务完成音 | SeVgc_Dialog_Check | 0.50s | 回合 completed;后台作业 completed@轻(介入级) |
| `error.wav` | 错误音 | SeNewsBad | 0.70s | 回合 error/max-tokens;工具失败@低;后台作业 failed(介入级) |
| `menu-move.wav` | 菜单移动音 | SeBtnFocus | 0.73s | turn/start(@40%) |
| `send.wav` | 发送音 | SeVgc_Connect_Recieve | 0.44s | 用户发送消息 |
| `button.wav` | 按键音 | SeBtnDecide | 0.05s | tool/call@30%;自家组件点击 |
| `confirm.wav` | 确认音 | SeToggleBtnOn | 0.11s | tool/result 成功@60% |
| `cancel.wav` | 取消音 | SeFooterDecideBack | 0.09s | 用户手动中止回合 |
| `session-new.wav` | 新建音 | SeFlcIconFloat | 0.80s | api-session/added |
| `session-close.wav` | 关闭音 | SeFlcIconSink | 0.82s | api-session/removed(与新建刻意成对) |
| `reconnect.wav` | 恢复音 | SePage | 0.73s | 断线恢复 onConnected |
| `warn.wav` | 警示音 | SeWarning_Dtt | 0.15s | 断线 reconnecting |

## 设置页需求(工单 #7 议程)

用户要求:设置页提供每槽位的音效选择,**可选范围为 `pack/` 全包 211 个音**;至少含槽位映射、每槽位音量;总开关/总音量不变。
