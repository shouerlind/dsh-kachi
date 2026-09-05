# 浏览器前后台音频播放技术约束(研究)

- 工单:[shouerlind/ns-notify#3 — 浏览器前后台音频播放技术约束](https://github.com/shouerlind/ns-notify/issues/3)
- 日期:2026-09-05
- 目的:为 ns-notify 的 Switch rip 音效播放(映射表试听原型 + 后台通知音)给出技术选型建议,供后续 spec 使用。

## 结论速览(选型建议)

| 维度 | 建议 |
| --- | --- |
| 播放 API | **Web Audio API**:单例 `AudioContext`(懒初始化、首次用户手势 `resume()`),音效预解码为 `AudioBuffer` 缓存,播放时新建 `AudioBufferSourceNode` 接 `GainNode` 总线。不使用 `HTMLAudioElement` 做音效引擎(后台标签页不可靠,见 §2.2) |
| 文件格式 | **统一 MP3(192–320 kbps)**:全浏览器支持、专利已过期、体积小;保留 WAV/无损母带以便再转码。不要依赖 OGG/Vorbis(Safari 不支持)或 WebM/Opus(旧 Safari 仅支持 CAF 容器中的 Opus) |
| 后台播放策略 | 用 `document.visibilityState` / `visibilitychange` 分级:前台(hidden=false)全级别响;后台(hidden=true)仅高优先级(重要通知)用 Web Audio 响,低优先级静默或改发 **Notification API**(由 OS 播放系统提示音)作为兜底 |
| 关键前提 | 页面首次用户交互(点击/按键)时解锁 `AudioContext`;若 `state === "suspended"` 且 `resume()` 失败,降级到 Notification API 或提示用户交互 |
| 音量/并发 | 主音量 = master `GainNode`(一次设置全体生效);每个音效播放独立 `AudioBufferSourceNode`,天然支持重叠并发 |

---

## 1. 运行环境(来自 dsh 源码)

- dsh web 界面是 **Vite + React 18 构建的 SPA**(`@deepseek-ai/dsh-web-frontend`,见 `D:\deepseek harness\deepseek-harness\apps\web\package.json`),构建产物 `dist/` 由 dsh CLI 本地托管,用户在**桌面浏览器**中访问。因此约束按桌面 Chrome/Edge/Firefox/Safari 考量,移动端(尤其 iOS Safari)仅作附注。
- 在 `apps/web/src` 与 `packages/client` 源码中检索 `new Audio` / `AudioContext` / `Notification` / `showNotification`:**无任何命中**。音效与通知是完全的新功能,没有既有实现需要兼容。
- 通知触发来自本地服务推送(事件到达页面时由 JS 同步触发播放),不是 `<audio>` 预加载自动播放场景;但事件到达时标签页常处于**后台**,这是本工单的核心难点。

## 2. autoplay policy:前台与后台标签页

### 2.1 通用规则(前台)

依据 MDN《Autoplay guide for media and Web Audio APIs》与 Chrome 官方博客《Autoplay policy in Chrome》:

- **静音(muted)自动播放总是允许**;有声音的自动播放受限。
- 有声音播放被允许的条件:
  1. 用户已与该文档/域发生过交互(**sticky user activation**:点击、tap、按键等),这是对 ns-notify 最实用的一条;
  2. Chrome 的 MEI(Media Engagement Index)达到阈值;
  3. 安装为 PWA;4. iframe 委托(与本项目无关)。
- **Web Audio 同样受 autoplay policy 约束**:Chrome 71+ 中,无用户激活时新建的 `AudioContext` 处于 `"suspended"` 状态,需在用户激活上下文中调用 `resume()`(Firefox 有等价偏好 `media.autoplay.block-webaudio`,默认开启)。
- 检测手段:`navigator.getAutoplayPolicy?.("audiocontext" | "mediaelement")`(Firefox 支持);通用做法是检查 `AudioContext.state` + `resume()` 的 promise 结果。
- `HTMLMediaElement.play()` 被策略拒绝时 promise 以 `NotAllowedError` 拒绝;这是标准化的处理入口(MDN 给出的 recommended pattern:调用后 `.catch()`,在拒绝时回退到可见控件)。

### 2.2 前台 vs 后台的关键差异(结论最重要的一节)

| 行为 | 前台标签页 | 后台标签页 |
| --- | --- | --- |
| `HTMLAudioElement.play()`(有 sticky activation) | 正常播放 | **桌面 Chrome 会推迟:defer 到标签页可见,promise 保持 pending**;Firefox 默认推迟自动播放到前台(`media.block-autoplay-until-in-foreground`,默认 true) |
| running 的 `AudioContext` 中 `AudioBufferSourceNode.start()` | 正常发声 | **正常发声**(Chrome 不因标签页 hidden 而 suspend 已 running 的 AudioContext;Web Audio 的限制只来自用户激活,不来自前后台) |
| 定时器(setTimeout/interval) | 正常 | 被节流(≥1s,长时间后台更狠);但**正在播放音频的标签页被视为前台、不受节流**(MDN Page Visibility API);WebSocket `onmessage` 等事件回调本身不受 timer 节流 |

依据与出处:

- Chrome 官方博客《HTMLMediaElement.play() returns a promise》明确记载:"desktop Chrome will not begin playback of a media element until the tab is visible. The Promise returned by play() will remain pending until then。"(针对桌面 Chrome的媒体元素播放)
- Chromium issue tracker 40440743《Ability to disable "defer media playback in background tabs"》确认该"后台标签页中媒体播放不启动、直到切到前台"的行为存在且目前无法关闭(5 个重复报告,如 "Media playback autoplay does not work in background … until tab has focus")。
- MDN autoplay guide 记载 Firefox 的 `media.block-autoplay-until-in-foreground` 默认为 true:"即使其他条件满足,autoplay 也要等标签页到前台才发生"。
- Web Audio 后台可用性是反向印证 + 政策来源:Chrome《Autoplay policy in Chrome》对 Web Audio 的要求只有"用户激活",没有前后台条件;MDN autoplay guide 的 Web Audio 一节亦只提到激活要求。实践佐证:Discord/Slack 等纯 Web 应用在后台标签页能播放自定义通知音,均走 Web Audio 路线。

> **推论**:「后台只响重要通知」的页面内出声通道应选 **Web Audio**,不能依赖 `new Audio(...).play()`——后者在后台标签页会被 Chrome 推迟到切回前台,通知音会"迟到或丢失"。

## 3. 「后台只响重要通知」的实现

### 3.1 Page Visibility API(前后台判定)

- `document.visibilityState`(hidden/visible)+ `visibilitychange` 事件,无需轮询(MDN Page Visibility API)。注意 `hidden` = 切到其他标签页或最小化;与窗口失焦(not blur)不是一回事。
- 建议逻辑:

```ts
function shouldPlayInPage(level: Priority): boolean {
  if (document.visibilityState === "visible") return true; // 前台:全级别
  return level >= HIGH; // 后台:仅重要通知在页面内出声(Web Audio)
}
```

### 3.2 Notification API 与声音的关系

- `Notification` / Service Worker `showNotification` 由浏览器进程呈现,**不依赖页面可见性**,后台标签页同样能弹出 OS 级通知。
- 声音方面:
  - 通知选项 `silent`(默认 `false`):不静默时由 **OS 播放系统提示音**,声音本身不受页面控制;
  - `Notification.sound`(自定义提示音 URL)**在主流浏览器中未实现**(MDN 兼容性表:Chrome/Firefox 无支持)——不能指望用它播 Switch rip 自定义音效;
  - `Notification.permission` 需为 `granted`;Chrome 中 `requestPermission()` 要求用户手势,且需 HTTPS(本地 dsh CLI 托管为 localhost/HTTPS 时无碍)。
- 定位:Notification API 适合做**兜底/增强**(OS 级提示,带文本内容),不适合承载"自定义音效 + 精确分级"的主通道。

### 3.3 建议的后台策略(组合)

1. **解锁**:`pointerdown`/`keydown`(一次性监听)中创建/`resume()` AudioContext,并可播一个 0 静音 buffer 确保解锁;记录 `unlocked` 状态。
2. **前台**:`visibilityState === "visible"` → 所有级别事件都用 Web Audio 播放对应音效。
3. **后台**:`hidden` → 仅高优先级(重要通知)用 Web Audio 播放;低优先级静默,或(可选)发一条 Notification(silent: false)借 OS 系统提示音提醒。
4. **降级**:`AudioContext.state !== "running"` 或 `resume()` 被 `NotAllowedError` 拒绝(用户从未交互)→ 停止页面内发声尝试,改用 Notification API(若已授权),并在 UI 上提示"点一下页面以启用通知音"。
5. 设置面:提供总开关、主音量、按事件分级开关(浏览器自身也提供按标签页静音,不必对抗)。

## 4. 音量控制与多音效并发

Web Audio 路线(推荐,依据 MDN《Using the Web Audio API》《AudioBufferSourceNode》):

- **并发**:每个音效播放 = 新建一个 `AudioBufferSourceNode`(绑定已解码的 `AudioBuffer`)。`AudioBufferSourceNode` 是一次性节点:`start()` 只能调用一次,播完即废;要重叠/连发就再建节点(节点创建成本极低,`AudioBuffer` 复用)。因此**重叠播放天然支持**,无需元素池或 `cloneNode`。
- **音量**:建一条 `master GainNode → destination` 总线,总音量只改 `master.gain.value`(0.0–1.0)一处;需要单音效独立音量/淡出时再给该次播放挂一个 per-sound `GainNode`。人耳响度感知非线性,做音量滑条时常用平方映射(`gain = percent * percent`),这是社区通用做法。
- **打断/限速**:`stop()` 可立即掐断;`start(when)` 支持精确调度;需要"同类音效不叠太多"时可自行做并发上限计数。
- 对比 `HTMLAudioElement`:每元素有独立 `volume`(0.0–1.0)但全局音量要遍历所有元素;同源音频元素复用会打断当前播放,重叠需 `cloneNode(true)` 或元素池;有不可消除的起播延迟且无法精确调度——不适合音效引擎,仅适合"预览长音频"这类简单场景。

## 5. 音频格式支持(Switch rip 常见格式)

依据 MDN《Web audio codec guide》《Media container formats (file types)》:

| 格式 | Chrome/Edge | Firefox | Safari | 备注 |
| --- | --- | --- | --- | --- |
| WAV(PCM) | ✅ | ✅ | ✅ | 全支持;**未压缩,体积大**(44.1kHz/16bit/立体声 ≈ 10MB/分钟),不适合网络传输,适合本地母带 |
| MP3 | ✅ | ✅ | ✅ | **全支持且专利已过期**;MDN 原话:若只能提供单一格式,选覆盖面最广的,音频"such as MP3" |
| OGG(Vorbis) | ✅ | ✅ | ❌ | MDN codec 表:Safari **不支持** Vorbis → 排除 |
| WebM(Opus) | ✅ | ✅ | ⚠️ | Safari 11+ 仅在 **CAF 容器**中支持 Opus(macOS High Sierra+);Ogg/WebM+Opus 在 Safari 有兼容坑 → 排除 |
| FLAC | ✅ | ✅ | ✅ | 全支持(iOS 除外);无损但体积大于 MP3 |

- Switch rip 实际来源:vgmstream 等工具从 BCWAV/BFWAV、BLOPUS/LOPUS、IDSP 等原生格式转出,通常落到 **WAV 或 OGG**;因此管线里必须有一次"统一转码"。
- `AudioContext.decodeAudioData` 能解码该浏览器媒体栈支持的格式(WAV/MP3 都稳),所以解码不是选 MP3 的障碍;选 MP3 的核心理由是**跨浏览器一致 + 体积**。
- **推荐:统一转码为 MP3(192–320 kbps)**;保留 WAV/FLAC 母带以便将来改码率或换格式。音效都是短样本(单发 < 1s),320kbps MP3 单个通常几十 KB,预解码开销可忽略。

## 6. 风险与注意事项

- **用户从未交互过的页面**:任何页面内发声都会被拒(Chrome/Firefox),必须实现降级(Notification 或 UI 提示),并在交互后自动恢复。
- **iOS Safari**(附注):锁屏/切后台可能 suspend AudioContext(audio interruption 行为),且 `HTMLMediaElement.volume` 只读;dsh web 主要面向桌面,若未来覆盖移动端需单独处理。
- **浏览器/系统级静音**:用户可在 Chrome 中对单个标签页静音、在 OS 层调音量;不要试图对抗,提供自己的开关即可。
- **节流**:后台标签页的 `setTimeout` 有 ≥1s 节流,但 WS `onmessage` 回调与音频播放不受影响;触发播放的代码要写在事件回调的同步栈里,不要包在 `setTimeout` 里,可避免额外延迟。

## 参考来源

- [MDN — Autoplay guide for media and Web Audio APIs](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)(允许条件、Firefox `media.block-autoplay-until-in-foreground` / `media.autoplay.block-webaudio`、`getAutoplayPolicy`、`NotAllowedError` 处理)
- [Chrome Developers Blog — Autoplay policy in Chrome](https://developer.chrome.com/blog/autoplay)(MEI、用户手势、Web Audio suspended/resume、`NotAllowedError` fallback)
- [Chromium — Autoplay](https://www.chromium.org/audio-video/autoplay/)(政策细则、iframe 委托、MEI 计分条件)
- [Chrome Developers Blog — HTMLMediaElement.play() returns a promise](https://developer.chrome.com/blog/play-returns-promise)("desktop Chrome will not begin playback of a media element until the tab is visible")
- [Chromium Issue 40440743 — Ability to disable "defer media playback in background tabs"](https://issues.chromium.org/issues/40440743)(后台标签页媒体播放推迟无法禁用)
- [MDN — Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)(`visibilityState`/`visibilitychange`;播放音频的后台标签页被视为前台、不被节流)
- [MDN — Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API) / [Notification.sound](https://developer.mozilla.org/en-US/docs/Web/API/Notification/sound)(`silent` 选项、permission、`sound` 属性无支持)
- [MDN — Web audio codec guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Web_audio_codecs)(MP3/Vorbis/Opus/FLAC 各浏览器支持表)
- [MDN — Media container formats (file types)](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers)(容器支持、"single format → MP3" 建议、WAV/LPCM)
- [MDN — Using the Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_Web_Audio_API)(audio graph、GainNode 音量、`suspended` → `resume()` 模式)
- [MDN — AudioBufferSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode)(一次性语义:start() 只能调用一次,重叠播放需新建节点)
- dsh 源码:`D:\deepseek harness\deepseek-harness\apps\web\package.json`(Vite + React 18 SPA,桌面浏览器环境);`apps/web/src`、`packages/client` 中无既有音频/通知代码
