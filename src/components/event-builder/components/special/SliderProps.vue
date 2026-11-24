<script setup lang="ts">
import { reactive, watch } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'

import { useEditorStore } from '@/app/editor/active-store'
import { getShadrData, setShadrData } from '@/app/integrations/shadr/data'
import AppInput from '@/components/ui/input/AppInput.vue'
import Tip from '@/components/ui/overlay/Tip.vue'

const { node } = defineProps<{
  node: SceneNode
}>()

const editor = useEditorStore()

const FIELDS = [
  {
    key: 'min',
    label: 'Min',
    placeholder: '0',
    tip: 'Минимальное значение ползунка (по умолчанию 0)'
  },
  {
    key: 'max',
    label: 'Max',
    placeholder: '100',
    tip: 'Максимальное значение ползунка (по умолчанию 100)'
  },
  {
    key: 'step',
    label: 'Step',
    placeholder: '1',
    tip: 'Шаг изменения значения (например 1 или 5)'
  },
  {
    key: 'value',
    label: 'Value',
    placeholder: '50',
    tip: 'Текущее или начальное значение ползунка'
  }
] as const

type SliderKey = (typeof FIELDS)[number]['key']

const values = reactive<Record<SliderKey, number | ''>>({
  min: '',
  max: '',
  step: '',
  value: ''
})

watch(
  () => node,
  (currentNode) => {
    const data = getShadrData(currentNode)
    for (const f of FIELDS) {
      const val = data[f.key]
      values[f.key] = typeof val === 'number' ? val : ''
    }
  },
  { immediate: true, deep: true }
)

function commit() {
  const targets = editor.getSelectedNodes()
  const patch: Record<string, number | undefined> = {}
  for (const f of FIELDS) {
    patch[f.key] = values[f.key] === '' ? undefined : Number(values[f.key])
  }
  setShadrData(editor, targets.length > 0 ? targets : [node], patch)
}
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <div v-for="f in FIELDS" :key="f.key" class="flex items-center justify-between gap-2">
      <Tip :label="f.tip" side="left">
        <label class="text-xs text-muted w-24 shrink-0 cursor-help">{{ f.label }}</label>
      </Tip>
      <div class="flex-1">
        <Tip :label="f.tip" side="top">
          <AppInput
            v-model="values[f.key]"
            size="xs"
            type="number"
            :placeholder="f.placeholder"
            class="w-full"
            @blur="commit"
            @keydown.enter="commit"
          />
        </Tip>
      </div>
    </div>
  </div>
</template>
