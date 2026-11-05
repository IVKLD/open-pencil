<script setup lang="ts">
import { computed, ref } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

import { useShadrStore } from '../useShadrStore'

const DEFAULT_COMPONENTS = [
  'button',
  'button_ghost',
  'badge',
  'divider',
  'stat_chip',
  'progress_bar',
  'panel',
  'tab',
  'toast',
  'tooltip',
  'modal',
  'list_row',
  'section_header'
]

const editor = useEditorStore()
const shadr = useShadrStore()

const availableComponents = computed(() => {
  const fromServer = shadr.serverComponents.value
  return fromServer.length > 0 ? fromServer : DEFAULT_COMPONENTS
})

const selectedComp = ref(shadr.selectedComponentId.value || 'button')
const deployName = ref(selectedComp.value)

function handleInsert(name?: string) {
  const compId = name || selectedComp.value
  void shadr.insertComponentInstance(compId, editor)
}

function handlePullComponent() {
  if (!selectedComp.value) return
  deployName.value = selectedComp.value
  void shadr.pullComponent(selectedComp.value, editor)
}

function handleDeployComponent() {
  const name = deployName.value.trim() || selectedComp.value || 'button'
  void shadr.pushCurrentComponent(editor, name)
}
</script>

<template>
  <PanelSection label="Компоненты Shadr">
    <div class="flex flex-col gap-2.5">
      <div class="flex flex-col gap-1">
        <label class="text-[10px] text-muted font-medium">Выбрать компонент</label>
        <div class="flex items-center gap-1.5">
          <select
            v-model="selectedComp"
            class="flex-1 h-7 px-2 rounded bg-surface border border-border text-xs focus:outline-none focus:border-primary"
          >
            <option v-for="id in availableComponents" :key="id" :value="id">
              {{ id }}
            </option>
          </select>
          <AppButton
            size="xs"
            variant="solid"
            color="primary"
            :disabled="shadr.isSyncing.value || !selectedComp"
            @click="() => handleInsert()"
          >
            <icon-lucide-plus class="size-3 mr-1" />
            Вставить
          </AppButton>
          <AppButton
            size="xs"
            variant="ghost"
            :disabled="shadr.isSyncing.value || !selectedComp"
            @click="handlePullComponent"
          >
            <icon-lucide-edit-3 class="size-3 mr-1" />
            Правка
          </AppButton>
        </div>
      </div>

      <!-- Quick insert chips -->
      <div class="flex flex-col gap-1">
        <label class="text-[10px] text-muted font-medium">Быстрая вставка</label>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="chip in ['button', 'badge', 'divider', 'stat_chip', 'panel', 'progress_bar']"
            :key="chip"
            type="button"
            class="px-2 py-0.5 rounded text-[11px] bg-surface hover:bg-surface-hover border border-border/60 transition-colors"
            @click="() => handleInsert(chip)"
          >
            + {{ chip }}
          </button>
        </div>
      </div>

      <!-- Deploy component -->
      <div v-if="shadr.currentDocumentType.value === 'component'" class="flex flex-col gap-1 pt-2 border-t border-border/40">
        <label class="text-[10px] text-muted font-medium">Сохранить компонент на сервер</label>
        <div class="flex items-center gap-1.5">
          <AppInput v-model="deployName" placeholder="button" class="flex-1" />
          <AppButton
            size="xs"
            color="primary"
            variant="solid"
            :disabled="shadr.isSyncing.value"
            @click="handleDeployComponent"
          >
            <icon-lucide-upload-cloud class="size-3 mr-1" />
            Сохранить
          </AppButton>
        </div>
      </div>
    </div>
  </PanelSection>
</template>
