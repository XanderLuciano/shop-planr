<script setup lang="ts">
import type { N8nConnectionSettings } from '~/types/domain'

const props = defineProps<{
  connection: N8nConnectionSettings
}>()

const emit = defineEmits<{
  save: [connection: Partial<N8nConnectionSettings>]
}>()

const { testN8nConnection } = useSettings()

const form = reactive({
  baseUrl: props.connection.baseUrl,
  apiKey: props.connection.apiKey,
  enabled: props.connection.enabled,
})

// ---- Test Connection state ----
const testStatus = ref<'idle' | 'testing' | 'success' | 'error'>('idle')
const testMessage = ref('')

// Keep the form in sync when the parent refetches settings (e.g., after save).
watch(() => props.connection, (c) => {
  form.baseUrl = c.baseUrl
  form.apiKey = c.apiKey
  form.enabled = c.enabled
}, { deep: true })

async function onTestConnection() {
  testStatus.value = 'testing'
  testMessage.value = ''
  try {
    const result = await testN8nConnection({
      baseUrl: form.baseUrl,
      apiKey: form.apiKey,
    })
    if (result.connected) {
      testStatus.value = 'success'
      testMessage.value = 'Connected'
    } else {
      testStatus.value = 'error'
      testMessage.value = result.error ?? 'Connection failed'
    }
  } catch (e: unknown) {
    testStatus.value = 'error'
    testMessage.value = extractApiError(e, 'Connection test failed')
  }
}

function onSave() {
  emit('save', { ...form })
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2 mb-2">
      <USwitch
        v-model="form.enabled"
        size="sm"
      />
      <span class="text-xs text-(--ui-text-highlighted)">n8n Integration Enabled</span>
    </div>

    <div>
      <label class="block text-xs text-(--ui-text-muted) mb-0.5">Base URL</label>
      <UInput
        v-model="form.baseUrl"
        size="sm"
        placeholder="http://localhost:5678"
        class="w-full"
      />
      <p class="text-[10px] text-(--ui-text-dimmed) mt-1">
        The root URL of your self-hosted n8n instance. No trailing slash required.
      </p>
    </div>

    <div>
      <label class="block text-xs text-(--ui-text-muted) mb-0.5">API Key</label>
      <UInput
        v-model="form.apiKey"
        size="sm"
        type="password"
        placeholder="••••••••"
        class="w-full"
      />
      <p class="text-[10px] text-(--ui-text-dimmed) mt-1">
        Generate an API key in n8n under Settings → API. Stored encrypted-at-rest is not currently supported — treat the shop server as trusted.
      </p>
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
      <span
        v-if="testStatus === 'success'"
        class="text-xs text-green-600"
      >{{ testMessage }}</span>
      <span
        v-if="testStatus === 'error'"
        class="text-xs text-red-500"
      >{{ testMessage }}</span>
    </div>

    <div class="flex justify-end">
      <UButton
        size="xs"
        label="Save Connection"
        @click="onSave"
      />
    </div>

    <p class="text-[10px] text-(--ui-text-dimmed) pt-2 border-t border-(--ui-border)">
      Tip: <code class="bg-(--ui-bg-elevated) px-1 py-0.5 rounded">N8N_BASE_URL</code> and
      <code class="bg-(--ui-bg-elevated) px-1 py-0.5 rounded">N8N_API_KEY</code> env vars
      act as bootstrap defaults for automated deployments. Values saved here override them.
    </p>
  </div>
</template>
