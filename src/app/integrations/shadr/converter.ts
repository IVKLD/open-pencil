import {
  type Fill,
  type NodeType,
  type SceneNode,
  SceneGraph
} from '@open-pencil/scene-graph'

import type { EditorStore } from '@/app/editor/active-store'

import { colorToShadrHex, shadrHexToColor } from './converter/color'
import { parseCoordinate } from './converter/math'
import { componentRegistry, expandComponent } from './converter/template'
import { SHADR_DATA_KEY, SHADR_PLUGIN_ID, getShadrData } from './data'
import type { ShadrComponent, ShadrElement, ShadrNodeData, ShadrPage, ShadrScreen } from './types'

export class ShadrConverter {
  /** Converts OpenPencil Canvas scene into Shadr Page JSON */
  exportPage(editor: EditorStore, pageName?: string): ShadrPage {
    const graph = editor.graph
    const pageNodes = graph.getPages()
    const currentPageId = editor.state.currentPageId || pageNodes[0]?.id
    const targetPage = pageNodes.find((p) => p.id === currentPageId) ?? pageNodes[0]
    const targetPageId = targetPage?.id ?? currentPageId
    const topNodes = graph.getChildren(targetPageId)

    const rootFrame = topNodes.find((n: SceneNode) => n.type === 'FRAME' && n.width >= 600)
    const screen: ShadrScreen = {
      width: rootFrame ? Math.round(rootFrame.width) : 1920,
      height: rootFrame ? Math.round(rootFrame.height) : 1080,
      cursorSize: 10,
      cursorSpeed: 2.0,
      cursorLayer: 9700
    }

    const sourceNodes = rootFrame ? graph.getChildren(rootFrame.id) : topNodes
    const blocks: ShadrElement[] = sourceNodes.map((n: SceneNode, i: number) =>
      this.#nodeToElement(n, graph, i)
    )

    const finalName =
      pageName ||
      targetPage?.name ||
      rootFrame?.name ||
      'main_menu'

    return {
      name: finalName.toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
      screen,
      blocks
    }
  }

  /** Converts multiple Shadr Pages and Components into a full Project SceneGraph */
  importProject(pages: ShadrPage[], components: Record<string, ShadrComponent> = {}): SceneGraph {
    const graph = new SceneGraph()
    const pageNodes = graph.getPages()

    // Register all components in template registry first so pages can expand them
    for (const [name, comp] of Object.entries(components)) {
      componentRegistry.set(name, comp)
    }

    // Populate scenes (pages)
    pages.forEach((page, index) => {
      let pageNode = index === 0 ? pageNodes[0] : null
      if (pageNode) {
        graph.updateNode(pageNode.id, { name: page.name })
      } else {
        pageNode = graph.createNode('CANVAS', graph.rootId, { name: page.name, width: 0, height: 0 })
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
        ]
      })

      if (page.blocks && Array.isArray(page.blocks)) {
        for (const block of page.blocks) {
          this.#elementToNode(block, rootFrame.id, graph)
        }
      }
    })

    // Populate _components page
    const compEntries = Object.entries(components)
    if (compEntries.length > 0) {
      const compPage = graph.createNode('CANVAS', graph.rootId, { name: '_components', width: 0, height: 0 })
      let offsetX = 100
      let offsetY = 100
      let rowHeight = 0

      for (const [compName, comp] of compEntries) {
        const width = parseCoordinate(comp.params?.width as string | number | undefined, 300)
        const height = parseCoordinate(comp.params?.height as string | number | undefined, 120)

        const compFrame = graph.createNode('FRAME', compPage.id, {
          name: `component_${compName}`,
          x: offsetX,
          y: offsetY,
          width: Math.max(160, width + 40),
          height: Math.max(80, height + 40),
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
            this.#elementToNode(block, compFrame.id, graph)
          }
        }

        offsetX += Math.max(160, width + 40) + 60
        rowHeight = Math.max(rowHeight, height + 40)
        if (offsetX > 2400) {
          offsetX = 100
          offsetY += rowHeight + 80
          rowHeight = 0
        }
      }
    }

    return graph
  }

  /** Converts the full Project SceneGraph back into Shadr Pages and Components */
  exportProject(editor: EditorStore): {
    pages: ShadrPage[]
    components: Record<string, ShadrComponent>
  } {
    const graph = editor.graph
    const allPages = graph.getPages()
    const pages: ShadrPage[] = []
    const components: Record<string, ShadrComponent> = {}

    for (const pageNode of allPages) {
      if (pageNode.name === '_components') {
        const compFrames = graph.getChildren(pageNode.id).filter((n: SceneNode) => n.type === 'FRAME')
        for (const frame of compFrames) {
          const compName = frame.name.replace(/^component_/, '')
          const data = getShadrData(frame)
          const params = (data.componentParams ?? { id: compName }) as Record<string, unknown>
          const blocks = graph.getChildren(frame.id).map((c: SceneNode, i: number) =>
            this.#nodeToElement(c, graph, i)
          )
          components[compName] = { params, blocks }
        }
      } else {
        const topNodes = graph.getChildren(pageNode.id)
        const rootFrame = topNodes.find((n: SceneNode) => n.type === 'FRAME' && n.width >= 600)
        const screen: ShadrScreen = {
          width: rootFrame ? Math.round(rootFrame.width) : 1920,
          height: rootFrame ? Math.round(rootFrame.height) : 1080,
          cursorSize: 10,
          cursorSpeed: 2.0,
          cursorLayer: 9700
        }

        const sourceNodes = rootFrame ? graph.getChildren(rootFrame.id) : topNodes
        const blocks: ShadrElement[] = sourceNodes.map((n: SceneNode, i: number) =>
          this.#nodeToElement(n, graph, i)
        )

        pages.push({
          name: pageNode.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
          screen,
          blocks
        })
      }
    }

    return { pages, components }
  }

  /** Converts Shadr Page JSON into OpenPencil SceneGraph */
  importPage(page: ShadrPage): SceneGraph {
    const graph = new SceneGraph()
    const pageNodes = graph.getPages()
    const pageNode =
      pageNodes[0] ??
      graph.createNode('CANVAS', graph.rootId, { name: page.name, width: 0, height: 0 })

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
      ]
    })

    if (page.blocks && Array.isArray(page.blocks)) {
      for (const block of page.blocks) {
        this.#elementToNode(block, rootFrame.id, graph)
      }
    }

    return graph
  }

  /** Converts Shadr Component JSON into OpenPencil SceneGraph for editing */
  importComponent(comp: ShadrComponent, compName: string): SceneGraph {
    const graph = new SceneGraph()
    const pageNodes = graph.getPages()
    const pageNode =
      pageNodes[0] ??
      graph.createNode('CANVAS', graph.rootId, { name: compName, width: 0, height: 0 })

    const width = parseCoordinate(comp.params?.width as string | number | undefined, 360)
    const height = parseCoordinate(comp.params?.height as string | number | undefined, 120)

    const rootFrame = graph.createNode('FRAME', pageNode.id, {
      name: `component_${compName}`,
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
        this.#elementToNode(block, rootFrame.id, graph)
      }
    }

    return graph
  }

  /** Converts edited Canvas scene back into Shadr Component JSON */
  exportComponent(editor: EditorStore, componentName?: string): ShadrComponent {
    const graph = editor.graph
    const pageNodes = graph.getPages()
    const currentPageId = editor.state.currentPageId || pageNodes[0]?.id
    const topNodes = graph.getChildren(currentPageId)

    const rootFrame = topNodes.find((n: SceneNode) => n.type === 'FRAME')
    const sourceNodes = rootFrame ? graph.getChildren(rootFrame.id) : topNodes

    const blocks: ShadrElement[] = sourceNodes.map((n: SceneNode, i: number) =>
      this.#nodeToElement(n, graph, i)
    )

    let params: Record<string, unknown> = {}
    if (rootFrame) {
      const data = getShadrData(rootFrame)
      if (data.componentParams) {
        params = { ...data.componentParams }
      }
    }

    const name = componentName || rootFrame?.name.replace(/^component_/, '') || 'component'
    if (!params.id) {
      params.id = name
    }

    return {
      params,
      blocks
    }
  }

  /** Inserts a ShadrElement (or component) into an existing SceneGraph */
  addElementToGraph(elem: ShadrElement, parentId: string, graph: SceneGraph): SceneNode {
    return this.#elementToNode(elem, parentId, graph)
  }

  #nodeToElement(node: SceneNode, graph: SceneGraph, depth = 0): ShadrElement {
    const data = getShadrData(node)
    const id = data.blockId || node.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || `block_${node.id}`
    const layer = data.layer ?? depth * 2

    if (data.componentName) {
      const compElem: ShadrElement = {
        type: 'component',
        id,
        component: data.componentName,
        params: { id, ...(data.componentParams ?? {}) }
      }
      if (node.x !== 0 || node.y !== 0) {
        compElem.position = { x: Math.round(node.x), y: Math.round(node.y) }
      }
      return compElem
    }

    const base: ShadrElement = {
      type: 'block',
      id,
      layer,
      position: { x: Math.round(node.x), y: Math.round(node.y) },
      size: { width: Math.round(node.width), height: Math.round(node.height) }
    }

    if (data.interactive !== undefined) base.interactive = data.interactive
    if (data.hoverEffect) base.hoverEffect = data.hoverEffect
    if (data.clickEffect) base.clickEffect = data.clickEffect
    if (data.onClickAction && data.onClickAction.length > 0) base.onClickAction = data.onClickAction

    if (node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL') {
      base.type = 'grid_block'
      base.direction = node.layoutMode === 'HORIZONTAL' ? 'row' : 'column'
      base.gap = Math.round(node.itemSpacing || 0)
      base.children = graph
        .getChildren(node.id)
        .map((c: SceneNode, i: number) => this.#nodeToElement(c, graph, depth + 1 + i))
      return base
    }

    if (node.type === 'TEXT') {
      base.type = 'text'
      base.text = node.text || node.name
      base.font = data.customFont || 'shadr'
      const fill = (node.fills ?? []).find((f) => f.visible !== false)
      if (fill) base.color = colorToShadrHex(fill.color)
      const align = (node.textAlignHorizontal || 'LEFT').toLowerCase()
      base.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left'
      return base
    }

    if (node.type === 'ELLIPSE') {
      base.type = 'circle'
      const fill = (node.fills ?? []).find((f) => f.visible !== false)
      if (fill) {
        base.color = colorToShadrHex(fill.color)
        base.opacity = Math.round((fill.opacity ?? 1) * 255)
      }
      return base
    }

    const primaryFill = (node.fills ?? []).find((f) => f.visible !== false)
    if (primaryFill) {
      base.type = primaryFill.type === 'GRADIENT_LINEAR' ? 'gradient' : 'block'
      base.color = colorToShadrHex(primaryFill.color)
      base.opacity = Math.round((primaryFill.opacity ?? 1) * 255)
    }

    if (node.cornerRadius && node.cornerRadius > 0) {
      base.type = 'block_rounded'
      base.rounding = { radius: Math.round(node.cornerRadius) }
    }

    const children = graph.getChildren(node.id)
    if (children.length > 0 && base.type !== 'grid_block') {
      base.children = children.map((c: SceneNode, i: number) =>
        this.#nodeToElement(c, graph, depth + 1 + i)
      )
    }

    return base
  }

  #elementToNode(elem: ShadrElement, parentId: string, graph: SceneGraph): SceneNode {
    if (elem.type === 'component') {
      const expanded = expandComponent(elem)
      if (expanded) {
        return this.#elementToNode(expanded, parentId, graph)
      }
    }

    const x = parseCoordinate(elem.position?.x, 0)
    const y = parseCoordinate(elem.position?.y, 0)
    const width = Math.max(1, parseCoordinate(elem.size?.width, 100))
    const height = Math.max(1, parseCoordinate(elem.size?.height, 40))

    const shadrData: ShadrNodeData = {
      blockId: elem.id,
      layer: elem.layer,
      interactive: elem.interactive,
      hoverEffect: elem.hoverEffect,
      clickEffect: elem.clickEffect,
      onClickAction: elem.onClickAction,
      componentName: elem.component,
      componentParams: elem.params,
      customFont: elem.font
    }

    let nodeType: NodeType = 'RECTANGLE'
    const displayName = elem.component ? `[${elem.component}] ${elem.id}` : elem.id || elem.type
    const props: Partial<SceneNode> = {
      name: displayName,
      x,
      y,
      width,
      height,
      pluginData: [
        { pluginId: SHADR_PLUGIN_ID, key: SHADR_DATA_KEY, value: JSON.stringify(shadrData) }
      ]
    }

    if (elem.color) {
      const { color, opacity } = shadrHexToColor(elem.color, elem.opacity)
      const fill: Fill = {
        type: elem.type === 'gradient' ? 'GRADIENT_LINEAR' : 'SOLID',
        color,
        opacity,
        visible: true
      }
      props.fills = [fill]
    }

    if (elem.rounding?.radius) {
      props.cornerRadius = elem.rounding.radius
    } else if (elem.rounding?.size) {
      props.cornerRadius = elem.rounding.size === 'small' ? 4 : elem.rounding.size === 'large' ? 12 : 8
    }

    if (elem.type === 'text') {
      nodeType = 'TEXT'
      props.text = elem.text ?? ''
      props.fontSize = Math.round(height * 0.8) || 16
      props.fontFamily = 'Inter'
      props.textAlignHorizontal = elem.textAlign === 'center' ? 'CENTER' : elem.textAlign === 'right' ? 'RIGHT' : 'LEFT'
    } else if (elem.type === 'grid_block') {
      nodeType = 'FRAME'
      props.layoutMode = elem.direction === 'column' ? 'VERTICAL' : 'HORIZONTAL'
      props.itemSpacing = elem.gap ?? 0
    } else if (elem.type === 'component') {
      nodeType = 'FRAME'
    }

    const createdNode = graph.createNode(nodeType, parentId, props)
    if (elem.children && elem.children.length > 0) {
      for (const child of elem.children) {
        this.#elementToNode(child, createdNode.id, graph)
      }
    }

    return createdNode
  }
}

export const shadrConverter = new ShadrConverter()

// Re-exports for convenience and backward-compatibility
export const exportPageFromCanvas = (editor: EditorStore, pageName?: string) =>
  shadrConverter.exportPage(editor, pageName)
export const importPageToSceneGraph = (page: ShadrPage) =>
  shadrConverter.importPage(page)
export { colorToShadrHex, shadrHexToColor } from './converter/color'
export { parseCoordinate } from './converter/math'
export { componentRegistry, expandComponent } from './converter/template'
