import type { PluginDataEntry, SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { EditorStore } from '@/app/editor/active-store'

import type { ShadrNodeData } from './types'

export const SHADR_PLUGIN_ID = 'minecraft'
export const SHADR_DATA_KEY = 'shadr'

/** Reads Shadr metadata from a node's pluginData or resolves it from master component for instances. */
export function getShadrData(
  node: SceneNode | null | undefined,
  graph?: SceneGraph
): ShadrNodeData {
  if (!node) return {}
  let ownData: ShadrNodeData = {}
  if (node.pluginData) {
    const entry = node.pluginData.find(
      (e) => e.pluginId === SHADR_PLUGIN_ID && e.key === SHADR_DATA_KEY
    )
    if (entry?.value) {
      try {
        const parsed: unknown = JSON.parse(entry.value)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          ownData = parsed as ShadrNodeData
        }
      } catch (err) {
        console.warn('[Shadr] Failed to parse node pluginData:', err)
      }
    }
  }

  if (node.type === 'INSTANCE' && node.componentId && graph) {
    const compNode = graph.getNode(node.componentId)
    if (compNode) {
      const compData = getShadrData(compNode)
      return {
        ...compData,
        ...ownData,
        componentName: ownData.componentName || compData.componentName || compNode.name || '',
        componentParams: {
          ...compData.componentParams,
          ...ownData.componentParams
        }
      }
    }
  }

  return ownData
}

/** Updates Shadr metadata on the specified target nodes with undo history. */
export function setShadrData(
  editor: EditorStore,
  targetNodes: SceneNode[],
  patch: Partial<ShadrNodeData>,
  historyLabel = 'Update Shadr properties'
) {
  for (const node of targetNodes) {
    const current = getShadrData(node)
    const combined: ShadrNodeData = { ...current, ...patch }

    // Clean out empty/undefined keys without mutating/deleting
    const filteredEntries = (
      Object.entries(combined) as Array<[keyof ShadrNodeData, ShadrNodeData[keyof ShadrNodeData]]>
    ).filter(([, val]) => {
      if (val === undefined || val === '') return false
      if (Array.isArray(val) && val.length === 0) return false
      return true
    })
    const next = Object.fromEntries(filteredEntries) as ShadrNodeData

    const clean = (node.pluginData ?? []).filter(
      (e) => !(e.pluginId === SHADR_PLUGIN_ID && e.key === SHADR_DATA_KEY)
    )

    const hasData = Object.keys(next).length > 0
    const nextPluginData: PluginDataEntry[] = hasData
      ? [...clean, { pluginId: SHADR_PLUGIN_ID, key: SHADR_DATA_KEY, value: JSON.stringify(next) }]
      : clean

    editor.updateNodeWithUndo(node.id, { pluginData: nextPluginData }, historyLabel)
  }
}
