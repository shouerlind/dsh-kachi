import { describe, expect, it } from 'vitest'
import {
  OPEN_SUPPRESS_MS,
  createInteractionSound,
  type InteractionEvent,
} from '../src/client/wiring/interaction.ts'

/** 状态机夹具:记录发声序列 + 可拨动时钟;item 用字符串指代元素引用。 */
function make() {
  const played: InteractionEvent[] = []
  let t = 0
  const sound = createInteractionSound({ play: (e) => played.push(e), now: () => t })
  return {
    sound,
    played,
    at: (ms: number): void => {
      t = ms
    },
  }
}

describe('触发器点击(SPEC §5 行 21/24)', () => {
  it('打开 → 确认音;再点同一触发器(aria-expanded 仍为 true)→ 取消音', () => {
    const { sound, played } = make()
    sound.menuOpen(false)
    sound.menuOpen(true)
    expect(played).toEqual(['menu-open', 'menu-close'])
  })

  it('打开后重置悬停状态:重开面板不残留上一次的「最近发声项」', () => {
    const { sound, played, at } = make()
    sound.menuOpen(false)
    at(500)
    sound.itemHover('a')
    expect(played).toEqual(['menu-open', 'menu-move'])
    sound.menuOpen(true) // 关
    sound.menuOpen(false) // 再开
    at(1000)
    sound.itemHover('a') // 同一项,但已跨面板生命周期 → 可再响
    expect(played).toEqual(['menu-open', 'menu-move', 'menu-close', 'menu-open', 'menu-move'])
  })
})

describe('悬停音(SPEC §5.1:换行才算、抑制窗、重进可再响)', () => {
  it('换项才响,选项内抖动(mouseover 命中同项)不响', () => {
    const { sound, played } = make()
    sound.itemHover('a')
    sound.itemHover('a')
    sound.itemHover('b')
    sound.itemHover('b')
    expect(played.filter((e) => e === 'menu-move')).toHaveLength(2)
  })

  it('离开面板(null)后重进同一项可再响', () => {
    const { sound, played } = make()
    sound.itemHover('a')
    sound.itemHover(null)
    sound.itemHover('a')
    expect(played.filter((e) => e === 'menu-move')).toHaveLength(2)
  })

  it(`面板打开后 ${OPEN_SUPPRESS_MS}ms 内的首次悬停被抑制,其后恢复`, () => {
    const { sound, played, at } = make()
    sound.menuOpen(false)
    at(100)
    sound.itemHover('a')
    expect(played).toEqual(['menu-open'])
    at(200)
    sound.itemHover('b')
    expect(played).toEqual(['menu-open', 'menu-move'])
  })

  it('被抑制的首项不占「最近发声项」:折返回它仍会响', () => {
    const { sound, played, at } = make()
    sound.menuOpen(false)
    at(50)
    sound.itemHover('a') // 抑制
    at(300)
    sound.itemHover('b')
    sound.itemHover('a')
    expect(played.filter((e) => e === 'menu-move')).toHaveLength(2)
  })
})

describe('键盘同权(SPEC §5.1:focus 委托)', () => {
  it('focus 移动响菜单移动音,且不受打开抑制窗限制(十字键语义)', () => {
    const { sound, played, at } = make()
    sound.menuOpen(false)
    at(10)
    sound.itemFocus('a')
    sound.itemFocus('b')
    expect(played).toEqual(['menu-open', 'menu-move', 'menu-move'])
  })

  it('点击选择不双响:hover 已响过的项,click 后的 focusin 静默', () => {
    const { sound, played, at } = make()
    sound.menuOpen(false)
    at(500)
    sound.itemHover('a') // 悬停已响
    sound.itemFocus('a') // mousedown 聚焦同项
    expect(played.filter((e) => e === 'menu-move')).toHaveLength(1)
  })
})

describe('按压伴随 focus 静默(#28:抑制悬停项点击双响)', () => {
  it('打开瞬间被抑制悬停的选项,按压+focus 静默,只保留开音(确认音由 click 路径发声)', () => {
    const { sound, played, at } = make()
    sound.menuOpen(false)
    at(50)
    sound.itemHover('a') // 被抑制:无声
    sound.pressItem('a') // pointerdown 落在该选项
    sound.itemFocus('a') // 按压伴随的 focusin → 静默
    expect(played).toEqual(['menu-open'])
  })

  it('按压记录消费后不残留:其后的键盘 focus 照常响', () => {
    const { sound, played } = make()
    sound.pressItem('a')
    sound.itemFocus('a') // 消费
    sound.itemFocus('b') // 键盘移动 → 响
    expect(played).toEqual(['menu-move'])
  })

  it('pointerdown 不在选项上不拦键盘 focus', () => {
    const { sound, played } = make()
    sound.pressItem(null)
    sound.itemFocus('a')
    expect(played).toEqual(['menu-move'])
  })

  it('面板重开清按压记录:上一会话的按压不拦新面板的 focus', () => {
    const { sound, played } = make()
    sound.pressItem('a')
    sound.menuOpen(false)
    sound.itemFocus('a')
    expect(played).toEqual(['menu-open', 'menu-move'])
  })
})

describe('选项点击与菜单差分(SPEC §5.1 锚点段;#26 下沉状态机)', () => {
  it('选项点击 = 确认音直报', () => {
    const { sound, played } = make()
    sound.itemClick()
    expect(played).toEqual(['menu-item-click'])
  })

  it('菜单差分:挂载=开音,卸载=取消音,恒无=静默,都在(换面板开)=开音', () => {
    const { sound, played } = make()
    sound.menuDiff(false, true)
    sound.menuDiff(true, false)
    sound.menuDiff(false, false)
    sound.menuDiff(true, true)
    expect(played).toEqual(['menu-open', 'menu-close', 'menu-open'])
  })
})

describe('未选中关闭(SPEC §5.1)', () => {
  it('面板在 DOM 且按点不在触发器/面板内 → 取消音', () => {
    const { sound, played } = make()
    sound.pressOutside({ onTrigger: false, insideMenu: false }, true)
    expect(played).toEqual(['menu-close'])
  })

  it('按在触发器上交给 click 判定;按在面板内(滚动条/分组标题)不响', () => {
    const { sound, played } = make()
    sound.pressOutside({ onTrigger: true, insideMenu: false }, true)
    sound.pressOutside({ onTrigger: false, insideMenu: true }, true)
    expect(played).toEqual([])
  })

  it('面板不在 DOM 时按外部无事发生', () => {
    const { sound, played } = make()
    sound.pressOutside({ onTrigger: false, insideMenu: false }, false)
    expect(played).toEqual([])
  })

  it('Escape:面板在 DOM 即取消音(含钻入态退层),不在则静默', () => {
    const { sound, played } = make()
    sound.escape(true)
    sound.escape(false)
    expect(played).toEqual(['menu-close'])
  })
})

describe('全站按钮泛化(ui-click / ui-hover;2026-09-08 决议)', () => {
  it('按钮悬停:换目标才响,离开(null)重进同一按钮可再响', () => {
    const { sound, played } = make()
    sound.uiHover('a')
    sound.uiHover('a') // 同按钮抖动不响
    sound.uiHover('b')
    sound.uiHover(null) // 离开按钮面
    sound.uiHover('b') // 重进可再响
    expect(played.filter((e) => e === 'ui-hover')).toHaveLength(3)
  })

  it('按钮点击 = ui-click 直报', () => {
    const { sound, played } = make()
    sound.uiClick()
    expect(played).toEqual(['ui-click'])
  })

  it('键盘同权:focus 与悬停共用「最近发声目标」去重', () => {
    const { sound, played } = make()
    sound.uiHover('a')
    sound.uiFocus('a') // 悬停已响过
    sound.uiFocus('b') // 键盘移到下一颗
    expect(played.filter((e) => e === 'ui-hover')).toHaveLength(2)
  })

  it('按压伴随 focus 静默:未悬停直接点击只留 click 一声(#28 同构)', () => {
    const { sound, played } = make()
    sound.pressUi('a') // pointerdown 落在该按钮
    sound.uiFocus('a') // mousedown 聚焦 → 静默
    sound.uiClick() // click → ui-click
    expect(played).toEqual(['ui-click'])
  })

  it('按压记录消费后不残留;menuOpen 重置按压记录(镜像 #28)', () => {
    const { sound, played } = make()
    sound.pressUi('a')
    sound.uiFocus('a') // 消费(静默)
    sound.uiFocus('b') // → 响(1)
    sound.pressUi('a')
    sound.menuOpen(false) // 面板生命周期重置按压记录
    sound.uiFocus('a') // 若未重置会被按压记录吞掉;重置后 → 响(2)
    expect(played.filter((e) => e === 'ui-hover')).toHaveLength(2)
  })

  it('面板在场按到外部按钮:取消音 + 该次 ui-click 抑制(一次按压一声)', () => {
    const { sound, played } = make()
    sound.pressItem(null) // 每次按压起点
    sound.pressOutside({ onTrigger: false, insideMenu: false }, true) // 取消音 + 记抑制
    sound.uiClick()
    expect(played).toEqual(['menu-close'])
  })

  it('抑制只覆盖当次按压:下一次按压(面板已关)点击照常响', () => {
    const { sound, played } = make()
    sound.pressItem(null)
    sound.pressOutside({ onTrigger: false, insideMenu: false }, true)
    sound.pressItem(null) // 新按压:清抑制标记;面板不在,pressOutside 不再响
    sound.pressOutside({ onTrigger: false, insideMenu: false }, false)
    sound.uiClick()
    expect(played).toEqual(['menu-close', 'ui-click'])
  })
})
