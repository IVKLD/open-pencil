import {
  currentDocumentId,
  currentDocumentType,
  isConnecting,
  isOnline,
  isSyncing,
  lastError,
  selectedComponentId,
  selectedPageId,
  serverComponents,
  serverPages,
  serverUrl,
  status,
  token
} from '@/app/integrations/shadr/store/state'

import { componentService } from './services/component.service'
import { checkConnection, saveCredentials } from './services/connection.service'
import {
  pullComponent,
  pullPage,
  pushCurrentComponent,
  pushCurrentPage
} from './services/sync.service'

export function useShadrStore() {
  return {
    serverUrl,
    token,
    status,
    isOnline,
    isConnecting,
    isSyncing,
    serverPages,
    selectedPageId,
    serverComponents,
    selectedComponentId,
    currentDocumentType,
    currentDocumentId,
    lastError,
    saveCredentials,
    checkConnection,
    pullPage,
    pushCurrentPage,
    pullComponent,
    pushCurrentComponent,
    insertComponentInstance: componentService.insertComponentInstance
  }
}
