import { describe, expect, test } from 'bun:test'

import { http } from '@/app/integrations/shadr/http/http-client'
import { serverURL, token } from '@/app/integrations/shadr/store/state'
import { pageService } from '@/components/event-builder/services/config.service'

const testToken = process.env.SHADR_TOKEN

describe('Shadr Page Service Integration', () => {
  if (testToken) {
    token.value = testToken
  }
  if (process.env.SHADR_URL) {
    serverURL.value = process.env.SHADR_URL
  }

  test.skipIf(!testToken)('list returns existing page ids', async () => {
    const pages = await pageService.list()
    expect(pages).toContain('main_menu')
    expect(pages).toContain('shop')
  })

  test.skipIf(!testToken)('get fetches main_menu page definition', async () => {
    const page = await pageService.get('main_menu')
    expect(page.name).toBe('main_menu')
    expect(page.screen.width).toBe(1920)
    expect(page.screen.height).toBe(1080)
    expect(page.blocks.length).toBeGreaterThan(0)
  })
})

describe('Shadr HttpClient Declarative API', () => {
  test('http methods are defined and callable', () => {
    expect(typeof http.get).toBe('function')
    expect(typeof http.post).toBe('function')
    expect(typeof http.put).toBe('function')
    expect(typeof http.delete).toBe('function')
    expect(typeof http.binary).toBe('function')
    expect(typeof http.putBinary).toBe('function')
  })

  test('tracks network request lifecycle with status, duration, and error reporting', async () => {
    const {
      clearRequestLogs,
      completeRequestError,
      completeRequestSuccess,
      createRequestLog,
      isNetworkActive,
      requestLogs
    } = await import('@/app/integrations/shadr/http/activity')

    clearRequestLogs()
    expect(requestLogs.value.length).toBe(0)
    expect(isNetworkActive.value).toBe(false)

    // 1. Pending request
    const id = createRequestLog('GET', '/api/shadr/pages')
    expect(requestLogs.value.length).toBe(1)
    expect(isNetworkActive.value).toBe(true)
    expect(requestLogs.value[0].status).toBe('pending')
    expect(requestLogs.value[0].method).toBe('GET')
    expect(requestLogs.value[0].url).toBe('/pages')

    // 2. Successful response
    completeRequestSuccess(id, 200, performance.now() - 35)
    expect(isNetworkActive.value).toBe(false)
    expect(requestLogs.value[0].status).toBe('success')
    expect(requestLogs.value[0].statusCode).toBe(200)
    expect(requestLogs.value[0].durationMs).toBeGreaterThan(0)

    // 3. Error response
    const errId = createRequestLog('POST', '/api/shadr/pages/main_menu')
    expect(isNetworkActive.value).toBe(true)
    completeRequestError(errId, 401, 'Unauthorized', performance.now() - 10)
    expect(isNetworkActive.value).toBe(false)
    expect(requestLogs.value[0].status).toBe('error')
    expect(requestLogs.value[0].statusCode).toBe(401)
    expect(requestLogs.value[0].errorMessage).toBe('Unauthorized')

    // 4. Clear logs
    clearRequestLogs()
    expect(requestLogs.value.length).toBe(0)
  })
})
