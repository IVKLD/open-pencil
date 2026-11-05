import type { EditorStore } from '@/app/editor/active-store'
import { componentRegistry, shadrConverter } from '@/app/integrations/shadr/converter'
import { request } from '@/app/integrations/shadr/http/http-client'
import type { ShadrComponent, ShadrElement } from '@/app/integrations/shadr/types'
import { toast } from '@/app/shell/ui'

export const componentService = {
  list: (): Promise<string[]> =>
    request<{ ids: string[] }>('/configs/components').then((r) => r.ids ?? []),

  get: (id: string): Promise<ShadrComponent> =>
    request<{ document: ShadrComponent }>(`/configs/components/${encodeURIComponent(id)}`).then((r) => r.document),

  save: (id: string, comp: ShadrComponent): Promise<void> =>
    request(`/configs/components/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(comp)
    }),

  delete: (id: string): Promise<void> =>
    request(`/configs/components/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  insertComponentInstance: async (componentId: string, editor: EditorStore): Promise<boolean> => {
    try {
      if (!componentRegistry.has(componentId)) {
        try {
          const comp = await componentService.get(componentId)
          componentRegistry.set(componentId, comp)
        } catch {
          // ignore if offline or not found
        }
      }

      const graph = editor.graph
      const pageNodes = graph.getPages()
      const currentPageId = editor.state.currentPageId || pageNodes[0]?.id
      const topNodes = graph.getChildren(currentPageId)
      const rootFrame = topNodes.find((n) => n.type === 'FRAME')
      const targetParentId = rootFrame ? rootFrame.id : currentPageId

      const blockId = `${componentId}_${Date.now().toString(36).slice(-4)}`
      const elem: ShadrElement = {
        type: 'component',
        id: blockId,
        component: componentId,
        position: { x: 120, y: 120 }
      }

      const node = shadrConverter.addElementToGraph(elem, targetParentId, graph)
      editor.select([node.id])
      toast.info(`Компонент "${componentId}" добавлен на холст!`)
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Не удалось вставить компонент: ${msg}`)
      return false
    }
  }
}
