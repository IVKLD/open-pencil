<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'

import { useEditorStore } from '@/app/editor/active-store'
import { getShadrData, setShadrData } from '@/app/integrations/shadr/data'
import type { ShadrParamValue } from '@/app/integrations/shadr/types'
import AppInput from '@/components/ui/input/AppInput.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

interface Props {
  node: SceneNode
}

const { node } = defineProps<Props>()

const editor = useEditorStore()
const componentName = ref('')
const params = ref<Record<string, ShadrParamValue>>({})

function findTextChildForParam(targetNode: SceneNode, paramKey: string): SceneNode | undefined {
  if (targetNode.type === 'TEXT') {
    const singleKeys = new Set(['label', 'title', 'value', 'text', 'body'])
    if (singleKeys.has(paramKey)) {
      return targetNode
    }
  }
  const children = editor.graph.getChildren(targetNode.id)
  const textChildren = children.filter((c) => c.type === 'TEXT')
  for (const tc of textChildren) {
    const childData = getShadrData(tc, editor.graph)
    const childId = childData.blockId || tc.name || ''
    if (childId === paramKey || childId.endsWith(`_${paramKey}`)) {
      return tc
    }
  }
  if (textChildren.length === 1) {
    const singleKeys = new Set(['label', 'title', 'value', 'text', 'body'])
    if (singleKeys.has(paramKey)) {
      return textChildren[0]
    }
  }
  return undefined
}

watch(
  () => node,
  (currentNode) => {
    const data = getShadrData(currentNode, editor.graph)
    componentName.value = data.componentName ?? ''
    const currentParams = { ...data.componentParams }
    for (const key of Object.keys(currentParams)) {
      const tc = findTextChildForParam(currentNode, key)
      if (tc && tc.text !== undefined) {
        currentParams[key] = tc.text
      }
    }
    params.value = currentParams
  },
  { immediate: true, deep: true }
)

const HIDDEN_PARAM_KEYS = new Set(['id'])

const hasComponent = computed(() => Boolean(componentName.value))
const paramEntries = computed(() =>
  Object.entries(params.value).filter(([key]) => !HIDDEN_PARAM_KEYS.has(key))
)

function updateParam(key: string, value: string) {
  params.value[key] = value
  const tc = findTextChildForParam(node, key)
  if (tc) {
    editor.graph.updateNode(tc.id, { text: value })
  }
  setShadrData(editor, [node], { componentParams: { ...params.value } })
}

function paramTip(key: string): string {
  return `Параметр '${key}' компонента [${componentName.value}]`
}

function inputTip(key: string): string {
  return `Значение параметра '${key}' компонента [${componentName.value}]. Обновляет узел и JSON Shadr`
}

const tips = {
  visualPropsHint:
    'Текст, цвета, размеры и скругления синхронизируются автоматически с холста OpenPencil'
}
</script>

<template>
  <PanelSection v-if="hasComponent" :label="`Параметры [${componentName}]`">
    <div v-if="paramEntries.length > 0" class="flex flex-col gap-2">
      <div
        v-for="[key, val] in paramEntries"
        :key="key"
        class="flex items-center justify-between gap-2"
      >
        <Tip :label="paramTip(key)" side="left">
          <label class="text-2xs text-muted w-20 shrink-0 font-medium truncate cursor-help">
            {{ key }}
          </label>
        </Tip>
        <div class="flex-1">
          <Tip :label="inputTip(key)" side="top">
            <AppInput
              :model-value="String(val ?? '')"
              size="xs"
              class="w-full"
              @update:model-value="(newVal) => updateParam(key, String(newVal))"
            />
          </Tip>
        </div>
      </div>
    </div>
    <div v-else class="text-2xs text-muted py-1">
      <Tip :label="tips.visualPropsHint" side="top">
        <span class="cursor-help">
          Визуальные свойства (текст, цвета, размеры, скругления) настраиваются напрямую на холсте
          OpenPencil.
        </span>
      </Tip>
    </div>
  </PanelSection>
</template>
