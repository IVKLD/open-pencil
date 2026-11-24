import type { ShadrAnimation, ShadrElement, ShadrParamValue } from './element'

export interface ShadrScreen {
  width: number
  height: number
  cursorSize?: number
  cursorSpeed?: number
  cursorLayer?: number
  offsetX?: number
  offsetY?: number
}

export interface ShadrPosition {
  x: number | string
  y: number | string
}

export interface ShadrSize {
  width: number | string
  height: number | string
}

export interface ShadrRounding {
  radius?: number
  size?: 'small' | 'medium' | 'large' | 'regular' | string
}

export interface ShadrScrollRegion {
  id: string
  x: number | string
  y: number | string
  width: number | string
  height: number | string
  contentHeight?: number | string
  step?: number | string
}

export interface ShadrPage {
  name: string
  screen: ShadrScreen
  blocks: ShadrElement[]
  animations?: ShadrAnimation[]
  scrollRegions?: ShadrScrollRegion[]
}

export interface ShadrComponent {
  params: Record<string, ShadrParamValue>
  blocks: ShadrElement[]
}

export interface ShadrEffect {
  id?: string
  name?: string
  moveX?: number | string
  moveY?: number | string
  opacityDelta?: number | string
  rotationDeg?: number | string
  durationMs?: number | string
  scaleX?: number | string
  scaleY?: number | string
  interpolation?: string
}

export type ShadrLang = Record<string, string>

export interface ShadrGrading {
  exposure?: number | string
  contrast?: number | string
  saturation?: number | string
  vibrance?: number | string
  temperature?: number | string
  tint?: number | string
  vignette?: number | string
  tonemap?: string | number
  shadows?: string
  midtones?: string
  highlights?: string
}
