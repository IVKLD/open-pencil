<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import {
  clearRequestLogs,
  isNetworkActive,
  lastRequest,
  requestLogs
} from '@/app/integrations/shadr/http/activity'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppPasswordInput from '@/components/ui/input/AppPasswordInput.vue'
import Tip from '@/components/ui/overlay/Tip.vue'

import { useShadrStore } from '../useShadrStore'

const shadr = useShadrStore()
const showKeyInput = ref(false)
const showActivity = ref(false)
const userKeyDraft = ref(shadr.token.value)

onMounted(() => {
  if (shadr.status.value === 'idle') {
    void shadr.checkConnection()
  }
})

function handleSaveKey() {
  shadr.saveUserKey(userKeyDraft.value)
  showKeyInput.value = false
}

function methodBadgeClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'bg-sky-500/15 text-sky-400 border-sky-500/30'
    case 'POST':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    case 'PUT':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    case 'DELETE':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30'
    default:
      return 'bg-muted/20 text-muted border-border'
  }
}

const statusTip = computed(() => {
  if (shadr.isOnline.value) {
    return 'Сервер Shadr подключен и готов к синхронизации'
  }
  if (shadr.isConnecting.value) {
    return 'Идет проверка соединения с сервером...'
  }
  return 'Нет связи с сервером Shadr. Проверьте сеть или ключ доступа'
})

const tokenButtonTip = computed(() =>
  shadr.token.value
    ? 'Bearer-ключ авторизации задан. Нажмите, чтобы изменить'
    : 'Ввести персональный Bearer-ключ для авторизации на сервере Shadr'
)

const tips = {
  networkActivity: 'Сетевая активность: журнал HTTP-запросов к backend',
  checkConnection: 'Проверить соединение и обновить статус связи с сервером',
  saveToken: 'Сохранить токен доступа в браузере и выполнить проверку авторизации',
  inFlightRequest: 'Выполняется асинхронный HTTP-запрос к серверу Shadr',
  clearLogs: 'Очистить историю сетевых запросов',
  closeActivity: 'Закрыть панель журнала сетевой активности',
  closeKeyDrawer: 'Закрыть форму ввода ключа авторизации',
  tokenInput: 'Введите персональный токен (Bearer) для взаимодействия с backend Shadr'
}
</script>

<template>
  <div class="p-2 border-b border-border/40 bg-panel-secondary/30 flex flex-col gap-2">
    <!-- Status Plate -->
    <div class="flex items-center justify-between gap-2">
      <Tip :label="statusTip" side="bottom">
        <div class="flex items-center gap-2 min-w-0 cursor-help">
          <span
            class="size-2 rounded-full shrink-0"
            :class="
              shadr.isOnline.value
                ? 'bg-success'
                : shadr.isConnecting.value
                  ? 'bg-warning animate-pulse'
                  : 'bg-error'
            "
          />
          <span class="text-xs font-medium text-surface truncate">
            {{
              shadr.isOnline.value
                ? 'Подключено'
                : shadr.isConnecting.value
                  ? 'Подключение...'
                  : 'Нет связи'
            }}
          </span>
        </div>
      </Tip>

      <div class="flex items-center gap-1 shrink-0">
        <!-- Network Activity Toggle -->
        <Tip :label="tips.networkActivity" side="bottom">
          <AppButton
            size="xs"
            variant="subtle"
            class="cursor-pointer border border-border/60 bg-panel-field/50 hover:bg-hover hover:border-border text-surface/90 hover:text-surface px-1.5 transition-all"
            :class="{
              'border-primary/60 text-primary bg-primary/10 shadow-sm':
                showActivity || isNetworkActive,
              'border-error/40 text-error bg-error/10':
                !isNetworkActive && lastRequest?.status === 'error' && !showActivity
            }"
            @click="showActivity = !showActivity"
          >
            <template #leading>
              <icon-lucide-activity
                class="size-3"
                :class="{
                  'animate-pulse text-primary': isNetworkActive,
                  'text-error': !isNetworkActive && lastRequest?.status === 'error',
                  'text-success': !isNetworkActive && lastRequest?.status === 'success'
                }"
              />
            </template>
            <span class="text-2xs font-mono">
              {{ isNetworkActive ? 'Запрос...' : `Сеть (${requestLogs.length})` }}
            </span>
          </AppButton>
        </Tip>

        <Tip :label="tokenButtonTip" side="bottom">
          <AppButton
            size="xs"
            :variant="shadr.token.value ? 'subtle' : 'solid'"
            :color="shadr.token.value ? 'neutral' : 'primary'"
            class="cursor-pointer border border-border/60 bg-panel-field/50 hover:bg-hover hover:border-border text-surface/90 hover:text-surface transition-all px-1.5"
            :class="{ 'border-primary/60 text-primary bg-primary/10 shadow-sm': showKeyInput }"
            @click="showKeyInput = !showKeyInput"
          >
            <template #leading>
              <icon-lucide-key
                class="size-3"
                :class="{
                  'text-primary': shadr.token.value,
                  'text-on-primary': !shadr.token.value
                }"
              />
            </template>
            <span class="text-2xs">{{ shadr.token.value ? 'Ключ задан' : 'Ключ' }}</span>
          </AppButton>
        </Tip>

        <Tip :label="tips.checkConnection" side="bottom">
          <IconButton size="xs" label="Проверить соединение" @click="shadr.checkConnection">
            <icon-lucide-refresh-cw
              class="size-3 text-muted hover:text-surface transition-colors"
              :class="{ 'animate-spin': shadr.isConnecting.value || isNetworkActive }"
            />
          </IconButton>
        </Tip>
      </div>
    </div>

    <!-- Active In-Flight Request Live Indicator -->
    <Tip v-if="isNetworkActive && lastRequest" :label="tips.inFlightRequest" side="bottom">
      <div
        class="flex items-center justify-between px-2 py-1 rounded bg-primary/10 border border-primary/25 text-2xs animate-pulse text-primary font-mono shadow-xs cursor-help"
      >
        <div class="flex items-center gap-1.5 min-w-0">
          <icon-lucide-loader-2 class="size-3 animate-spin shrink-0 text-primary" />
          <span class="font-bold shrink-0">{{ lastRequest.method }}</span>
          <span class="truncate">{{ lastRequest.url }}</span>
        </div>
        <span class="shrink-0 text-muted ml-1 font-sans">отправка...</span>
      </div>
    </Tip>

    <!-- Network Activity Log Drawer -->
    <div
      v-if="showActivity"
      class="flex flex-col gap-1.5 p-2 rounded-md bg-panel border border-border text-xs shadow-md"
    >
      <div class="flex items-center justify-between border-b border-border/50 pb-1.5">
        <div class="flex items-center gap-1.5 font-medium text-surface text-2xs">
          <icon-lucide-activity class="size-3 text-primary" />
          <span>Журнал сетевых запросов</span>
          <span
            v-if="requestLogs.length > 0"
            class="px-1 rounded-sm bg-panel-field text-muted text-2xs font-mono"
          >
            {{ requestLogs.length }}
          </span>
        </div>
        <div class="flex items-center gap-1">
          <Tip v-if="requestLogs.length > 0" :label="tips.clearLogs" side="left">
            <IconButton size="xs" label="Очистить историю" @click="clearRequestLogs">
              <icon-lucide-trash-2 class="size-3 text-muted hover:text-surface" />
            </IconButton>
          </Tip>
          <Tip :label="tips.closeActivity" side="left">
            <IconButton size="xs" label="Закрыть" @click="showActivity = false">
              <icon-lucide-x class="size-3.5" />
            </IconButton>
          </Tip>
        </div>
      </div>

      <!-- Log Entries List -->
      <div class="flex flex-col gap-1 max-h-48 overflow-y-auto pr-0.5">
        <div
          v-for="log in requestLogs"
          :key="log.id"
          class="flex flex-col gap-0.5 p-1.5 rounded bg-panel-field/40 border border-border/40 text-2xs hover:bg-hover/40 transition-colors"
        >
          <div class="flex items-center justify-between gap-1.5 font-mono">
            <div class="flex items-center gap-1 min-w-0">
              <span
                class="px-1 py-0.5 rounded text-3xs font-bold border uppercase shrink-0"
                :class="methodBadgeClass(log.method)"
              >
                {{ log.method }}
              </span>
              <Tip :label="log.url" side="top">
                <span class="truncate text-surface font-medium cursor-help">{{ log.url }}</span>
              </Tip>
            </div>

            <!-- Status Indicator -->
            <div class="flex items-center gap-1 shrink-0">
              <template v-if="log.status === 'pending'">
                <icon-lucide-loader-2 class="size-2.5 animate-spin text-warning" />
                <span class="text-warning text-3xs">Wait...</span>
              </template>
              <template v-else-if="log.status === 'success'">
                <icon-lucide-check class="size-2.5 text-success" />
                <span class="text-success text-3xs font-semibold">{{ log.statusCode ?? 200 }}</span>
                <span v-if="log.durationMs" class="text-muted text-3xs"
                  >({{ log.durationMs }}ms)</span
                >
              </template>
              <template v-else>
                <icon-lucide-alert-circle class="size-2.5 text-error" />
                <span class="text-error text-3xs font-semibold">{{ log.statusCode ?? 'ERR' }}</span>
                <span v-if="log.durationMs" class="text-muted text-3xs"
                  >({{ log.durationMs }}ms)</span
                >
              </template>
            </div>
          </div>

          <!-- Error details line -->
          <div
            v-if="log.errorMessage"
            class="text-3xs text-error font-sans pl-1 border-l border-error/50 break-words mt-0.5"
          >
            {{ log.errorMessage }}
          </div>

          <div class="text-3xs text-muted/70 text-right font-mono">
            {{ log.timeFormatted }}
          </div>
        </div>

        <div v-if="requestLogs.length === 0" class="py-4 text-center text-muted text-2xs italic">
          Запросов к backend пока не выполнялось
        </div>
      </div>
    </div>

    <!-- User Key input overlay/drawer -->
    <div
      v-if="showKeyInput"
      class="flex flex-col gap-2 p-2.5 rounded-md bg-panel border border-border text-xs shadow-md"
    >
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-surface">Персональный ключ доступа (Bearer)</span>
        <Tip :label="tips.closeKeyDrawer" side="left">
          <IconButton size="xs" label="Закрыть" @click="showKeyInput = false">
            <icon-lucide-x class="size-3.5" />
          </IconButton>
        </Tip>
      </div>

      <p class="text-2xs text-muted leading-tight">
        Хост получен из <span class="font-mono text-primary font-semibold">ENV</span>. Введите ключ
        для авторизации на сервере:
      </p>

      <div class="flex items-center gap-1.5">
        <div class="flex-1">
          <Tip :label="tips.tokenInput" side="top">
            <AppPasswordInput
              v-model="userKeyDraft"
              size="xs"
              placeholder="Секретный ключ Shadr"
              class="w-full font-mono"
              @keydown.enter="handleSaveKey"
            />
          </Tip>
        </div>
        <Tip :label="tips.saveToken" side="top">
          <AppButton size="xs" variant="solid" color="primary" @click="handleSaveKey">
            Сохранить
          </AppButton>
        </Tip>
      </div>
    </div>
  </div>
</template>
