import { computed, ref } from 'vue'

import { randomHex } from '@open-pencil/scene-graph/random'

export interface HttpRequestLog {
  id: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | string
  url: string
  status: 'pending' | 'success' | 'error'
  statusCode?: number
  durationMs?: number
  timestamp: Date
  timeFormatted: string
  errorMessage?: string
}

const MAX_LOG_ENTRIES = 25

export const requestLogs = ref<HttpRequestLog[]>([])
export const activeRequestsCount = ref(0)
export const isNetworkActive = computed(() => activeRequestsCount.value > 0)
export const lastRequest = computed<HttpRequestLog | undefined>(() => requestLogs.value[0])

export function createRequestLog(method: string, url: string): string {
  const id = randomHex(8)
  const now = new Date()
  const timeFormatted = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  // Normalize displayed URL (strip full base host if internal proxy)
  const displayURL = url.replace(/^\/api\/shadr/, '').replace(/^https?:\/\/[^/]+/, '') || url

  const entry: HttpRequestLog = {
    id,
    method: method.toUpperCase(),
    url: displayURL,
    status: 'pending',
    timestamp: now,
    timeFormatted
  }

  requestLogs.value = [entry, ...requestLogs.value.slice(0, MAX_LOG_ENTRIES - 1)]
  activeRequestsCount.value++
  return id
}

export function completeRequestSuccess(id: string, statusCode: number, startTime?: number): void {
  const item = requestLogs.value.find((r) => r.id === id)
  if (item) {
    item.status = 'success'
    item.statusCode = statusCode
    if (startTime) {
      item.durationMs = Math.max(1, Math.round(performance.now() - startTime))
    }
  }
  activeRequestsCount.value = Math.max(0, activeRequestsCount.value - 1)
}

export function completeRequestError(
  id: string,
  statusCode: number | undefined,
  errorMessage: string,
  startTime?: number
): void {
  const item = requestLogs.value.find((r) => r.id === id)
  if (item) {
    item.status = 'error'
    item.statusCode = statusCode
    item.errorMessage = errorMessage
    if (startTime) {
      item.durationMs = Math.max(1, Math.round(performance.now() - startTime))
    }
  }
  activeRequestsCount.value = Math.max(0, activeRequestsCount.value - 1)
}

export function clearRequestLogs(): void {
  requestLogs.value = []
}
