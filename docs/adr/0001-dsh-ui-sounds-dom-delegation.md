# dsh 自家 UI 交互音经无源 DOM 委托覆盖

dsh 没有全局 UI 事件总线,SPEC 原把音效范围收在「插件自家注入组件」;交互音需求(composer 二级面板悬停/点击/关闭)要覆盖 dsh 自家 UI。决定:插件在 document 上做原生事件委托(click/mousedown 挂 **capture**——React 18 对离散事件同步提交,冒泡阶段读 `aria-expanded` 已是翻转后的值;悬停/焦点挂冒泡),用语义锚点识别交互——触发器 `aria-haspopup="menu"`、条目 `role="menuitem"` / `role="menuitemradio"` / `role="option"`、范围锚 `[data-composer-seat]`(座席容器;`data-composer-card` 只圈输入卡片,圈不住权限/工作区座席)。portal 到 body 的共享 Menu 面板不在座席子树内,以「触发器打开的会话」放宽条目范围并随关闭路径回收。不改 dsh 源码一行。首期锚定 composer 座席,全局推广见工单 #20。

## Considered Options

- 改 dsh 源码加事件总线/埋点:违背插件自包含与 SPEC「不改 dsh 源码」备忘,从此背上游维护分叉 → 拒;
- 维持 SPEC 现状(只覆盖自家注入组件):等于放弃需求 → 拒。

## Consequences

- 失灵模式是「静默无音」而非报错:dsh 大改 aria/role 结构时锚点失配,交互音消失,其余音效不受影响;SPEC 已有「跨版本不设硬兼容约束」先例,接受。
