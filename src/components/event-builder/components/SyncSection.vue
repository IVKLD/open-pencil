<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

import { useShadrStore } from '../useShadrStore'

const editor = useEditorStore()
const shadr = useShadrStore()

const newSceneName = ref('')
const isCreatingScene = ref(false)

const projectScenes = computed(() => {
  const pages = editor.graph.getPages()
  const names = pages.map((p) => p.name).filter((n) => n !== '_components')
  return names.length > 0 ? names : shadr.serverPages.value
})

const activeSceneName = computed(() => {
  const current = editor.graph.getPages().find((p) => p.id === editor.state.currentPageId)
  return current ? current.name : shadr.selectedPageId.value || 'main_menu'
})

const selectedScene = ref(activeSceneName.value)

watch(activeSceneName, (val) => {
  if (val) selectedScene.value = val
})

function handleSceneChange() {
  if (!selectedScene.value) return
  void shadr.switchScene(selectedScene.value, editor)
}

function handleCreateScene() {
  const name = newSceneName.value.trim()
  if (!name) return
  void shadr.createScene(name, editor)
  newSceneName.value = ''
  isCreatingScene.value = false
}

function handlePullProject() {
  void shadr.pullProject(editor)
}

function handlePullComponents() {
  void shadr.pullComponents(editor)
}

function handlePushProject() {
  void shadr.pushProject(editor)
}

function handlePushCurrentScene() {
  void shadr.pushCurrentPage(editor, activeSceneName.value)
}
</script>

<template>
  <PanelSection label="Проект и сцены Shadr">
    <div class="flex flex-col gap-2.5">
      <!-- Project actions -->
      <div class="flex flex-col gap-1 p-2 rounded bg-surface-hover/60 border border-border/40">
        <div class="text-[10px] text-muted flex items-center justify-between font-medium">
          <span>Синхронизация проекта</span>
          <span class="text-primary">{{ projectScenes.length }} сцен</span>
        </div>
        <div class="flex items-center gap-1.5 mt-1">
          <AppButton
            size="xs"
            variant="solid"
            color="primary"
            class="flex-1"
            :disabled="shadr.isSyncing.value"
            @click="handlePullProject"
          >
            <icon-lucide-download-cloud class="size-3 mr-1" />
            Pull проект
          </AppButton>
          <AppButton
            size="xs"
            variant="ghost"
            class="flex-1 border border-border"
            :disabled="shadr.isSyncing.value"
            @click="handlePushProject"
          >
            <icon-lucide-upload-cloud class="size-3 mr-1" />
            Deploy проект
          </AppButton>
        </div>
      </div>

      <!-- Assets / Components quick sync -->
      <div class="flex flex-col gap-1 p-2 rounded bg-surface-hover/60 border border-border/40">
        <div class="text-[10px] text-muted flex items-center justify-between font-medium">
          <span>Компоненты в Assets</span>
          <span class="text-primary">{{ shadr.serverComponents.value.length }} на сервере</span>
        </div>
        <AppButton
          size="xs"
          variant="ghost"
          class="w-full mt-1 border border-border text-xs"
          :disabled="shadr.isSyncing.value"
          @click="handlePullComponents"
        >
          <icon-lucide-boxes class="size-3 mr-1.5 text-component" />
          Загрузить компоненты в Assets
        </AppButton>
      </div>

      <!-- Current Scene Switcher -->
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between">
          <label class="text-[10px] text-muted font-medium">Текущая сцена (Page)</label>
          <button
            type="button"
            class="text-[10px] text-primary hover:underline"
            @click="isCreatingScene = !isCreatingScene"
          >
            {{ isCreatingScene ? 'Отмена' : '+ Новая сцена' }}
          </button>
        </div>

        <div v-if="isCreatingScene" class="flex items-center gap-1.5 py-1">
          <AppInput
            v-model="newSceneName"
            placeholder="имя_сцены"
            class="flex-1"
            @keydown.enter="handleCreateScene"
          />
          <AppButton size="xs" variant="solid" color="primary" @click="handleCreateScene">
            Создать
          </AppButton>
        </div>

        <div class="flex items-center gap-1.5">
          <select
            v-model="selectedScene"
            class="flex-1 h-7 px-2 rounded bg-surface border border-border text-xs focus:outline-none focus:border-primary"
            @change="handleSceneChange"
          >
            <option v-for="id in projectScenes" :key="id" :value="id">
              {{ id }}
            </option>
          </select>
          <AppButton
            size="xs"
            variant="ghost"
            :disabled="shadr.isSyncing.value"
            @click="handlePushCurrentScene"
          >
            <icon-lucide-upload class="size-3 mr-1" />
            Deploy сцену
          </AppButton>
        </div>
      </div>

      <div
        v-if="shadr.lastError.value"
        class="text-[11px] text-danger bg-danger/10 p-2 rounded border border-danger/20"
      >
        {{ shadr.lastError.value }}
      </div>
    </div>
  </PanelSection>
</template>
