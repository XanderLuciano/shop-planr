<script setup lang="ts">
import type { Certificate } from '~/server/types/domain'

const props = defineProps<{
  partId: string
  stepId: string
}>()

const emit = defineEmits<{
  attached: []
}>()

const { certs, fetchCerts, loading } = useCerts()
const { operatorId } = useOperatorIdentity()

const searchQuery = ref('')
const selectedCertId = ref('')
const attaching = ref(false)
const attachError = ref<string | null>(null)

onMounted(() => {
  if (!certs.value.length) fetchCerts()
})

const filteredCerts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return certs.value
  return certs.value.filter(c =>
    c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q),
  )
})

async function handleAttach() {
  attachError.value = null
  if (!selectedCertId.value) {
    attachError.value = 'Select a certificate'
    return
  }
  if (!operatorId.value) {
    attachError.value = 'No operator selected'
    return
  }

  attaching.value = true
  try {
    await $fetch('/api/certs/batch-attach', {
      method: 'POST',
      body: {
        certId: selectedCertId.value,
        partIds: [props.partId],
        userId: operatorId.value,
      },
    })
    selectedCertId.value = ''
    searchQuery.value = ''
    emit('attached')
  } catch (e: any) {
    attachError.value = e?.data?.message ?? e?.message ?? 'Failed to attach certificate'
  } finally {
    attaching.value = false
  }
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center gap-2">
      <UInput
        v-model="searchQuery"
        placeholder="Search certificates..."
        size="sm"
        class="flex-1"
      />
    </div>

    <div v-if="filteredCerts.length" class="border border-(--ui-border) rounded-md max-h-32 overflow-y-auto divide-y divide-(--ui-border)">
      <button
        v-for="cert in filteredCerts"
        :key="cert.id"
        type="button"
        class="w-full text-left px-2 py-1.5 text-xs hover:bg-(--ui-bg-elevated)/50 flex items-center justify-between"
        :class="selectedCertId === cert.id ? 'bg-(--ui-primary)/10' : ''"
        @click="selectedCertId = cert.id"
      >
        <span class="text-(--ui-text-highlighted)">{{ cert.name }}</span>
        <UBadge :color="cert.type === 'material' ? 'primary' : 'neutral'" variant="subtle" size="xs">
          {{ cert.type }}
        </UBadge>
      </button>
    </div>

    <p v-if="attachError" class="text-xs text-(--ui-error)">{{ attachError }}</p>

    <UButton
      size="sm"
      label="Attach Certificate"
      icon="i-lucide-link"
      :loading="attaching"
      :disabled="!selectedCertId"
      @click="handleAttach"
    />
  </div>
</template>
