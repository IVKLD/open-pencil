import type { SceneNode } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

/** Applies standard Figma/OpenPencil canvas page background so it doesn't fall back to light gray */
export function setCanvasPageBackground(page: SceneNode, theme: 'dark' | 'light' = 'dark'): void {
  const color =
    theme === 'dark'
      ? { r: 0x1e / 255, g: 0x1e / 255, b: 0x1e / 255, a: 1 }
      : { r: 0.96, g: 0.96, b: 0.96, a: 1 }
  page.source.fig.rawNodeFields.backgroundColor = { ...color }
  page.source.fig.rawNodeFields.backgroundPaints = [
    { type: 'SOLID', color: { ...color }, opacity: 1, visible: true, blendMode: 'NORMAL' }
  ]
}

export function colorToShadrHex(c?: Color): string {
  if (!c) return 'ffffff'
  const r = Math.round(Math.max(0, Math.min(1, c.r)) * 255)
    .toString(16)
    .padStart(2, '0')
  const g = Math.round(Math.max(0, Math.min(1, c.g)) * 255)
    .toString(16)
    .padStart(2, '0')
  const b = Math.round(Math.max(0, Math.min(1, c.b)) * 255)
    .toString(16)
    .padStart(2, '0')
  return `${r}${g}${b}`
}

export function shadrHexToColor(
  hex: string | number,
  opacity?: number
): { color: Color; opacity: number } {
  let hexStr: string
  if (typeof hex === 'number') {
    // 70.0 is the YAML 1.1 scientific notation parser bug for '70e000' (accent green)
    hexStr = hex === 70 ? '70e000' : hex.toString(16).padStart(6, '0')
  } else {
    hexStr = String(hex)
  }
  const clean = hexStr.replace(/^#/, '').trim()
  const r = Number.parseInt(clean.slice(0, 2), 16) / 255 || 0
  const g = Number.parseInt(clean.slice(2, 4), 16) / 255 || 0
  const b = Number.parseInt(clean.slice(4, 6), 16) / 255 || 0
  const op = opacity !== undefined ? Math.max(0, Math.min(1, opacity / 255)) : 1
  return { color: { r, g, b, a: 1 }, opacity: op }
}
