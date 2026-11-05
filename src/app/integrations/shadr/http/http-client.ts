import { serverUrl, token } from '../store/state'

const ENV_URL = (import.meta.env?.VITE_SHADR_API_URL || '').replace(/\/+$/, '')

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = serverUrl.value.replace(/\/+$/, '')
  const currentToken = token.value.trim()
  const fullUrl = `${baseUrl}${path}`

  const isBrowser = typeof window !== 'undefined'
  const isCrossOrigin =
    isBrowser &&
    typeof window.location !== 'undefined' &&
    !fullUrl.startsWith(window.location.origin) &&
    /^https?:\/\//.test(fullUrl)

  let url = fullUrl
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${currentToken}`,
    ...(options.headers as Record<string, string>)
  }

  if (isCrossOrigin) {
    // If targeting the configured backend, use Vite's native dev server proxy
    if (!baseUrl || baseUrl === ENV_URL || baseUrl.includes('167.233.151.217')) {
      url = `/api/shadr${path}`
    } else {
      url = '/api/shadr-proxy'
      headers['x-target-url'] = fullUrl
    }
  }

  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json; charset=utf-8'
  }

  const res = await fetch(url, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err.errors?.[0]?.message || err.error || `HTTP ${res.status}: ${res.statusText}`
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}
