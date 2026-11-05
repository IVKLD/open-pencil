<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'

import { useEditorStore } from '@/app/editor/active-store'
import { shadrHexToColor } from '@/app/integrations/shadr/converter'
import { getShadrData, setShadrData } from '@/app/integrations/shadr/data'
import AppInput from '@/components/ui/input/AppInput.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

interface Props {
  node: SceneNode
}

const props = defineProps<Props>()

const editor = useEditorStore()
const componentName = ref('')
const params = ref<Record<string, unknown>>({})

watch(
  () => props.node,
  (currentNode) => {
    const data = getShadrData(currentNode)
    componentName.value = data.componentName ?? ''
    params.value = { ...(data.componentParams ?? {}) }
  },
  { immediate: true, deep: true }
)

const hasComponent = computed(() => Boolean(componentName.value))
const paramEntries = computed(() => Object.entries(params.value))

function updateParam(key: string, value: string) {
  params.value[key] = value

  // Update canvas nodes visually
  if (key === 'label' || key === 'title') {
    const children = editor.graph.getChildren(props.node.id)
    const textChild = children.find((c) => c.type === 'TEXT')
    if (textChild) {
      editor.graph.updateNode(textChild.id, { text: value })
    }
  } else if (key === 'width' || key === 'height') {
    const num = Number(value)
    if (Number.isFinite(num) && num > 0) {
      editor.graph.updateNode(props.node.id, { [key]: num })
    }
  } else if (key === 'color' && typeof value === 'string') {
    const { color, opacity } = shadrHexToColor(value)
    editor.graph.updateNode(props.node.id, {
      fills: [{ type: 'SOLID', color, opacity, visible: true }]
    })
  }

  setShadrData(editor, [props.node], { componentParams: { ...params.value } })
}
</script>

<template>
  <PanelSection v-if="hasComponent" :label="`Параметры [${componentName}]`">
    <div class="flex flex-col gap-2">
      <div
        v-for="[key, val] in paramEntries"
        :key="key"
        class="flex items-center justify-between gap-2"
      >
        <label class="text-[10px] text-muted w-20 shrink-0 font-medium truncate">
          {{ key }}
        </label>
        <AppInput
          :model-value="String(val ?? '')"
          class="flex-1"
          @update:model-value="(newVal) => updateParam(key, String(newVal))"
        />
      </div>
    </div>
  </PanelSection>
</template>
