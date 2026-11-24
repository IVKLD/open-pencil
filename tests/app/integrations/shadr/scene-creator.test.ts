import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { asDouble } from '@open-pencil/test-support/doubles'

import type { EditorStore } from '@/app/editor/active-store'
import { sceneCreatorService } from '@/components/event-builder/services/scene-creator.service'

function createMockEditor(): EditorStore {
  const graph = new SceneGraph()
  const page = graph.createNode('CANVAS', graph.rootId, { name: 'Page 1', width: 0, height: 0 })
  const state = {
    currentPageId: page.id,
    sceneVersion: 0
  }
  return asDouble<EditorStore>({
    graph,
    state,
    addPage: (name?: string) => {
      const p = graph.addPage(name ?? 'Page')
      state.currentPageId = p.id
      return p.id
    },
    switchPage: async (pageId: string) => {
      state.currentPageId = pageId
    },
    updateNodeWithUndo: (id: string, patch: Partial<SceneNode>) => {
      graph.updateNode(id, patch)
    },
    select: () => undefined,
    zoomToSelection: () => undefined,
    requestRender: () => undefined
  })
}

describe('Shadr Scene Creator (1920x1080 UX)', () => {
  test('creates 1920x1080 screen frame on new page', async () => {
    const editor = createMockEditor()
    const frame = await sceneCreatorService.createScene(editor, {
      name: 'shop_menu',
      target: 'newPage'
    })

    expect(frame.width).toBe(1920)
    expect(frame.height).toBe(1080)
    expect(frame.name).toBe('shop_menu')

    const page = editor.graph.getNode(editor.state.currentPageId)
    expect(page?.name).toBe('shop_menu')
  })

  test('creates screen on current canvas with offset', async () => {
    const editor = createMockEditor()
    const frame1 = await sceneCreatorService.createScene(editor, {
      name: 'screen_1',
      target: 'currentCanvas'
    })
    const frame2 = await sceneCreatorService.createScene(editor, {
      name: 'screen_2',
      target: 'currentCanvas'
    })

    expect(frame1.x).toBe(0)
    expect(frame2.x).toBe(1920 + 120)
    expect(frame2.width).toBe(1920)
    expect(frame2.height).toBe(1080)
  })
})
