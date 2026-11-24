<script setup lang="ts">
import { ref, watch } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'

import { useEditorStore } from '@/app/editor/active-store'
import { getShadrData, setShadrData } from '@/app/integrations/shadr/data'
import AppInput from '@/components/ui/input/AppInput.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

const { node } = defineProps<{
  node: SceneNode
}>()

const editor = useEditorStore()

const DISPLAY_OPTIONS = [
  { value: 'gui', label: 'Инвентарь (gui)' },
  { value: 'ground', label: 'На земле (ground)' },
  { value: 'fixed', label: 'В рамке (fixed)' },
  { value: 'head', label: 'На голове (head)' },
  { value: 'firstperson_righthand', label: 'В руке (1st person)' },
  { value: 'thirdperson_righthand', label: 'В руке (3rd person)' }
]

const item = ref('')
const customModelData = ref<number | ''>('')
const itemDisplay = ref('gui')

watch(
  () => node,
  (currentNode) => {
    const data = getShadrData(currentNode)
    item.value = data.item ?? ''
    customModelData.value = typeof data.customModelData === 'number' ? data.customModelData : ''
    itemDisplay.value = data.itemDisplay ?? 'gui'
  },
  { immediate: true, deep: true }
)

function commit() {
  const targets = editor.getSelectedNodes()
  setShadrData(editor, targets.length > 0 ? targets : [node], {
    item: item.value.trim() || undefined,
    customModelData: customModelData.value === '' ? undefined : Number(customModelData.value),
    itemDisplay: itemDisplay.value.trim() || undefined
  })
}

const tips = {
  itemId: 'ID предмета в Minecraft (например minecraft:diamond_sword)',
  modelData: 'CustomModelData для кастомных ресурспаков и 3D-моделей',
  display: 'Режим отображения предмета (gui, ground, fixed)'
}
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <div class="flex items-center justify-between gap-2">
      <Tip :label="tips.itemId" side="left">
        <label class="text-xs text-muted w-24 shrink-0 cursor-help">Item ID</label>
      </Tip>
      <div class="flex-1">
        <Tip :label="tips.itemId" side="top">
          <AppInput
            v-model="item"
            size="xs"
            placeholder="minecraft:diamond"
            class="w-full font-mono text-2xs"
            @blur="commit"
            @keydown.enter="commit"
          />
        </Tip>
      </div>
    </div>

    <div class="flex items-center justify-between gap-2">
      <Tip :label="tips.modelData" side="left">
        <label class="text-xs text-muted w-24 shrink-0 cursor-help">ModelData</label>
      </Tip>
      <div class="flex-1">
        <Tip :label="tips.modelData" side="top">
          <AppInput
            v-model="customModelData"
            size="xs"
            type="number"
            placeholder="1001"
            class="w-full"
            @blur="commit"
            @keydown.enter="commit"
          />
        </Tip>
      </div>
    </div>

    <div class="flex items-center justify-between gap-2">
      <Tip :label="tips.display" side="left">
        <label class="text-xs text-muted w-24 shrink-0 cursor-help">Display</label>
      </Tip>
      <div class="flex-1">
        <Tip :label="tips.display" side="top">
          <AppSelect
            :model-value="itemDisplay || 'gui'"
            :options="DISPLAY_OPTIONS"
            size="xs"
            :ui="{ trigger: 'w-full' }"
            @update:model-value="
              (val) => {
                itemDisplay = String(val)
                commit()
              }
            "
          />
        </Tip>
      </div>
    </div>
  </div>
</template>
