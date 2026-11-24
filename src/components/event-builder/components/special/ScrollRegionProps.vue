<script setup lang="ts">
import { ref, watch } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'

import { useEditorStore } from '@/app/editor/active-store'
import { getShadrData, setShadrData } from '@/app/integrations/shadr/data'
import AppInput from '@/components/ui/input/AppInput.vue'
import Tip from '@/components/ui/overlay/Tip.vue'

const { node } = defineProps<{
  node: SceneNode
}>()

const editor = useEditorStore()

const contentHeight = ref<number | ''>('')
const scrollStep = ref<number | ''>('')
const scrollbarFor = ref('')

watch(
  () => node,
  (currentNode) => {
    const data = getShadrData(currentNode)
    contentHeight.value = typeof data.contentHeight === 'number' ? data.contentHeight : ''
    scrollStep.value = typeof data.step === 'number' ? data.step : ''
    scrollbarFor.value = data.scrollbarFor ?? ''
  },
  { immediate: true, deep: true }
)

function commit() {
  const targets = editor.getSelectedNodes()
  setShadrData(editor, targets.length > 0 ? targets : [node], {
    contentHeight: contentHeight.value === '' ? undefined : Number(contentHeight.value),
    step: scrollStep.value === '' ? undefined : Number(scrollStep.value),
    scrollbarFor: scrollbarFor.value.trim() || undefined
  })
}

const tips = {
  contentHeight: 'Общая высота прокручиваемого содержимого в пикселях',
  step: 'Шаг прокрутки при повороте колеса мыши',
  scrollbar: 'ID скроллбара, привязанного к этому региону'
}
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <div class="flex items-center justify-between gap-2">
      <Tip :label="tips.contentHeight" side="left">
        <label class="text-xs text-muted w-24 shrink-0 cursor-help">Content H</label>
      </Tip>
      <div class="flex-1">
        <Tip :label="tips.contentHeight" side="top">
          <AppInput
            v-model="contentHeight"
            size="xs"
            type="number"
            placeholder="1200"
            class="w-full"
            @blur="commit"
            @keydown.enter="commit"
          />
        </Tip>
      </div>
    </div>

    <div class="flex items-center justify-between gap-2">
      <Tip :label="tips.step" side="left">
        <label class="text-xs text-muted w-24 shrink-0 cursor-help">Step</label>
      </Tip>
      <div class="flex-1">
        <Tip :label="tips.step" side="top">
          <AppInput
            v-model="scrollStep"
            size="xs"
            type="number"
            placeholder="40"
            class="w-full"
            @blur="commit"
            @keydown.enter="commit"
          />
        </Tip>
      </div>
    </div>

    <div class="flex items-center justify-between gap-2">
      <Tip :label="tips.scrollbar" side="left">
        <label class="text-xs text-muted w-24 shrink-0 cursor-help">Scrollbar</label>
      </Tip>
      <div class="flex-1">
        <Tip :label="tips.scrollbar" side="top">
          <AppInput
            v-model="scrollbarFor"
            size="xs"
            placeholder="task_scroll"
            class="w-full font-mono text-2xs"
            @blur="commit"
            @keydown.enter="commit"
          />
        </Tip>
      </div>
    </div>
  </div>
</template>
