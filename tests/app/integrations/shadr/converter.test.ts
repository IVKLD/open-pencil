import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { asDouble } from '@open-pencil/test-support/doubles'

import type { EditorStore } from '@/app/editor/active-store'
import {
  colorToShadrHex,
  componentRegistry,
  parseCoordinate,
  shadrConverter,
  shadrHexToColor
} from '@/app/integrations/shadr/converter'
import type { ShadrPage } from '@/app/integrations/shadr/types'

describe('Shadr Converter', () => {
  test('parseCoordinate handles numbers and expressions', () => {
    expect(parseCoordinate(100)).toBe(100)
    expect(parseCoordinate('200')).toBe(200)
    expect(parseCoordinate('1920/2')).toBe(960)
    expect(parseCoordinate('1920/2 - 130')).toBe(830)
    expect(parseCoordinate('halfWidth - 250')).toBe(710)
    expect(parseCoordinate('1080 - 60')).toBe(1020)
    expect(parseCoordinate('26 + 72 * 0.9')).toBeCloseTo(90.8, 2)
    expect(parseCoordinate('52 / 2 - 0.1514 * 68')).toBeCloseTo(15.7048, 2)
    expect(parseCoordinate('520 - 48')).toBe(472)
  })

  test('color conversion round-trips correctly', () => {
    const hex = '4cc9f0'
    const { color } = shadrHexToColor(hex)
    expect(colorToShadrHex(color)).toBe(hex)
  })

  test('imports main_menu.json into SceneGraph and exports back', () => {
    const buttonRaw = readFileSync(
      resolve(process.cwd(), 'docs/shadr/components/button.json'),
      'utf-8'
    )
    componentRegistry.set('button', JSON.parse(buttonRaw))

    const fixturePath = resolve(process.cwd(), 'docs/shadr/pages/main_menu.json')
    const raw = readFileSync(fixturePath, 'utf-8')
    const page: ShadrPage = JSON.parse(raw)

    const graph = shadrConverter.importPage(page)
    const pages = graph.getPages()
    expect(pages.length).toBeGreaterThan(0)

    const rootNodes = graph.getChildren(pages[0].id)
    expect(rootNodes.length).toBe(1)
    const screenFrame = rootNodes[0]
    expect(screenFrame.name).toBe('main_menu')
    expect(screenFrame.width).toBe(1920)
    expect(screenFrame.height).toBe(1080)

    // Check children imported
    const blocks = graph.getChildren(screenFrame.id)
    expect(blocks.length).toBeGreaterThan(3)

    // Check component expansion inside menu_column
    const menuColumn = blocks.find((b) => b.name === 'menu_column')
    expect(menuColumn).toBeDefined()
    const columnChildren = menuColumn ? graph.getChildren(menuColumn.id) : []
    expect(columnChildren.length).toBe(4)
    const playBtn = columnChildren[0]
    expect(playBtn.name).toBe('[button] menu_play')
    expect(playBtn.width).toBe(260)
    expect(playBtn.height).toBe(52)
    const playChildren = graph.getChildren(playBtn.id)
    expect(playChildren.length).toBe(1)
    expect(playChildren[0].text).toBe('Play')

    // Mock EditorStore for exportPage
    const mockEditor = asDouble<EditorStore>({
      graph,
      state: {
        currentPageId: pages[0].id
      }
    })

    const exported = shadrConverter.exportPage(mockEditor, 'main_menu')
    expect(exported.name).toBe('main_menu')
    expect(exported.screen.width).toBe(1920)
    expect(exported.screen.height).toBe(1080)
    expect(exported.blocks.length).toBe(blocks.length)

    // Verify exported button retains component type and parameters
    const expColumn = exported.blocks.find((b) => b.id === 'menu_column')
    expect(expColumn).toBeDefined()
    expect(expColumn?.children?.[0].type).toBe('component')
    expect(expColumn?.children?.[0].component).toBe('button')
    expect(expColumn?.children?.[0].params?.label).toBe('Play')
  })

  test('preserves animations and custom screen properties on round-trip', () => {
    const originalPage: ShadrPage = {
      name: 'hud_overlay',
      screen: {
        width: 1920,
        height: 1080,
        cursorSize: 0,
        cursorSpeed: 1.5,
        cursorLayer: 9900,
        offsetX: 5,
        offsetY: 10
      },
      blocks: [
        {
          type: 'block',
          id: 'bg',
          position: { x: 0, y: 0 },
          size: { width: 1920, height: 1080 }
        }
      ],
      animations: [
        {
          name: 'slide_in',
          durationTicks: 15,
          steps: [{ target: 'bg', axis: 'y', from: -100, to: 0, duration: 15 }]
        }
      ]
    }

    const graph = shadrConverter.importPage(originalPage)
    const pageNode = graph.getPages()[0]

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: {
        currentPageId: pageNode.id
      }
    })

    const exported = shadrConverter.exportPage(mockEditor, 'hud_overlay')
    expect(exported.screen.cursorSize).toBe(0)
    expect(exported.screen.cursorSpeed).toBe(1.5)
    expect(exported.screen.cursorLayer).toBe(9900)
    expect(exported.screen.offsetX).toBe(5)
    expect(exported.screen.offsetY).toBe(10)
    expect(exported.animations).toBeDefined()
    expect(exported.animations?.length).toBe(1)
  })

  test('preserves text_input and video blocks with their properties on round-trip', () => {
    const pageWithSpecialBlocks: ShadrPage = {
      name: 'interactive_demo',
      screen: { width: 1920, height: 1080 },
      blocks: [
        {
          type: 'text_input',
          id: 'player_name',
          position: { x: 100, y: 150 },
          size: { width: 300, height: 50 },
          placeholder: 'Enter username',
          maxLength: 16,
          fontSize: 20,
          textColor: 'f0f0f0',
          permission: 'shadr.chat'
        },
        {
          type: 'video',
          id: 'intro_video',
          position: { x: 500, y: 150 },
          size: { width: 640, height: 360 },
          video: 'intro_cutscene',
          stream: true
        }
      ]
    }

    const graph = shadrConverter.importPage(pageWithSpecialBlocks)
    const pageNode = graph.getPages()[0]

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: {
        currentPageId: pageNode.id
      }
    })

    const exported = shadrConverter.exportPage(mockEditor, 'interactive_demo')
    const inputBlock = exported.blocks.find((b) => b.id === 'player_name')
    expect(inputBlock).toBeDefined()
    expect(inputBlock?.type).toBe('text_input')
    expect(inputBlock?.placeholder).toBe('Enter username')
    expect(inputBlock?.maxLength).toBe(16)
    expect(inputBlock?.fontSize).toBe(20)
    expect(inputBlock?.permission).toBe('shadr.chat')

    const videoBlock = exported.blocks.find((b) => b.id === 'intro_video')
    expect(videoBlock).toBeDefined()
    expect(videoBlock?.type).toBe('video')
    expect(videoBlock?.video).toBe('intro_cutscene')
    expect(videoBlock?.stream).toBe(true)
  })

  test('correctly imports admin_server.json text elements without artificial column wrapping', () => {
    const fixturePath = resolve(process.cwd(), 'docs/shadr/pages/admin_server.json')
    const raw = readFileSync(fixturePath, 'utf-8')
    const page: ShadrPage = JSON.parse(raw)

    const graph = shadrConverter.importPage(page)
    const pageNode = graph.getPages()[0]
    const screenFrame = graph.getChildren(pageNode.id)[0]
    const nodes = graph.getChildren(screenFrame.id)

    // Title ("Обзор сервера", size: 112 -> 28px)
    const titleNode = nodes.find((n) => n.name === 'title')
    expect(titleNode).toBeDefined()
    if (!titleNode) throw new Error('titleNode not found')
    expect(titleNode.type).toBe('TEXT')
    expect(titleNode.fontSize).toBe(28)
    expect(titleNode.textAutoResize).toBe('WIDTH_AND_HEIGHT')
    expect(titleNode.width).toBeGreaterThanOrEqual(100)

    // Eyebrow ("SHADR / ADMIN", size: 48 -> 12px)
    const eyebrowNode = nodes.find((n) => n.name === 'eyebrow')
    expect(eyebrowNode).toBeDefined()
    if (!eyebrowNode) throw new Error('eyebrowNode not found')
    expect(eyebrowNode.type).toBe('TEXT')
    expect(eyebrowNode.fontSize).toBe(12)
    expect(eyebrowNode.textAutoResize).toBe('WIDTH_AND_HEIGHT')

    // Footer ("Данные сервера · доступ через shadr.command", size: 44 -> 11px)
    const footerNode = nodes.find((n) => n.name === 'footer')
    expect(footerNode).toBeDefined()
    if (!footerNode) throw new Error('footerNode not found')
    expect(footerNode.type).toBe('TEXT')
    expect(footerNode.fontSize).toBe(11)
    expect(footerNode.textAutoResize).toBe('WIDTH_AND_HEIGHT')
    // Crucial check: width must be wide enough to hold 44 characters, not 44 pixels!
    expect(footerNode.width).toBeGreaterThan(200)

    // Verify round-trip export preserves font scale
    const mockEditor = asDouble<EditorStore>({
      graph,
      state: { currentPageId: pageNode.id }
    })
    const exported = shadrConverter.exportPage(mockEditor, 'admin_server')
    const expTitle = exported.blocks.find((b) => b.id === 'title')
    expect(expTitle).toBeDefined()
    if (!expTitle || !expTitle.size) throw new Error('expTitle not found')
    expect(expTitle.size.width).toBe(112)
    expect(expTitle.size.height).toBe(112)

    const expEyebrow = exported.blocks.find((b) => b.id === 'eyebrow')
    expect(expEyebrow).toBeDefined()
    if (!expEyebrow || !expEyebrow.size) throw new Error('expEyebrow not found')
    expect(expEyebrow.size.width).toBe(48)
    expect(expEyebrow.size.height).toBe(48)
  })

  test('correctly imports shop.json expanding loop: 4 and fixing color 70.0', () => {
    const fixturePath = resolve(process.cwd(), 'docs/shadr/pages/shop.json')
    const raw = readFileSync(fixturePath, 'utf-8')
    const page: ShadrPage = JSON.parse(raw)

    const graph = shadrConverter.importPage(page)
    const pageNode = graph.getPages()[0]
    const screenFrame = graph.getChildren(pageNode.id)[0]
    const nodes = graph.getChildren(screenFrame.id)

    // All 4 loop offers must be expanded as separate nodes
    const offer0 = nodes.find((n) => n.name === 'offer_0')
    const offer1 = nodes.find((n) => n.name === 'offer_1')
    const offer2 = nodes.find((n) => n.name === 'offer_2')
    const offer3 = nodes.find((n) => n.name === 'offer_3')

    expect(offer0).toBeDefined()
    expect(offer1).toBeDefined()
    expect(offer2).toBeDefined()
    expect(offer3).toBeDefined()

    // Verify calculated Y positions: 1080/2 - 160 + loopIndex * 92
    expect(offer0?.y).toBe(380)
    expect(offer1?.y).toBe(472)
    expect(offer2?.y).toBe(564)
    expect(offer3?.y).toBe(656)

    // Verify children inside loop items
    if (offer0) {
      const offer0Children = graph.getChildren(offer0.id)
      const nameNode = offer0Children.find((c) => c.name === 'offer_0_name')
      expect(nameNode?.text).toBe('Offer 1')
      const priceNode = offer0Children.find((c) => c.name === 'offer_0_price')
      expect(priceNode?.text).toBe('$100')
      // Color 70.0 should be interpreted as lime green #70e000, not dark blue
      const priceFill = priceNode?.fills?.[0]
      expect(priceFill?.color?.g).toBeGreaterThan(0.7)
    }

    // Verify background layers are locked while interactive offers stay unlocked
    const backdrop = nodes.find((n) => n.name === 'backdrop')
    const shopPanel = nodes.find((n) => n.name.includes('shop_panel'))
    expect(backdrop?.locked).toBe(true)
    expect(shopPanel).toBeDefined()
    expect(shopPanel?.locked).toBe(true)
    expect(offer0?.locked).toBe(false)
  })

  test('correctly maps Shadr and Minecraft font variants to Inter and preserves original font on round-trip', () => {
    const fixturePath = resolve(process.cwd(), 'docs/shadr/pages/stupidcli.json')
    const raw = readFileSync(fixturePath, 'utf-8')
    const page: ShadrPage = JSON.parse(raw)

    const graph = shadrConverter.importPage(page)
    const pages = graph.getPages()
    const screenFrame = graph.getChildren(pages[0].id)[0]
    const textNode = graph.getChildren(screenFrame.id).find((n) => n.text === 'stupidcli')

    // Resolves to Inter with semibold weight
    expect(textNode?.fontFamily).toBe('Inter')
    // Weight should be inferred as 600 from 'shadr_sharp_semibold'
    expect(textNode?.fontWeight).toBe(600)

    // Round-trip export back to Shadr JSON
    const mockEditor = asDouble<EditorStore>({
      graph,
      state: {
        currentPageId: pages[0].id
      }
    })
    const exported = shadrConverter.exportPage(mockEditor, 'stupidcli')
    const exportedText = exported.blocks.find((e) => e.text === 'stupidcli')
    expect(exportedText).toBeDefined()
    // Original resourcepack font name must be preserved 100%
    expect(exportedText?.font).toBe('shadr_sharp_semibold')
  })

  test('imports interactive_menu.json with scrollRegions as clipped container frame and exports back', () => {
    const fixturePath = resolve(process.cwd(), 'docs/shadr/pages/interactive_menu.json')
    const raw = readFileSync(fixturePath, 'utf-8')
    const page: ShadrPage = JSON.parse(raw)

    const graph = shadrConverter.importPage(page)
    const pages = graph.getPages()
    expect(pages.length).toBeGreaterThan(0)

    const rootNodes = graph.getChildren(pages[0].id)
    const screenFrame = rootNodes[0]
    expect(screenFrame.name).toBe('interactive_menu')

    const blocks = graph.getChildren(screenFrame.id)
    const scrollFrame = blocks.find((b) => b.name === 'scroll_tasks')
    expect(scrollFrame).toBeDefined()
    if (!scrollFrame) throw new Error('scroll_tasks frame not found')

    expect(scrollFrame.type).toBe('FRAME')
    expect(scrollFrame.clipsContent).toBe(true)
    expect(scrollFrame.x).toBe(280)
    expect(scrollFrame.y).toBe(360)
    expect(scrollFrame.width).toBe(760)
    expect(scrollFrame.height).toBe(448)

    // Verify all 24 rows are nested inside scroll_tasks with relative coordinates
    const rows = graph.getChildren(scrollFrame.id)
    expect(rows.length).toBe(24)

    const firstRow = rows[0]
    expect(firstRow.name).toBe('row_0')
    expect(firstRow.x).toBe(0)
    expect(firstRow.y).toBe(0)

    const secondRow = rows[1]
    expect(secondRow.name).toBe('row_1')
    expect(secondRow.x).toBe(0)
    expect(secondRow.y).toBe(64)

    const lastRow = rows[23]
    expect(lastRow.name).toBe('row_23')
    expect(lastRow.x).toBe(0)
    expect(lastRow.y).toBe(23 * 64)

    // Export back to Shadr and verify scrollRegions & child blocks
    const mockEditor = asDouble<EditorStore>({
      graph,
      state: { currentPageId: pages[0].id }
    })
    const exported = shadrConverter.exportPage(mockEditor, 'interactive_menu')

    expect(exported.scrollRegions).toBeDefined()
    const regions = exported.scrollRegions
    if (!regions) throw new Error('regions not found')
    expect(regions.length).toBe(1)
    const region = regions[0]
    expect(region.id).toBe('tasks')
    expect(region.x).toBe(280)
    expect(region.y).toBe(360)
    expect(region.width).toBe(760)
    expect(region.height).toBe(448)
    expect(region.contentHeight).toBe(1536)
    expect(region.step).toBe(64)

    // Verify exported child blocks preserved their scrollRegion and reconstructed absolute coordinates
    const exportedRow0 = exported.blocks.find((b) => b.id === 'row_0')
    expect(exportedRow0).toBeDefined()
    if (!exportedRow0 || !exportedRow0.position) throw new Error('exportedRow0 not found')
    expect(exportedRow0.scrollRegion).toBe('tasks')
    expect(exportedRow0.position.x).toBe(280)
    expect(exportedRow0.position.y).toBe(360)

    const exportedRow1 = exported.blocks.find((b) => b.id === 'row_1')
    expect(exportedRow1).toBeDefined()
    if (!exportedRow1 || !exportedRow1.position) throw new Error('exportedRow1 not found')
    expect(exportedRow1.scrollRegion).toBe('tasks')
    expect(exportedRow1.position.x).toBe(280)
    expect(exportedRow1.position.y).toBe(424)
  })

  test('handles textAlign: "right" correctly on import and export roundtrip', () => {
    const page: ShadrPage = {
      name: 'test_align',
      screen: { width: 1920, height: 1080 },
      blocks: [
        {
          type: 'text',
          id: 'right_val',
          position: { x: 540, y: 100 },
          size: { width: 60, height: 60 },
          text: 'Auto',
          textAlign: 'right'
        }
      ]
    }

    const graph = shadrConverter.importPage(page)
    const pages = graph.getPages()
    const screenFrame = graph.getChildren(pages[0].id)[0]
    const textNode = graph.getChildren(screenFrame.id).find((b) => b.name === 'right_val')
    expect(textNode).toBeDefined()
    if (!textNode) throw new Error('textNode not found')

    expect(textNode.textAlignHorizontal).toBe('RIGHT')
    // The right edge of the text box (x + width) must anchor at 540
    expect(textNode.x + textNode.width).toBe(540)
    expect(textNode.x).toBeLessThan(540)

    // Export back to Shadr
    const mockEditor = asDouble<EditorStore>({
      graph,
      state: { currentPageId: pages[0].id }
    })
    const exported = shadrConverter.exportPage(mockEditor, 'test_align')
    const exportedText = exported.blocks.find((b) => b.id === 'right_val')
    expect(exportedText).toBeDefined()
    expect(exportedText?.textAlign).toBe('right')
    expect(exportedText?.position?.x).toBe(540)
  })

  test('imports settings.json keeping right-aligned values and reset_link properly anchored inside card', () => {
    const loadComp = (name: string) => {
      const p = resolve(process.cwd(), `docs/shadr/components/${name}.json`)
      componentRegistry.set(name, JSON.parse(readFileSync(p, 'utf-8')))
    }
    loadComp('panel')
    loadComp('list_row')
    loadComp('section_header')
    loadComp('progress_bar')
    loadComp('button')
    loadComp('button_ghost')

    const fixturePath = resolve(process.cwd(), 'docs/shadr/pages/settings.json')
    const page: ShadrPage = JSON.parse(readFileSync(fixturePath, 'utf-8'))

    const graph = shadrConverter.importPage(page)
    const pages = graph.getPages()
    const screenFrame = graph.getChildren(pages[0].id)[0]
    const blocks = graph.getChildren(screenFrame.id)

    // reset_link is an absolute text node with textAlign: "right" at x: 1920/2 + 250 = 1210
    const resetLink = blocks.find((b) => b.name === 'reset_link')
    expect(resetLink).toBeDefined()
    if (!resetLink) throw new Error('reset_link not found')

    expect(resetLink.textAlignHorizontal).toBe('RIGHT')
    expect(resetLink.x + resetLink.width).toBe(1210)
    // Panel width is 620 starting at 650 -> right border is 1270. 1210 is comfortably inside the panel!
    expect(resetLink.x + resetLink.width).toBeLessThan(1270)
  })

  test('preserves draggable, dragGroup, dragBounds, hoverText, and enabled on roundtrip', () => {
    const page: ShadrPage = {
      name: 'test_advanced_props',
      screen: { width: 1920, height: 1080 },
      blocks: [
        {
          type: 'block_rounded',
          id: 'drag_card',
          position: { x: 100, y: 100 },
          size: { width: 300, height: 200 },
          draggable: true,
          dragGroup: 'cards',
          dragBounds: { x: 50, y: 50, width: 600, height: 600 },
          hoverText: 'Drag me around',
          enabled: false
        }
      ]
    }

    const graph = shadrConverter.importPage(page)
    const pages = graph.getPages()
    const mockEditor = asDouble<EditorStore>({
      graph,
      state: { currentPageId: pages[0].id }
    })
    const exported = shadrConverter.exportPage(mockEditor, 'test_advanced_props')
    const card = exported.blocks.find((b) => b.id === 'drag_card')

    expect(card).toBeDefined()
    expect(card?.draggable).toBe(true)
    expect(card?.dragGroup).toBe('cards')
    expect(card?.dragBounds).toEqual({ x: 50, y: 50, width: 600, height: 600 })
    expect(card?.hoverText).toBe('Drag me around')
    expect(card?.enabled).toBe(false)
  })

  test('correctly imports demo.json with blur element in the background with blur effects', () => {
    const chipRaw = readFileSync(
      resolve(process.cwd(), 'docs/shadr/components/stat_chip.json'),
      'utf-8'
    )
    componentRegistry.set('stat_chip', JSON.parse(chipRaw))

    const demoPath = resolve(process.cwd(), 'docs/shadr/pages/demo.json')
    const raw = readFileSync(demoPath, 'utf-8')
    const page: ShadrPage = JSON.parse(raw)

    const graph = shadrConverter.importPage(page)
    const pages = graph.getPages()
    const screenFrame = graph.getChildren(pages[0].id)[0]
    const children = graph.getChildren(screenFrame.id)

    // Check that blur node is placed in the background before the card
    const blurIndex = children.findIndex((c) => c.name === 'el_blur_1')
    const cardIndex = children.findIndex((c) => c.name === 'card')
    expect(blurIndex).toBeGreaterThanOrEqual(0)
    expect(cardIndex).toBeGreaterThanOrEqual(0)
    expect(blurIndex).toBeLessThan(cardIndex)

    const blurNode = children[blurIndex]
    expect(blurNode.effects?.some((e) => e.type === 'BACKGROUND_BLUR')).toBe(true)
    // Blur without explicit opacity must NOT draw an opaque/tinted box over the canvas
    expect(blurNode.fills?.length ?? 0).toBe(0)

    // Card has rounding: { size: "regular" } -> 24px corner radius
    const cardNode = children[cardIndex]
    expect(cardNode.cornerRadius).toBe(24)

    // Text display entity inside card
    const cardChildren = graph.getChildren(cardNode.id)
    const bodyNode = cardChildren.find((c) => c.name.includes('card_body'))
    expect(bodyNode).toBeDefined()
    expect(bodyNode?.text).toBe('Every element here is a glyph placed by a display entity.')
    expect(bodyNode?.textAutoResize).toBe('HEIGHT')
    expect(bodyNode?.width).toBe(456)

    // Export round-trip
    const mockEditor = asDouble<EditorStore>({
      graph,
      state: { currentPageId: pages[0].id }
    })
    const exported = shadrConverter.exportPage(mockEditor, 'demo')
    const exportedBlur = exported.blocks.find((b) => b.id === 'el_blur_1')
    expect(exportedBlur).toBeDefined()
    expect(exportedBlur?.type).toBe('blur')
    expect(exportedBlur?.color).toBe('ffffff')

    const exportedCard = exported.blocks.find((b) => b.id === 'card')
    expect(exportedCard?.rounding?.size).toBe('regular')
    const exportedBody = exportedCard?.children?.find((c) => c.id === 'card_body')
    expect(exportedBody?.lineWidth).toBe(456)
  })
})
