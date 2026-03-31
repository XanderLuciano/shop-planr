<script setup lang="ts">
import type { Certificate, CertAttachment } from '~/types/domain'

const props = defineProps<{
  certId: string
}>()

const cert = ref<Certificate | null>(null)
const attachments = ref<CertAttachment[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  loading.value = true
  try {
    const [certData, attachData] = await Promise.all([
      $fetch<Certificate>(`/api/certs/${encodeURIComponent(props.certId)}`),
      $fetch<CertAttachment[]>(`/api/certs/${encodeURIComponent(props.certId)}/attachments`),
    ])
    cert.value = certData
    attachments.value = attachData
  } catch (e: any) {
    error.value = e?.data?.message ?? e?.message ?? 'Failed to load certificate'
  } finally {
    loading.value = false
  }
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="loading" class="text-sm text-(--ui-text-muted)">Loading...</div>
    <div v-else-if="error" class="text-sm text-(--ui-error)">{{ error }}</div>

    <template v-else-if="cert">
      <div class="space-y-2">
        <h3 class="text-lg font-semibold text-(--ui-text-highlighted)">{{ cert.name }}</h3>
        <div class="flex items-center gap-2">
          <UBadge :color="cert.type === 'material' ? 'primary' : 'neutral'" variant="subtle">
            {{ cert.type }}
          </UBadge>
          <span class="text-xs text-(--ui-text-muted)">Created {{ formatDate(cert.createdAt) }}</span>
        </div>
      </div>

      <div v-if="cert.metadata && Object.keys(cert.metadata).length" class="space-y-1">
        <h4 class="text-sm font-semibold text-(--ui-text-highlighted)">Metadata</h4>
        <div class="border border-(--ui-border) rounded-md p-3">
          <div
            v-for="(value, key) in cert.metadata"
            :key="String(key)"
            class="flex items-center gap-2 text-sm"
          >
            <span class="font-medium text-(--ui-text-muted)">{{ key }}:</span>
            <span class="text-(--ui-text-highlighted)">{{ value }}</span>
          </div>
        </div>
      </div>

      <div class="space-y-1">
        <h4 class="text-sm font-semibold text-(--ui-text-highlighted)">
          Attached Parts ({{ attachments.length }})
        </h4>
        <div v-if="!attachments.length" class="text-sm text-(--ui-text-muted)">
          No parts attached
        </div>
        <div v-else class="border border-(--ui-border) rounded-md divide-y divide-(--ui-border) max-h-60 overflow-y-auto">
          <div
            v-for="att in attachments"
            :key="`${att.partId}-${att.stepId}`"
            class="px-3 py-2 flex items-center justify-between text-sm"
          >
            <NuxtLink
              :to="`/parts-browser/${att.partId}`"
              class="font-mono text-(--ui-primary) hover:underline"
            >
              {{ att.partId }}
            </NuxtLink>
            <span class="text-xs text-(--ui-text-muted)">
              {{ formatDate(att.attachedAt) }} by {{ att.attachedBy }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
