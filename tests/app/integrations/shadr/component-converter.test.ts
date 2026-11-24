import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { SceneGraph } from '@open-pencil/scene-graph'
import { asDouble } from '@open-pencil/test-support/doubles'

import type { EditorStore } from '@/app/editor/active-store'
import {
  componentRegistry,
  paramPlaceholder,
  shadrConverter
} from '@/app/integrations/shadr/converter'
import type { ShadrComponent, ShadrPage } from '@/app/integrations/shadr/types'

describe('Shadr Component Converter', () => {
  test('imports standalone component and exports back', () => {
    const fixturePath = resolve(process.cwd(), 'docs/shadr/components/button.json')
    const raw = readFileSync(fixturePath, 'utf-8')
    const comp: ShadrComponent = JSON.parse(raw)

    const graph = shadrConverter.importComponent(comp, 'button')
    const pages = graph.getPages()
    expect(pages.length).toBeGreaterThan(0)

    const compNodes = graph.getChildren(pages[0].id)
    expect(compNodes.length).toBe(1)
    const compFrame = compNodes[0]
    expect(compFrame.name).toBe('button')
    expect(compFrame.type).toBe('COMPONENT')

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: { currentPageId: pages[0].id }
    })
    const exported = shadrConverter.exportComponent(mockEditor, 'button')
    expect(exported.params).toBeDefined()
    expect(exported.params.id).toBe('button')
    expect(exported.blocks.length).toBeGreaterThan(0)
  })

  test('normalizes component child coordinates to (0, 0) inside component frame', () => {
    const compWithOffset: ShadrComponent = {
      params: { id: 'card', width: 200, height: 100 },
      blocks: [
        {
          type: 'block',
          id: 'card_bg',
          position: { x: 500, y: 300 },
          size: { width: 200, height: 100 }
        },
        {
          type: 'text',
          id: 'card_label',
          position: { x: 520, y: 320 },
          text: 'Hello'
        }
      ]
    }

    const graph = new SceneGraph()
    shadrConverter.importComponentsIntoGraph(graph, { card: compWithOffset })

    const compPage = graph.getPages().find((p) => p.name === '_components')
    expect(compPage).toBeDefined()
    if (!compPage) throw new Error('_components page not found')

    const compFrame = graph.getChildren(compPage.id)[0]
    expect(compFrame).toBeDefined()
    if (!compFrame) throw new Error('compFrame not found')
    expect(compFrame.name).toBe('card')

    const children = graph.getChildren(compFrame.id)
    expect(children.length).toBe(2)

    const bgNode = children.find((c) => c.name === 'card_bg')
    expect(bgNode).toBeDefined()
    if (!bgNode) throw new Error('card_bg not found')
    expect(bgNode.x).toBe(0)
    expect(bgNode.y).toBe(0)

    const labelNode = children.find((c) => c.name === 'card_label')
    expect(labelNode).toBeDefined()
    if (!labelNode) throw new Error('card_label not found')
    expect(labelNode.x).toBe(20)
    expect(labelNode.y).toBe(20)
  })

  test('exportComponent reconstructs single root block with hover/click effects and actions', () => {
    const fixturePath = resolve(process.cwd(), 'docs/shadr/components/button.json')
    const raw = readFileSync(fixturePath, 'utf-8')
    const buttonComp: ShadrComponent = JSON.parse(raw)

    const graph = new SceneGraph()
    shadrConverter.importComponentsIntoGraph(graph, { button: buttonComp })

    const compPage = graph.getPages().find((p) => p.name === '_components')
    expect(compPage).toBeDefined()
    if (!compPage) throw new Error('_components page not found')

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: {
        currentPageId: compPage.id
      }
    })

    const exported = shadrConverter.exportComponent(mockEditor, 'button')
    expect(exported.blocks.length).toBe(1)

    const rootBlock = exported.blocks[0]
    expect(rootBlock.type).toBe('block_rounded')
    expect(rootBlock.hoverEffect).toBe('lift')
    expect(rootBlock.clickEffect).toBe('press')
    expect(rootBlock.onClickAction).toBeDefined()
    expect(rootBlock.onClickAction?.[0]).toBe(`sound: ${paramPlaceholder('sound')}`)
    expect(rootBlock.children).toBeDefined()
    expect(rootBlock.children?.length).toBe(1)
    expect(rootBlock.children?.[0].type).toBe('text')
  })

  test('exportComponent preserves auxiliary scrim block, outline, and centered position for modal', () => {
    const fixturePath = resolve(process.cwd(), 'docs/shadr/components/modal.json')
    const raw = readFileSync(fixturePath, 'utf-8')
    const modalComp: ShadrComponent = JSON.parse(raw)

    const graph = new SceneGraph()
    shadrConverter.importComponentsIntoGraph(graph, { modal: modalComp })

    const compPage = graph.getPages().find((p) => p.name === '_components')
    expect(compPage).toBeDefined()
    if (!compPage) throw new Error('_components page not found')

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: {
        currentPageId: compPage.id
      }
    })

    const exported = shadrConverter.exportComponent(mockEditor, 'modal')
    expect(exported.blocks.length).toBe(2)

    // Block 0: auxiliary scrim overlay block
    const scrimBlock = exported.blocks[0]
    expect(scrimBlock.id).toContain('scrim')
    expect(scrimBlock.layer).toBe(40)
    expect(scrimBlock.size?.width).toBe(1920)

    // Block 1: centered modal dialog box with rounded corners and outline
    const dialogBlock = exported.blocks[1]
    expect(dialogBlock.type).toBe('block_rounded')
    expect(dialogBlock.layer).toBe(41)
    expect(dialogBlock.position?.x).toBe(`1920 / 2 - ${paramPlaceholder('width')} / 2`)
    expect(dialogBlock.position?.y).toBe(`1080 / 2 - ${paramPlaceholder('height')} / 2`)
    expect(dialogBlock.outline).toBeDefined()
    expect(dialogBlock.children?.length).toBeGreaterThan(0)
  })

  test('synchronizes multiple text child parameters (label and value) in component instances', () => {
    const listRowComp: ShadrComponent = {
      params: {
        id: 'row',
        label: 'Ping',
        value: '15ms',
        width: 440,
        height: 52
      },
      blocks: [
        {
          type: 'block',
          id: paramPlaceholder('id'),
          size: { width: paramPlaceholder('width'), height: paramPlaceholder('height') },
          children: [
            {
              type: 'text',
              id: `${paramPlaceholder('id')}_label`,
              text: paramPlaceholder('label')
            },
            {
              type: 'text',
              id: `${paramPlaceholder('id')}_value`,
              text: paramPlaceholder('value')
            }
          ]
        }
      ]
    }
    componentRegistry.set('list_row', listRowComp)

    const page: ShadrPage = {
      name: 'test_multi_param',
      screen: { width: 1920, height: 1080 },
      blocks: [
        {
          type: 'component',
          id: 'ping_row',
          component: 'list_row',
          params: {
            id: 'ping_row',
            label: 'Задержка',
            value: '42ms'
          }
        }
      ]
    }

    const graph = shadrConverter.importPage(page)
    const pageNode = graph.getPages()[0]
    const screenFrame = graph.getChildren(pageNode.id)[0]
    const compNode = graph.getChildren(screenFrame.id)[0]

    expect(compNode.name).toBe('[list_row] ping_row')

    const textNodes = graph.getChildren(compNode.id).filter((c) => c.type === 'TEXT')
    expect(textNodes.length).toBe(2)

    const labelNode = textNodes.find((t) => t.name?.includes('label') || t.text === 'Задержка')
    expect(labelNode).toBeDefined()
    if (!labelNode) throw new Error('labelNode not found')
    expect(labelNode.text).toBe('Задержка')

    const valueNode = textNodes.find((t) => t.name?.includes('value') || t.text === '42ms')
    expect(valueNode).toBeDefined()
    if (!valueNode) throw new Error('valueNode not found')
    expect(valueNode.text).toBe('42ms')

    graph.updateNode(labelNode.id, { text: 'Пинг сервера' })
    graph.updateNode(valueNode.id, { text: '12ms' })

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: { currentPageId: pageNode.id }
    })
    const exported = shadrConverter.exportPage(mockEditor, 'test_multi_param')
    const exportedComp = exported.blocks.find((b) => b.id === 'ping_row')
    expect(exportedComp).toBeDefined()
    if (!exportedComp) throw new Error('exportedComp not found')
    expect(exportedComp.type).toBe('component')
    expect(exportedComp.params?.label).toBe('Пинг сервера')
    expect(exportedComp.params?.value).toBe('12ms')
  })

  test('exports component instances as type: "component" and auto-adopts loose nodes into scene', () => {
    const badgeRaw = readFileSync(
      resolve(process.cwd(), 'docs/shadr/components/badge.json'),
      'utf-8'
    )
    const badgeComp = JSON.parse(badgeRaw)

    const graph = new SceneGraph()
    shadrConverter.importComponentsIntoGraph(graph, { badge: badgeComp })

    // Create a page with scene frame
    const pageNode = graph.getPages()[0]
    const rootFrame = graph.createNode('FRAME', pageNode.id, {
      name: 'hud',
      x: 0,
      y: 0,
      width: 1920,
      height: 1080
    })

    const compPage = graph.getPages().find((p) => p.name === '_components')
    expect(compPage).toBeDefined()
    const badgeDef = compPage
      ? graph.getChildren(compPage.id).find((n) => n.name === 'badge')
      : undefined
    expect(badgeDef).toBeDefined()

    // 1. Instance directly inside rootFrame
    const insideInstance = badgeDef
      ? graph.createInstance(badgeDef.id, rootFrame.id, { x: 50, y: 60 })
      : null
    expect(insideInstance).toBeDefined()

    // 2. Loose instance on the page canvas (not inside rootFrame yet)
    const looseInstance = badgeDef
      ? graph.createInstance(badgeDef.id, pageNode.id, { x: 200, y: 300 })
      : null
    expect(looseInstance).toBeDefined()

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: {
        currentPageId: pageNode.id
      }
    })

    const exported = shadrConverter.exportPage(mockEditor, 'hud')
    expect(exported.name).toBe('hud')
    // Both inside and loose instances must be exported into scene blocks as type: 'component'
    const componentBlocks = exported.blocks.filter((b) => b.type === 'component')
    expect(componentBlocks.length).toBe(2)
    expect(componentBlocks[0].component).toBe('badge')
    expect(componentBlocks[1].component).toBe('badge')

    // Loose node must have been reparented into rootFrame
    expect(graph.getChildren(rootFrame.id).map((c) => c.id)).toContain(looseInstance?.id ?? '')
  })
})
