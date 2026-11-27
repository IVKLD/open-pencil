import { createFetch, type FetchOptions } from 'ofetch'

import { IS_BROWSER } from '@/constants'

import { serverURL, token } from '../store/state'
import {
  clearRequestLogs,
  completeRequestError,
  completeRequestSuccess,
  createRequestLog,
  isNetworkActive,
  requestLogs
} from './activity'

export { clearRequestLogs, isNetworkActive, requestLogs }
export type { HttpRequestLog } from './activity'

export type HttpBody = RequestInit['body'] | object

const requestMetaMap = new WeakMap<FetchOptions, { logId: string; startTime: number }>()

/**
 * Declarative Shadr API fetch client using `ofetch` (UnJS) with automatic
 * JSON serialization/parsing, interceptors for Bearer auth, activity tracking, and dev proxy resolution.
 */
export const shadrFetch = createFetch().create({
  timeout: 10000,
  onRequest({ request, options }) {
    const rawURL = serverURL.value.replace(/\/+$/, '')
    const currentToken = token.value.trim()

    options.baseURL = IS_BROWSER ? '/api/shadr' : rawURL

    const headers = new Headers(options.headers)
    if (currentToken) {
      headers.set('Authorization', `Bearer ${currentToken}`)
    }
    if (
      options.body !== undefined &&
      !(options.body instanceof Uint8Array) &&
      !(options.body instanceof Blob) &&
      !(options.body instanceof ArrayBuffer) &&
      !headers.has('Content-Type')
    ) {
      headers.set('Content-Type', 'application/json; charset=utf-8')
    }
    options.headers = headers

    const method = options.method || 'GET'
    const url = typeof request === 'string' ? request : (request as Request).url || ''
    const logId = createRequestLog(method, url)
    requestMetaMap.set(options, { logId, startTime: performance.now() })
  },
  onResponse({ options, response }) {
    const meta = requestMetaMap.get(options)
    if (meta && response.ok) {
      completeRequestSuccess(meta.logId, response.status, meta.startTime)
    }
  },
  onResponseError({ options, response }) {
    const meta = requestMetaMap.get(options)
    const err = response._data as
      | { errors?: Array<{ message?: string }>; error?: string }
      | undefined
    const msg =
      err?.errors?.[0]?.message || err?.error || `HTTP ${response.status}: ${response.statusText}`
    if (meta) {
      completeRequestError(meta.logId, response.status, msg, meta.startTime)
    }
  },
  onRequestError({ options, error }) {
    const meta = requestMetaMap.get(options)
    const msg = error instanceof Error ? error.message : 'Ошибка соединения с сервером'
    if (meta) {
      completeRequestError(meta.logId, undefined, msg, meta.startTime)
    }
  }
})

/**
 * Angular-like HTTP client with clean declarative methods:
 * `http.get<T>(url)`, `http.post<T>(url, body)`, `http.put<T>(url, body)`, `http.delete(url)`, etc.
 */
export const http = {
  get<T>(url: string, options?: FetchOptions<'json'>): Promise<T> {
    return shadrFetch<T, 'json'>(url, { ...options, method: 'GET' })
  },

  post<T>(url: string, body?: HttpBody, options?: FetchOptions<'json'>): Promise<T> {
    return shadrFetch<T, 'json'>(url, { ...options, method: 'POST', body })
  },

  put<T>(url: string, body?: HttpBody, options?: FetchOptions<'json'>): Promise<T> {
    return shadrFetch<T, 'json'>(url, { ...options, method: 'PUT', body })
  },

  delete<T>(url: string, options?: FetchOptions<'json'>): Promise<T> {
    return shadrFetch<T, 'json'>(url, { ...options, method: 'DELETE' })
  },

  async binary(url: string, options?: FetchOptions<'arrayBuffer'>): Promise<Uint8Array> {
    const buffer = await shadrFetch<ArrayBuffer, 'arrayBuffer'>(url, {
      ...options,
      responseType: 'arrayBuffer'
    })
    return new Uint8Array(buffer)
  },

  async putBinary(
    url: string,
    data: Uint8Array | Blob,
    contentType = 'image/png',
    options?: FetchOptions
  ): Promise<void> {
    const headers = new Headers(options?.headers)
    headers.set('Content-Type', contentType)
    await shadrFetch(url, {
      ...options,
      method: 'PUT',
      headers,
      body: data
    })
  }
}
