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

interface FieldConfig {
  key: 'placeholder' | 'placeholderColor' | 'hint' | 'maxLength' | 'fontSize' | 'textColor'
  label: string
  placeholder: string
  tip: string
  type?: 'number'
  fontMono?: boolean
}

const FIELDS: readonly FieldConfig[] = [
  {
    key: 'placeholder',
    label: 'Placeholder',
    placeholder: 'Никнейм...',
    tip: 'Текст подсказки, отображаемый внутри поля до ввода'
  },
  {
    key: 'placeholderColor',
    label: 'Цвет подсказки',
    placeholder: '#8a8a98',
    fontMono: true,
    tip: 'Цвет подсказки (HEX или шаблон)'
  },
  {
    key: 'hint',
    label: 'Hint',
    placeholder: 'Только латиница',
    tip: 'Вспомогательный текст подсказки под полем ввода'
  },
  {
    key: 'maxLength',
    label: 'Max Length',
    placeholder: '16',
    type: 'number',
    tip: 'Максимальное количество вводимых символов'
  },
  {
    key: 'fontSize',
    label: 'Font Size',
    placeholder: '64',
    type: 'number',
    tip: 'Размер шрифта вводимого текста (по умолчанию 26-64)'
  },
  {
    key: 'textColor',
    label: 'Text Color',
    placeholder: 'e8e8f0',
    fontMono: true,
    tip: 'Цвет вводимого текста (HEX, например ffffff или e8e8f0)'
  }
]

const values = reactive<Record<FieldConfig['key'], string | number>>({
  placeholder: '',
  placeholderColor: '',
  hint: '',
  maxLength: '',
  fontSize: '',
  textColor: ''
})

watch(
  () => node,
  (currentNode) => {
    const data = getShadrData(currentNode)
    values.placeholder = data.placeholder ?? ''
    values.placeholderColor = data.placeholderColor ?? ''
    values.hint = data.hint ?? ''
    values.maxLength = data.maxLength !== undefined ? data.maxLength : ''
    values.fontSize = typeof data.fontSize === 'number' ? data.fontSize : ''
    values.textColor = data.textColor ?? ''
  },
  { immediate: true, deep: true }
)

function commit() {
  const targets = editor.getSelectedNodes()
  setShadrData(editor, targets.length > 0 ? targets : [node], {
    placeholder: String(values.placeholder).trim() || undefined,
    placeholderColor: String(values.placeholderColor).trim() || undefined,
    hint: String(values.hint).trim() || undefined,
    maxLength: values.maxLength === '' ? undefined : Number(values.maxLength),
    fontSize: values.fontSize === '' ? undefined : Number(values.fontSize),
    textColor: String(values.textColor).trim() || undefined
  })
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
            :type="f.type"
            :placeholder="f.placeholder"
            :class="['w-full', f.fontMono && 'font-mono text-2xs']"
            @blur="commit"
            @keydown.enter="commit"
          />
        </Tip>
      </div>
    </div>
  </div>
</template>
