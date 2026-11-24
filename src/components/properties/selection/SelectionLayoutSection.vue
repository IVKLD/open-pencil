<script setup lang="ts">
import { compact } from 'es-toolkit'

import { createSceneGeometry } from '@open-pencil/core/geometry'
import type { SceneNode } from '@open-pencil/scene-graph'
import { layerResizes } from '@open-pencil/scene-graph/generated'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import type { Rect } from '@open-pencil/scene-graph/primitives'
import { useSelectionLayout } from '@open-pencil/vue/controls/selection-layout'
import { useEditorCommands } from '@open-pencil/vue/editor/commands'
import { useI18n } from '@open-pencil/vue/i18n'
import { useSceneComputed } from '@open-pencil/vue/internal/scene-computed'
import { PositionControlsRoot } from '@open-pencil/vue/primitives/PositionControls'

import { useEditorStore } from '@/app/editor/active-store'
import NumberField from '@/components/inputs/NumberField.vue'
import ClipContentControl from '@/components/properties/layout/ClipContentControl.vue'
import LayoutFlowControl from '@/components/properties/layout/LayoutFlowControl.vue'
import TextResizingControl from '@/components/properties/layout/TextResizingControl.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

/**
 * Layout of several selected layers, as in Figma: flow when all can hold an auto layout, resizing
 * for the text among them, their group bounds size and individual bulk sizes, the spacing of a row
 * or column, and clip content for those that can clip.
 */
const store = useEditorStore()
const layout = useSelectionLayout()
const { getCommand } = useEditorCommands()
const wrapInAutoLayout = getCommand('selection.wrapInAutoLayout')
const { panels } = useI18n()

interface GroupResizeSnapshot {
  box: Rect
  nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>
}

let groupSnapshot: GroupResizeSnapshot | null = null

function topLevelResizableSelection(): SceneNode[] {
  const selectedIds = store.state.selectedIds
  const nodes = compact([...selectedIds].map((id) => store.graph.getNode(id)))
  return nodes.filter((node) => {
    if (node.locked || !layerResizes(node)) return false
    for (let cur = node.parentId; cur; cur = store.graph.getNode(cur)?.parentId ?? null) {
      if (selectedIds.has(cur)) return false
    }
    return true
  })
}

const groupBounds = useSceneComputed(() => {
  const nodes = topLevelResizableSelection()
  if (nodes.length < 2) return null
  const geometry = createSceneGeometry(store.graph)
  const box = computeBounds(nodes.map((node) => geometry.bounds(node)))
  return {
    x: box.x,
    y: box.y,
    width: Math.max(1, Math.round(box.width)),
    height: Math.max(1, Math.round(box.height))
  }
})

function ensureGroupSnapshot(): GroupResizeSnapshot | null {
  if (groupSnapshot) return groupSnapshot
  const nodes = topLevelResizableSelection()
  if (nodes.length < 2) return null
  const geometry = createSceneGeometry(store.graph)
  const box = computeBounds(nodes.map((node) => geometry.bounds(node)))
  groupSnapshot = {
    box,
    nodes: nodes.map((n) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height
    }))
  }
  return groupSnapshot
}

function applyGroupDimension(axis: 'width' | 'height', target: number, commit = false) {
  const snap = ensureGroupSnapshot()
  if (!snap) return
  const origSpan = axis === 'width' ? snap.box.width : snap.box.height
  if (origSpan <= 0) return
  const scale = Math.max(1, target) / origSpan

  const apply = () => {
    for (const orig of snap.nodes) {
      const node = store.graph.getNode(orig.id)
      if (!node) continue
      const parentAbs = node.parentId
        ? store.graph.getAbsolutePosition(node.parentId)
        : { x: 0, y: 0 }
      if (axis === 'width') {
        const origAbsX = parentAbs.x + orig.x
        const nextAbsX = snap.box.x + (origAbsX - snap.box.x) * scale
        const nextX = Math.round(nextAbsX - parentAbs.x)
        const nextW = Math.max(1, Math.round(orig.width * scale))
        if (commit) {
          store.graph.updateNode(orig.id, { x: orig.x, width: orig.width })
          store.updateNodeWithUndo(orig.id, { x: nextX, width: nextW }, 'Resize group')
        } else {
          store.updateNode(orig.id, { x: nextX, width: nextW })
        }
      } else {
        const origAbsY = parentAbs.y + orig.y
        const nextAbsY = snap.box.y + (origAbsY - snap.box.y) * scale
        const nextY = Math.round(nextAbsY - parentAbs.y)
        const nextH = Math.max(1, Math.round(orig.height * scale))
        if (commit) {
          store.graph.updateNode(orig.id, { y: orig.y, height: orig.height })
          store.updateNodeWithUndo(orig.id, { y: nextY, height: nextH }, 'Resize group')
        } else {
          store.updateNode(orig.id, { y: nextY, height: nextH })
        }
      }
    }
  }

  if (commit) {
    store.undo.runBatch('Resize group', apply)
    groupSnapshot = null
  } else {
    apply()
  }
}

function cancelGroupDimension() {
  if (!groupSnapshot) return
  for (const orig of groupSnapshot.nodes) {
    store.updateNode(orig.id, {
      x: orig.x,
      y: orig.y,
      width: orig.width,
      height: orig.height
    })
  }
  groupSnapshot = null
}
</script>

<template>
  <PanelSection :label="panels.layout" data-test-id="selection-layout">
    <template #actions>
      <IconButton
        :label="wrapInAutoLayout.label"
        size="xs"
        :disabled="!wrapInAutoLayout.enabled.value"
        @click="wrapInAutoLayout.run()"
      >
        <icon-lucide-layout-panel-top class="size-3.5" />
      </IconButton>
    </template>

    <LayoutFlowControl v-if="layout.layoutMode.value !== undefined" class="mb-2" />
    <TextResizingControl v-if="layout.textResize.value !== undefined" />

    <template v-if="groupBounds">
      <div class="mt-2 mb-1 text-2xs text-muted">Размер группы</div>
      <PanelGrid :columns="2">
        <Tip label="Ширина выделенной группы">
          <NumberField
            icon="W"
            data-property="group-width"
            aria-label="Ширина группы"
            :model-value="groupBounds.width"
            :min="1"
            @update:model-value="applyGroupDimension('width', $event)"
            @commit="(v: number) => applyGroupDimension('width', v, true)"
            @cancel="cancelGroupDimension"
          />
        </Tip>
        <Tip label="Высота выделенной группы">
          <NumberField
            icon="H"
            data-property="group-height"
            aria-label="Высота группы"
            :model-value="groupBounds.height"
            :min="1"
            @update:model-value="applyGroupDimension('height', $event)"
            @commit="(v: number) => applyGroupDimension('height', v, true)"
            @cancel="cancelGroupDimension"
          />
        </Tip>
      </PanelGrid>
    </template>

    <div class="mt-2 mb-1 text-2xs text-muted">{{ panels.dimensions }} (каждого элемента)</div>

    <PositionControlsRoot v-slot="{ wValue, hValue, actions }">
      <PanelGrid :columns="2">
        <Tip :label="panels.width">
          <NumberField
            icon="W"
            data-property="width"
            :aria-label="panels.width"
            :model-value="wValue"
            :min="1"
            @update:model-value="actions.updateProp('width', $event)"
            @commit="(v: number, p: number) => actions.commitProp('width', v, p)"
            @cancel="actions.cancelProp('width')"
          />
        </Tip>
        <Tip :label="panels.height">
          <NumberField
            icon="H"
            data-property="height"
            :aria-label="panels.height"
            :model-value="hValue"
            :min="1"
            @update:model-value="actions.updateProp('height', $event)"
            @commit="(v: number, p: number) => actions.commitProp('height', v, p)"
            @cancel="actions.cancelProp('height')"
          />
        </Tip>
      </PanelGrid>
    </PositionControlsRoot>

    <template v-if="layout.spacingAxis.value">
      <div class="mt-2 mb-1 text-2xs text-muted">{{ panels.spacing }}</div>
      <PanelGrid :columns="2">
        <Tip :label="panels.spacing">
          <NumberField
            data-property="selection-spacing"
            :aria-label="panels.spacing"
            :model-value="layout.spacing.value"
            @update:model-value="layout.setSpacing($event)"
            @commit="layout.flushSpacing()"
          >
            <template #icon>
              <icon-lucide-move-horizontal
                v-if="layout.spacingAxis.value === 'horizontal'"
                class="size-3"
              />
              <icon-lucide-move-vertical v-else class="size-3" />
            </template>
          </NumberField>
        </Tip>
      </PanelGrid>
    </template>

    <ClipContentControl v-if="layout.clipsContent.value !== undefined" />
  </PanelSection>
</template>
