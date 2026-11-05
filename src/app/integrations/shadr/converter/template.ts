import type { ShadrComponent, ShadrElement } from '../types'
import { BUILTIN_COMPONENTS } from './builtin-templates'

export class ComponentRegistry {
  readonly #templates = new Map<string, ShadrComponent>()

  constructor() {
    this.resetToDefaults()
  }

  resetToDefaults(): void {
    this.#templates.clear()
    for (const [key, comp] of Object.entries(BUILTIN_COMPONENTS)) {
      this.#templates.set(key, comp)
    }
  }

  get(name: string): ShadrComponent | undefined {
    return this.#templates.get(name)
  }

  set(name: string, template: ShadrComponent): void {
    this.#templates.set(name, template)
  }

  has(name: string): boolean {
    return this.#templates.has(name)
  }

  list(): string[] {
    return Array.from(this.#templates.keys())
  }
}

export const componentRegistry = new ComponentRegistry()

function interpolateValue(val: unknown, params: Record<string, unknown>): unknown {
  if (typeof val === 'string') {
    const singleMatch = val.match(/^\$\{([a-zA-Z0-9_]+)\}$/)
    if (singleMatch) {
      const key = singleMatch[1]
      if (params[key] !== undefined) return params[key]
    }
    return val.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
      const pVal = params[key]
      return pVal !== undefined ? String(pVal) : `\${${key}}`
    })
  }
  if (Array.isArray(val)) {
    return val.map((item) => interpolateValue(item, params))
  }
  if (val && typeof val === 'object') {
    const res: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(val)) {
      res[k] = interpolateValue(v, params)
    }
    return res
  }
  return val
}

export function interpolateElement(
  elem: ShadrElement,
  params: Record<string, unknown>
): ShadrElement {
  return interpolateValue(elem, params) as ShadrElement
}

/** Expands a component instance element into concrete Shadr element tree using its template */
export function expandComponent(elem: ShadrElement): ShadrElement | null {
  if (!elem.component) return null
  const template = componentRegistry.get(elem.component)
  if (!template || !template.blocks || template.blocks.length === 0) return null

  const compParams: Record<string, unknown> = {
    ...(template.params ?? {}),
    ...(elem.params ?? {}),
    id: elem.params?.id || elem.id
  }

  const rootBlock = template.blocks[0]
  const expanded = interpolateElement(rootBlock, compParams)

  expanded.component = elem.component
  expanded.params = compParams

  if (elem.position) {
    expanded.position = { ...elem.position }
  }

  return expanded
}
