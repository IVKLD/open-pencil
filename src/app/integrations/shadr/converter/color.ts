import type { Color } from '@open-pencil/scene-graph/primitives'

export function colorToShadrHex(c?: Color): string {
  if (!c) return 'ffffff'
  const r = Math.round(Math.max(0, Math.min(1, c.r)) * 255).toString(16).padStart(2, '0')
  const g = Math.round(Math.max(0, Math.min(1, c.g)) * 255).toString(16).padStart(2, '0')
  const b = Math.round(Math.max(0, Math.min(1, c.b)) * 255).toString(16).padStart(2, '0')
  return `${r}${g}${b}`
}

export function shadrHexToColor(
  hex: string | number,
  opacity?: number
): { color: Color; opacity: number } {
  const hexStr = typeof hex === 'number' ? hex.toString(16).padStart(6, '0') : String(hex)
  const clean = hexStr.replace(/^#/, '').trim()
  const r = parseInt(clean.slice(0, 2), 16) / 255 || 0
  const g = parseInt(clean.slice(2, 4), 16) / 255 || 0
  const b = parseInt(clean.slice(4, 6), 16) / 255 || 0
  const op = opacity !== undefined ? Math.max(0, Math.min(1, opacity / 255)) : 1
  return { color: { r, g, b, a: 1 }, opacity: op }
}
