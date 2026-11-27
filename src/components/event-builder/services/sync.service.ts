import { ref } from 'vue'

import { randomHex } from '@open-pencil/scene-graph/random'

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
import type { ShadrComponent, ShadrElement, ShadrPage } from '@/app/integrations/shadr/types'
import { toast } from '@/app/shell/ui'

import { componentService, pageService } from './config.service'
import { imageService } from './image.service'

export const isComponentsLoading = ref(false)
let isAutoLoading = false

const sceneBaselines = new Map<string, string>()
const componentBaselines = new Map<string, string>()

export function recordSceneBaseline(name: string, page: ShadrPage): void {
  sceneBaselines.set(name.toLowerCase().replace(/[^a-z0-9_-]/g, '_'), JSON.stringify(page))
}

export function recordComponentBaseline(name: string, comp: ShadrComponent): void {
  componentBaselines.set(name.toLowerCase().replace(/[^a-z0-9_-]/g, '_'), JSON.stringify(comp))
}

export function clearBaselines(): void {
  sceneBaselines.clear()
  componentBaselines.clear()
}

/**
 * Detects the currently active scene name in the editor based on `currentPageId`
 * and keeps `selectedPageId` updated.
 */
export function syncActiveSceneWithEditor(editor: EditorStore): string {
  const pages = editor.graph.getPages().filter((p) => p.name !== '_components')
  const current = pages.find((p) => p.id === editor.state.currentPageId)
  if (current && current.name) {
    selectedPageId.value = current.name
    currentDocumentId.value = current.name
    currentDocumentType.value = 'page'
    return current.name
  }
  const firstValid = pages[0]
  const resolved = firstValid?.name || selectedPageId.value || 'main_menu'
  selectedPageId.value = resolved
  return resolved
}

/** Executes a sync operation with standard loading state, error catching and toast reporting */
async function withSync(actionName: string, fn: () => Promise<void>): Promise<boolean> {
  isSyncing.value = true
  lastError.value = null
  try {
    await fn()
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    lastError.value = msg
    toast.error(`${actionName}: ${msg}`)
    return false
  } finally {
    isSyncing.value = false
  }
}

/** Fetches all component definitions from backend and populates registry */
async function fetchAllComponents(): Promise<{
  ids: string[]
  map: Record<string, ShadrComponent>
}> {
  const ids = await componentService.list().catch((): string[] => [])
  const list = await Promise.all(ids.map((id) => componentService.get(id).catch(() => null)))
  const map: Record<string, ShadrComponent> = {}
  ids.forEach((id, i) => {
    const comp = list[i]
    if (comp) {
      map[id] = comp
      componentRegistry.set(id, comp)
    }
  })
  return { ids, map }
}

/** Pulls all backend pages and components into a unified OpenPencil project */
export async function pullProject(editor: EditorStore): Promise<boolean> {
  return withSync('Ошибка загрузки проекта', async () => {
    const [pageIds, { ids: compIds, map: compMap }] = await Promise.all([
      pageService.list(),
      fetchAllComponents()
    ])

    const pages = await Promise.all(pageIds.map((id) => pageService.get(id)))
    const theme = editor.state.theme ?? 'dark'
    const graph = shadrConverter.importProject(pages, compMap, theme)
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

    await imageService.preloadGraphTextures(editor)

    // Record canonical baselines for all loaded scenes
    const sceneNames = shadrConverter.listProjectSceneNames(editor)
    for (const sceneName of sceneNames) {
      const exported = shadrConverter.exportPage(editor, sceneName)
      recordSceneBaseline(exported.name, exported)
    }

    // Record canonical baselines for all components
    const compPage = graph.getPages().find((p) => p.name === '_components')
    if (compPage) {
      for (const compNode of graph.getChildren(compPage.id)) {
        const exported = shadrConverter.exportComponent(editor, compNode.name)
        recordComponentBaseline(compNode.name, exported)
      }
    }

    status.value = 'online'
    toast.info(`Проект загружен: ${pages.length} сцен, ${compIds.length} компонентов!`)
  })
}

/** Pulls only components from backend into the current canvas Assets (_components page) */
export async function pullComponents(editor: EditorStore): Promise<boolean> {
  isComponentsLoading.value = true
  try {
    return await withSync('Ошибка загрузки компонентов', async () => {
      const { ids: compIds, map: compMap } = await fetchAllComponents()
      serverComponents.value = compIds
      shadrConverter.importComponentsIntoGraph(editor.graph, compMap)
      editor.state.sceneVersion++
      editor.requestRender()

      const count = Object.keys(compMap).length
      toast.info(`Компоненты загружены в Assets: ${count} шт.!`)
    })
  } finally {
    isComponentsLoading.value = false
  }
}

/** Automatically loads components from Shadr into Assets without alerts if not present yet */
export async function autoLoadShadrComponents(editor: EditorStore): Promise<boolean> {
  const hasComponents = editor.graph.getPages().some((p) => p.name === '_components')
  if (hasComponents || isAutoLoading) return false

  isAutoLoading = true
  isComponentsLoading.value = true
  try {
    const { ids: compIds, map: compMap } = await fetchAllComponents()
    if (compIds.length === 0 || Object.keys(compMap).length === 0) return false

    serverComponents.value = compIds
    shadrConverter.importComponentsIntoGraph(editor.graph, compMap)
    status.value = 'online'
    editor.state.sceneVersion++
    editor.requestRender()
    return true
  } catch {
    return false
  } finally {
    isAutoLoading = false
    isComponentsLoading.value = false
  }
}

/** Resolves the best parent container for inserting an element or component */
export function resolveInsertParent(editor: EditorStore): string {
  const graph = editor.graph
  const selectedId = [...editor.state.selectedIds][0]
  if (selectedId) {
    const selected = graph.getNode(selectedId)
    if (selected) {
      if (selected.type === 'FRAME' || selected.type === 'COMPONENT') {
        return selected.id
      }
      if (selected.parentId) {
        const parent = graph.getNode(selected.parentId)
        if (parent && (parent.type === 'FRAME' || parent.type === 'COMPONENT')) {
          return parent.id
        }
      }
    }
  }

  const pageNodes = graph.getPages()
  const currentPageId = editor.state.currentPageId || pageNodes[0]?.id
  if (!currentPageId) return graph.rootId

  const topNodes = graph.getChildren(currentPageId)
  const rootFrame = topNodes.find((n) => n.type === 'FRAME')
  return rootFrame ? rootFrame.id : currentPageId
}

/** Inserts an instance of a Shadr component into the active editor scene */
export async function insertComponentInstance(
  componentId: string,
  editor: EditorStore
): Promise<boolean> {
  try {
    if (!componentRegistry.has(componentId)) {
      try {
        const comp = await componentService.get(componentId)
        componentRegistry.set(componentId, comp)
      } catch (err) {
        console.warn(`[Shadr] Component ${componentId} not found on server:`, err)
      }
    }

    const graph = editor.graph
    const targetParentId = resolveInsertParent(editor)

    const blockId = `${componentId}_${randomHex(2)}`
    const elem: ShadrElement = {
      type: 'component',
      id: blockId,
      component: componentId,
      position: { x: 120, y: 120 }
    }

    const node = shadrConverter.addElementToGraph(elem, targetParentId, graph)
    editor.select([node.id])
    editor.bringToFront()
    editor.state.sceneVersion++
    editor.requestRender()
    toast.info(`Компонент "${componentId}" добавлен в сцену!`)
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    toast.error(`Не удалось вставить компонент: ${msg}`)
    return false
  }
}

/** Commits any in-progress canvas text edit so exported JSON includes the latest text */
function flushActiveTextEdit(editor: EditorStore): void {
  if (editor.state?.editingTextId && typeof editor.commitTextEdit === 'function') {
    editor.commitTextEdit()
  }
}

/** Pushes all scenes and components in the project back to the backend */
export async function pushProject(editor: EditorStore): Promise<boolean> {
  return withSync('Ошибка синхронизации проекта', async () => {
    flushActiveTextEdit(editor)
    await imageService.autoUploadGraphImages(editor)
    const { pages, components } = shadrConverter.exportProject(editor)

    await Promise.all([
      ...pages.map(async (p) => {
        await pageService.save(p.name, p)
        recordSceneBaseline(p.name, p)
        if (!serverPages.value.includes(p.name)) {
          serverPages.value.push(p.name)
        }
      }),
      ...Object.entries(components).map(async ([name, comp]) => {
        await componentService.save(name, comp)
        recordComponentBaseline(name, comp)
        if (!serverComponents.value.includes(name)) {
          serverComponents.value.push(name)
        }
      })
    ])

    status.value = 'online'
    toast.info(
      `Весь проект сохранен: ${pages.length} сцен, ${Object.keys(components).length} компонентов!`
    )
  })
}

/** Switches the canvas to a specific scene by name */
export async function switchScene(sceneName: string, editor: EditorStore): Promise<boolean> {
  const targetPage = editor.graph.getPages().find((p) => p.name === sceneName)
  if (!targetPage) return false

  await editor.switchPage(targetPage.id)
  selectedPageId.value = sceneName
  currentDocumentId.value = sceneName
  currentDocumentType.value = sceneName === '_components' ? 'component' : 'page'
  if (sceneName !== '_components') {
    const exported = shadrConverter.exportPage(editor, sceneName)
    if (!sceneBaselines.has(exported.name)) {
      recordSceneBaseline(exported.name, exported)
    }
  }
  return true
}

/** Pulls a single page from backend into current canvas */
export async function pullPage(pageId: string, editor: EditorStore): Promise<boolean> {
  if (!pageId) return false
  return withSync(`Ошибка загрузки сцены "${pageId}"`, async () => {
    const pageData: ShadrPage = await pageService.get(pageId)
    const graph = shadrConverter.importPage(pageData)
    editor.replaceGraph(graph)
    editor.undo.clear()
    editor.clearSelection()
    selectedPageId.value = pageId
    currentDocumentType.value = 'page'
    currentDocumentId.value = pageId
    await imageService.preloadGraphTextures(editor)

    const exported = shadrConverter.exportPage(editor, pageId)
    recordSceneBaseline(exported.name, exported)

    toast.info(`Сцена "${pageId}" успешно загружена с сервера!`)
  })
}

/**
 * Returns normalized scene names belonging to the currently active canvas page.
 * Handles both single-scene pages and multi-screen canvases (e.g. `test_main` + `welcome` on one page).
 */
function getActivePageSceneNames(editor: EditorStore): Set<string> {
  const activeScene = syncActiveSceneWithEditor(editor)
  const result = new Set<string>([activeScene.toLowerCase().replace(/[^a-z0-9_-]/g, '_')])
  const currentPage = editor.graph.getNode(editor.state.currentPageId)
  if (!currentPage) return result

  for (const child of editor.graph.getChildren(currentPage.id)) {
    if (child.type !== 'FRAME') continue
    if (child.name) {
      result.add(child.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))
    }
  }
  return result
}

/**
 * Finds all scenes in the current editor project that differ from their baseline version.
 */
export function getChangedScenes(editor: EditorStore): ShadrPage[] {
  const sceneNames = shadrConverter.listProjectSceneNames(editor)
  const activePageScenes = getActivePageSceneNames(editor)
  const changed: ShadrPage[] = []

  for (const name of sceneNames) {
    const exported = shadrConverter.exportPage(editor, name)
    const currentStr = JSON.stringify(exported)
    const normalizedName = exported.name
    const baseline = sceneBaselines.get(normalizedName)

    if (baseline !== undefined) {
      if (currentStr !== baseline) {
        changed.push(exported)
      }
    } else if (activePageScenes.has(normalizedName) || !serverPages.value.includes(normalizedName)) {
      changed.push(exported)
    } else {
      sceneBaselines.set(normalizedName, currentStr)
    }
  }

  return changed
}

/** Pushes all modified scenes to backend */
export async function pushChangedScenes(editor: EditorStore): Promise<boolean> {
  return withSync('Ошибка сохранения измененных сцен', async () => {
    flushActiveTextEdit(editor)
    syncActiveSceneWithEditor(editor)

    const changedPages = getChangedScenes(editor)

    if (changedPages.length === 0) {
      toast.info('Все сцены актуальны (нет изменений для отправки)')
      return
    }

    await imageService.autoUploadGraphImages(
      editor,
      changedPages.map((p) => p.name)
    )

    for (const page of changedPages) {
      await pageService.save(page.name, page)
      recordSceneBaseline(page.name, page)
      if (!serverPages.value.includes(page.name)) {
        serverPages.value.push(page.name)
      }
    }

    status.value = 'online'

    if (changedPages.length === 1) {
      toast.info(`Сцена "${changedPages[0].name}" успешно сохранена на Minecraft сервер!`)
    } else {
      const names = changedPages.map((p) => p.name).join(', ')
      toast.info(`Сохранено ${changedPages.length} измененных сцен (${names}) на сервер!`)
    }
  })
}

/** Pushes the current active scene to backend */
export async function pushCurrentPage(
  editor: EditorStore,
  overrideName?: string
): Promise<boolean> {
  return withSync('Ошибка сохранения сцены', async () => {
    flushActiveTextEdit(editor)
    const activeName = overrideName || syncActiveSceneWithEditor(editor)
    const page = shadrConverter.exportPage(editor, activeName)
    await imageService.autoUploadGraphImages(editor, [page.name])
    await pageService.save(page.name, page)
    recordSceneBaseline(page.name, page)
    selectedPageId.value = page.name
    currentDocumentType.value = 'page'
    currentDocumentId.value = page.name
    if (!serverPages.value.includes(page.name)) {
      serverPages.value.push(page.name)
    }
    status.value = 'online'
    toast.info(`Сцена "${page.name}" успешно сохранена на Minecraft сервер!`)
  })
}

export async function pullComponent(componentId: string, editor: EditorStore): Promise<boolean> {
  if (!componentId) return false
  return withSync(`Ошибка загрузки компонента "${componentId}"`, async () => {
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
    await imageService.preloadGraphTextures(editor)
    toast.info(`Компонент "${componentId}" загружен для редактирования!`)
  })
}

export async function pushCurrentComponent(
  editor: EditorStore,
  overrideName?: string
): Promise<boolean> {
  return withSync('Ошибка сохранения компонента', async () => {
    await imageService.autoUploadGraphImages(editor)
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
  })
}
