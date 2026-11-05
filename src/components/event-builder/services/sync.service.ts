import type { EditorStore } from '@/app/editor/active-store'
import { componentRegistry, shadrConverter } from '@/app/integrations/shadr/converter'
import {
  currentDocumentId,
  currentDocumentType,
  isSyncing,
  lastError,
  selectedComponentId,
  selectedPageId,
  serverComponents,
  serverPages,
  status
} from '@/app/integrations/shadr/store/state'
import type { ShadrComponent, ShadrPage } from '@/app/integrations/shadr/types'
import { toast } from '@/app/shell/ui'

import { componentService } from './component.service'
import { pageService } from './page.service'

export async function pullPage(pageId: string, editor: EditorStore): Promise<boolean> {
  if (!pageId) return false
  isSyncing.value = true
  lastError.value = null
  try {
    const pageData: ShadrPage = await pageService.get(pageId)
    const graph = shadrConverter.importPage(pageData)
    editor.replaceGraph(graph)
    editor.undo.clear()
    editor.clearSelection()
    selectedPageId.value = pageId
    currentDocumentType.value = 'page'
    currentDocumentId.value = pageId
    toast.info(`Страница "${pageId}" успешно загружена с сервера!`)
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    lastError.value = msg
    toast.error(`Ошибка загрузки страницы "${pageId}": ${msg}`)
    return false
  } finally {
    isSyncing.value = false
  }
}

export async function pushCurrentPage(editor: EditorStore, overrideName?: string): Promise<boolean> {
  isSyncing.value = true
  lastError.value = null
  try {
    const page = shadrConverter.exportPage(editor, overrideName || selectedPageId.value)
    await pageService.save(page.name, page)
    selectedPageId.value = page.name
    currentDocumentType.value = 'page'
    currentDocumentId.value = page.name
    if (!serverPages.value.includes(page.name)) {
      serverPages.value.push(page.name)
    }
    status.value = 'online'
    toast.info(`Страница "${page.name}" успешно сохранена на Minecraft сервер!`)
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    lastError.value = msg
    toast.error(`Ошибка сохранения: ${msg}`)
    return false
  } finally {
    isSyncing.value = false
  }
}

export async function pullComponent(componentId: string, editor: EditorStore): Promise<boolean> {
  if (!componentId) return false
  isSyncing.value = true
  lastError.value = null
  try {
    let compData: ShadrComponent
    try {
      compData = await componentService.get(componentId)
      componentRegistry.set(componentId, compData)
    } catch {
      const fallback = componentRegistry.get(componentId)
      if (!fallback) throw new Error(`Компонент "${componentId}" не найден`)
      compData = fallback
    }

    const graph = shadrConverter.importComponent(compData, componentId)
    editor.replaceGraph(graph)
    editor.undo.clear()
    editor.clearSelection()
    selectedComponentId.value = componentId
    currentDocumentType.value = 'component'
    currentDocumentId.value = componentId
    toast.info(`Компонент "${componentId}" загружен для редактирования!`)
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    lastError.value = msg
    toast.error(`Ошибка загрузки компонента "${componentId}": ${msg}`)
    return false
  } finally {
    isSyncing.value = false
  }
}

export async function pushCurrentComponent(editor: EditorStore, overrideName?: string): Promise<boolean> {
  isSyncing.value = true
  lastError.value = null
  try {
    const name = overrideName || selectedComponentId.value
    const comp = shadrConverter.exportComponent(editor, name)
    await componentService.save(name, comp)
    componentRegistry.set(name, comp)
    selectedComponentId.value = name
    currentDocumentType.value = 'component'
    currentDocumentId.value = name
    if (!serverComponents.value.includes(name)) {
      serverComponents.value.push(name)
    }
    status.value = 'online'
    toast.info(`Компонент "${name}" успешно сохранен на Minecraft сервер!`)
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    lastError.value = msg
    toast.error(`Ошибка сохранения компонента: ${msg}`)
    return false
  } finally {
    isSyncing.value = false
  }
}
