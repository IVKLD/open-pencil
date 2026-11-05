import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { EditorStore } from '@/app/editor/active-store'
import {
  colorToShadrHex,
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
    const columnChildren = graph.getChildren(menuColumn!.id)
    expect(columnChildren.length).toBe(4)
    const playBtn = columnChildren[0]
    expect(playBtn.name).toBe('[button] menu_play')
    expect(playBtn.width).toBe(260)
    expect(playBtn.height).toBe(52)
    const playChildren = graph.getChildren(playBtn.id)
    expect(playChildren.length).toBe(1)
    expect(playChildren[0].text).toBe('Play')

    // Fake an EditorStore for exportPageFromCanvas
    const mockEditor = {
      graph,
      state: {
        currentPageId: pages[0].id
      }
    } as unknown as EditorStore

    const exported = shadrConverter.exportPage(mockEditor, 'main_menu')
    expect(exported.name).toBe('main_menu')
    expect(exported.screen.width).toBe(1920)
    expect(exported.screen.height).toBe(1080)
    expect(exported.blocks.length).toBe(blocks.length)

    // Verify exported button retains component type and parameters
    const expColumn = exported.blocks.find((b) => b.id === 'menu_column')
    expect(expColumn).toBeDefined()
    expect(expColumn!.children?.[0].type).toBe('component')
    expect(expColumn!.children?.[0].component).toBe('button')
    expect(expColumn!.children?.[0].params?.label).toBe('Play')
  })

  test('imports standalone component and exports back', () => {
    const fixturePath = resolve(process.cwd(), 'docs/shadr/components/button.json')
    const raw = readFileSync(fixturePath, 'utf-8')
    const buttonComp = JSON.parse(raw)

    const graph = shadrConverter.importComponent(buttonComp, 'button')
    const pages = graph.getPages()
    expect(pages.length).toBe(1)
    const rootNodes = graph.getChildren(pages[0].id)
    expect(rootNodes.length).toBe(1)
    expect(rootNodes[0].name).toBe('component_button')

    const mockEditor = {
      graph,
      state: {
        currentPageId: pages[0].id
      }
    } as unknown as EditorStore

    const exported = shadrConverter.exportComponent(mockEditor, 'button')
    expect(exported.params.id).toBe('button')
    expect(exported.blocks.length).toBeGreaterThan(0)
  })
})

