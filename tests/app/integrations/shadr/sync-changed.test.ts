import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { asDouble } from '@open-pencil/test-support/doubles'

import type { EditorStore } from '@/app/editor/active-store'
import { shadrConverter } from '@/app/integrations/shadr/converter'
import { getShadrData, setShadrData } from '@/app/integrations/shadr/data'
import type { ShadrComponent, ShadrPage } from '@/app/integrations/shadr/types'
import { pageService } from '@/components/event-builder/services/config.service'
import {
  clearBaselines,
  getChangedScenes,
  pushChangedScenes,
  pushCurrentPage,
  recordSceneBaseline,
  syncActiveSceneWithEditor
} from '@/components/event-builder/services/sync.service'

describe('Shadr Changed Scenes Push Sync', () => {
  beforeEach(() => {
    clearBaselines()
  })

  test('detects modified scene when node properties change', async () => {
    const demoRaw = readFileSync(resolve(process.cwd(), 'docs/shadr/pages/demo.json'), 'utf-8')
    const menuRaw = readFileSync(resolve(process.cwd(), 'docs/shadr/pages/main_menu.json'), 'utf-8')

    const demoPage: ShadrPage = JSON.parse(demoRaw)
    const menuPage: ShadrPage = JSON.parse(menuRaw)

    const graph = shadrConverter.importProject([menuPage, demoPage])
    const docPages = graph.getPages()

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: {
        currentPageId: docPages[1].id // demo page
      }
    })

    // Record initial baseline right after import
    for (const name of shadrConverter.listProjectSceneNames(mockEditor)) {
      recordSceneBaseline(name, shadrConverter.exportPage(mockEditor, name))
    }

    // Initially, no scenes are changed
    let changed = await getChangedScenes(mockEditor)
    expect(changed.length).toBe(0)

    // Now modify the demo page: move a child in demo
    const demoScreenFrame = graph.getChildren(docPages[1].id)[0]
    const demoChildren = graph.getChildren(demoScreenFrame.id)
    graph.updateNode(demoChildren[0].id, { x: demoChildren[0].x + 50 })

    // Now only demo should be detected as changed
    changed = await getChangedScenes(mockEditor)
    expect(changed.length).toBe(1)
    expect(changed[0].name).toBe('demo')

    // Also modify main_menu
    const menuScreenFrame = graph.getChildren(docPages[0].id)[0]
    const menuChildren = graph.getChildren(menuScreenFrame.id)
    graph.updateNode(menuChildren[0].id, { y: menuChildren[0].y + 20 })

    // Now both should be detected as changed
    changed = await getChangedScenes(mockEditor)
    expect(changed.length).toBe(2)
    const names = changed.map((p) => p.name)
    expect(names).toContain('demo')
    expect(names).toContain('main_menu')
  })

  test('pushChangedScenes saves only modified scenes and updates baselines', async () => {
    const demoRaw = readFileSync(resolve(process.cwd(), 'docs/shadr/pages/demo.json'), 'utf-8')
    const menuRaw = readFileSync(resolve(process.cwd(), 'docs/shadr/pages/main_menu.json'), 'utf-8')

    const demoPage: ShadrPage = JSON.parse(demoRaw)
    const menuPage: ShadrPage = JSON.parse(menuRaw)

    const graph = shadrConverter.importProject([menuPage, demoPage])
    const docPages = graph.getPages()

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: {
        currentPageId: docPages[1].id // on demo
      }
    })

    // Establish baselines
    for (const name of shadrConverter.listProjectSceneNames(mockEditor)) {
      recordSceneBaseline(name, shadrConverter.exportPage(mockEditor, name))
    }

    // Mutate only demo
    const demoScreenFrame = graph.getChildren(docPages[1].id)[0]
    const demoChildren = graph.getChildren(demoScreenFrame.id)
    graph.updateNode(demoChildren[0].id, { x: 777 })

    const savedPages: string[] = []
    const originalSave = pageService.save
    pageService.save = mock(async (id: string) => {
      savedPages.push(id)
    })

    try {
      const ok = await pushChangedScenes(mockEditor)
      expect(ok).toBe(true)
      expect(savedPages).toEqual(['demo'])

      // After push, baselines are updated -> subsequent check reports 0 changes
      const changedAfter = await getChangedScenes(mockEditor)
      expect(changedAfter.length).toBe(0)
    } finally {
      pageService.save = originalSave
    }
  })

  test('syncActiveSceneWithEditor correctly resolves current canvas page name', () => {
    const graph = shadrConverter.importProject([
      { name: 'main_menu', blocks: [] },
      { name: 'demo', blocks: [] }
    ])
    const docPages = graph.getPages()

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: {
        currentPageId: docPages[1].id
      }
    })

    const activeName = syncActiveSceneWithEditor(mockEditor)
    expect(activeName).toBe('demo')
  })

  test('pushCurrentPage exports the active page instead of stale default', async () => {
    const graph = shadrConverter.importProject([
      { name: 'main_menu', blocks: [{ type: 'text', id: 'mm', text: 'MM' }] },
      { name: 'demo', blocks: [{ type: 'text', id: 'dm', text: 'DM' }] }
    ])
    const docPages = graph.getPages()

    // Active page is demo
    const mockEditor = asDouble<EditorStore>({
      graph,
      state: {
        currentPageId: docPages[1].id
      }
    })

    const saved: string[] = []
    const originalSave = pageService.save
    pageService.save = mock(async (id: string) => {
      saved.push(id)
    })

    try {
      const ok = await pushCurrentPage(mockEditor)
      expect(ok).toBe(true)
      expect(saved).toEqual(['demo'])
    } finally {
      pageService.save = originalSave
    }
  })

  test('detaches component with custom close action so Shadr executes it', () => {
    const compsDir = resolve(process.cwd(), 'docs/shadr/components')
    const comps: Record<string, ShadrComponent> = {}
    for (const f of readdirSync(compsDir).filter((x) => x.endsWith('.json'))) {
      comps[f.replace('.json', '')] = JSON.parse(readFileSync(resolve(compsDir, f), 'utf-8'))
    }
    const shopPage: ShadrPage = JSON.parse(
      readFileSync(resolve(process.cwd(), 'docs/shadr/pages/shop.json'), 'utf-8')
    )

    const graph = shadrConverter.importProject([shopPage], comps)
    const docPages = graph.getPages()
    const mockEditor = asDouble<EditorStore>({
      graph,
      state: { currentPageId: docPages[0].id },
      updateNodeWithUndo(id, patch) {
        graph.updateNode(id, patch)
      }
    })

    recordSceneBaseline('shop', shadrConverter.exportPage(mockEditor, 'shop'))

    const closeNode = Array.from(graph.nodes.values()).find(
      (n) => getShadrData(n, graph).blockId === 'shop_close'
    )
    expect(closeNode).toBeDefined()
    if (!closeNode) return

    setShadrData(mockEditor, [closeNode], {
      onClickAction: ['sound: shadr.close', 'close:']
    })

    const changed = getChangedScenes(mockEditor)
    expect(changed.length).toBe(1)

    const actionsGrid = changed[0].blocks.find((b) => b.id === 'shop_actions')
    expect(actionsGrid?.type).toBe('grid_block')
    const buyBlock = actionsGrid?.children?.find((c) => c.id === 'shop_buy')
    const closeBlock = actionsGrid?.children?.find((c) => c.id === 'shop_close')

    // Untouched button stays a component; customized close button detaches to concrete block_rounded
    expect(buyBlock?.type).toBe('component')
    expect(closeBlock?.type).toBe('block_rounded')
    expect(closeBlock?.onClickAction).toEqual(['sound: shadr.close', 'close:'])
    expect(closeBlock?.children?.some((c) => c.type === 'text' && c.text === 'Close')).toBe(true)
  })

  test('detects text edit on TEXT-root component and moved buttons inside grid_block', () => {
    const compsDir = resolve(process.cwd(), 'docs/shadr/components')
    const comps: Record<string, ShadrComponent> = {}
    for (const f of readdirSync(compsDir).filter((x) => x.endsWith('.json'))) {
      comps[f.replace('.json', '')] = JSON.parse(readFileSync(resolve(compsDir, f), 'utf-8'))
    }
    const shopPage: ShadrPage = JSON.parse(
      readFileSync(resolve(process.cwd(), 'docs/shadr/pages/shop.json'), 'utf-8')
    )

    const graph = shadrConverter.importProject([shopPage], comps)
    const docPages = graph.getPages()
    const mockEditor = asDouble<EditorStore>({
      graph,
      state: { currentPageId: docPages[0].id }
    })

    recordSceneBaseline('shop', shadrConverter.exportPage(mockEditor, 'shop'))

    // 1. Edit text of TEXT-root component (section_header)
    const headerNode = Array.from(graph.nodes.values()).find(
      (n) => getShadrData(n, graph).blockId === 'balance_header'
    )
    expect(headerNode).toBeDefined()
    if (!headerNode) return
    graph.updateNode(headerNode.id, { text: 'WALLET' })

    let changed = getChangedScenes(mockEditor)
    expect(changed.length).toBe(1)
    const exportedHeader = changed[0].blocks.find((b) => b.id === 'balance_header')
    expect(exportedHeader?.params?.label).toBe('WALLET')

    recordSceneBaseline('shop', changed[0])
    expect(getChangedScenes(mockEditor).length).toBe(0)

    // 2. Move button inside grid_block (shop_actions)
    const closeNode = Array.from(graph.nodes.values()).find(
      (n) => getShadrData(n, graph).blockId === 'shop_close'
    )
    expect(closeNode).toBeDefined()
    if (!closeNode) return
    graph.updateNode(closeNode.id, { x: closeNode.x + 60, y: closeNode.y + 40 })

    changed = getChangedScenes(mockEditor)
    expect(changed.length).toBe(1)
    const exportedActions = changed[0].blocks.find((b) => b.id === 'shop_actions')
    expect(exportedActions?.type).toBe('block')
    expect(exportedActions?.opacity).toBe(0)
    const exportedClose = exportedActions?.children?.find((c) => c.id === 'shop_close')
    expect(exportedClose?.position).toEqual({
      x: Math.round(closeNode.x),
      y: Math.round(closeNode.y)
    })
  })

  test('commits active text edit before pushing changed scenes', async () => {
    const graph = shadrConverter.importProject([
      { name: 'shop', blocks: [{ type: 'text', id: 'title', text: 'Old' }] }
    ])
    const docPages = graph.getPages()
    const rootFrame = graph.getChildren(docPages[0].id)[0]
    const titleNode = graph.getChildren(rootFrame.id)[0]

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: {
        currentPageId: docPages[0].id,
        editingTextId: titleNode.id
      },
      commitTextEdit: mock(() => {
        graph.updateNode(titleNode.id, { text: 'New' })
        mockEditor.state.editingTextId = null
      })
    })

    recordSceneBaseline('shop', shadrConverter.exportPage(mockEditor, 'shop'))

    let savedPage: ShadrPage | undefined
    const originalSave = pageService.save
    pageService.save = mock(async (_id: string, page: ShadrPage) => {
      savedPage = page
    })

    try {
      const ok = await pushChangedScenes(mockEditor)
      expect(ok).toBe(true)
      expect(mockEditor.commitTextEdit).toHaveBeenCalledTimes(1)
      expect(savedPage?.blocks[0]?.text).toBe('New')
    } finally {
      pageService.save = originalSave
    }
  })

  test('lists and pushes multiple screens placed on the same page (test_main + welcome)', async () => {
    const graph = shadrConverter.importProject([{ name: 'test_main', blocks: [] }])
    const pageNode = graph.getPages()[0]
    graph.createNode('FRAME', pageNode.id, {
      name: 'welcome',
      x: 2040,
      y: 0,
      width: 1920,
      height: 1080
    })

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: { currentPageId: pageNode.id }
    })

    const sceneNames = shadrConverter.listProjectSceneNames(mockEditor)
    expect(sceneNames).toContain('test_main')
    expect(sceneNames).toContain('welcome')

    const changed = getChangedScenes(mockEditor)
    expect(changed.map((p) => p.name)).toEqual(['test_main', 'welcome'])
  })

  test('does not mark image scenes as changed after texture preload replaces placeholder fill', () => {
    const imageEndPage: ShadrPage = JSON.parse(
      readFileSync(resolve(process.cwd(), 'docs/shadr/pages/image_end.json'), 'utf-8')
    )
    const graph = shadrConverter.importProject([imageEndPage])
    const pageNode = graph.getPages()[0]
    const mockEditor = asDouble<EditorStore>({
      graph,
      state: { currentPageId: pageNode.id }
    })

    // Record baseline right after import (while image node still has placeholder SOLID fill)
    recordSceneBaseline('image_end', shadrConverter.exportPage(mockEditor, 'image_end'))

    // Simulate preloadGraphTextures replacing the SOLID placeholder with an IMAGE fill
    const imgNode = Array.from(graph.nodes.values()).find(
      (n) => getShadrData(n, graph).textureName === 'gallery_end'
    )
    expect(imgNode).toBeDefined()
    if (!imgNode) return
    graph.updateNode(imgNode.id, {
      fills: [
        {
          type: 'IMAGE',
          imageHash: 'abc123',
          imageScaleMode: 'FIT',
          opacity: 1,
          visible: true,
          color: { r: 1, g: 1, b: 1, a: 1 }
        }
      ]
    })

    // Scene must still match baseline (not falsely flagged as modified)
    expect(getChangedScenes(mockEditor).length).toBe(0)
  })
})
