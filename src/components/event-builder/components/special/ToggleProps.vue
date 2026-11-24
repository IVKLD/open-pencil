<script setup lang="ts">
import { ref, watch } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'

import { useEditorStore } from '@/app/editor/active-store'
import { getShadrData, setShadrData } from '@/app/integrations/shadr/data'
import Tip from '@/components/ui/overlay/Tip.vue'
import AppCheckbox from '@/components/ui/toggle/AppCheckbox.vue'

const { node } = defineProps<{
  node: SceneNode
}>()

const editor = useEditorStore()
const isChecked = ref(false)

watch(
  () => node,
  (currentNode) => {
    isChecked.value = Boolean(getShadrData(currentNode).checked)
  },
  { immediate: true, deep: true }
)

function commit() {
  const targets = editor.getSelectedNodes()
  setShadrData(editor, targets.length > 0 ? targets : [node], {
    checked: isChecked.value
  })
}

const tips = {
  defaultChecked: 'Начальное состояние чекбокса в интерфейсе Shadr'
}
</script>

<template>
  <div class="flex items-center justify-between py-1 border-t border-border/30">
    <Tip :label="tips.defaultChecked" side="left">
      <label class="text-xs text-muted cursor-help">Включен по умолчанию</label>
    </Tip>
    <Tip :label="tips.defaultChecked" side="left">
      <AppCheckbox
        v-model="isChecked"
        ariaLabel="Включен по умолчанию"
        @update:model-value="commit"
      />
    </Tip>
  </div>
</template>
