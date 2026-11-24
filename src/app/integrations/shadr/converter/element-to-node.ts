import { isString } from 'es-toolkit'

import type { Fill, NodeType, SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { TRANSPARENT } from '@open-pencil/scene-graph/constants'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { SHADR_DATA_KEY, SHADR_PLUGIN_ID } from '../data'
import type { ShadrElement, ShadrNodeData } from '../types'
import { shadrHexToColor } from './color'
import { parseCoordinate } from './math'
import { expandComponent } from './template'

function normalizeFontSize(val: string | number | undefined): number {
  const raw = parseCoordinate(val, 64)
  return raw >= 28 ? Math.round(raw / 4) : Math.max(8, Math.round(raw))
}

function parseTextFontSize(elem: ShadrElement): number {
  if (elem.fontSize !== undefined) {
    return normalizeFontSize(elem.fontSize)
  }
  if (elem.size !== undefined) {
    const s = typeof elem.size === 'object' ? (elem.size.height ?? elem.size.width) : elem.size
    return normalizeFontSize(s)
  }
  return 16
}

function resolveGridBlockSize(
  elem: ShadrElement,
  fallbackWidth: number,
  fallbackHeight: number
): { width: number; height: number } {
  if (elem.size?.width && elem.size?.height) {
    return {
      width: parseCoordinate(elem.size.width, fallbackWidth),
      height: parseCoordinate(elem.size.height, fallbackHeight)
    }
  }
  if (!elem.children?.length) {
    return { width: fallbackWidth, height: fallbackHeight }
  }
  const isColumn = elem.direction === 'column'
  const gap = Math.max(0, elem.gap ?? 0)
  let totalW = 0
  let maxW = 0
  let totalH = 0
  let maxH = 0
  for (const child of elem.children) {
    const b = resolveElementBounds(child)
    totalW += b.width
    maxW = Math.max(maxW, b.width)
    totalH += b.height
    maxH = Math.max(maxH, b.height)
  }
  const gapSpan = gap * (elem.children.length - 1)
  const autoW = isColumn ? maxW : totalW + gapSpan
  const autoH = isColumn ? totalH + gapSpan : maxH
  return {
    width: elem.size?.width ? parseCoordinate(elem.size.width, fallbackWidth) : autoW,
    height: elem.size?.height ? parseCoordinate(elem.size.height, fallbackHeight) : autoH
  }
}

function resolveTextWrapLimit(
  elem: ShadrElement,
  startX: number,
  rawWidth: number,
  parentWidth?: number
): number | undefined {
  if (elem.lineWidth && elem.lineWidth > 0) {
    return parseCoordinate(elem.lineWidth, rawWidth)
  }
  if (parentWidth && parentWidth > startX + 40) {
    const availableWidth = Math.round(parentWidth - startX - 32)
    if (rawWidth > availableWidth && availableWidth >= 80) {
      return availableWidth
    }
  }
  return undefined
}

function resolveTextBounds(
  elem: ShadrElement,
  startX: number,
  startY: number,
  parentWidth?: number
): Rect {
  const fontSize = parseTextFontSize(elem)
  const text = elem.text ?? ''
  const rawWidth = Math.max(1, Math.round((text.length || 10) * fontSize * 0.52))
  const wrapLimit = resolveTextWrapLimit(elem, startX, rawWidth, parentWidth)

  const effectiveWrap =
    wrapLimit !== undefined && (rawWidth > wrapLimit || text.includes('\n')) ? wrapLimit : undefined
  const width = effectiveWrap ?? rawWidth
  const lines = effectiveWrap !== undefined ? Math.ceil(rawWidth / effectiveWrap) : 1
  const height = Math.max(1, Math.round(lines * fontSize * 1.25))

  let x = startX
  if (elem.textAlign === 'center') {
    x = Math.max(0, Math.round(x - width / 2))
  } else if (elem.textAlign === 'right') {
    x = Math.max(0, Math.round(x - width))
  }

  return { x, y: Math.max(0, startY), width, height }
}

function resolveElementBounds(elem: ShadrElement, parentWidth?: number): Rect {
  const x = parseCoordinate(elem.position?.x, 0)
  const y = parseCoordinate(elem.position?.y, 0)

  if (elem.type === 'text') {
    return resolveTextBounds(elem, x, y, parentWidth)
  }

  const compW =
    elem.type === 'component' && typeof elem.params?.width !== 'boolean'
      ? elem.params?.width
      : undefined
  const compH =
    elem.type === 'component' && typeof elem.params?.height !== 'boolean'
      ? elem.params?.height
      : undefined
  const width = Math.max(
    1,
    parseCoordinate(elem.size?.width ?? compW, elem.type === 'component' ? 180 : 100)
  )
  const height = Math.max(
    1,
    parseCoordinate(elem.size?.height ?? compH, elem.type === 'component' ? 44 : 40)
  )

  if (elem.type === 'grid_block') {
    const grid = resolveGridBlockSize(elem, width, height)
    return { x, y, width: grid.width, height: grid.height }
  }

  return { x, y, width, height }
}

function resolveBlockId(elem: ShadrElement): string | undefined {
  return elem.id || (isString(elem.params?.id) ? elem.params.id : undefined)
}

function resolveElementDisplayName(elem: ShadrElement): string {
  if (elem.component) {
    const id = resolveBlockId(elem)
    return id ? `[${elem.component}] ${id}` : `[${elem.component}]`
  }
  if (elem.type === 'image' && elem.image) {
    return `img_${elem.image}`
  }
  return elem.id || elem.type || 'element'
}

export function resolveElementFills(elem: ShadrElement): Fill[] | undefined {
  if (elem.type === 'blur') {
    if (elem.opacity === undefined) {
      return undefined
    }
    const rawOpacity = elem.opacity / 255
    const { color } =
      elem.color !== undefined && elem.color !== ''
        ? shadrHexToColor(elem.color)
        : { color: { r: 1, g: 1, b: 1, a: 1 } }
    return [
      {
        type: 'SOLID',
        color,
        opacity: rawOpacity,
        visible: true
      }
    ]
  }
  if (elem.color !== undefined && elem.color !== '') {
    const { color, opacity } = shadrHexToColor(elem.color, elem.opacity)
    return [
      {
        type: elem.type === 'gradient' ? 'GRADIENT_LINEAR' : 'SOLID',
        color,
        opacity,
        visible: true
      }
    ]
  }
  if (elem.type === 'image') {
    return [
      {
        type: 'SOLID',
        color: { r: 0.15, g: 0.18, b: 0.25, a: 1 },
        opacity: 0.8,
        visible: true
      }
    ]
  }
  return undefined
}

export function resolveElementStrokes(elem: ShadrElement): {
  strokes?: Stroke[]
  strokeWeight?: number
} {
  if (!elem.outline?.color) return {}
  const { color } = shadrHexToColor(elem.outline.color)
  const rawWeight = parseCoordinate(elem.outline.size, 1)
  const strokeWeight = Math.max(1, Math.min(rawWeight, 16))
  return {
    strokeWeight,
    strokes: [
      {
        type: 'SOLID' as const,
        color,
        visible: true,
        opacity: 1,
        weight: strokeWeight,
        align: 'INSIDE' as const
      }
    ]
  }
}

const ROUNDING_SIZES: Record<string, number> = {
  small: 8,
  regular: 24,
  medium: 32,
  large: 48,
  full: 9999
}

export function resolveElementRounding(elem: ShadrElement): number | undefined {
  if (elem.rounding?.radius !== undefined) {
    return elem.rounding.radius
  }
  if (elem.rounding?.size) {
    return ROUNDING_SIZES[elem.rounding.size] ?? 8
  }
  return undefined
}

function resolveShadrFont(fontName: string | undefined): {
  fontFamily: string
  fontWeight?: number
} {
  if (!fontName) {
    return { fontFamily: 'Silkscreen' }
  }

  const name = fontName.toLowerCase()
  const isSemibold =
    name.includes('semibold') || (name.includes('bold') && !name.includes('normal'))

  if (name.startsWith('minecraft') || name === 'default') {
    return {
      fontFamily: 'Silkscreen',
      fontWeight: isSemibold ? 700 : 400
    }
  }

  if (name.startsWith('shadr')) {
    return {
      fontFamily: 'Silkscreen',
      fontWeight: isSemibold ? 600 : 400
    }
  }

  let fontWeight: number | undefined
  if (name.includes('bold') && !name.includes('semibold')) {
    fontWeight = 700
  } else if (name.includes('semibold')) {
    fontWeight = 600
  } else if (name.includes('medium')) {
    fontWeight = 500
  }

  return { fontFamily: fontName, fontWeight }
}

function toHorizontalAlign(align?: string): 'LEFT' | 'CENTER' | 'RIGHT' {
  if (align === 'center') return 'CENTER'
  if (align === 'right') return 'RIGHT'
  return 'LEFT'
}

function applyTextConstraints(elem: ShadrElement, props: Partial<SceneNode>): void {
  if (!props.horizontalConstraint) {
    if (elem.textAlign === 'center') props.horizontalConstraint = 'CENTER'
    else if (elem.textAlign === 'right') props.horizontalConstraint = 'MAX'
  }
  if (!props.verticalConstraint && isString(elem.position?.y) && elem.position.y.includes('/ 2')) {
    props.verticalConstraint = 'CENTER'
  }
}

function configureTextProps(
  elem: ShadrElement,
  props: Partial<SceneNode>,
  parentWidth?: number
): void {
  const text = elem.text ?? ''
  const fontSize = parseTextFontSize(elem)
  props.text = text
  props.fontSize = fontSize
  const { fontFamily, fontWeight } = resolveShadrFont(elem.font)
  props.fontFamily = fontFamily
  if (fontWeight !== undefined) {
    props.fontWeight = fontWeight
  }
  props.textAlignHorizontal = toHorizontalAlign(elem.textAlign)
  applyTextConstraints(elem, props)

  const rawWidth = Math.max(1, Math.round((text.length || 10) * fontSize * 0.52))
  const wrapLimit = resolveTextWrapLimit(elem, props.x ?? 0, rawWidth, parentWidth)
  props.textAutoResize =
    wrapLimit !== undefined && props.width === wrapLimit ? 'HEIGHT' : 'WIDTH_AND_HEIGHT'
}

function configureNodeTypeAndProps(
  elem: ShadrElement,
  props: Partial<SceneNode>,
  parentWidth?: number
): NodeType {
  if (elem.type === 'text') {
    configureTextProps(elem, props, parentWidth)
    return 'TEXT'
  }
  if (elem.type === 'grid_block') {
    props.layoutMode = elem.direction === 'column' ? 'VERTICAL' : 'HORIZONTAL'
    props.itemSpacing = elem.gap ?? 0
    props.primaryAxisSizing = 'HUG'
    props.counterAxisSizing = 'HUG'
    return 'FRAME'
  }
  if (elem.type === 'component' || (elem.children && elem.children.length > 0)) {
    return 'FRAME'
  }
  return 'RECTANGLE'
}

function buildShadrNodeData(elem: ShadrElement): ShadrNodeData {
  return {
    ...elem,
    blockId: resolveBlockId(elem),
    rawType: elem.type,
    rawColor: elem.color,
    rawOpacity: elem.opacity,
    rawRounding: elem.rounding,
    rawLineWidth: elem.lineWidth,
    rawPosition: elem.position,
    rawSize: elem.size,
    rawText: elem.text,
    componentName: elem.component,
    componentParams: elem.params,
    customFont: elem.font,
    textureName: elem.image,
    imageFit: elem.fit
  }
}

const ALIGN_TO_CONSTRAINT: Record<string, 'MIN' | 'CENTER' | 'MAX'> = {
  left: 'MIN',
  center: 'CENTER',
  right: 'MAX'
}

function applyVisualProps(elem: ShadrElement, props: Partial<SceneNode>): void {
  if (elem.align && ALIGN_TO_CONSTRAINT[elem.align]) {
    props.horizontalConstraint = ALIGN_TO_CONSTRAINT[elem.align]
  }

  if (elem.opacity !== undefined && elem.opacity < 255 && !elem.color) {
    props.opacity = Math.max(0, Math.min(1, elem.opacity / 255))
  }

  const fills = resolveElementFills(elem)
  if (fills) props.fills = fills

  const { strokes, strokeWeight } = resolveElementStrokes(elem)
  if (strokes) {
    props.strokes = strokes
    props.strokeWeight = strokeWeight
  }

  const cornerRadius = resolveElementRounding(elem)
  if (cornerRadius !== undefined) {
    props.cornerRadius = cornerRadius
    if (elem.children?.length) {
      props.clipsContent = true
    }
  }

  if (elem.type === 'blur') {
    props.effects = [
      {
        type: 'BACKGROUND_BLUR',
        radius: 24,
        spread: 0,
        offset: { x: 0, y: 0 },
        color: TRANSPARENT,
        visible: true
      }
    ]
  }
}

function appendElementChildren(
  elem: ShadrElement,
  createdNode: SceneNode,
  graph: SceneGraph,
  parentWidth: number
): void {
  if (!elem.children?.length) return
  const isGrid = elem.type === 'grid_block'
  const isRow = isGrid && elem.direction !== 'column'
  const gap = elem.gap ?? 0
  let childOffset = 0
  for (const child of elem.children) {
    const childNode = elementToNode(child, createdNode.id, graph, parentWidth)
    if (isGrid) {
      if (isRow) {
        graph.updateNode(childNode.id, { x: childOffset, y: 0 })
        childOffset += childNode.width + gap
      } else {
        graph.updateNode(childNode.id, { x: 0, y: childOffset })
        childOffset += childNode.height + gap
      }
    }
  }
}

function isShadrBackgroundElement(elem: ShadrElement): boolean {
  if (elem.type === 'blur') return true
  const id = resolveBlockId(elem) ?? ''
  if (id === 'backdrop' || id === 'scrim' || id.endsWith('_scrim')) return true
  if (elem.component === 'panel') return true
  return !elem.children?.length && (id === 'panel' || id.endsWith('_panel'))
}

/** Converts a ShadrElement into an OpenPencil SceneNode in the graph */
export function elementToNode(
  elem: ShadrElement,
  parentId: string,
  graph: SceneGraph,
  parentWidth?: number
): SceneNode {
  if (elem.type === 'component') {
    const expanded = expandComponent(elem)
    if (expanded) {
      return elementToNode(expanded, parentId, graph, parentWidth)
    }
  }

  const { x, y, width, height } = resolveElementBounds(elem, parentWidth)
  const shadrData = buildShadrNodeData(elem)

  const props: Partial<SceneNode> = {
    name: resolveElementDisplayName(elem),
    x,
    y,
    width,
    height,
    locked: isShadrBackgroundElement(elem),
    pluginData: [
      { pluginId: SHADR_PLUGIN_ID, key: SHADR_DATA_KEY, value: JSON.stringify(shadrData) }
    ]
  }

  applyVisualProps(elem, props)
  const nodeType = configureNodeTypeAndProps(elem, props, parentWidth)
  const createdNode = graph.createNode(nodeType, parentId, props)

  appendElementChildren(elem, createdNode, graph, width)
  return createdNode
}
