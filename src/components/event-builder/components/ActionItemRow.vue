<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelItemRow from '@/components/ui/panel/PanelItemRow.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import {
  type ActionType,
  SOUND_PRESETS,
  buildActionString,
  parseAction
} from '../composables/useActionBuilder'

const { actionStr, index, total, availableScenes } = defineProps<{
  actionStr: string
  index: number
  total: number
  availableScenes: string[]
}>()

const emit = defineEmits<{
  (e: 'update', index: number, value: string): void
  (e: 'move', index: number, direction: 'up' | 'down'): void
  (e: 'remove', index: number): void
}>()

const ACTION_TYPES: Array<{ value: ActionType; label: string }> = [
  { value: 'sound', label: 'Звук' },
  { value: 'open', label: 'Сцена' },
  { value: 'redirect', label: 'Редирект' },
  { value: 'close', label: 'Закрыть' },
  { value: 'set', label: 'Переменная' },
  { value: 'command', label: 'Команда' },
  { value: 'message', label: 'Чат' },
  { value: 'url', label: 'Ссылка' },
  { value: 'scroll', label: 'Скролл' },
  { value: 'custom', label: 'Свой' }
]

const DEFAULT_ACTION_VALUES: Partial<Record<ActionType, string>> = {
  sound: 'shadr.click',
  set: 'selected_tab = 1',
  command: 'say Привет',
  message: 'Сообщение',
  url: 'https://'
}

const parsed = computed(() => parseAction(actionStr))
const currentType = ref<ActionType>('sound')
const currentValue = ref('')
const isCustomSound = ref(false)

watch(
  () => actionStr,
  () => {
    const p = parsed.value
    currentType.value = p.type
    currentValue.value = p.value
    if (p.type === 'sound') {
      const isKnown = SOUND_PRESETS.some((s) => s.value === p.value && s.value !== 'custom')
      isCustomSound.value = !isKnown
    } else {
      isCustomSound.value = false
    }
  },
  { immediate: true }
)

function commitChange(type: ActionType, val: string) {
  const newStr = buildActionString(type, val)
  emit('update', index, newStr)
}

function handleTypeChange(newType: ActionType) {
  currentType.value = newType
  const defaultVal =
    newType === 'open' || newType === 'redirect'
      ? availableScenes[0] || 'main_menu'
      : (DEFAULT_ACTION_VALUES[newType] ?? '')
  currentValue.value = defaultVal
  commitChange(newType, defaultVal)
}

function handleSoundChange(val: string) {
  if (val === 'custom') {
    isCustomSound.value = true
    currentValue.value = ''
  } else {
    isCustomSound.value = false
    currentValue.value = val
    commitChange('sound', val)
  }
}

const sceneOptions = computed(() => availableScenes.map((s) => ({ value: s, label: s })))

const openSceneTip = computed(() =>
  currentType.value === 'redirect'
    ? 'Экран Shadr для немедленного перехода без закрытия'
    : 'Экран Shadr, на который перейдет игрок при нажатии'
)

const tips = {
  actionType:
    'Тип события: sound (звук), open (экран), close (закрыть), command (команда), url (ссылка)',
  customSound:
    'Идентификатор звука Minecraft или ресурспака (например: entity.experience_orb.pickup)',
  presetsList: 'Вернуться к списку стандартных пресетов звуков Shadr',
  soundPresets: 'Выберите звуковой эффект из стандартного набора Shadr',
  closeAction: 'Действие close: закрывает текущий открытый экран Shadr и возвращает в игру',
  defaultAction: 'Значение действия: команда консоли (например say Привет), текст или URL',
  moveUp: 'Переместить действие выше в цепочке',
  moveDown: 'Переместить действие ниже в цепочке',
  remove: 'Удалить это действие из цепочки'
}
</script>

<template>
  <PanelItemRow class="px-1 py-0.5 rounded hover:bg-hover/30 transition-colors">
    <div class="w-20 shrink-0">
      <Tip :label="tips.actionType" side="top">
        <AppSelect
          :model-value="currentType"
          :options="ACTION_TYPES"
          size="xs"
          :ui="{ trigger: 'w-full' }"
          @update:model-value="(val) => handleTypeChange(val as ActionType)"
        />
      </Tip>
    </div>

    <div class="flex-1 min-w-0">
      <template v-if="currentType === 'sound'">
        <div v-if="isCustomSound" class="flex items-center gap-1">
          <div class="flex-1">
            <Tip :label="tips.customSound" side="top">
              <AppInput
                v-model="currentValue"
                size="xs"
                placeholder="звук"
                class="w-full text-2xs font-mono"
                @blur="commitChange('sound', currentValue)"
                @keydown.enter="commitChange('sound', currentValue)"
              />
            </Tip>
          </div>
          <Tip :label="tips.presetsList" side="top">
            <IconButton size="xs" label="К пресетам" @click="handleSoundChange('shadr.click')">
              <icon-lucide-list class="size-3 text-muted hover:text-surface" />
            </IconButton>
          </Tip>
        </div>
        <Tip v-else :label="tips.soundPresets" side="top">
          <AppSelect
            :model-value="currentValue"
            :options="SOUND_PRESETS"
            size="xs"
            :ui="{ trigger: 'w-full font-mono text-2xs' }"
            @update:model-value="handleSoundChange"
          />
        </Tip>
      </template>

      <Tip
        v-else-if="currentType === 'open' || currentType === 'redirect'"
        :label="openSceneTip"
        side="top"
      >
        <AppSelect
          :model-value="currentValue"
          :options="sceneOptions"
          size="xs"
          placeholder="Сцена"
          :ui="{ trigger: 'w-full font-mono text-2xs' }"
          @update:model-value="
            (val) => {
              currentValue = String(val)
              commitChange(currentType, String(val))
            }
          "
        />
      </Tip>

      <Tip v-else-if="currentType === 'close'" :label="tips.closeAction" side="top">
        <span class="text-2xs text-muted/70 italic px-1 block truncate cursor-help">
          Закрыть экран
        </span>
      </Tip>

      <Tip v-else :label="tips.defaultAction" side="top">
        <AppInput
          v-model="currentValue"
          size="xs"
          class="w-full text-2xs font-mono"
          @blur="commitChange(currentType, currentValue)"
          @keydown.enter="commitChange(currentType, currentValue)"
        />
      </Tip>
    </div>

    <template #rail="{ removeClass }">
      <Tip v-if="total > 1 && index > 0" :label="tips.moveUp" side="left">
        <IconButton size="xs" label="Вверх" @click="emit('move', index, 'up')">
          <icon-lucide-chevron-up class="size-3 text-muted hover:text-surface" />
        </IconButton>
      </Tip>
      <Tip v-if="total > 1 && index < total - 1" :label="tips.moveDown" side="left">
        <IconButton size="xs" label="Вниз" @click="emit('move', index, 'down')">
          <icon-lucide-chevron-down class="size-3 text-muted hover:text-surface" />
        </IconButton>
      </Tip>
      <Tip :label="tips.remove" side="left">
        <IconButton
          size="xs"
          label="Удалить"
          :class="[removeClass, 'shrink-0']"
          @click="emit('remove', index)"
        >
          <icon-lucide-minus class="size-3 text-muted hover:text-surface" />
        </IconButton>
      </Tip>
    </template>
  </PanelItemRow>
</template>
