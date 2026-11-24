<script setup lang="ts">
import Tip from '@/components/ui/overlay/Tip.vue'

const tips = {
  selectionGuide:
    'Нажмите на любой элемент или фрейм на холсте OpenPencil, чтобы настроить его параметры Shadr'
}
</script>

<template>
  <Tip :label="tips.selectionGuide" side="top">
    <div
      class="flex flex-col items-center justify-center p-6 text-center text-muted gap-2 cursor-help"
    >
      <icon-lucide-mouse-pointer-click class="size-8 opacity-40" />
      <span class="text-xs">
        Выберите элемент на холсте для настройки интерактивности и эффектов Shadr
      </span>
    </div>
  </Tip>
</template>
