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

/** Pulls all backend pages and components into a unified OpenPencil project */
export async function pullProject(editor: EditorStore): Promise<boolean> {
  isSyncing.value = true
  lastError.value = null
  try {
    const [pageIds, compIds] = await Promise.all([
      pageService.list(),
      componentService.list().catch((): string[] => [])
    ])

    const [pages, componentsList] = await Promise.all([
      Promise.all(pageIds.map((id) => pageService.get(id))),
      Promise.all(compIds.map((id) => componentService.get(id).catch(() => null)))
    ])

    const compMap: Record<string, ShadrComponent> = {}
    compIds.forEach((id, i) => {
      const comp = componentsList[i]
      if (comp) compMap[id] = comp
    })

    const graph = shadrConverter.importProject(pages, compMap)
    editor.replaceGraph(graph)
    editor.undo.clear()
    editor.clearSelection()

    serverPages.value = pageIds
    serverComponents.value = compIds
    currentDocumentType.value = 'page'

    const firstPage = graph.getPages()[0]
    if (firstPage) {
      selectedPageId.value = firstPage.name
      currentDocumentId.value = firstPage.name
      await editor.switchPage(firstPage.id)
    }

    status.value = 'online'
    toast.info(`Проект загружен: ${pages.length} сцен, ${compIds.length} компонентов!`)
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    lastError.value = msg
    toast.error(`Ошибка загрузки проекта: ${msg}`)
    return false
  } finally {
    isSyncing.value = false
  }
}

/** Pushes all scenes and components in the project back to the backend */
export async function pushProject(editor: EditorStore): Promise<boolean> {
  isSyncing.value = true
  lastError.value = null
  try {
    const { pages, components } = shadrConverter.exportProject(editor)

    await Promise.all([
      ...pages.map((p) => pageService.save(p.name, p)),
      ...Object.entries(components).map(([name, comp]) => componentService.save(name, comp))
    ])

    status.value = 'online'
    toast.info(`Весь проект сохранен: ${pages.length} сцен, ${Object.keys(components).length} компонентов!`)
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    lastError.value = msg
    toast.error(`Ошибка синхронизации проекта: ${msg}`)
    return false
  } finally {
    isSyncing.value = false
  }
}

/** Switches the canvas to a specific scene by name */
export async function switchScene(sceneName: string, editor: EditorStore): Promise<boolean> {
  const targetPage = editor.graph.getPages().find((p) => p.name === sceneName)
  if (!targetPage) return false

  await editor.switchPage(targetPage.id)
  selectedPageId.value = sceneName
  currentDocumentId.value = sceneName
  currentDocumentType.value = sceneName === '_components' ? 'component' : 'page'
  return true
}

/** Creates a new scene (page) inside the current project */
export async function createScene(sceneName: string, editor: EditorStore): Promise<boolean> {
  const cleanName = sceneName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')
  if (!cleanName) return false

  const graph = editor.graph
  const existing = graph.getPages().find((p) => p.name === cleanName)
  if (existing) {
    await editor.switchPage(existing.id)
    return true
  }

  const pageNode = graph.createNode('CANVAS', graph.rootId, { name: cleanName, width: 0, height: 0 })
  graph.createNode('FRAME', pageNode.id, {
    name: cleanName,
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    fills: [{ type: 'SOLID', color: { r: 0.05, g: 0.05, b: 0.08, a: 1 }, opacity: 1, visible: true }]
  })

  await editor.switchPage(pageNode.id)
  selectedPageId.value = cleanName
  currentDocumentId.value = cleanName
  currentDocumentType.value = 'page'

  if (!serverPages.value.includes(cleanName)) {
    serverPages.value.push(cleanName)
  }

  toast.info(`Создана сцена "${cleanName}"`)
  return true
}

/** Pulls a single page from backend into current canvas */
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
    toast.info(`Сцена "${pageId}" успешно загружена с сервера!`)
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    lastError.value = msg
    toast.error(`Ошибка загрузки сцены "${pageId}": ${msg}`)
    return false
  } finally {
    isSyncing.value = false
  }
}

/** Pushes the current active scene to backend */
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
    toast.info(`Сцена "${page.name}" успешно сохранена на Minecraft сервер!`)
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    lastError.value = msg
    toast.error(`Ошибка сохранения сцены: ${msg}`)
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
