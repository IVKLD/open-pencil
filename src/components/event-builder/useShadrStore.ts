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
  serverHost,
  serverPages,
  serverURL,
  status,
  token
} from '@/app/integrations/shadr/store/state'

import { checkConnection, saveUserKey } from './services/connection.service'
import { sceneCreatorService } from './services/scene-creator.service'
import {
  getChangedScenes,
  insertComponentInstance,
  pullComponent,
  pullComponents,
  pullPage,
  pullProject,
  pushChangedScenes,
  pushCurrentComponent,
  pushCurrentPage,
  pushProject,
  switchScene
} from './services/sync.service'

export function useShadrStore() {
  return {
    serverURL,
    serverHost,
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
    saveUserKey,
    checkConnection,
    pullProject,
    pullComponents,
    pushProject,
    switchScene,
    createScene: sceneCreatorService.createScene,
    pullPage,
    pushCurrentPage,
    pushChangedScenes,
    getChangedScenes,
    pullComponent,
    pushCurrentComponent,
    insertComponentInstance
  }
}
