<script setup lang="ts">
import { isGeneratedFrame, layerResizes } from '@open-pencil/scene-graph/generated'
import { MIXED, type MixedValue } from '@open-pencil/vue/controls/node-props'
import { LAYOUT_CONTAINER_TYPES } from '@open-pencil/vue/controls/selection-layout'
import { useI18n } from '@open-pencil/vue/i18n'
import { useSceneComputed } from '@open-pencil/vue/internal/scene-computed'
import { LayoutControlsRoot } from '@open-pencil/vue/primitives/LayoutControls'

import { useEditorStore } from '@/app/editor/active-store'
import NumberField from '@/components/inputs/NumberField.vue'
import ClipContentControl from '@/components/properties/layout/ClipContentControl.vue'
import FlexControls from '@/components/properties/layout/flex/FlexControls.vue'
import GridControls from '@/components/properties/layout/grid/GridControls.vue'
import LayoutFlowControl from '@/components/properties/layout/LayoutFlowControl.vue'
import LayoutWrapToggle from '@/components/properties/layout/LayoutWrapToggle.vue'
import PaddingControls from '@/components/properties/layout/padding/PaddingControls.vue'
import SizeControls from '@/components/properties/layout/size/SizeControls.vue'
import TextResizingControl from '@/components/properties/layout/TextResizingControl.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

const { panels } = useI18n()
const store = useEditorStore()

let groupChildrenSnapshot: Array<{ id: string; width: number; height: number }> | null = null

const groupChildren = useSceneComputed(() => {
  const selected = store.getSelectedNodes()
  if (selected.length !== 1 || selected[0].type !== 'GROUP') return []
  return store.graph
    .getChildren(selected[0].id)
    .filter((child) => !child.locked && layerResizes(child))
})

function sharedChildDimension(axis: 'width' | 'height'): MixedValue<number> {
  const children = groupChildren.value
  if (children.length === 0) return 0
  const first = Math.round(children[0][axis])
  return children.every((c) => Math.round(c[axis]) === first) ? first : MIXED
}

const groupChildrenW = useSceneComputed(() => sharedChildDimension('width'))
const groupChildrenH = useSceneComputed(() => sharedChildDimension('height'))

function applyGroupChildrenSize(axis: 'width' | 'height', value: number, commit = false) {
  const children = groupChildren.value
  if (children.length === 0) return
  if (!groupChildrenSnapshot) {
    groupChildrenSnapshot = children.map((c) => ({ id: c.id, width: c.width, height: c.height }))
  }
  const nextVal = Math.max(1, Math.round(value))
  if (commit) {
    const snap = groupChildrenSnapshot
    store.undo.runBatch('Resize group elements', () => {
      for (const orig of snap) {
        store.graph.updateNode(orig.id, { [axis]: orig[axis] })
        store.updateNodeWithUndo(orig.id, { [axis]: nextVal }, 'Resize group elements')
      }
    })
    groupChildrenSnapshot = null
  } else {
    for (const orig of groupChildrenSnapshot) {
      store.updateNode(orig.id, { [axis]: nextVal })
    }
  }
}

function cancelGroupChildrenSize() {
  if (!groupChildrenSnapshot) return
  for (const orig of groupChildrenSnapshot) {
    store.updateNode(orig.id, { width: orig.width, height: orig.height })
  }
  groupChildrenSnapshot = null
}
</script>

<template>
  <LayoutControlsRoot v-slot="ctx">
    <template v-if="ctx.node">
      <!-- A generated frame, such as a shape with text, lays out its own sublayers; its auto layout is not offered. -->
      <PanelSection
        :label="
          ctx.node.layoutMode === 'NONE' || isGeneratedFrame(ctx.node)
            ? panels.layout
            : panels.autoLayout
        "
      >
        <template v-if="LAYOUT_CONTAINER_TYPES.has(ctx.node.type)" #actions>
          <IconButton
            :label="ctx.node.layoutMode === 'NONE' ? panels.addAutoLayout : panels.removeAutoLayout"
            size="xs"
            :active="ctx.node.layoutMode !== 'NONE'"
            class="data-[state=on]:bg-accent/15"
            @click="
              ctx.editor.setLayoutMode(
                ctx.node.id,
                ctx.node.layoutMode === 'NONE' ? 'VERTICAL' : 'NONE'
              )
            "
          >
            <icon-lucide-layout-panel-top class="size-3.5" />
          </IconButton>
        </template>

        <LayoutFlowControl v-if="LAYOUT_CONTAINER_TYPES.has(ctx.node.type)">
          <LayoutWrapToggle v-if="ctx.isFlex" />
        </LayoutFlowControl>
        <div v-if="ctx.node.type !== 'TEXT'" class="mt-2 mb-1 text-2xs text-muted">
          {{ panels.dimensions }}
        </div>
        <TextResizingControl v-if="ctx.node.type === 'TEXT'" />
        <SizeControls />
        <template v-if="ctx.node.type === 'GROUP' && groupChildren.length > 0">
          <div class="mt-2 mb-1 text-2xs text-muted">Размер элементов группы</div>
          <PanelGrid :columns="2">
            <Tip label="Ширина всех элементов внутри группы">
              <NumberField
                icon="W"
                data-property="group-children-width"
                aria-label="Ширина элементов группы"
                :model-value="groupChildrenW"
                :min="1"
                @update:model-value="applyGroupChildrenSize('width', $event)"
                @commit="(v: number) => applyGroupChildrenSize('width', v, true)"
                @cancel="cancelGroupChildrenSize"
              />
            </Tip>
            <Tip label="Высота всех элементов внутри группы">
              <NumberField
                icon="H"
                data-property="group-children-height"
                aria-label="Высота элементов группы"
                :model-value="groupChildrenH"
                :min="1"
                @update:model-value="applyGroupChildrenSize('height', $event)"
                @commit="(v: number) => applyGroupChildrenSize('height', v, true)"
                @cancel="cancelGroupChildrenSize"
              />
            </Tip>
          </PanelGrid>
        </template>
        <ClipContentControl
          v-if="LAYOUT_CONTAINER_TYPES.has(ctx.node.type) && ctx.node.layoutMode === 'NONE'"
        />

        <template
          v-if="LAYOUT_CONTAINER_TYPES.has(ctx.node.type) && ctx.node.layoutMode !== 'NONE'"
        >
          <FlexControls v-if="ctx.isFlex" />
          <template v-if="ctx.isGrid">
            <GridControls />
            <PaddingControls />
            <ClipContentControl />
          </template>
        </template>
      </PanelSection>
    </template>
  </LayoutControlsRoot>
</template>
