import { setCookie } from '@/app/integrations/shadr/store/cookie'
import {
  COOKIE_KEY_TOKEN,
  lastError,
  selectedComponentId,
  selectedPageId,
  serverComponents,
  serverPages,
  serverUrl,
  status,
  STORAGE_KEY_URL,
  token
} from '@/app/integrations/shadr/store/state'

import { componentService } from './component.service'
import { pageService } from './page.service'

export async function checkConnection(): Promise<boolean> {
  status.value = 'connecting'
  lastError.value = null
  try {
    const [pages, components] = await Promise.all([
      pageService.list(),
      componentService.list().catch((): string[] => [])
    ])
    serverPages.value = pages
    if (pages.length > 0 && !pages.includes(selectedPageId.value)) {
      selectedPageId.value = pages[0]
    }

    if (components.length > 0) {
      serverComponents.value = components
      if (!components.includes(selectedComponentId.value)) {
        selectedComponentId.value = components[0]
      }
    }

    status.value = 'online'
    return true
  } catch (err) {
    status.value = 'offline'
    lastError.value = err instanceof Error ? err.message : String(err)
    return false
  }
}

export function saveCredentials(newUrl: string, newToken: string) {
  serverUrl.value = newUrl.trim()
  token.value = newToken.trim()

  setCookie(COOKIE_KEY_TOKEN, token.value)

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_URL, serverUrl.value)
  }
  void checkConnection()
}
