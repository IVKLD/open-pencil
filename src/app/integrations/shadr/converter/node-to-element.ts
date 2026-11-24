import { isEqual, isString } from 'es-toolkit'

import type { SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { getShadrData } from '../data'
import type {
  ShadrCommonBlockProps,
  ShadrElement,
  ShadrElementType,
  ShadrNodeData,
  ShadrParamValue
} from '../types'
import { colorToShadrHex } from './color'
import { parseCoordinate } from './math'
import { componentRegistry, interpolateElement } from './template'

function resolveRoundingSizeName(radius: number): string {
  if (radius <= 12) return 'small'
  if (radius <= 26) return 'regular'
  if (radius <= 36) return 'medium'
  return 'large'
}

function applyComponentStrokes(node: SceneNode, params: Record<string, ShadrParamValue>): void {
  if (!node.strokes || node.strokes.length === 0) return
  const primaryStroke = node.strokes.find((s: Stroke) => s.visible !== false)
  if (primaryStroke?.color) {
    const strokeHex = colorToShadrHex(primaryStroke.color)
    if (params.border !== undefined) params.border = strokeHex
    if (params.borderColor !== undefined) params.borderColor = strokeHex
    if (params.outline !== undefined && isString(params.outline)) {
      params.outline = strokeHex
    }
  }
}

function matchParamName(
  childId: string,
  params: Record<string, ShadrParamValue>,
  textChildrenCount: number
): string | undefined {
  const match = Object.keys(params).find((k) => childId === k || childId.endsWith(`_${k}`))
  if (match) return match
  if (textChildrenCount === 1) {
    return ['label', 'title', 'value', 'text', 'body'].find((k) => params[k] !== undefined)
  }
  return undefined
}

function applyComponentTextChild(
  tc: SceneNode,
  matchedParam: string,
  params: Record<string, ShadrParamValue>
): void {
  if (tc.text !== undefined) {
    params[matchedParam] = tc.text
  }
  const textFill = (tc.fills ?? []).find((f) => f.visible !== false)
  if (textFill?.color) {
    const colorHex = colorToShadrHex(textFill.color)
    const colorKey = `${matchedParam}Color`
    if (params[colorKey] !== undefined) {
      params[colorKey] = colorHex
    } else if (params.textColor !== undefined && matchedParam === 'label') {
      params.textColor = colorHex
    }
  }
  if (tc.fontSize && params.fontSize !== undefined) {
    params.fontSize = Math.round(tc.fontSize * 4)
  }
}

function applyComponentTextChildren(
  node: SceneNode,
  params: Record<string, ShadrParamValue>,
  graph: SceneGraph
): void {
  if (node.type === 'TEXT') {
    const nodeData = getShadrData(node, graph)
    const nodeId = nodeData.blockId || node.name || ''
    const matchedParam = matchParamName(nodeId, params, 1)
    if (matchedParam) {
      applyComponentTextChild(node, matchedParam, params)
    }
    return
  }

  const children = graph.getChildren(node.id)
  const textChildren = children.filter((c: SceneNode) => c.type === 'TEXT')
  for (const tc of textChildren) {
    const childData = getShadrData(tc, graph)
    const childId = childData.blockId || tc.name || ''
    const matchedParam = matchParamName(childId, params, textChildren.length)
    if (matchedParam) {
      applyComponentTextChild(tc, matchedParam, params)
    }
  }
}

const COMPONENT_SAFE_KEYS: readonly (keyof ShadrCommonBlockProps)[] = [
  'align',
  'scrollRegion',
  'scrollbarFor'
]

const COMPONENT_DETACH_INTERACTION_KEYS: readonly (keyof ShadrCommonBlockProps)[] = [
  'interactive',
  'hoverEffect',
  'clickEffect',
  'permission',
  'draggable',
  'dragGroup',
  'dragBounds',
  'hoverText',
  'enabled',
  'onClickAction',
  'onSubmitAction',
  'onLeftClickAction',
  'onRightClickAction',
  'onChangeAction'
]

function hasInteractionOverrides(
  data: ShadrNodeData,
  templateBlock: ShadrElement,
  onlyDefined = false
): boolean {
  for (const key of COMPONENT_DETACH_INTERACTION_KEYS) {
    const actual = data[key]
    if (onlyDefined && actual === undefined) continue
    const expected = templateBlock[key]
    if (!isEqual(actual, expected)) {
      return true
    }
  }
  return false
}

function getEffectiveChildPosition(child: SceneNode, tmplChild: ShadrElement): Vector {
  if (child.type === 'TEXT') {
    const align = tmplChild.textAlign
    if (align === 'center') {
      return { x: Math.round(child.x + child.width / 2), y: Math.round(child.y) }
    }
    if (align === 'right') {
      return { x: Math.round(child.x + child.width), y: Math.round(child.y) }
    }
  }
  return { x: Math.round(child.x), y: Math.round(child.y) }
}

function extractSingleParamKey(val: unknown): string | undefined {
  if (!isString(val)) return undefined
  const match = val.match(/^\$\{([a-zA-Z0-9_]+)\}$/)
  return match?.[1]
}

function applyTemplateColorBindings(
  node: SceneNode,
  rawRoot: ShadrElement | undefined,
  params: Record<string, ShadrParamValue>,
  graph: SceneGraph
): void {
  const primaryFill = (node.fills ?? []).find((f) => f.visible !== false)
  if (primaryFill?.color) {
    if (rawRoot) {
      const rootColorParam = extractSingleParamKey(rawRoot.color)
      if (rootColorParam && params[rootColorParam] !== undefined) {
        params[rootColorParam] = colorToShadrHex(primaryFill.color)
      }
    } else if (params.color !== undefined) {
      params.color = colorToShadrHex(primaryFill.color)
    }
  }

  if (!rawRoot?.children?.length) return
  const children = graph.getChildren(node.id)
  for (let i = 0; i < Math.min(children.length, rawRoot.children.length); i++) {
    const child = children[i]
    const tmplChild = rawRoot.children[i]
    const childColorParam = extractSingleParamKey(tmplChild.color)
    if (!childColorParam || params[childColorParam] === undefined) continue
    const childFill = (child.fills ?? []).find((f) => f.visible !== false)
    if (childFill?.color) {
      params[childColorParam] = colorToShadrHex(childFill.color)
    }
  }
}

function isCenteredTextAtPreviousWidth(
  child: SceneNode,
  tmplChild: ShadrElement,
  actualX: number,
  nodeData: ShadrNodeData
): boolean {
  if (child.type !== 'TEXT' || child.horizontalConstraint !== 'CENTER') return false
  if (tmplChild.textAlign !== 'center') return false
  const prevWidth = parseCoordinate(
    nodeData.componentParams?.width as string | number | undefined,
    0
  )
  return prevWidth > 0 && Math.abs(actualX - Math.round(prevWidth / 2)) <= 2
}

function hasChildLayoutOverrides(
  node: SceneNode,
  templateBlock: ShadrElement,
  graph: SceneGraph,
  nodeData: ShadrNodeData
): boolean {
  const children = graph.getChildren(node.id)
  const tmplChildren = templateBlock.children ?? []
  if (children.length !== tmplChildren.length) return true

  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const tmplChild = tmplChildren[i]
    const childData = getShadrData(child, graph)
    if (hasInteractionOverrides(childData, tmplChild)) return true

    const expectedX = Math.max(0, Math.round(parseCoordinate(tmplChild.position?.x, 0)))
    const expectedY = Math.max(0, Math.round(parseCoordinate(tmplChild.position?.y, 0)))
    const actual = getEffectiveChildPosition(child, tmplChild)
    const xMoved =
      Math.abs(actual.x - expectedX) > 2 &&
      !isCenteredTextAtPreviousWidth(child, tmplChild, actual.x, nodeData)
    if (xMoved || Math.abs(actual.y - expectedY) > 2) {
      return true
    }

    if (child.type !== 'TEXT' && tmplChild.size) {
      const expectedW = Math.max(1, Math.round(parseCoordinate(tmplChild.size.width, child.width)))
      const expectedH = Math.max(
        1,
        Math.round(parseCoordinate(tmplChild.size.height, child.height))
      )
      if (Math.abs(Math.round(child.width) - expectedW) > 2) return true
      if (Math.abs(Math.round(child.height) - expectedH) > 2) return true
    }
  }
  return false
}

function buildComponentParams(
  node: SceneNode,
  id: string,
  data: ShadrNodeData,
  graph: SceneGraph
): Record<string, ShadrParamValue> {
  const params: Record<string, ShadrParamValue> = {
    id,
    ...data.componentParams
  }
  if (node.width > 0) params.width = Math.round(node.width)
  if (node.height > 0) params.height = Math.round(node.height)

  const template = data.componentName ? componentRegistry.get(data.componentName) : undefined
  const rawRoot = template?.blocks?.find((b) => !b.id?.includes('scrim')) ?? template?.blocks?.[0]
  applyTemplateColorBindings(node, rawRoot, params, graph)

  if (node.cornerRadius !== undefined && params.rounding !== undefined) {
    const r = node.cornerRadius
    params.rounding = isString(params.rounding) ? resolveRoundingSizeName(r) : Math.round(r)
  }

  applyComponentStrokes(node, params)
  applyComponentTextChildren(node, params, graph)
  return params
}

function shouldDetachComponent(
  node: SceneNode,
  data: ShadrNodeData,
  params: Record<string, ShadrParamValue>,
  graph: SceneGraph
): boolean {
  if (!data.componentName) return false
  const template = componentRegistry.get(data.componentName)
  if (!template?.blocks?.length) return false

  const rawRoot = template.blocks.find((b) => !b.id?.includes('scrim')) ?? template.blocks[0]
  const expanded = interpolateElement(rawRoot, { ...template.params, ...params })

  if (node.type === 'INSTANCE') {
    return hasInteractionOverrides(data, expanded, true)
  }

  if (hasInteractionOverrides(data, expanded)) return true
  if (node.type !== 'TEXT' && hasChildLayoutOverrides(node, expanded, graph, data)) return true
  return false
}

function buildComponentElement(
  node: SceneNode,
  id: string,
  data: ShadrNodeData,
  params: Record<string, ShadrParamValue>,
  isGridChild = false
): ShadrElement {
  const compElem: ShadrElement = {
    type: 'component',
    id,
    component: data.componentName,
    params
  }
  copyDefined(compElem, data, COMPONENT_SAFE_KEYS)
  if (!isGridChild) {
    compElem.position = resolveElementExportPosition(node, data)
  }
  return compElem
}

function preserveFormula(val: number, raw?: number | string): number | string {
  return isString(raw) && parseCoordinate(raw, 0) === val ? raw : val
}

function resolveElementExportPosition(
  node: SceneNode,
  data: ShadrNodeData
): { x: number | string; y: number | string } {
  const x = Math.round(node.x)
  const y = Math.round(node.y)
  return {
    x: preserveFormula(x, data.rawPosition?.x),
    y: preserveFormula(y, data.rawPosition?.y)
  }
}

function resolveElementExportSize(
  node: SceneNode,
  data: ShadrNodeData
): { width: number | string; height: number | string } {
  const width = Math.round(node.width)
  const height = Math.round(node.height)
  return {
    width: preserveFormula(width, data.rawSize?.width),
    height: preserveFormula(height, data.rawSize?.height)
  }
}

function applyStrokeOutline(node: SceneNode, base: ShadrElement): void {
  if (!node.strokes || node.strokes.length === 0) return
  const primaryStroke = node.strokes.find((s: Stroke) => s.visible !== false)
  if (primaryStroke && primaryStroke.color) {
    base.outline = {
      size: Math.round(node.strokeWeight || primaryStroke.weight || 1),
      color: colorToShadrHex(primaryStroke.color)
    }
  }
}

function resolveExportFont(node: SceneNode, customFont?: string): string | undefined {
  if (customFont && customFont.startsWith('shadr')) {
    return customFont
  }
  if (node.fontFamily === 'Silkscreen') {
    if (customFont && customFont !== 'minecraft:default' && customFont !== 'default') {
      return customFont
    }
    return undefined
  }
  const weight = node.fontWeight
  if (weight && weight >= 700) return 'shadr_bold'
  if (weight && weight >= 600) return 'shadr_semibold'
  return 'shadr'
}

function applyTextPosition(node: SceneNode, base: ShadrElement): void {
  if (base.textAlign === 'center') {
    base.position = {
      x: Math.round(node.x + node.width / 2),
      y: Math.round(node.y)
    }
  } else if (base.textAlign === 'right') {
    base.position = {
      x: Math.round(node.x + node.width),
      y: Math.round(node.y)
    }
  }
}

function toShadrTextAlign(align?: string): 'left' | 'center' | 'right' {
  if (align === 'CENTER') return 'center'
  if (align === 'RIGHT') return 'right'
  return 'left'
}

function buildTextElement(
  node: SceneNode,
  base: ShadrElement,
  data: ShadrNodeData,
  isGridChild = false
): ShadrElement {
  base.type = 'text'
  base.text = node.text !== undefined ? node.text : data.rawText || node.name || ''
  const font = resolveExportFont(node, data.customFont)
  if (font !== undefined) {
    base.font = font
  }
  const fill = (node.fills ?? []).find((f) => f.visible !== false)
  if (fill) base.color = colorToShadrHex(fill.color)
  base.textAlign = toShadrTextAlign(node.textAlignHorizontal)
  const fontScale = Math.round((node.fontSize || 16) * 4)
  base.size = { width: fontScale, height: fontScale }

  if ((node.textAutoResize === 'HEIGHT' || node.textAutoResize === 'NONE') && node.width > 0) {
    base.lineWidth = Math.round(node.width)
  } else if (data.rawLineWidth !== undefined) {
    base.lineWidth = data.rawLineWidth
  }

  if (!isGridChild) {
    applyTextPosition(node, base)
  }
  return base
}

function applyTexture(node: SceneNode, base: ShadrElement, data: ShadrNodeData): void {
  const primaryFill = (node.fills ?? []).find((f) => f.visible !== false)
  const hasImageFill = primaryFill?.type === 'IMAGE'
  const textureName =
    data.textureName ||
    (hasImageFill
      ? (node.name ?? '')
          .replace(/^img_/, '')
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .toLowerCase() || `texture_${primaryFill?.imageHash?.slice(0, 8)}`
      : undefined)

  if (!textureName) return
  base.type = 'image'
  base.image = textureName
  base.fit = data.imageFit || (primaryFill?.imageScaleMode === 'FIT' ? 'contain' : 'cover')
}

function applyFillsAndOpacity(node: SceneNode, base: ShadrElement, data?: ShadrNodeData): void {
  if (base.type === 'image') {
    if (node.opacity !== undefined && node.opacity < 1) {
      base.opacity = Math.round(node.opacity * 255)
    } else if (data?.rawOpacity !== undefined) {
      base.opacity = data.rawOpacity
    }
    return
  }

  const primaryFill = (node.fills ?? []).find((f) => f.visible !== false)
  if (primaryFill && primaryFill.type !== 'IMAGE') {
    if (base.type !== 'circle') {
      base.type = primaryFill.type === 'GRADIENT_LINEAR' ? 'gradient' : 'block'
    }
    base.color = colorToShadrHex(primaryFill.color)
    const fillOpacity = primaryFill.opacity ?? 1
    const nodeOpacity = node.opacity ?? 1
    base.opacity = Math.round(fillOpacity * nodeOpacity * 255)
  } else if (node.opacity !== undefined && node.opacity < 1) {
    base.opacity = Math.round(node.opacity * 255)
  } else if (data?.rawOpacity !== undefined) {
    base.opacity = data.rawOpacity
  }
}

function applyRounding(node: SceneNode, base: ShadrElement, data?: ShadrNodeData): void {
  if (!node.cornerRadius || node.cornerRadius <= 0) return
  if (base.type !== 'image') {
    base.type = 'block_rounded'
  }
  if (data?.rawRounding?.size) {
    base.rounding = { size: data.rawRounding.size }
  } else if (data?.rawRounding?.radius !== undefined) {
    base.rounding = { radius: Math.round(node.cornerRadius) }
  } else {
    base.rounding = { size: resolveRoundingSizeName(node.cornerRadius) }
  }
}

function copyDefined<T extends object>(
  target: T,
  source: Partial<T>,
  keys: readonly (keyof T)[]
): void {
  for (const key of keys) {
    const val = source[key]
    if (val !== undefined) {
      target[key] = val
    }
  }
}

const INTERACTION_KEYS: readonly (keyof ShadrElement)[] = [
  'interactive',
  'hoverEffect',
  'clickEffect',
  'permission',
  'align',
  'scrollRegion',
  'scrollbarFor',
  'draggable',
  'dragGroup',
  'dragBounds',
  'hoverText',
  'enabled',
  'onClickAction',
  'onSubmitAction',
  'onLeftClickAction',
  'onRightClickAction',
  'onChangeAction'
]

function applyInteractions(data: ShadrNodeData, base: ShadrElement): void {
  copyDefined(base, data, INTERACTION_KEYS)
}

function hasCustomGridChildPositions(node: SceneNode, children: readonly SceneNode[]): boolean {
  const isRow = node.layoutMode === 'HORIZONTAL'
  const gap = Math.round(node.itemSpacing || 0)
  let offset = 0
  for (const child of children) {
    const expectedX = isRow ? offset : 0
    const expectedY = isRow ? 0 : offset
    if (Math.abs(child.x - expectedX) > 2 || Math.abs(child.y - expectedY) > 2) {
      return true
    }
    offset += (isRow ? child.width : child.height) + gap
  }
  return false
}

function buildGridBlockElement(
  node: SceneNode,
  id: string,
  data: ShadrNodeData,
  graph: SceneGraph,
  depth: number,
  minLayer = 0
): ShadrElement {
  const children = graph.getChildren(node.id)
  if (hasCustomGridChildPositions(node, children)) {
    const layer = Math.max(data.layer ?? 12 + depth * 2, minLayer)
    const container: ShadrElement = {
      type: 'block',
      id,
      layer,
      opacity: 0,
      size: resolveElementExportSize(node, data),
      position: resolveElementExportPosition(node, data),
      children: children.map((c: SceneNode, i: number) =>
        nodeToElement(c, graph, depth + 1 + i, false, layer + 1)
      )
    }
    applyInteractions(data, container)
    return container
  }

  const childMinLayer = Math.max(minLayer, data.layer !== undefined ? data.layer + 1 : 0)
  const elem: ShadrElement = {
    type: 'grid_block',
    id,
    direction: node.layoutMode === 'HORIZONTAL' ? 'row' : 'column',
    gap: Math.round(node.itemSpacing || 0),
    position: resolveElementExportPosition(node, data),
    children: children.map((c: SceneNode, i: number) =>
      nodeToElement(c, graph, depth + 1 + i, true, childMinLayer)
    )
  }
  applyInteractions(data, elem)
  return elem
}

const SPECIAL_BLOCK_KEYS: Record<string, readonly (keyof ShadrElement)[]> = {
  slider: ['min', 'max', 'step', 'value'],
  toggle: ['checked', 'value'],
  video: ['video', 'stream'],
  item: ['item', 'customModelData', 'itemDisplay'],
  shader: ['shader'],
  text_input: ['placeholder', 'placeholderColor', 'hint', 'maxLength', 'fontSize', 'textColor']
}

function resolveCustomType(data: ShadrNodeData): ShadrElementType | undefined {
  if (data.rawType) return data.rawType
  if (data.min !== undefined) return 'slider'
  if (data.checked !== undefined) return 'toggle'
  return undefined
}

function applyCustomBlockProperties(data: ShadrNodeData, base: ShadrElement): void {
  const type = resolveCustomType(data)
  if (!type || type === 'block' || type === 'block_rounded') return

  base.type = type
  const keys = SPECIAL_BLOCK_KEYS[type]
  if (keys) {
    copyDefined(base, data, keys)
  }
  if (type === 'text_input' && data.customFont !== undefined) {
    base.font = data.customFont
  } else if (type === 'blur') {
    if (data.layer === undefined) delete base.layer
    if (data.rawColor !== undefined) base.color = data.rawColor
    if (data.rawOpacity !== undefined) base.opacity = data.rawOpacity
    else delete base.opacity
  }
}

const CONSTRAINT_TO_ALIGN: Record<string, string> = {
  CENTER: 'center',
  MAX: 'right'
}

/** Converts an OpenPencil SceneNode into a ShadrElement JSON definition */
export function nodeToElement(
  node: SceneNode,
  graph: SceneGraph,
  depth = 0,
  isGridChild = false,
  minLayer = 0
): ShadrElement {
  const data = getShadrData(node, graph)
  const id =
    data.blockId ||
    (node.name ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '_') ||
    `block_${node.id}`

  if (data.componentName) {
    const params = buildComponentParams(node, id, data, graph)
    if (!shouldDetachComponent(node, data, params, graph)) {
      return buildComponentElement(node, id, data, params, isGridChild)
    }
  }

  if (node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL') {
    return buildGridBlockElement(node, id, data, graph, depth, minLayer)
  }

  const layer = Math.max(data.layer ?? 12 + depth * 2, minLayer)
  const base: ShadrElement = {
    type: 'block',
    id,
    layer,
    size: resolveElementExportSize(node, data)
  }
  if (!isGridChild) {
    base.position = resolveElementExportPosition(node, data)
  }

  applyInteractions(data, base)
  if (!base.align && node.type !== 'TEXT' && node.horizontalConstraint) {
    base.align = CONSTRAINT_TO_ALIGN[node.horizontalConstraint]
  }
  applyStrokeOutline(node, base)

  if (node.type === 'TEXT') {
    return buildTextElement(node, base, data, isGridChild)
  }

  if (node.type === 'ELLIPSE') {
    base.type = 'circle'
    applyFillsAndOpacity(node, base)
    return base
  }

  applyTexture(node, base, data)
  applyFillsAndOpacity(node, base, data)
  applyRounding(node, base, data)
  applyCustomBlockProperties(data, base)

  const children = graph.getChildren(node.id)
  if (children.length > 0) {
    base.children = children.map((c: SceneNode, i: number) =>
      nodeToElement(c, graph, depth + 1 + i, false, layer + 1)
    )
  }

  return base
}
