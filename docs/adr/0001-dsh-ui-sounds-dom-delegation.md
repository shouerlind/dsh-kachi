# dsh 自家 UI 交互音经无源 DOM 委托覆盖

dsh 没有全局 UI 事件总线,SPEC 原把音效范围收在「插件自家注入组件」;交互音需求(composer 二级面板悬停/点击/关闭)要覆盖 dsh 自家 UI。决定:插件在 document 上做原生事件委托(click/pointerdown 挂 **capture**——React 18 对离散事件同步提交,冒泡阶段读 `aria-expanded` 已是翻转后的值;按压判定用 pointerdown 而非 mousedown:共享 Menu 的点外关闭自身监听 document pointerdown 并同步卸载面板,pointerdown capture 是能读到「面板还在」的最后时刻;悬停/焦点挂冒泡),用语义锚点识别交互——触发器 `aria-haspopup="menu"`、条目 `role="menuitem"` / `role="menuitemradio"` / `role="option"`、范围锚 `[data-composer-seat]`(座席容器;`data-composer-card` 只圈输入卡片,圈不住权限/工作区座席)。portal 到 body 的共享 Menu 面板不在座席子树内,首期以「触发器打开的会话」放宽条目范围并随关闭路径回收(该 session 机制已随全局推广退役)。不改 dsh 源码一行。首期锚定 composer 座席;全局推广已于工单 #20 落地(2026-09-08):触发器/条目/面板锚点放宽至全站(触发器取 `aria-haspopup="menu"|"listbox"` —— dsh 实测设置页菜单行等为 menu、composer 命令菜单 + 钮为 listbox,dialog/tree 弹层非二级面板不接),面板存活按「可见」判定,无标记按钮差分兜底仍限 composer 座席(全站无标记触发器实测仅 composer 胶囊)。同日按钮泛化修正:面板/自家行/座席之外的 `button,[role="button"]` 全部接入委托(点击=按键音,悬停/键盘焦点=菜单移动音),侧边栏与设置一级导航由此自动覆盖、免逐区适配;面板在场时按到外部按钮只响取消音(一次按压一声)。

## Considered Options

- 改 dsh 源码加事件总线/埋点:违背插件自包含与 SPEC「不改 dsh 源码」备忘,从此背上游维护分叉 → 拒;
- 维持 SPEC 现状(只覆盖自家注入组件):等于放弃需求 → 拒。

## Consequences

- 失灵模式是「静默无音」而非报错:dsh 大改 aria/role 结构时锚点失配,交互音消失,其余音效不受影响;SPEC 已有「跨版本不设硬兼容约束」先例,接受。
