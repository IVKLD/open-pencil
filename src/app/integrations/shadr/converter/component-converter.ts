import { createDocumentGraph } from '@open-pencil/core'
import type { Fill, SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { EditorStore } from '@/app/editor/active-store'

import { SHADR_DATA_KEY, SHADR_PLUGIN_ID, getShadrData } from '../data'
import type {
  ShadrComponent,
  ShadrElement,
  ShadrElementType,
  ShadrNodeData,
  ShadrParamValue
} from '../types'
import { colorToShadrHex, setCanvasPageBackground } from './color'
import {
  elementToNode,
  resolveElementFills,
  resolveElementRounding,
  resolveElementStrokes
} from './element-to-node'
import { parseCoordinate } from './math'
import { nodeToElement } from './node-to-element'
import { paramPlaceholder } from './placeholder'
import { componentRegistry, interpolateElement } from './template'

interface ComponentVisuals {
  fills: Fill[]
  strokes?: Stroke[]
  strokeWeight?: number
  cornerRadius?: number
}

function resolveComponentVisuals(singleRootBlock: ShadrElement | null): ComponentVisuals {
  if (!singleRootBlock) return { fills: [] }
  if (singleRootBlock.type !== 'block' && singleRootBlock.type !== 'block_rounded') {
    return { fills: [] }
  }
  const fills = resolveElementFills(singleRootBlock) ?? []
  const { strokes, strokeWeight } = resolveElementStrokes(singleRootBlock)
  const cornerRadius = resolveElementRounding(singleRootBlock)
  return { fills, strokes, strokeWeight, cornerRadius }
}

function populateComponentChildren(
  compFrameId: string,
  singleRootBlock: ShadrElement | null,
  meaningfulBlocks: ShadrElement[],
  params: Record<string, ShadrParamValue>,
  graph: SceneGraph,
  width: number
): void {
  if (singleRootBlock) {
    const isContainer = singleRootBlock.type === 'block' || singleRootBlock.type === 'block_rounded'
    if (isContainer) {
      if (singleRootBlock.children && singleRootBlock.children.length > 0) {
        for (const child of singleRootBlock.children) {
          elementToNode(child, compFrameId, graph, width)
        }
      }
    } else {
      elementToNode(singleRootBlock, compFrameId, graph, width)
    }
    return
  }

  if (meaningfulBlocks.length === 0) return

  let minX = Infinity
  let minY = Infinity
  for (const block of meaningfulBlocks) {
    const concrete = interpolateElement(block, params)
    const bx = parseCoordinate(concrete.position?.x, 0)
    const by = parseCoordinate(concrete.position?.y, 0)
    if (bx < minX) minX = bx
    if (by < minY) minY = by
  }
  if (!Number.isFinite(minX)) minX = 0
  if (!Number.isFinite(minY)) minY = 0

  for (const block of meaningfulBlocks) {
    const concrete = interpolateElement(block, params)
    const origX = parseCoordinate(concrete.position?.x, 0)
    const origY = parseCoordinate(concrete.position?.y, 0)
    const normalized = {
      ...concrete,
      position: {
        x: Math.round(origX - minX),
        y: Math.round(origY - minY)
      }
    }
    elementToNode(normalized, compFrameId, graph, width)
  }
}

function resolveRawComponent(
  rawComp: ShadrComponent | { document?: ShadrComponent }
): ShadrComponent {
  if ('document' in rawComp && rawComp.document) {
    return rawComp.document
  }
  return rawComp as ShadrComponent
}

function createImportedComponentFrame(
  compName: string,
  rawComp: ShadrComponent | { document?: ShadrComponent },
  compPageId: string,
  graph: SceneGraph,
  position: Vector
): { width: number; height: number } {
  const comp = resolveRawComponent(rawComp)
  componentRegistry.set(compName, comp)

  const params: Record<string, ShadrParamValue> = { ...comp.params, id: compName }
  const width = Math.max(40, parseCoordinate(params.width as string | number | undefined, 180))
  const height = Math.max(10, parseCoordinate(params.height as string | number | undefined, 44))

  const auxiliaryBlocks: ShadrElement[] = []
  const meaningfulBlocks =
    comp.blocks && Array.isArray(comp.blocks)
      ? comp.blocks.filter((b) => {
          const isScrim =
            b.id?.includes('scrim') ||
            (parseCoordinate(b.size?.width, 0) >= 1920 &&
              parseCoordinate(b.size?.height, 0) >= 1080)
          if (isScrim && comp.blocks.length > 1) {
            auxiliaryBlocks.push(b)
            return false
          }
          return true
        })
      : []

  const rawSingleRootBlock = meaningfulBlocks.length === 1 ? meaningfulBlocks[0] : null
  const singleRootBlock = rawSingleRootBlock ? interpolateElement(rawSingleRootBlock, params) : null
  const isContainer = Boolean(
    singleRootBlock &&
    ((singleRootBlock.children && singleRootBlock.children.length > 0) ||
      singleRootBlock.type === 'block' ||
      singleRootBlock.type === 'block_rounded' ||
      singleRootBlock.type === 'progress')
  )
  let rootBlock: Partial<ShadrElement> | undefined
  if (isContainer && rawSingleRootBlock) {
    const { children: _children, ...rest } = rawSingleRootBlock
    rootBlock = rest
  }

  const visuals = resolveComponentVisuals(singleRootBlock)
  const compProps: Partial<SceneNode> = {
    name: compName,
    x: position.x,
    y: position.y,
    width,
    height,
    fills: visuals.fills,
    pluginData: [
      {
        pluginId: SHADR_PLUGIN_ID,
        key: SHADR_DATA_KEY,
        value: JSON.stringify({
          componentName: compName,
          componentParams: params,
          blockId: `component_${compName}`,
          rootBlock,
          auxiliaryBlocks: auxiliaryBlocks.length > 0 ? auxiliaryBlocks : undefined
        } satisfies ShadrNodeData)
      }
    ]
  }

  if (visuals.strokes) {
    compProps.strokes = visuals.strokes
    compProps.strokeWeight = visuals.strokeWeight
  }

  if (visuals.cornerRadius !== undefined) {
    compProps.cornerRadius = visuals.cornerRadius
  }

  const compFrame = graph.createNode('COMPONENT', compPageId, compProps)
  populateComponentChildren(compFrame.id, singleRootBlock, meaningfulBlocks, params, graph, width)

  return { width, height }
}

/** Imports components into a given SceneGraph under the _components page */
export function importComponentsIntoGraph(
  graph: SceneGraph,
  components: Record<string, ShadrComponent>
): void {
  const compEntries = Object.entries(components)
  if (compEntries.length === 0) return

  let compPage = graph.getPages().find((p) => p.name === '_components')
  if (compPage) {
    for (const child of graph.getChildren(compPage.id)) {
      graph.deleteNode(child.id)
    }
    setCanvasPageBackground(compPage, 'dark')
  } else {
    compPage = graph.createNode('CANVAS', graph.rootId, {
      name: '_components',
      width: 0,
      height: 0
    })
    setCanvasPageBackground(compPage, 'dark')
  }

  let offsetX = 100
  let offsetY = 100
  let rowHeight = 0

  for (const [compName, rawComp] of compEntries) {
    const { width, height } = createImportedComponentFrame(compName, rawComp, compPage.id, graph, {
      x: offsetX,
      y: offsetY
    })

    rowHeight = Math.max(rowHeight, height)
    offsetX += width + 60
    if (offsetX > 1600) {
      offsetX = 100
      offsetY += rowHeight + 80
      rowHeight = 0
    }
  }
}

/** Converts Shadr Component JSON into OpenPencil SceneGraph for editing */
export function importComponent(
  comp: ShadrComponent,
  compName: string,
  theme: 'dark' | 'light' = 'dark'
): SceneGraph {
  const graph = createDocumentGraph('design', theme)
  const pageNodes = graph.getPages()
  const pageNode =
    pageNodes[0] ??
    graph.createNode('CANVAS', graph.rootId, { name: compName, width: 0, height: 0 })
  setCanvasPageBackground(pageNode, theme)

  const width = parseCoordinate(comp.params?.width as string | number | undefined, 360)
  const height = parseCoordinate(comp.params?.height as string | number | undefined, 120)

  const rootFrame = graph.createNode('COMPONENT', pageNode.id, {
    name: compName,
    x: 0,
    y: 0,
    width: Math.max(200, width + 80),
    height: Math.max(120, height + 80),
    fills: [
      {
        type: 'SOLID',
        color: { r: 0.07, g: 0.07, b: 0.1, a: 1 },
        opacity: 1,
        visible: true
      }
    ],
    pluginData: [
      {
        pluginId: SHADR_PLUGIN_ID,
        key: SHADR_DATA_KEY,
        value: JSON.stringify({
          componentName: compName,
          componentParams: comp.params,
          blockId: `component_${compName}`
        } satisfies ShadrNodeData)
      }
    ]
  })

  if (comp.blocks && Array.isArray(comp.blocks)) {
    for (const block of comp.blocks) {
      elementToNode(block, rootFrame.id, graph)
    }
  }

  return graph
}

function findComponentRootFrame(
  searchNodes: readonly SceneNode[],
  graph: SceneGraph,
  componentName?: string
): SceneNode | undefined {
  if (componentName) {
    return (
      searchNodes.find((n) => n.name === componentName) ??
      graph.getNode(componentName) ??
      searchNodes.find((n: SceneNode) => n.type === 'FRAME' || n.type === 'COMPONENT')
    )
  }
  return searchNodes.find((n: SceneNode) => n.type === 'FRAME' || n.type === 'COMPONENT')
}

function applyExportRootVisuals(rootFrame: SceneNode, elem: ShadrElement): void {
  const primaryFill = (rootFrame.fills ?? []).find((f) => f.visible !== false)
  if (primaryFill?.color) {
    elem.color = colorToShadrHex(primaryFill.color)
    elem.opacity = Math.round((primaryFill.opacity ?? 1) * 255)
  }
  if (rootFrame.cornerRadius) {
    elem.rounding = { radius: Math.round(rootFrame.cornerRadius) }
  }
  if (rootFrame.strokes?.length) {
    const stroke = rootFrame.strokes.find((s) => s.visible !== false)
    if (stroke?.color) {
      elem.outline = {
        size: Math.round(rootFrame.strokeWeight || stroke.weight || 1),
        color: colorToShadrHex(stroke.color)
      }
    }
  }
}

function buildExportRootBlock(
  rootFrame: SceneNode,
  data: ShadrNodeData,
  childBlocks: ShadrElement[]
): ShadrElement {
  const rootBlock = data.rootBlock ?? {}
  const rootType =
    rootFrame.cornerRadius && rootFrame.cornerRadius > 0
      ? 'block_rounded'
      : rootBlock.type || 'block'

  const rootBlockElem: ShadrElement = {
    ...rootBlock,
    type: rootType as ShadrElementType,
    id: rootBlock.id || paramPlaceholder('id'),
    layer: rootBlock.layer ?? 10,
    position: rootBlock.position || { x: 0, y: 0 },
    size: rootBlock.size || {
      width: paramPlaceholder('width'),
      height: paramPlaceholder('height')
    },
    children: childBlocks
  }

  applyExportRootVisuals(rootFrame, rootBlockElem)

  return rootBlockElem
}

/** Converts edited Canvas scene back into Shadr Component JSON */
export function exportComponent(editor: EditorStore, componentName?: string): ShadrComponent {
  const graph = editor.graph
  const pageNodes = graph.getPages()
  const compPage = pageNodes.find((p) => p.name === '_components')
  const currentPageId = editor.state.currentPageId || pageNodes[0]?.id
  let searchNodes: SceneNode[] = []
  if (compPage) {
    searchNodes = graph.getChildren(compPage.id)
  } else if (currentPageId) {
    searchNodes = graph.getChildren(currentPageId)
  }

  const rootFrame = findComponentRootFrame(searchNodes, graph, componentName)
  const data = rootFrame ? getShadrData(rootFrame) : {}
  const sourceNodes = rootFrame ? graph.getChildren(rootFrame.id) : searchNodes
  const childBlocks: ShadrElement[] = sourceNodes.map((n: SceneNode, i: number) =>
    nodeToElement(n, graph, i)
  )

  const prefixBlocks = data.auxiliaryBlocks ?? []
  const blocks: ShadrElement[] =
    data.rootBlock && rootFrame
      ? [...prefixBlocks, buildExportRootBlock(rootFrame, data, childBlocks)]
      : [...prefixBlocks, ...childBlocks]

  let params: Record<string, ShadrParamValue> = {}
  if (data.componentParams) {
    params = { ...data.componentParams }
  }

  const name = componentName || rootFrame?.name?.replace(/^component_/, '') || 'component'
  if (!params.id) {
    params.id = name
  }

  return {
    params,
    blocks
  }
}
