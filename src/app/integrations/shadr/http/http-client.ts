import { serverUrl, token } from '../store/state'

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = serverUrl.value.replace(/\/+$/, '')
  const currentToken = token.value.trim()
  const isBrowser = typeof window !== 'undefined'

  // In browser development, use the Vite dev server proxy to avoid CORS issues
  const url = isBrowser ? `/api/shadr${path}` : `${baseUrl}${path}`

  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${currentToken}`,
    ...(options.headers as Record<string, string>)
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
