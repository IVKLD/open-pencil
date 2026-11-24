<script setup lang="ts">
import { computed, type Component } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'

import { getShadrData } from '@/app/integrations/shadr/data'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

import ItemProps from './special/ItemProps.vue'
import ScrollRegionProps from './special/ScrollRegionProps.vue'
import SliderProps from './special/SliderProps.vue'
import TextInputProps from './special/TextInputProps.vue'
import ToggleProps from './special/ToggleProps.vue'
import VideoProps from './special/VideoProps.vue'

const { node } = defineProps<{
  node: SceneNode
}>()

interface SpecialConfig {
  component: Component
  title: string
  tip: string
}

const SPECIAL_CONFIG: Record<string, SpecialConfig> = {
  text_input: {
    component: TextInputProps,
    title: 'Свойства поля ввода (text_input)',
    tip: 'Настройка поля ввода текста: placeholder, цвет подсказки, hint и лимит символов'
  },
  item: {
    component: ItemProps,
    title: 'Предмет Minecraft (item)',
    tip: 'Настройка отображения предметов Minecraft и кастомных моделей CustomModelData'
  },
  slider: {
    component: SliderProps,
    title: 'Свойства ползунка (slider)',
    tip: 'Настройка диапазона числовых значений и шага для элемента slider'
  },
  toggle: {
    component: ToggleProps,
    title: 'Свойства переключателя (toggle)',
    tip: 'Настройка состояния переключателя (чекбокса)'
  },
  video: {
    component: VideoProps,
    title: 'Свойства видео (video)',
    tip: 'Настройка воспроизведения локального видеофайла или стрима'
  },
  scrollRegion: {
    component: ScrollRegionProps,
    title: 'Параметры скролл-области',
    tip: 'Настройка параметров контейнера скролла: высота контента, шаг и привязка к скроллбару'
  }
}

const rawType = computed(() => getShadrData(node).rawType || 'block')
const currentConfig = computed(() => SPECIAL_CONFIG[rawType.value])
</script>

<template>
  <PanelSection v-if="currentConfig" :label="currentConfig.title">
    <template #actions>
      <Tip :label="currentConfig.tip" side="left">
        <icon-lucide-help-circle class="size-3 text-muted/60 hover:text-surface cursor-help" />
      </Tip>
    </template>
    <component :is="currentConfig.component" :node="node" />
  </PanelSection>
</template>
