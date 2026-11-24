import type { ShadrComponent, ShadrElement, ShadrParamValue } from '../types'

/** Global registry of loaded Shadr component templates */
export const componentRegistry = new Map<string, ShadrComponent>()

function interpolateStr(str: string, params: Record<string, ShadrParamValue>): string {
  return str.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    const pVal = params[key]
    return pVal !== undefined ? String(pVal) : '${' + key + '}'
  })
}

function interpolateVal(
  val: string | number | boolean,
  params: Record<string, ShadrParamValue>
): string | number | boolean {
  if (typeof val !== 'string') return val
  const singleMatch = val.match(/^\$\{([a-zA-Z0-9_]+)\}$/)
  if (singleMatch) {
    const pVal = params[singleMatch[1]]
    if (pVal !== undefined) return pVal
  }
  return interpolateStr(val, params)
}

function interpolateCoord(
  val: string | number,
  params: Record<string, ShadrParamValue>
): string | number {
  if (typeof val !== 'string') return val
  let res: string | number | boolean = interpolateVal(val, params)
  if (typeof res === 'string') {
    for (const [key, pVal] of Object.entries(params)) {
      if (typeof pVal === 'number' || typeof pVal === 'string') {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        res = res.replace(new RegExp(`\\b${escaped}\\b`, 'g'), String(pVal))
      }
    }
  }
  return typeof res === 'boolean' ? String(res) : res
}

const TEXT_PROPS = ['id', 'text', 'image', 'font', 'textColor', 'placeholder'] as const

/** Interpolates parameters into a concrete ShadrElement */
export function interpolateElement(
  elem: ShadrElement,
  params: Record<string, ShadrParamValue>
): ShadrElement {
  const cloned: ShadrElement = { ...elem }

  for (const prop of TEXT_PROPS) {
    const str = cloned[prop]
    if (str) cloned[prop] = interpolateStr(str, params)
  }

  if (typeof cloned.color === 'string') {
    cloned.color = interpolateStr(cloned.color, params)
  }

  if (cloned.position) {
    cloned.position = {
      x: interpolateCoord(cloned.position.x, params),
      y: interpolateCoord(cloned.position.y, params)
    }
  }

  if (cloned.size) {
    cloned.size = {
      width: interpolateCoord(cloned.size.width, params),
      height: interpolateCoord(cloned.size.height, params)
    }
  }

  if (cloned.outline) {
    cloned.outline = {
      size: cloned.outline.size,
      color: interpolateStr(cloned.outline.color, params)
    }
  }

  if (cloned.rounding) {
    const nextSize = cloned.rounding.size ? interpolateVal(cloned.rounding.size, params) : undefined
    cloned.rounding = {
      ...cloned.rounding,
      ...(nextSize !== undefined
        ? { size: typeof nextSize === 'boolean' ? String(nextSize) : String(nextSize) }
        : {})
    }
  }

  if (cloned.onClickAction) {
    cloned.onClickAction = cloned.onClickAction.map((a) => interpolateStr(a, params))
  }

  if (cloned.onSubmitAction) {
    cloned.onSubmitAction = cloned.onSubmitAction.map((a) => interpolateStr(a, params))
  }

  if (cloned.children) {
    cloned.children = cloned.children.map((c) => interpolateElement(c, params))
  }

  if (cloned.params) {
    const nextParams: Record<string, ShadrParamValue> = {}
    for (const [k, v] of Object.entries(cloned.params)) {
      nextParams[k] = interpolateVal(v, params)
    }
    cloned.params = nextParams
  }

  return cloned
}

/** Expands a component instance element into concrete Shadr element tree using its template */
export function expandComponent(elem: ShadrElement): ShadrElement | null {
  if (!elem.component) return null
  const template = componentRegistry.get(elem.component)
  if (!template || !template.blocks || template.blocks.length === 0) return null

  const compParams: Record<string, ShadrParamValue> = {
    ...template.params,
    ...elem.params,
    id: elem.params?.id || elem.id
  }

  const rootBlock = template.blocks.find((b) => !b.id?.includes('scrim')) ?? template.blocks[0]
  const expanded = interpolateElement(rootBlock, compParams)

  expanded.component = elem.component
  expanded.params = compParams

  if (elem.position) {
    expanded.position = { ...elem.position }
  }

  return expanded
}
