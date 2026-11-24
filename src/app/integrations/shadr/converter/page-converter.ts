import { createDocumentGraph } from '@open-pencil/core'
import { computeAllLayouts } from '@open-pencil/core/layout'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { EditorStore } from '@/app/editor/active-store'

import { getShadrData, SHADR_DATA_KEY, SHADR_PLUGIN_ID } from '../data'
import type {
  ShadrComponent,
  ShadrElement,
  ShadrNodeData,
  ShadrPage,
  ShadrParamValue,
  ShadrScreen,
  ShadrScrollRegion
} from '../types'
import { setCanvasPageBackground } from './color'
import { exportComponent, importComponentsIntoGraph } from './component-converter'
import { elementToNode } from './element-to-node'
import { parseCoordinate } from './math'
import { nodeToElement } from './node-to-element'
import { componentRegistry, interpolateElement } from './template'

export interface ShadrLoopBlock {
  loop: number
  blocks: ShadrElement[]
}

/** Recursively expands Shadr loop: N constructs into concrete elements */
export function expandBlocks(blocks: Array<ShadrElement | ShadrLoopBlock>): ShadrElement[] {
  const result: ShadrElement[] = []
  for (const item of blocks) {
    if (!item) continue
    if ('loop' in item && typeof item.loop === 'number' && Array.isArray(item.blocks)) {
      const loopCount = Math.max(0, Math.min(item.loop, 100))
      for (let i = 0; i < loopCount; i++) {
        const loopParams: Record<string, ShadrParamValue> = {
          loopIndex: i,
          loopNumber: i + 1
        }
        for (const tmpl of item.blocks) {
          const expanded = interpolateElement(tmpl, loopParams)
          if (expanded.children?.length) {
            expanded.children = expandBlocks(expanded.children)
          }
          result.push(expanded)
        }
      }
    } else {
      const elem = item as ShadrElement
      if (elem.children?.length) {
        elem.children = expandBlocks(elem.children)
      }
      result.push(elem)
    }
  }
  return result
}

function resolveExportScreen(
  rootFrame: SceneNode | undefined,
  savedScreen?: ShadrScreen
): ShadrScreen {
  return {
    ...savedScreen,
    width: rootFrame ? Math.round(rootFrame.width) : (savedScreen?.width ?? 1920),
    height: rootFrame ? Math.round(rootFrame.height) : (savedScreen?.height ?? 1080),
    cursorSize: savedScreen?.cursorSize ?? 10,
    cursorSpeed: savedScreen?.cursorSpeed ?? 2.0,
    cursorLayer: savedScreen?.cursorLayer ?? 9700
  }
}

function reparentLooseNodes(
  graph: SceneGraph,
  rootFrame: SceneNode,
  topNodes: SceneNode[]
): SceneNode[] {
  const looseNodes = topNodes.filter((n) => {
    if (n.id === rootFrame.id || !n.visible || n.type === 'CANVAS') return false
    if (n.type === 'FRAME') {
      const data = getShadrData(n, graph)
      if (data.screen !== undefined || n.width >= 400) return false
    }
    return true
  })
  for (const loose of looseNodes) {
    const abs = graph.getAbsolutePosition(loose.id)
    graph.reparentNode(loose.id, rootFrame.id)
    graph.updateNode(loose.id, {
      x: Math.round(abs.x - rootFrame.x),
      y: Math.round(abs.y - rootFrame.y)
    })
  }
  return graph.getChildren(rootFrame.id)
}

function findExportTargetPage(editor: EditorStore, pageName?: string): SceneNode | undefined {
  const pageNodes = editor.graph.getPages().filter((p) => p.name !== '_components')
  if (pageName) {
    const directMatch = pageNodes.find((p) => p.name === pageName || p.id === pageName)
    if (directMatch) return directMatch

    const pageWithFrame = pageNodes.find((p) => {
      const topNodes = editor.graph.getChildren(p.id)
      return topNodes.some((n) => {
        if (n.type !== 'FRAME') return false
        const data = getShadrData(n, editor.graph)
        return (
          n.name === pageName || data.blockId === pageName || data.blockId === `screen_${pageName}`
        )
      })
    })
    if (pageWithFrame) return pageWithFrame
  }
  return pageNodes.find((p) => p.id === editor.state.currentPageId) ?? pageNodes[0]
}

function findExportRootFrame(
  topNodes: readonly SceneNode[],
  targetPage: SceneNode | undefined,
  graph: SceneGraph,
  targetName?: string
): SceneNode | undefined {
  if (targetName) {
    const matched = topNodes.find((n: SceneNode) => {
      if (n.type !== 'FRAME') return false
      const data = getShadrData(n, graph)
      return (
        n.name === targetName ||
        data.blockId === targetName ||
        data.blockId === `screen_${targetName}`
      )
    })
    if (matched) return matched
  }

  if (targetPage?.name) {
    const matched = topNodes.find((n: SceneNode) => {
      if (n.type !== 'FRAME') return false
      const data = getShadrData(n, graph)
      return (
        n.name === targetPage.name ||
        data.blockId === targetPage.name ||
        data.blockId === `screen_${targetPage.name}`
      )
    })
    if (matched) return matched
  }

  return (
    topNodes.find((n: SceneNode) => {
      if (n.type !== 'FRAME') return false
      const data = getShadrData(n, graph)
      return data.screen !== undefined
    }) ?? topNodes.find((n: SceneNode) => n.type === 'FRAME' && n.width >= 400)
  )
}

function exportScrollRegionNode(
  n: SceneNode,
  data: ShadrNodeData,
  graph: SceneGraph,
  startIndex: number
): { region: ShadrScrollRegion; blocks: ShadrElement[] } {
  const regionId = data.scrollRegionId || n.name.replace(/^scroll_/, '')
  const region: ShadrScrollRegion = {
    id: regionId,
    x: Math.round(n.x),
    y: Math.round(n.y),
    width: Math.round(n.width),
    height: Math.round(n.height)
  }
  if (data.contentHeight !== undefined) {
    region.contentHeight = data.contentHeight
  }
  if (data.step !== undefined) {
    region.step = data.step
  }

  const blocks: ShadrElement[] = []
  const children = graph.getChildren(n.id)
  let idx = startIndex
  for (const child of children) {
    const childElem = nodeToElement(child, graph, idx++)
    childElem.scrollRegion = regionId
    childElem.position = {
      x: Math.round(n.x + child.x),
      y: Math.round(n.y + child.y)
    }
    blocks.push(childElem)
  }
  return { region, blocks }
}

function collectExportBlocks(
  sourceNodes: readonly SceneNode[],
  graph: SceneGraph
): { blocks: ShadrElement[]; scrollRegions: ShadrScrollRegion[] } {
  const blocks: ShadrElement[] = []
  const scrollRegions: ShadrScrollRegion[] = []
  let blockIndex = 0
  for (const n of sourceNodes) {
    const data = getShadrData(n, graph)
    if (data.isScrollRegion) {
      const { region, blocks: regionBlocks } = exportScrollRegionNode(n, data, graph, blockIndex)
      scrollRegions.push(region)
      blocks.push(...regionBlocks)
      blockIndex += regionBlocks.length
    } else {
      blocks.push(nodeToElement(n, graph, blockIndex++))
    }
  }
  return { blocks, scrollRegions }
}

function resolveExportPageName(
  pageName: string | undefined,
  rootFrame: SceneNode | undefined,
  targetPage: SceneNode | undefined
): string {
  const targetPageName =
    targetPage && !/^Page \d+$/i.test(targetPage.name) ? targetPage.name : undefined
  const rawName = pageName || rootFrame?.name || targetPageName || 'main_menu'
  return rawName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')
}

/** Converts OpenPencil Canvas scene into Shadr Page JSON */
export function exportPage(editor: EditorStore, pageName?: string): ShadrPage {
  const graph = editor.graph
  const targetPage = findExportTargetPage(editor, pageName)
  const targetPageId = targetPage?.id ?? editor.state.currentPageId ?? graph.getPages()[0]?.id
  const topNodes = targetPageId ? graph.getChildren(targetPageId) : []

  const rootFrame = findExportRootFrame(topNodes, targetPage, graph, pageName)
  const pageData = rootFrame ? getShadrData(rootFrame, graph) : {}
  const screen = resolveExportScreen(rootFrame, pageData.screen)

  const sourceNodes = rootFrame ? reparentLooseNodes(graph, rootFrame, topNodes) : topNodes
  const { blocks, scrollRegions } = collectExportBlocks(sourceNodes, graph)

  const result: ShadrPage = {
    name: resolveExportPageName(pageName, rootFrame, targetPage),
    screen,
    blocks
  }
  if (Array.isArray(pageData.animations)) {
    result.animations = pageData.animations
  }
  if (scrollRegions.length > 0) {
    result.scrollRegions = scrollRegions
  } else if (Array.isArray(pageData.scrollRegions)) {
    result.scrollRegions = pageData.scrollRegions
  }

  return result
}

/** Converts multiple Shadr Pages and Components into a full Project SceneGraph */
export function importProject(
  pages: ShadrPage[],
  components: Record<string, ShadrComponent> = {},
  theme: 'dark' | 'light' = 'dark'
): SceneGraph {
  const graph = createDocumentGraph('design', theme)
  const pageNodes = graph.getPages()

  for (const [name, comp] of Object.entries(components)) {
    componentRegistry.set(name, comp)
  }

  pages.forEach((page, index) => {
    let pageNode = index === 0 ? pageNodes[0] : null
    if (pageNode) {
      graph.updateNode(pageNode.id, { name: page.name })
      setCanvasPageBackground(pageNode, theme)
    } else {
      pageNode = graph.createNode('CANVAS', graph.rootId, {
        name: page.name,
        width: 0,
        height: 0
      })
      setCanvasPageBackground(pageNode, theme)
    }

    const rootData: ShadrNodeData = {
      blockId: page.name,
      screen: page.screen,
      animations: page.animations,
      scrollRegions: page.scrollRegions
    }

    const rootFrame = graph.createNode('FRAME', pageNode.id, {
      name: page.name,
      x: 0,
      y: 0,
      width: page.screen?.width || 1920,
      height: page.screen?.height || 1080,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0.05, g: 0.05, b: 0.08, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      pluginData: [
        {
          pluginId: SHADR_PLUGIN_ID,
          key: SHADR_DATA_KEY,
          value: JSON.stringify(rootData)
        }
      ]
    })

    const scrollFrameMap = new Map<string, SceneNode>()
    if (page.scrollRegions && Array.isArray(page.scrollRegions)) {
      for (const region of page.scrollRegions) {
        const rx = parseCoordinate(region.x, 0)
        const ry = parseCoordinate(region.y, 0)
        const rw = parseCoordinate(region.width, 100)
        const rh = parseCoordinate(region.height, 100)
        const sFrame = graph.createNode('FRAME', rootFrame.id, {
          name: `scroll_${region.id}`,
          x: rx,
          y: ry,
          width: rw,
          height: rh,
          clipsContent: true,
          pluginData: [
            {
              pluginId: SHADR_PLUGIN_ID,
              key: SHADR_DATA_KEY,
              value: JSON.stringify({
                blockId: region.id,
                isScrollRegion: true,
                scrollRegionId: region.id,
                contentHeight: region.contentHeight,
                step: region.step
              })
            }
          ]
        })
        scrollFrameMap.set(region.id, sFrame)
      }
    }

    if (page.blocks && Array.isArray(page.blocks)) {
      const expandedBlocks = expandBlocks(page.blocks as Array<ShadrElement | ShadrLoopBlock>)
      let currentMaxLayer = 0
      const blocksWithLayers = expandedBlocks.map((b) => {
        let effLayer: number
        if (b.type === 'blur') {
          effLayer = b.layer !== undefined ? b.layer : -5000
        } else if (b.layer !== undefined) {
          effLayer = b.layer
          currentMaxLayer = Math.max(currentMaxLayer, b.layer)
        } else {
          effLayer = currentMaxLayer
        }
        return { block: b, effLayer }
      })
      blocksWithLayers.sort((a, b) => a.effLayer - b.effLayer)

      for (const { block } of blocksWithLayers) {
        const sFrame = block.scrollRegion ? scrollFrameMap.get(block.scrollRegion) : undefined
        if (sFrame) {
          const rx = sFrame.x
          const ry = sFrame.y
          const origX = parseCoordinate(block.position?.x, 0)
          const origY = parseCoordinate(block.position?.y, 0)
          const relBlock: ShadrElement = {
            ...block,
            position: {
              x: origX - rx,
              y: origY - ry
            }
          }
          elementToNode(relBlock, sFrame.id, graph, sFrame.width)
        } else {
          elementToNode(block, rootFrame.id, graph, rootFrame.width)
        }
      }
    }
  })

  importComponentsIntoGraph(graph, components)
  computeAllLayouts(graph)

  return graph
}

/** Converts a single Shadr Page JSON into an OpenPencil SceneGraph */
export function importPage(page: ShadrPage, theme: 'dark' | 'light' = 'dark'): SceneGraph {
  return importProject([page], {}, theme)
}

/** Lists all scene names available in the current editor project */
export function listProjectSceneNames(editor: EditorStore): string[] {
  const graph = editor.graph
  const pageNodes = graph.getPages().filter((p) => p.name !== '_components')
  const sceneNames: string[] = []

  for (const pageNode of pageNodes) {
    const topNodes = graph.getChildren(pageNode.id)
    const screenFrames = topNodes.filter((n) => {
      if (n.type !== 'FRAME') return false
      const data = getShadrData(n, graph)
      return (
        data.screen !== undefined ||
        n.name === pageNode.name ||
        data.blockId === `screen_${pageNode.name}` ||
        n.width >= 400
      )
    })

    if (screenFrames.length > 1) {
      for (const frame of screenFrames) {
        if (!sceneNames.includes(frame.name)) {
          sceneNames.push(frame.name)
        }
      }
    } else if (screenFrames.length === 1) {
      const name = screenFrames[0].name || pageNode.name
      if (!sceneNames.includes(name)) {
        sceneNames.push(name)
      }
    } else {
      if (!sceneNames.includes(pageNode.name)) {
        sceneNames.push(pageNode.name)
      }
    }
  }

  return sceneNames
}

/** Exports the full project (all pages and components) from the editor */
export function exportProject(editor: EditorStore): {
  pages: ShadrPage[]
  components: Record<string, ShadrComponent>
} {
  const graph = editor.graph
  const sceneNames = listProjectSceneNames(editor)
  const pages: ShadrPage[] = sceneNames.map((name) => exportPage(editor, name))
  const components: Record<string, ShadrComponent> = {}

  const compPage = graph.getPages().find((p) => p.name === '_components')
  if (compPage) {
    const compNodes = graph.getChildren(compPage.id)
    for (const compNode of compNodes) {
      components[compNode.name] = exportComponent(editor, compNode.name)
    }
  }

  return { pages, components }
}
