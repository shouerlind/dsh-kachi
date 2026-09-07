/**
 * C 层交互音接线(SPEC §5.1,ADR-0001):document 级原生事件委托,覆盖 dsh
 * 自家 UI 的 composer 二级面板 —— 悬停/键盘移动=菜单移动音,触发器打开与
 * 选项点击=确认音,未选中关闭=取消音。锚点全是语义属性(aria/role;类名
 * 是 CSS module 运行时哈希不可用),范围锚 [data-composer-seat]。
 * 决策逻辑收在 createInteractionSound 纯状态机(时钟注入,无 DOM 可测),
 * DOM 胶水只做 target → closest 翻译。
 */
import type { Engine } from '../engine/audio-engine.ts'

/** 触发器(dsh 三件套与全部 composer 菜单按钮的稳定语义标记)。 */
export const TRIGGER_SELECTOR = '[aria-haspopup="menu"]'
/** 面板容器:ModelSelect 手写 role="menu",共享 MenuView 用 role="listbox"。 */
export const MENU_SELECTOR = '[role="menu"],[role="listbox"]'
/** 面板条目(ModelSelect 的 menuitem/menuitemradio 与 MenuView 的 option)。 */
export const ITEM_SELECTOR = '[role="menuitem"],[role="menuitemradio"],[role="option"]'
/** seat 内候选按钮(命令胶囊等无 aria 标记的菜单触发器走菜单差分判定)。 */
export const BUTTON_SELECTOR = 'button,[role="button"]'
/** 菜单差分判定等待渲染落定的窗口(ms;React 离散事件同步提交,一帧内可见)。 */
export const MENU_DIFF_DELAY_MS = 50
/**
 * 范围锚:composer 座席容器(ADR-0001 首期边界;全局推广见工单 #20)。
 * 踩坑:[data-composer-card] 只圈住输入卡片,权限预设/工作区座席在卡片外的
 * hero 行 —— 座席容器才圈住全部三件套(实机 DOM 走查确认,全页恰一个)。
 */
export const SEAT_SELECTOR = '[data-composer-seat]'

/** 面板打开后抑制首次悬停音的窗口(ms),防与确认音叠(SPEC §5.1)。 */
export const OPEN_SUPPRESS_MS = 150

export type InteractionEvent = 'menu-open' | 'menu-move' | 'menu-item-click' | 'menu-close'

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
 *  - pressOutside:面板在 DOM 且按点不在触发器/面板内 → 未选中关闭。
 *  - escape:面板在 DOM 即取消音(钻入态 Escape 退层同属返回语义)。
 */
export function createInteractionSound(deps: InteractionDeps) {
  let openedAt = Number.NEGATIVE_INFINITY
  let lastEntered: unknown = null
  let lastMoved: unknown = null
  let pressedItem: unknown = null

  function moveSound(target: unknown): void {
    if (target === lastMoved) return
    lastMoved = target
    deps.play('menu-move')
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
      deps.play('menu-close')
    },

    escape(menuInDom: boolean): void {
      if (menuInDom) deps.play('menu-close')
    },
  }
}

/**
 * 挂 document 级委托监听,返回卸载函数。槽位音量/选音/总开关/后台静默
 * 全部由引擎统一裁决,这里只报事件;所有监听 passive,不阻止任何默认行为。
 *
 * 两个实机约束(踩坑记录):
 *  - click/mousedown 挂 capture:React 18 对离散事件同步提交,document 冒泡
 *    阶段读 aria-expanded 已是翻转后的值;capture 阶段才是切换前状态。
 *  - portal 面板(共享 Menu,createPortal 到 body)不在 composer 座席子树内,
 *    条目范围放宽为「座席内 OR 会话进行中」;会话由 composer 触发器打开,
 *    随各类关闭路径显式回收,防止范围泄漏到设置页等同名菜单。
 */
export function wireInteraction(doc: Document, engine: Pick<Engine, 'play'>): () => void {
  const sound = createInteractionSound({
    play: (event) => {
      void engine.play(event)
    },
    now: () => performance.now(),
  })

  /**
   * 会话:composer 触发器打开中的菜单。存触发器元素便于调试,判定只用
   * 「非空」;菜单消失的各条路径都会清掉它。
   */
  let session: Element | null = null
  let menuGcTimer: ReturnType<typeof setTimeout> | undefined
  let diffTimer: ReturnType<typeof setTimeout> | undefined

  const asElement = (target: EventTarget | null): Element | null =>
    target instanceof Element ? target : null

  const inCard = (el: Element | null): Element | null =>
    el !== null && el.closest(SEAT_SELECTOR) !== null ? el : null

  /** 范围判定:卡片内元素恒在范围;卡片外条目仅在会话进行中(其触发器在卡片内)。 */
  const inScope = (el: Element | null): Element | null =>
    el !== null && (session !== null || el.closest(SEAT_SELECTOR) !== null) ? el : null

  const anyMenuAlive = (): boolean =>
    doc.querySelector('[role="menu"]') !== null || doc.querySelector('[role="listbox"]') !== null

  const cardMenuAlive = (): boolean =>
    doc.querySelector(`${SEAT_SELECTOR} [role="menu"]`) !== null ||
    doc.querySelector(`${SEAT_SELECTOR} [role="listbox"]`) !== null

  /** composer 自有菜单:卡片内面板恒算;portal 面板仅会话进行中算。 */
  const composerMenuAlive = (): boolean => cardMenuAlive() || (session !== null && anyMenuAlive())

  /** 条目点击后面板可能已卸载(portal onSelect 关闭);短暂延迟后回收陈旧会话。 */
  const armMenuGc = (): void => {
    if (menuGcTimer !== undefined) clearTimeout(menuGcTimer)
    menuGcTimer = setTimeout(() => {
      menuGcTimer = undefined
      if (session !== null && !anyMenuAlive()) session = null
    }, 120)
  }

  /**
   * 无 aria 标记的座席按钮(如 /permission 命令胶囊)没法从属性判断开/关,
   * 按菜单出现差分分类:点击前后面板有无 → 挂载=确认音,卸载=取消音,
   * 都在 = 换了个面板开(也作确认)。声随渲染落定,至多差一个判定窗。
   */
  const scheduleMenuDiff = (button: Element): void => {
    const before = composerMenuAlive()
    if (diffTimer !== undefined) clearTimeout(diffTimer)
    diffTimer = setTimeout(() => {
      diffTimer = undefined
      const after = composerMenuAlive()
      if (before === after) {
        if (!before) return
        session = button
        void engine.play('menu-open')
        return
      }
      if (after) {
        session = button
        void engine.play('menu-open')
      } else {
        session = null
        void engine.play('menu-close')
      }
    }, MENU_DIFF_DELAY_MS)
  }

  const onClick = (e: MouseEvent): void => {
    const target = asElement(e.target)
    if (target === null) return
    if (inScope(target.closest(ITEM_SELECTOR)) !== null) {
      // 选项点击恒为确认(已选中项的关闭性点击同属确认按压,SPEC §5.1)。
      void engine.play('menu-item-click')
      armMenuGc()
      return
    }
    const trigger = inCard(target.closest(TRIGGER_SELECTOR))
    if (trigger !== null) {
      const expandedBefore = trigger.getAttribute('aria-expanded') === 'true'
      sound.menuOpen(expandedBefore)
      session = expandedBefore ? null : trigger
      return
    }
    const seatButton = inCard(target.closest(BUTTON_SELECTOR))
    if (seatButton !== null) {
      // 无 aria 标记的座席按钮(/permission 命令胶囊等):开/关交给菜单差分。
      scheduleMenuDiff(seatButton)
      return
    }
    // 其余点击(含键盘 Enter 触发的无 mousedown 点击):面板若已不在,回收会话。
    if (session !== null && !anyMenuAlive()) session = null
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
      // 座席内按钮(含无标记胶囊)的开关由菜单差分发声,点外取消音豁免它们防双响。
      onTrigger: inCard(target.closest(TRIGGER_SELECTOR)) !== null ||
                 inCard(target.closest(BUTTON_SELECTOR)) !== null,
      insideMenu: inScope(target.closest(MENU_SELECTOR)) !== null,
    }
    const menuAlive = composerMenuAlive()
    sound.pressItem(inScope(target.closest(ITEM_SELECTOR)))
    sound.pressOutside(location, menuAlive)
    if (menuAlive && !location.onTrigger && !location.insideMenu) session = null
    if (session !== null && !anyMenuAlive()) session = null
  }

  const onHover = (e: MouseEvent): void => {
    const target = asElement(e.target)
    if (target === null) return
    sound.itemHover(inScope(target.closest(ITEM_SELECTOR)))
  }

  const onFocus = (e: FocusEvent): void => {
    const target = asElement(e.target)
    if (target === null) return
    const item = inScope(target.closest(ITEM_SELECTOR))
    if (item !== null) sound.itemFocus(item)
  }

  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return
    const menuAlive = composerMenuAlive()
    sound.escape(menuAlive)
    if (menuAlive) session = null
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
    if (menuGcTimer !== undefined) clearTimeout(menuGcTimer)
    if (diffTimer !== undefined) clearTimeout(diffTimer)
  }
}
