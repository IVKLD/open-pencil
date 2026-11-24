import type { Fill, SceneNode } from '@open-pencil/scene-graph'
import { randomHex } from '@open-pencil/scene-graph/random'

import type { EditorStore } from '@/app/editor/active-store'
import { setCanvasPageBackground } from '@/app/integrations/shadr/converter/color'
import { setShadrData } from '@/app/integrations/shadr/data'
import {
  currentDocumentId,
  currentDocumentType,
  selectedPageId,
  serverPages
} from '@/app/integrations/shadr/store/state'
import { toast } from '@/app/shell/ui'

export type ShadrSceneTarget = 'newPage' | 'currentCanvas'

export interface CreateShadrSceneOptions {
  name?: string
  target?: ShadrSceneTarget
}

function solidFill(r: number, g: number, b: number, opacity = 1): Fill {
  return { type: 'SOLID', color: { r, g, b, a: 1 }, opacity, visible: true }
}

export const sceneCreatorService = {
  /**
   * Creates a 1920x1080 Shadr screen frame
   */
  async createScene(editor: EditorStore, options?: CreateShadrSceneOptions): Promise<SceneNode> {
    const graph = editor.graph
    const cleanName =
      options?.name
        ?.trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_') || `scene_${randomHex(2)}`
    const target = options?.target ?? 'currentCanvas'

    let parentId: string
    let frameX = 0
    const frameY = 0

    if (target === 'newPage') {
      const pageId = editor.addPage(cleanName)
      parentId = pageId
      selectedPageId.value = cleanName
      currentDocumentId.value = cleanName
      currentDocumentType.value = 'page'
      if (!serverPages.value.includes(cleanName)) {
        serverPages.value.push(cleanName)
      }
    } else {
      const pageNodes = graph.getPages()
      const currentPageId = editor.state.currentPageId || pageNodes[0]?.id
      parentId = currentPageId
      const currentPage = graph.getNode(currentPageId)
      if (currentPage && currentPage.source?.fig?.rawNodeFields?.backgroundColor === undefined) {
        setCanvasPageBackground(currentPage, editor.state.theme ?? 'dark')
        if (typeof editor.setPageColor === 'function') {
          editor.setPageColor({ r: 0x1e / 255, g: 0x1e / 255, b: 0x1e / 255, a: 1 })
        }
      }
      const topNodes = graph.getChildren(currentPageId)
      const maxX = topNodes.reduce((max, n) => Math.max(max, n.x + (n.width || 0)), 0)
      frameX = maxX > 0 ? maxX + 120 : 0
    }

    const rootFrame = graph.createNode('FRAME', parentId, {
      name: cleanName,
      x: frameX,
      y: frameY,
      width: 1920,
      height: 1080,
      fills: [solidFill(0.05, 0.05, 0.08)]
    })

    setShadrData(editor, [rootFrame], {
      blockId: `screen_${cleanName}`,
      screen: {
        width: 1920,
        height: 1080
      }
    })

    editor.select([rootFrame.id])
    editor.zoomToSelection()
    editor.state.sceneVersion++
    editor.requestRender()

    toast.info(`Экран Shadr 1920×1080 "${cleanName}" создан!`)
    return rootFrame
  }
}
