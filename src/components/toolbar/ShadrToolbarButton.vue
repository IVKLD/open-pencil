<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ToolbarButton
} from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, ref, watch } from 'vue'

import { useAIChat } from '@/app/ai/chat/use'
import { useEditorStore } from '@/app/editor/active-store'
import { isNetworkActive, lastRequest } from '@/app/integrations/shadr/http/activity'
import { isSyncing, status } from '@/app/integrations/shadr/store/state'
import { checkConnection } from '@/components/event-builder/services/connection.service'
import { sceneCreatorService } from '@/components/event-builder/services/scene-creator.service'
import {
  pullComponents,
  pullProject,
  pushChangedScenes
} from '@/components/event-builder/services/sync.service'
import type { ToolbarUI } from '@/components/toolbar/types'
import AppDropdownMenuRoot from '@/components/ui/menu/AppDropdownMenuRoot.vue'
import { menu } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import toolbarTheme from '@/theme/toolbar'

const { ui, mobile = false } = defineProps<{ ui?: ToolbarUI; mobile?: boolean }>()

const store = useEditorStore()
const { activeTab: propertiesTab } = useAIChat()
const open = ref(false)

const toolbar = tv(toolbarTheme)
const styles = computed(() =>
  toolbar({ active: open.value || propertiesTab.value === 'event_builder', mobile })
)
const menuStyles = menu()

async function handleCreateScene() {
  open.value = false
  await sceneCreatorService.createScene(store, {
    target: 'currentCanvas'
  })
}

async function handlePull() {
  open.value = false
  await pullProject(store)
}

async function handlePullComponents() {
  open.value = false
  await pullComponents(store)
}

async function handlePush() {
  open.value = false
  await pushChangedScenes(store)
}

function handleOpenEventBuilder() {
  open.value = false
  propertiesTab.value = 'event_builder'
}

const isRotationLocked = computed({
  get: () => !!store.state.lockRotation,
  set: (val: boolean) => {
    store.state.lockRotation = val
    store.requestRender()
  }
})

function toggleLockRotation() {
  isRotationLocked.value = !isRotationLocked.value
}

watch(open, (isOpen) => {
  if (isOpen && status.value === 'idle') {
    void checkConnection()
  }
})

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'u') {
    event.preventDefault()
    if (!isSyncing.value) {
      void handlePush()
    }
  }
})

const tooltipText = computed(() => {
  if (isNetworkActive.value && lastRequest.value) {
    return `Shadr: Выполняется ${lastRequest.value.method} ${lastRequest.value.url}...`
  }
  if (status.value === 'online') return 'Shadr: Онлайн (Ctrl+Shift+U для отправки)'
  if (status.value === 'connecting') return 'Shadr: Подключение...'
  if (status.value === 'offline') return 'Shadr: Нет связи'
  return 'Shadr (1920×1080)'
})
const menuTips = {
  createScene: 'Создать новый экран Shadr размером 1920×1080 на текущем холсте',
  pullProject: 'Загрузить все экраны проекта Shadr с backend-сервера в OpenPencil',
  pullComponents: 'Загрузить переиспользуемые Shadr-компоненты с сервера в библиотеку Assets',
  pushCurrentPage: 'Отправить измененные сцены на сервер Shadr (Ctrl+Shift+U)',
  lockRotation: 'Заблокировать свободное вращение холста для точной верстки UI',
  eventBuilder: 'Открыть боковую панель Event Builder для настройки параметров и действий'
}
</script>

<template>
  <AppDropdownMenuRoot v-model:open="open">
    <Tip :label="tooltipText">
      <DropdownMenuTrigger as-child>
        <ToolbarButton
          data-test-id="toolbar-shadr-button"
          :aria-pressed="open"
          :data-active="open || propertiesTab === 'event_builder' || undefined"
          :data-mobile="mobile || undefined"
          aria-label="Minecraft Shadr"
          :class="styles.button({ class: ui?.button })"
        >
          <icon-lucide-loader-2
            v-if="isSyncing || isNetworkActive"
            :class="[styles.icon({ class: ui?.icon }), 'animate-spin text-primary']"
          />
          <icon-lucide-gamepad-2 v-else :class="styles.icon({ class: ui?.icon })" />
        </ToolbarButton>
      </DropdownMenuTrigger>
    </Tip>

    <DropdownMenuPortal>
      <DropdownMenuContent
        side="top"
        :side-offset="8"
        align="center"
        :class="menuStyles.content({ class: 'min-w-48' })"
      >
        <MenuScrollArea>
          <div :class="menuStyles.label()">Сцена Shadr</div>

          <DropdownMenuItem :class="menuStyles.item()" @select="handleCreateScene">
            <Tip :label="menuTips.createScene" side="right">
              <span class="w-full flex items-center gap-2">
                <icon-lucide-monitor :class="menuStyles.icon()" />
                <span class="flex-1">Новый экран (1920×1080)</span>
              </span>
            </Tip>
          </DropdownMenuItem>

          <DropdownMenuSeparator :class="menuStyles.separator()" />

          <DropdownMenuItem :disabled="isSyncing" :class="menuStyles.item()" @select="handlePull">
            <Tip :label="menuTips.pullProject" side="right">
              <span class="w-full flex items-center gap-2">
                <icon-lucide-download
                  :class="[menuStyles.icon(), { 'animate-bounce': isSyncing }]"
                />
                <span class="flex-1">Загрузить проект с сервера</span>
              </span>
            </Tip>
          </DropdownMenuItem>

          <DropdownMenuItem
            :disabled="isSyncing"
            :class="menuStyles.item()"
            @select="handlePullComponents"
          >
            <Tip :label="menuTips.pullComponents" side="right">
              <span class="w-full flex items-center gap-2">
                <icon-lucide-boxes :class="menuStyles.icon()" />
                <span class="flex-1">Загрузить компоненты в Assets</span>
              </span>
            </Tip>
          </DropdownMenuItem>

          <DropdownMenuItem :disabled="isSyncing" :class="menuStyles.item()" @select="handlePush">
            <Tip :label="menuTips.pushCurrentPage" side="right">
              <span class="w-full flex items-center gap-2">
                <icon-lucide-loader-2
                  v-if="isSyncing"
                  :class="[menuStyles.icon(), 'animate-spin text-primary']"
                />
                <icon-lucide-upload v-else :class="menuStyles.icon()" />
                <span class="flex-1">{{
                  isSyncing ? 'Загрузка на сервер...' : 'Отправить на сервер'
                }}</span>
                <span class="text-2xs text-muted font-mono ml-2">Ctrl+Shift+U</span>
              </span>
            </Tip>
          </DropdownMenuItem>

          <DropdownMenuSeparator :class="menuStyles.separator()" />

          <DropdownMenuItem :class="menuStyles.item()" @select="toggleLockRotation">
            <Tip :label="menuTips.lockRotation" side="right">
              <span class="w-full flex items-center gap-2">
                <icon-lucide-lock v-if="isRotationLocked" :class="menuStyles.icon()" />
                <icon-lucide-rotate-cw v-else :class="menuStyles.icon()" />
                <span class="flex-1">Блокировка вращения</span>
                <span
                  class="text-2xs font-mono ml-2 font-medium"
                  :class="isRotationLocked ? 'text-primary' : 'text-muted'"
                >
                  {{ isRotationLocked ? 'ВКЛ' : 'ВЫКЛ' }}
                </span>
              </span>
            </Tip>
          </DropdownMenuItem>

          <DropdownMenuItem :class="menuStyles.item()" @select="handleOpenEventBuilder">
            <Tip :label="menuTips.eventBuilder" side="right">
              <span class="w-full flex items-center gap-2">
                <icon-lucide-sliders :class="menuStyles.icon()" />
                <span class="flex-1">Панель Event Builder</span>
              </span>
            </Tip>
          </DropdownMenuItem>
        </MenuScrollArea>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </AppDropdownMenuRoot>
</template>
