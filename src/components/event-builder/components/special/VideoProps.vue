<script setup lang="ts">
import { ref, watch } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'

import { useEditorStore } from '@/app/editor/active-store'
import { getShadrData, setShadrData } from '@/app/integrations/shadr/data'
import AppInput from '@/components/ui/input/AppInput.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import AppCheckbox from '@/components/ui/toggle/AppCheckbox.vue'

const { node } = defineProps<{
  node: SceneNode
}>()

const editor = useEditorStore()

const videoSource = ref('')
const isStream = ref(false)

watch(
  () => node,
  (currentNode) => {
    const data = getShadrData(currentNode)
    videoSource.value = data.video ?? ''
    isStream.value = Boolean(data.stream)
  },
  { immediate: true, deep: true }
)

function commit() {
  const targets = editor.getSelectedNodes()
  setShadrData(editor, targets.length > 0 ? targets : [node], {
    video: videoSource.value.trim() || undefined,
    stream: isStream.value
  })
}

const tips = {
  videoSource: 'Путь к видеофайлу или URL стрима',
  isStream: 'Является ли видео живым потоком (HLS / RTSP)'
}
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <div class="flex items-center justify-between gap-2">
      <Tip :label="tips.videoSource" side="left">
        <label class="text-xs text-muted w-24 shrink-0 cursor-help">Video Source</label>
      </Tip>
      <div class="flex-1">
        <Tip :label="tips.videoSource" side="top">
          <AppInput
            v-model="videoSource"
            size="xs"
            placeholder="intro.mp4"
            class="w-full font-mono text-2xs"
            @blur="commit"
            @keydown.enter="commit"
          />
        </Tip>
      </div>
    </div>

    <div class="flex items-center justify-between py-1 border-t border-border/30">
      <Tip :label="tips.isStream" side="left">
        <label class="text-xs text-muted cursor-help">Live Stream</label>
      </Tip>
      <Tip :label="tips.isStream" side="left">
        <AppCheckbox v-model="isStream" ariaLabel="Live Stream" @update:model-value="commit" />
      </Tip>
    </div>
  </div>
</template>
