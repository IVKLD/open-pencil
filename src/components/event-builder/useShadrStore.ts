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
  createScene,
  pullComponent,
  pullPage,
  pullProject,
  pushCurrentComponent,
  pushCurrentPage,
  pushProject,
  switchScene
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
    pullProject,
    pushProject,
    switchScene,
    createScene,
    pullPage,
    pushCurrentPage,
    pullComponent,
    pushCurrentComponent,
    insertComponentInstance: componentService.insertComponentInstance
  }
}
