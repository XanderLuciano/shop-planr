<script setup lang="ts">
import type { JiraConnectionSettings } from '~/server/types/domain'

const props = defineProps<{
  connection: JiraConnectionSettings
}>()

const emit = defineEmits<{
  save: [connection: Partial<JiraConnectionSettings>]
}>()

const form = reactive({
  baseUrl: props.connection.baseUrl,
  projectKey: props.connection.projectKey,
  username: props.connection.username,
  apiToken: props.connection.apiToken,
  enabled: props.connection.enabled,
  pushEnabled: props.connection.pushEnabled,
})

const testStatus = ref<'idle' | 'testing' | 'success' | 'error'>('idle')

watch(
  () => props.connection,
  (c) => {
    form.baseUrl = c.baseUrl
    form.projectKey = c.projectKey
    form.username = c.username
    form.apiToken = c.apiToken
    form.enabled = c.enabled
    form.pushEnabled = c.pushEnabled
  },
  { deep: true }
)

function onTestConnection() {
  testStatus.value = 'testing'
  setTimeout(() => {
    if (form.baseUrl && form.username && form.apiToken) {
      testStatus.value = 'success'
    } else {
      testStatus.value = 'error'
    }
  }, 800)
}

function onSave() {
  emit('save', { ...form })
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-4 mb-2">
      <div class="flex items-center gap-2">
        <USwitch v-model="form.enabled" size="sm" />
        <span class="text-xs text-(--ui-text-highlighted)">Jira Enabled</span>
      </div>
      <div class="flex items-center gap-2">
        <USwitch v-model="form.pushEnabled" size="sm" :disabled="!form.enabled" />
        <span
          class="text-xs"
          :class="form.enabled ? 'text-(--ui-text-highlighted)' : 'text-(--ui-text-muted)'"
          >Push Enabled</span
        >
      </div>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <div>
        <label class="block text-xs text-(--ui-text-muted) mb-0.5">Base URL</label>
        <UInput v-model="form.baseUrl" size="sm" placeholder="https://jira.example.com" />
      </div>
      <div>
        <label class="block text-xs text-(--ui-text-muted) mb-0.5">Project Key</label>
        <UInput v-model="form.projectKey" size="sm" placeholder="PI" />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <div>
        <label class="block text-xs text-(--ui-text-muted) mb-0.5">Username</label>
        <UInput v-model="form.username" size="sm" placeholder="user@example.com" />
      </div>
      <div>
        <label class="block text-xs text-(--ui-text-muted) mb-0.5">API Token</label>
        <UInput v-model="form.apiToken" size="sm" type="password" placeholder="••••••••" />
      </div>
    </div>

    <div class="flex items-center gap-2">
      <UButton
        size="xs"
        variant="soft"
        color="neutral"
        icon="i-lucide-wifi"
        label="Test Connection"
        :loading="testStatus === 'testing'"
        @click="onTestConnection"
      />
      <span v-if="testStatus === 'success'" class="text-xs text-green-600">Connected</span>
      <span v-if="testStatus === 'error'" class="text-xs text-red-500"
        >Fill in all fields first</span
      >
    </div>

    <div class="flex justify-end">
      <UButton size="xs" label="Save Connection" @click="onSave" />
    </div>
  </div>
</template>
