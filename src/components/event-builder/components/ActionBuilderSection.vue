<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'

import { useEditorStore } from '@/app/editor/active-store'
import { shadrConverter } from '@/app/integrations/shadr/converter'
import { getShadrData, setShadrData } from '@/app/integrations/shadr/data'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

import { useShadrStore } from '../useShadrStore'
import ActionItemRow from './ActionItemRow.vue'

const { node } = defineProps<{
  node: SceneNode
}>()

const editor = useEditorStore()
const shadr = useShadrStore()

const activeTab = ref<'click' | 'submit'>('click')
const clickActions = ref<string[]>([])
const submitActions = ref<string[]>([])
const isTextInput = ref(false)

const availableScenes = computed(() => {
  void editor.state.sceneVersion
  const names = shadrConverter.listProjectSceneNames(editor)
  const server = shadr.serverPages.value
  const set = new Set([...names, ...server])
  return Array.from(set)
})

watch(
  () => node,
  (currentNode) => {
    const data = getShadrData(currentNode)
    clickActions.value = [...(data.onClickAction ?? [])]
    submitActions.value = [...(data.onSubmitAction ?? [])]
    isTextInput.value = data.rawType === 'text_input'
    if (!isTextInput.value) {
      activeTab.value = 'click'
    }
  },
  { immediate: true, deep: true }
)

const currentActions = computed({
  get: () => (activeTab.value === 'click' ? clickActions.value : submitActions.value),
  set: (val: string[]) => {
    if (activeTab.value === 'click') clickActions.value = val
    else submitActions.value = val
  }
})

const tabOptions = computed(() => [
  { value: 'click', label: `Клик (${clickActions.value.length})` },
  { value: 'submit', label: `Enter (${submitActions.value.length})` }
])

const sectionLabel = computed(() => {
  if (isTextInput.value) return 'Действия поля ввода'
  return `Действия по клику (${clickActions.value.length})`
})

function commit() {
  const targets = editor.getSelectedNodes()
  const list = targets.length > 0 ? targets : [node]
  if (activeTab.value === 'click') {
    setShadrData(editor, list, {
      onClickAction: clickActions.value.length > 0 ? clickActions.value : undefined
    })
  } else {
    setShadrData(editor, list, {
      onSubmitAction: submitActions.value.length > 0 ? submitActions.value : undefined
    })
  }
}

function addRawAction(actionStr: string) {
  if (!actionStr.trim()) return
  currentActions.value = [...currentActions.value, actionStr.trim()]
  commit()
}

function updateAction(index: number, newStr: string) {
  if (!newStr.trim()) return
  const next = [...currentActions.value]
  next[index] = newStr.trim()
  currentActions.value = next
  commit()
}

function removeAction(index: number) {
  const next = [...currentActions.value]
  next.splice(index, 1)
  currentActions.value = next
  commit()
}

function moveAction(index: number, direction: 'up' | 'down') {
  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= currentActions.value.length) return
  const next = [...currentActions.value]
  const item = next[index]
  next.splice(index, 1)
  next.splice(target, 0, item)
  currentActions.value = next
  commit()
}

const tips = {
  addAction: 'Добавить новое действие в цепочку событий этого блока',
  tabs: 'Переключение между действиями по клику (onClickAction) и по нажатию Enter в поле ввода (onSubmitAction)',
  createFirstAction: 'Создать первое действие в цепочке событий',
  presets: 'Быстрые пресеты популярных действий для интерфейсов Shadr',
  soundPreset: 'Добавить воспроизведение стандартного клика (sound: shadr.click)',
  closePreset: 'Добавить закрытие текущего экрана модального окна или меню (close:)',
  errorPreset: 'Добавить воспроизведение звука ошибки (sound: shadr.error)'
}
</script>

<template>
  <PanelSection :label="sectionLabel">
    <template #actions>
      <Tip :label="tips.addAction" side="left">
        <IconButton size="xs" label="Добавить действие" @click="addRawAction('sound: shadr.click')">
          <icon-lucide-plus class="size-3.5 text-muted hover:text-surface" />
        </IconButton>
      </Tip>
    </template>

    <div class="flex flex-col gap-2.5">
      <!-- Tabs: only shown for text_input where Enter action exists -->
      <Tip v-if="isTextInput" :label="tips.tabs" side="bottom">
        <SegmentedControl
          v-model="activeTab"
          :options="tabOptions"
          size="sm"
          label="Тип действия"
          class="w-full"
        />
      </Tip>

      <!-- Action items list -->
      <div v-if="currentActions.length > 0" class="flex flex-col gap-1.5">
        <ActionItemRow
          v-for="(act, idx) in currentActions"
          :key="`${act}_${idx}`"
          :action-str="act"
          :index="idx"
          :total="currentActions.length"
          :available-scenes="availableScenes"
          @update="updateAction"
          @move="moveAction"
          @remove="removeAction"
        />
      </div>

      <!-- Empty state with direct add button -->
      <div
        v-else
        class="flex flex-col items-center justify-center gap-1.5 py-3 px-2 border border-dashed border-border/40 rounded-md bg-panel-secondary/20"
      >
        <span class="text-2xs text-muted/80">Нет назначенных действий</span>
        <Tip :label="tips.createFirstAction" side="top">
          <AppButton
            size="xs"
            variant="outline"
            color="neutral"
            class="text-2xs"
            @click="addRawAction('sound: shadr.click')"
          >
            <icon-lucide-plus class="size-3 mr-1" />
            Добавить действие
          </AppButton>
        </Tip>
      </div>

      <!-- Quick presets -->
      <div class="flex items-center gap-1 pt-1 border-t border-border/30">
        <Tip :label="tips.presets" side="top">
          <span class="text-2xs text-muted/70 font-medium shrink-0 cursor-help">Быстро:</span>
        </Tip>
        <div class="flex flex-wrap gap-1 flex-1">
          <Tip :label="tips.soundPreset" side="top">
            <button
              type="button"
              class="text-2xs px-1.5 py-0.5 rounded bg-panel-secondary/60 hover:bg-hover text-muted hover:text-surface border border-border/30 transition-colors cursor-pointer"
              @click="addRawAction('sound: shadr.click')"
            >
              + Звук
            </button>
          </Tip>
          <Tip :label="tips.closePreset" side="top">
            <button
              type="button"
              class="text-2xs px-1.5 py-0.5 rounded bg-panel-secondary/60 hover:bg-hover text-muted hover:text-surface border border-border/30 transition-colors cursor-pointer"
              @click="addRawAction('close:')"
            >
              + Закрыть
            </button>
          </Tip>
          <Tip :label="tips.errorPreset" side="top">
            <button
              type="button"
              class="text-2xs px-1.5 py-0.5 rounded bg-panel-secondary/60 hover:bg-hover text-muted hover:text-surface border border-border/30 transition-colors cursor-pointer"
              @click="addRawAction('sound: shadr.error')"
            >
              + Ошибка
            </button>
          </Tip>
        </div>
      </div>
    </div>
  </PanelSection>
</template>
