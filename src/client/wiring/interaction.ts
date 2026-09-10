/**
 * C 层交互音接线(SPEC §5.1,ADR-0001;工单 #20 全局推广;2026-09-08 全站
 * 按钮泛化):document 级原生事件委托。两条发声面 ——
 *  - 二级面板:悬停/键盘移动=菜单移动音,触发器打开与选项点击=确认音,
 *    未选中关闭=取消音(锚点全是语义属性 aria/role;类名是 CSS module
 *    运行时哈希不可用);
 *  - 全站泛化按钮:点击=按键音(ui-click),悬停/键盘焦点=菜单移动音
 *    (ui-hover),面板内、自家设置行、座席按钮除外(各自路径权威);
 *    面板在场时按到外部按钮只响取消音,当次 ui-click 抑制;会话列表行
 *    (div[role=treeitem])经 UI_TARGET_SELECTOR 同规则接入。
 * 发声决策(触发器开关、悬停/焦点去重、按压伴随 focus 静默、菜单差分分类、
 * 点外抑制)收在 createInteractionSound 纯状态机(时钟注入,无 DOM 可测);
 * DOM 胶水只做 target → closest 翻译、面板存活读数与计时器,引擎发声只经
 * 状态机的 play 回调。
 */
import { OWN_ROW_SELECTOR } from '../settings/row.ts'
import type { Engine } from '../engine/audio-engine.ts'

/** 触发器(全站带 aria 标记的菜单按钮;dsh 实测取值 menu 与 listbox —— composer 命令菜单 + 钮即 listbox)。 */
export const TRIGGER_SELECTOR = '[aria-haspopup="menu"],[aria-haspopup="listbox"]'
/** 面板容器:ModelSelect 手写 role="menu",共享 MenuView 用 role="listbox"。 */
export const MENU_SELECTOR = '[role="menu"],[role="listbox"]'
/** 面板条目(ModelSelect 的 menuitem/menuitemradio 与 MenuView 的 option)。 */
export const ITEM_SELECTOR = '[role="menuitem"],[role="menuitemradio"],[role="option"]'
/** 候选按钮:菜单差分兜底的扫描面 + 点外豁免的「触发器」判定面(均限座席内,
 * 见 SEAT_SELECTOR 注)。全站泛化的点击/悬停/焦点锚是 UI_TARGET_SELECTOR
 * (本选择器的超集),两者勿混用。 */
export const BUTTON_SELECTOR = 'button,[role="button"]'
/** 菜单差分判定等待渲染落定的窗口(ms;React 离散事件同步提交,一帧内可见)。 */
export const MENU_DIFF_DELAY_MS = 50
/**
 * 差分兜底的范围锚:composer 座席容器(全局推广后唯一保留的座席约束)。
 * dsh 全站菜单触发器均带 aria 标记(实测 0.1.2:设置页菜单行/上下文量表/
 * 语言行/空屏座席),无标记的命令胶囊只在 composer —— 兜底不随 #20 放宽,
 * 座席外出现静默菜单时再议。
 */
export const SEAT_SELECTOR = '[data-composer-seat]'

/**
 * 自家设置行容器(settings-ui.tsx,own-click 已接线 §5 行 18):泛化路径
 * 跳过整行防双响。标记类名与选择器同源于 settings/row.ts —— 改名会在
 * 两侧一起改,不再是可能静默失配的字符串约定。
 */
export { OWN_ROW_SELECTOR } from '../settings/row.ts'

/**
 * 全站泛化锚(2026-09-08):点击=按键音、悬停/键盘焦点=菜单移动音的目标集。
 * `button/[role="button"]` 之外纳入 `[role="treeitem"]` —— 会话列表的常规
 * 行/分组行是 div[role=treeitem] + onClick(ui-workspace Rows.tsx),搜索
 * 结果行则是 button[role=treeitem];行内嵌套动作按钮取最内命中,不双响。
 * treeitem 不进 BUTTON_SELECTOR/点外豁免集:面板在场按到会话行仍响取消音。
 */
export const UI_TARGET_SELECTOR = 'button,[role="button"],[role="treeitem"]'

/** 面板打开后抑制首次悬停音的窗口(ms),防与确认音叠(SPEC §5.1)。 */
export const OPEN_SUPPRESS_MS = 150

export type InteractionEvent =
  | 'menu-open'
  | 'menu-move'
  | 'menu-item-click'
  | 'menu-close'
  | 'ui-click'
  | 'ui-hover'

export interface InteractionDeps {
  play(event: InteractionEvent): void
  /** 毫秒时钟。 */
  now(): number
}

/**
 * 交互音状态机。约定:
 *  - menuOpen(expandedBefore):触发器 click 在 document **capture 阶段**读到的
 *    aria-expanded —— 即切换前的值。React 18 对 click 这类离散事件同步提交,
 *    document 冒泡阶段读到的已是翻转后的值,开/关判定会反(实机踩坑)。
 *  - itemHover(item):mouseover 委托翻好的条目;null = 已离开面板,重进同一
 *    项可再响;只在真正换行时计数(选项内抖动不算)。
 *  - itemFocus(item):focusin 委托,与悬停共用「最近发声目标」去重 —— 点击
 *    聚焦回悬停已响过的同一项不双响;键盘移动不受打开抑制窗限制(那是
 *    指针静止在面板上的问题,十字键语义每一格都该响)。
 *  - pressItem(item):pointerdown 委托翻好的选项(null = 落点不在选项上);
 *    其后伴随按压的 focus 静默(点击自有确认音,防双响,#28)。
 *  - itemClick():选项点击 = 确认音;无状态直报,统一经状态机发声。
 *  - menuDiff(before, after):无标记座席按钮的菜单差分分类(SPEC §5.1
 *    锚点段)——挂载/换面板开 = 确认音,卸载 = 取消音,恒无 = 静默。
 *  - pressOutside:面板在 DOM 且按点不在触发器/面板内 → 未选中关闭;同一按压
 *    的后续 uiClick 抑制(2026-09-08 决议:一次按压一声,取消音已代表该按压)。
 *  - escape:面板在 DOM 即取消音(钻入态 Escape 退层同属返回语义)。
 *  - uiHover/uiFocus/uiClick/pressUi:全站按钮泛化(2026-09-08 决议)——
 *    悬停与键盘焦点共用「最近发声目标」去重(键盘同权,镜像面板条目);
 *    按压伴随 focus 静默(镜像 #28,防点击双响);面板重开重置按压记录。
 */
export function createInteractionSound(deps: InteractionDeps) {
  let openedAt = Number.NEGATIVE_INFINITY
  let lastEntered: unknown = null
  let lastMoved: unknown = null
  let pressedItem: unknown = null
  let lastUi: unknown = null
  let pressedUi: unknown = null
  let suppressUiClick = false

  function moveSound(target: unknown): void {
    if (target === lastMoved) return
    lastMoved = target
    deps.play('menu-move')
  }

  /** 泛化按钮的悬停/焦点共用发声:null = 离开按钮面,重进同一按钮可再响。 */
  function uiMoveSound(target: unknown): void {
    if (target === lastUi) return
    lastUi = target
    if (target === null) return
    deps.play('ui-hover')
  }

  return {
    menuOpen(expandedBefore: boolean): void {
      if (expandedBefore) {
        deps.play('menu-close')
        return
      }
      openedAt = deps.now()
      lastEntered = null
      lastMoved = null
      pressedItem = null
      pressedUi = null
      deps.play('menu-open')
    },

    itemHover(item: unknown): void {
      if (item === lastEntered) return
      lastEntered = item
      if (item === null) {
        // 离开条目面:连「最近发声项」一并清,重进同一项可再响(SPEC §5.1)。
        lastMoved = null
        return
      }
      if (deps.now() - openedAt < OPEN_SUPPRESS_MS) return
      moveSound(item)
    },

    pressItem(item: unknown | null): void {
      pressedItem = item
      // 每次按压的起点:清上一按压遗留的「点外取消抑制」(只覆盖当次按压)。
      suppressUiClick = false
    },

    itemFocus(item: unknown): void {
      // 按压伴随的 focus(mousedown 聚焦)静默:该次点击自带确认音。
      if (item !== null && item === pressedItem) {
        pressedItem = null
        return
      }
      moveSound(item)
    },

    pressOutside(location: { onTrigger: boolean; insideMenu: boolean }, menuInDom: boolean): void {
      if (!menuInDom || location.onTrigger || location.insideMenu) return
      suppressUiClick = true
      deps.play('menu-close')
    },

    escape(menuInDom: boolean): void {
      if (menuInDom) deps.play('menu-close')
    },

    itemClick(): void {
      deps.play('menu-item-click')
    },

    menuDiff(before: boolean, after: boolean): void {
      if (after) deps.play('menu-open')
      else if (before) deps.play('menu-close')
    },

    pressUi(target: unknown | null): void {
      pressedUi = target
    },

    uiHover(target: unknown): void {
      uiMoveSound(target)
    },

    uiFocus(target: unknown): void {
      // 按压伴随的 focus(mousedown 聚焦)静默:该次点击自带 ui-click(#28 同构)。
      if (target !== null && target === pressedUi) {
        pressedUi = null
        return
      }
      uiMoveSound(target)
    },

    uiClick(): void {
      if (suppressUiClick) {
        suppressUiClick = false
        return
      }
      deps.play('ui-click')
    },
  }
}

/**
 * 挂 document 级委托监听,返回卸载函数。槽位音量/选音/总开关/后台静默
 * 全部由引擎统一裁决,这里只报事件;所有监听 passive,不阻止任何默认行为。
 *
 * 两个实机约束(踩坑记录):
 *  - click/pointerdown 挂 capture:React 18 对离散事件同步提交,document 冒泡
 *    阶段读 aria-expanded 已是翻转后的值;capture 阶段才是切换前状态。
 *  - 面板存活要求可见:第三方/插件 UI 可能常驻挂载隐藏菜单,只按挂载判定
 *    会让 Escape/点外路径凭空响取消音(checkVisibility 守卫,缺 API 退回挂载)。
 */
export function wireInteraction(doc: Document, engine: Pick<Engine, 'play'>): () => void {
  const sound = createInteractionSound({
    play: (event) => {
      void engine.play(event)
    },
    now: () => performance.now(),
  })

  const asElement = (target: EventTarget | null): Element | null =>
    target instanceof Element ? target : null

  /** 座席内元素(仅差分兜底与其点外豁免使用,见 SEAT_SELECTOR 注)。 */
  const inSeat = (el: Element | null): Element | null =>
    el !== null && el.closest(SEAT_SELECTOR) !== null ? el : null

  /**
   * 泛化目标(2026-09-08):面板条目/面板容器/自家设置行之外最近命中
   * (UI_TARGET_SELECTOR,含 treeitem 会话行;行内嵌套按钮取最内),
   * 悬停与点击共用此排除集(条目与菜单路径权威;own-click 权威在自家行);
   * null = 不在泛化面(悬停/焦点路径兼作「离开按钮面」的重置信号)。
   */
  const genericButton = (target: Element): Element | null => {
    const btn = target.closest(UI_TARGET_SELECTOR)
    if (btn === null) return null
    if (btn.closest(MENU_SELECTOR) !== null || btn.closest(OWN_ROW_SELECTOR) !== null) return null
    return btn
  }

  /** 面板存活读数(全站;须可见,见头注)。 */
  const menuAlive = (): boolean =>
    [...doc.querySelectorAll(MENU_SELECTOR)].some((menu) => menu.checkVisibility?.() ?? true)

  let diffTimer: ReturnType<typeof setTimeout> | undefined

  /**
   * 无 aria 标记的座席按钮(如 /permission 命令胶囊)没法从属性判断开/关,
   * 按菜单出现差分分类:点击前后面板有无,声随渲染落定,至多差一个判定窗。
   * 分类决策在状态机(menuDiff),这里只读存活。
   */
  const scheduleMenuDiff = (): void => {
    const before = menuAlive()
    if (diffTimer !== undefined) clearTimeout(diffTimer)
    diffTimer = setTimeout(() => {
      diffTimer = undefined
      sound.menuDiff(before, menuAlive())
    }, MENU_DIFF_DELAY_MS)
  }

  const onClick = (e: MouseEvent): void => {
    const target = asElement(e.target)
    if (target === null) return
    if (target.closest(ITEM_SELECTOR) !== null) {
      // 选项点击恒为确认(已选中项的关闭性点击同属确认按压,SPEC §5.1)。
      sound.itemClick()
      return
    }
    const trigger = target.closest(TRIGGER_SELECTOR)
    if (trigger !== null) {
      const expandedBefore = trigger.getAttribute('aria-expanded') === 'true'
      sound.menuOpen(expandedBefore)
      return
    }
    if (inSeat(target.closest(BUTTON_SELECTOR)) !== null) {
      // 无 aria 标记的座席按钮(/permission 命令胶囊等):开/关交给菜单差分。
      scheduleMenuDiff()
      return
    }
    if (genericButton(target) !== null) {
      // 全站泛化按钮(侧边栏/设置导航/顶栏/对话框等):按键音;触发器、
      // 座席、自家行已在上方分流,此处不含面板内与面板在场抑制由状态机裁决。
      sound.uiClick()
    }
  }

  /**
   * 按压判定挂 capture 阶段的 pointerdown —— 这是能读到「面板还在」的最后
   * 时刻:共享 Menu 的点外关闭监听 document 的 pointerdown(Menu.tsx),冒泡
   * 阶段同步卸载面板;若等 mousedown 再看,面板已不在,取消音就丢了。
   */
  const onPress = (e: MouseEvent): void => {
    const target = asElement(e.target)
    if (target === null) return
    const location = {
      // 座席内无标记按钮(含胶囊)的开关由菜单差分发声,点外取消音豁免它们防双响。
      onTrigger: target.closest(TRIGGER_SELECTOR) !== null ||
                 inSeat(target.closest(BUTTON_SELECTOR)) !== null,
      insideMenu: target.closest(MENU_SELECTOR) !== null,
    }
    sound.pressItem(target.closest(ITEM_SELECTOR))
    // 泛化按压记录(含触发器/座席按钮):其 focus 静默由状态机裁决(镜像 #28)。
    sound.pressUi(genericButton(target))
    sound.pressOutside(location, menuAlive())
  }

  const onHover = (e: MouseEvent): void => {
    const target = asElement(e.target)
    if (target === null) return
    const item = target.closest(ITEM_SELECTOR)
    if (item !== null) {
      sound.itemHover(item)
      return
    }
    if (target.closest(MENU_SELECTOR) !== null) return // 面板内非条目区域:条目路径权威
    sound.uiHover(genericButton(target)) // null = 离开按钮面,重置去重
  }

  const onFocus = (e: FocusEvent): void => {
    const target = asElement(e.target)
    if (target === null) return
    const item = target.closest(ITEM_SELECTOR)
    if (item !== null) {
      sound.itemFocus(item)
      return
    }
    if (target.closest(MENU_SELECTOR) !== null) return
    sound.uiFocus(genericButton(target)) // 键盘同权:与悬停共用去重(2026-09-08)
  }

  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return
    sound.escape(menuAlive())
  }

  doc.addEventListener('click', onClick, { capture: true, passive: true })
  doc.addEventListener('pointerdown', onPress, { capture: true, passive: true })
  doc.addEventListener('mouseover', onHover, { passive: true })
  doc.addEventListener('focusin', onFocus, { passive: true })
  doc.addEventListener('keydown', onKey, { passive: true })
  return () => {
    doc.removeEventListener('click', onClick, { capture: true })
    doc.removeEventListener('pointerdown', onPress, { capture: true })
    doc.removeEventListener('mouseover', onHover)
    doc.removeEventListener('focusin', onFocus)
    doc.removeEventListener('keydown', onKey)
    if (diffTimer !== undefined) clearTimeout(diffTimer)
  }
}
