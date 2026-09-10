/**
 * 自家设置行的标记类名 —— 定义它的组件(settings-ui)与用它做排除锚的
 * 交互委托(interaction)同源引用,改名不再是一处静默失效的约定。
 * 注意:这是自家样式表的类名,不是 dsh 的 CSS module 哈希,可作锚点;
 * dsh 侧的锚点仍守 ADR-0001 的语义锚纪律(aria/role 优先)。
 */
export const OWN_ROW_CLASS = 'kachi-row'

/** 排除自家行的选择器(由类名派生,不另写字面量)。 */
export const OWN_ROW_SELECTOR = `.${OWN_ROW_CLASS}`
