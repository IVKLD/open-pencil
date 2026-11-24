export type ActionType =
  | 'sound'
  | 'open'
  | 'redirect'
  | 'close'
  | 'set'
  | 'command'
  | 'message'
  | 'url'
  | 'scroll'
  | 'custom'

export interface ParsedAction {
  raw: string
  type: ActionType
  value: string
}

export const SOUND_PRESETS = [
  { value: 'shadr.click', label: 'Клик (shadr.click)' },
  { value: 'shadr.close', label: 'Закрытие (shadr.close)' },
  { value: 'shadr.hover', label: 'Наведение (shadr.hover)' },
  { value: 'shadr.open', label: 'Открытие (shadr.open)' },
  { value: 'shadr.error', label: 'Ошибка (shadr.error)' },
  { value: 'custom', label: 'Свой звук (из ресурспака)...' }
]

export const COMMON_SOUNDS = [
  'shadr.click',
  'shadr.close',
  'shadr.hover',
  'shadr.open',
  'shadr.error'
]

const ACTION_PREFIXES = new Set<ActionType>([
  'sound',
  'open',
  'redirect',
  'close',
  'set',
  'command',
  'message',
  'url',
  'scroll'
])

export function parseAction(raw: string = ''): ParsedAction {
  if (typeof raw !== 'string' || !raw) {
    return { raw: '', type: 'custom', value: '' }
  }
  const colonIdx = raw.indexOf(':')
  if (colonIdx === -1) {
    return { raw, type: 'custom', value: raw }
  }
  const prefix = raw.slice(0, colonIdx).trim().toLowerCase() as ActionType
  const value = raw.slice(colonIdx + 1).trim()

  return ACTION_PREFIXES.has(prefix)
    ? { raw, type: prefix, value }
    : { raw, type: 'custom', value: raw }
}

export function buildActionString(
  type: ActionType,
  paramValue: string = '',
  scrollRegion: string = 'tasks',
  scrollDirection: 'up' | 'down' = 'up'
): string {
  const val = (paramValue ?? '').trim()
  if (type === 'close') return 'close:'
  if (type === 'scroll') return `scroll: ${scrollRegion.trim()} ${scrollDirection}`
  if (type === 'custom') return val
  return `${type}: ${val}`
}
