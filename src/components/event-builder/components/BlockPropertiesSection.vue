<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'

import { useEditorStore } from '@/app/editor/active-store'
import { getShadrData, setShadrData } from '@/app/integrations/shadr/data'
import type { ShadrElementType, ShadrNodeData } from '@/app/integrations/shadr/types'
import AppInput from '@/components/ui/input/AppInput.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppCheckbox from '@/components/ui/toggle/AppCheckbox.vue'

const { node } = defineProps<{
  node: SceneNode
}>()

const HOVER_OPTIONS = [
  { value: 'none', label: 'Нет (none)' },
  { value: 'lift', label: 'Поднятие (lift)' },
  { value: 'press', label: 'Нажатие (press)' },
  { value: 'glow', label: 'Свечение (glow)' },
  { value: 'nudge', label: 'Смещение (nudge)' },
  { value: 'pop', label: 'Пульс (pop)' },
  { value: 'sink', label: 'Утопление (sink)' },
  { value: 'tilt', label: 'Наклон (tilt)' }
]

const CLICK_OPTIONS = [
  { value: 'none', label: 'Нет (none)' },
  { value: 'press', label: 'Нажатие (press)' },
  { value: 'lift', label: 'Поднятие (lift)' }
]

const ELEMENT_TYPES = [
  { value: 'block', label: 'Блок (block)' },
  { value: 'text_input', label: 'Поле ввода (text_input)' },
  { value: 'item', label: 'Предмет (item)' },
  { value: 'slider', label: 'Ползунок (slider)' },
  { value: 'toggle', label: 'Чекбокс (toggle)' },
  { value: 'video', label: 'Видео (video)' },
  { value: 'scrollRegion', label: 'Скролл-область' }
]

const editor = useEditorStore()
const blockId = ref('')
const defaultBlockId = computed(
  () => node.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'block_id'
)
const rawType = ref('block')
const layer = ref<number | ''>('')
const isInteractive = ref(false)
const hoverEffect = ref('none')
const clickEffect = ref('none')

watch(
  () => node,
  (currentNode) => {
    const data = getShadrData(currentNode)
    blockId.value = data.blockId ?? ''
    rawType.value = data.rawType || 'block'
    layer.value = data.layer !== undefined ? data.layer : ''
    isInteractive.value = data.interactive ?? false
    hoverEffect.value = data.hoverEffect || 'none'
    clickEffect.value = data.clickEffect || 'none'
  },
  { immediate: true, deep: true }
)

const hoverOptions = computed(() => {
  const current = hoverEffect.value
  if (current && current !== 'none' && !HOVER_OPTIONS.some((o) => o.value === current)) {
    return [...HOVER_OPTIONS, { value: current, label: `${current} (сервер)` }]
  }
  return HOVER_OPTIONS
})

const clickOptions = computed(() => {
  const current = clickEffect.value
  if (current && current !== 'none' && !CLICK_OPTIONS.some((o) => o.value === current)) {
    return [...CLICK_OPTIONS, { value: current, label: `${current} (сервер)` }]
  }
  return CLICK_OPTIONS
})

function commit() {
  const patch: Partial<ShadrNodeData> = {
    blockId: blockId.value.trim() || undefined,
    rawType: rawType.value === 'block' ? undefined : (rawType.value as ShadrElementType),
    layer: layer.value === '' ? undefined : Number(layer.value),
    interactive: isInteractive.value,
    hoverEffect: hoverEffect.value === 'none' ? undefined : hoverEffect.value,
    clickEffect: clickEffect.value === 'none' ? undefined : clickEffect.value
  }
  const targets = editor.getSelectedNodes()
  setShadrData(editor, targets.length > 0 ? targets : [node], patch)
}

const tips = {
  rawType:
    'Тип элемента Shadr: блок, поле ввода, предмет Майнкрафта, ползунок, чекбокс, видео или скролл',
  blockId:
    'Уникальный ID блока в Shadr JSON. Используется в скриптах, серверных триггерах и селекторах',
  layer:
    'Z-index отрисовки в Minecraft: чем выше значение, тем выше блок перекрывает другие элементы',
  interactiveLabel:
    'Разрешить элементу реагировать на мышь: перехватывать курсор, ховер и клики игрока',
  interactiveToggle: 'Включить / отключить интерактивность для выбранного блока',
  hoverEffect:
    'Анимация при наведении курсора: lift (подъем), glow (свечение), pop (пульс), tilt (наклон)',
  clickEffect: 'Анимация при нажатии кнопки мыши: press (продавливание кнопки), lift (отскок)'
}
</script>

<template>
  <PanelSection label="Свойства блока Shadr">
    <div class="flex flex-col gap-2.5">
      <div class="flex items-center justify-between gap-2">
        <Tip :label="tips.rawType" side="left">
          <label class="text-xs text-muted w-20 shrink-0 cursor-help">Тип</label>
        </Tip>
        <div class="flex-1">
          <Tip :label="tips.rawType" side="top">
            <AppSelect
              v-model="rawType"
              :options="ELEMENT_TYPES"
              size="xs"
              class="w-full"
              @update:model-value="commit"
            />
          </Tip>
        </div>
      </div>

      <div class="flex items-center justify-between gap-2">
        <Tip :label="tips.blockId" side="left">
          <label class="text-xs text-muted w-20 shrink-0 cursor-help">Block ID</label>
        </Tip>
        <div class="flex-1">
          <Tip :label="tips.blockId" side="top">
            <AppInput
              v-model="blockId"
              size="xs"
              :placeholder="defaultBlockId"
              class="w-full"
              @blur="commit"
              @keydown.enter="commit"
            />
          </Tip>
        </div>
      </div>

      <div class="flex items-center justify-between gap-2">
        <Tip :label="tips.layer" side="left">
          <label class="text-xs text-muted w-20 shrink-0 cursor-help">Layer</label>
        </Tip>
        <div class="flex-1">
          <Tip :label="tips.layer" side="top">
            <AppInput
              v-model="layer"
              size="xs"
              type="number"
              placeholder="авто"
              class="w-full"
              @blur="commit"
              @keydown.enter="commit"
            />
          </Tip>
        </div>
      </div>

      <div class="flex items-center justify-between py-1 border-t border-border/30">
        <Tip :label="tips.interactiveLabel" side="left">
          <label class="text-xs text-muted cursor-help">Интерактивный</label>
        </Tip>
        <Tip :label="tips.interactiveToggle" side="left">
          <AppCheckbox
            v-model="isInteractive"
            ariaLabel="Интерактивный"
            @update:model-value="commit"
          />
        </Tip>
      </div>

      <div class="flex items-center justify-between gap-2">
        <Tip :label="tips.hoverEffect" side="left">
          <label class="text-xs text-muted w-20 shrink-0 cursor-help">Hover эффект</label>
        </Tip>
        <div class="flex-1">
          <Tip :label="tips.hoverEffect" side="top">
            <AppSelect
              v-model="hoverEffect"
              :options="hoverOptions"
              size="xs"
              class="w-full"
              @update:model-value="commit"
            />
          </Tip>
        </div>
      </div>

      <div class="flex items-center justify-between gap-2">
        <Tip :label="tips.clickEffect" side="left">
          <label class="text-xs text-muted w-20 shrink-0 cursor-help">Click эффект</label>
        </Tip>
        <div class="flex-1">
          <Tip :label="tips.clickEffect" side="top">
            <AppSelect
              v-model="clickEffect"
              :options="clickOptions"
              size="xs"
              class="w-full"
              @update:model-value="commit"
            />
          </Tip>
        </div>
      </div>
    </div>
  </PanelSection>
</template>
