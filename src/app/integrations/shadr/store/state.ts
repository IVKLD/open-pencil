import { computed, ref } from 'vue'

import { getCookie } from './cookie'

export type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'offline'

export const COOKIE_KEY_TOKEN = 'shadr_user_key'

// Server IP / Domain is strictly taken from environment variables
const ENV_URL =
  import.meta.env?.VITE_SHADR_API_URL ||
  import.meta.env?.VITE_SHADR_URL ||
  'http://localhost:8128/api/v1'

export const serverURL = ref(ENV_URL)

export const serverHost = computed(() => {
  try {
    const parsed = new URL(serverURL.value)
    return parsed.host || parsed.hostname
  } catch {
    return serverURL.value.replace(/^https?:\/\//, '').split('/')[0] || 'shadr-server'
  }
})

// Security key is accepted from user (stored in session cookie)
export const token = ref(getCookie(COOKIE_KEY_TOKEN) || '')

export const status = ref<ConnectionStatus>('idle')
export const isOnline = computed(() => status.value === 'online')
export const isConnecting = computed(() => status.value === 'connecting')
export const isSyncing = ref(false)

export const serverPages = ref<string[]>([])
export const selectedPageId = ref<string>('main_menu')
export const serverComponents = ref<string[]>([])
export const selectedComponentId = ref<string>('button')

export const currentDocumentType = ref<'page' | 'component'>('page')
export const currentDocumentId = ref<string>('main_menu')

export const lastError = ref<string | null>(null)
