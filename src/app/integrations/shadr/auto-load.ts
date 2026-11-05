import type { EditorStore } from '@/app/editor/session'

import { shadrConverter } from './converter'
import { request } from './http/http-client'
import { serverComponents, status } from './store/state'
import type { ShadrComponent } from './types'

let isAutoLoading = false

export async function autoLoadShadrComponents(editor: EditorStore): Promise<boolean> {
  const hasComponents = editor.graph.getPages().some((p) => p.name === '_components')
  if (hasComponents || isAutoLoading) return false

  isAutoLoading = true
  try {
    const listRes = await request<{ ids: string[] }>('/configs/components')
    const compIds = listRes.ids || []
    if (compIds.length === 0) return false

    serverComponents.value = compIds

    const componentsList = await Promise.all(
      compIds.map((id) => request<ShadrComponent>(`/configs/components/${id}`).catch(() => null))
    )

    const compMap: Record<string, ShadrComponent> = {}
    compIds.forEach((id, i) => {
      const comp = componentsList[i]
      if (comp) compMap[id] = comp
    })

    shadrConverter.importComponentsIntoGraph(editor.graph, compMap)
    status.value = 'online'
    editor.state.sceneVersion++
    editor.requestRender()
    return true
  } catch {
    return false
  } finally {
    isAutoLoading = false
  }
}
