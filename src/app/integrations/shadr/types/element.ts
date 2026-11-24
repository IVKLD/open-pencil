import type {
  ShadrPosition,
  ShadrRounding,
  ShadrScreen,
  ShadrScrollRegion,
  ShadrSize
} from './document'

export type ShadrElementType =
  | 'block'
  | 'block_rounded'
  | 'circle'
  | 'gradient'
  | 'blur'
  | 'progress'
  | 'block_sdf'
  | 'text'
  | 'item'
  | 'shader'
  | 'image'
  | 'video'
  | 'hitbox'
  | 'text_input'
  | 'toggle'
  | 'slider'
  | 'grid_block'
  | 'component'
  | 'scrollRegion'

export interface ShadrCommonBlockProps {
  placeholder?: string
  placeholderColor?: string
  hint?: string
  maxLength?: number
  fontSize?: number
  textColor?: string
  video?: string
  stream?: boolean
  item?: string
  customModelData?: number | string
  itemDisplay?: string
  shader?: string
  min?: number | string
  max?: number | string
  step?: number | string
  value?: number | string | boolean
  checked?: boolean
  permission?: string
  align?: string
  scrollRegion?: string
  scrollbarFor?: string
  draggable?: boolean
  dragGroup?: string
  dragBounds?: {
    x: number | string
    y: number | string
    width: number | string
    height: number | string
  }
  hoverText?: string
  enabled?: boolean | string
  interactive?: boolean
  hoverEffect?: string
  clickEffect?: string
  onClickAction?: string[]
  onSubmitAction?: string[]
  onLeftClickAction?: string[]
  onRightClickAction?: string[]
  onChangeAction?: string[]
}

export interface ShadrElement extends ShadrCommonBlockProps {
  type: ShadrElementType
  id: string
  layer?: number
  position?: ShadrPosition
  size?: ShadrSize
  color?: string | number
  opacity?: number
  rounding?: ShadrRounding
  text?: string
  font?: string
  textAlign?: 'left' | 'center' | 'right'
  lineWidth?: number
  direction?: 'row' | 'column'
  gap?: number
  children?: ShadrElement[]
  component?: string
  params?: Record<string, ShadrParamValue>
  image?: string
  fit?: 'contain' | 'cover' | 'fill'
  outline?: { size: number; color: string }
}

export type ShadrParamValue = string | number | boolean

export interface ShadrAnimationStep {
  target: string
  axis: string
  easing: string
  from: number
  to: number
  duration: number
}

export interface ShadrAnimation {
  name: string
  durationTicks: number
  steps: ShadrAnimationStep[]
}

export interface ShadrNodeData extends ShadrCommonBlockProps {
  blockId?: string
  rawType?: ShadrElementType
  rawColor?: string | number
  rawOpacity?: number
  rawRounding?: ShadrRounding
  rawLineWidth?: number
  rawPosition?: ShadrPosition
  rawSize?: ShadrSize
  layer?: number
  componentName?: string
  componentParams?: Record<string, ShadrParamValue>
  customFont?: string
  textureName?: string
  imageFit?: 'contain' | 'cover' | 'fill'
  rawText?: string
  isScrollRegion?: boolean
  scrollRegionId?: string
  scrollRegions?: ShadrScrollRegion[]
  contentHeight?: number | string
  screen?: ShadrScreen
  animations?: ShadrAnimation[]
  rootBlock?: Partial<ShadrElement>
  auxiliaryBlocks?: ShadrElement[]
}
