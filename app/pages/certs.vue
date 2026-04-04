<script setup lang="ts">
import type { Certificate } from '~/types/domain'

const { certs, loading, fetchCerts, createCert, batchAttachCert } = useCerts()
const { requireUser } = useUsers()

// UI state
const showForm = ref(false)
const formSaving = ref(false)
const formError = ref('')

// Batch attach state
const showBatchAttach = ref(false)
const batchCertId = ref('')
const batchPartIds = ref('')
const batchSaving = ref(false)
const batchError = ref('')
const batchSuccess = ref('')

// Detail view state
const selectedCertId = ref<string | null>(null)

async function onCreateCert(data: { type: 'material' | 'process', name: string, metadata?: Record<string, unknown> }) {
  formError.value = ''
  formSaving.value = true
  try {
    await createCert(data)
    showForm.value = false
  } catch (e) {
    formError.value = e?.data?.message ?? e?.message ?? 'Failed to create certificate'
  } finally {
    formSaving.value = false
  }
}

function metadataPreview(cert: Certificate): string {
  if (!cert.metadata || !Object.keys(cert.metadata).length) return '—'
  return Object.entries(cert.metadata)
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const certOptions = computed(() =>
  certs.value.map(c => ({ label: `${c.name} (${c.type})`, value: c.id })),
)

function openCertDetail(certId: string) {
  selectedCertId.value = certId
  showForm.value = false
  showBatchAttach.value = false
}

function closeCertDetail() {
  selectedCertId.value = null
}

async function onBatchAttach() {
  batchError.value = ''
  batchSuccess.value = ''

  if (!batchCertId.value) {
    batchError.value = 'Select a certificate'
    return
  }

  const ids = batchPartIds.value
    .split(/[,\n]+/)
    .map(s => s.trim())
    .filter(Boolean)

  if (!ids.length) {
    batchError.value = 'Enter at least one part ID'
    return
  }

  let userId: string
  try {
    userId = requireUser().id
  } catch {
    batchError.value = 'Please select a user first'
    return
  }

  batchSaving.value = true
  try {
    await batchAttachCert({
      certId: batchCertId.value,
      partIds: ids,
      userId,
    })
    batchSuccess.value = `Attached certificate to ${ids.length} part(s)`
    batchPartIds.value = ''
  } catch (e) {
    batchError.value = e?.data?.message ?? e?.message ?? 'Failed to batch attach'
  } finally {
    batchSaving.value = false
  }
}

onMounted(() => {
  fetchCerts()
})
</script>

<template>
  <div class="p-4 space-y-3 max-w-4xl">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-bold text-(--ui-text-highlighted)">
        Certificates
      </h1>
      <div class="flex gap-1.5">
        <UButton
          v-if="selectedCertId"
          icon="i-lucide-arrow-left"
          size="sm"
          variant="ghost"
          label="Back to List"
          @click="closeCertDetail"
        />
        <template v-else>
          <UButton
            v-if="!showBatchAttach"
            icon="i-lucide-link"
            size="sm"
            variant="soft"
            color="neutral"
            label="Batch Attach"
            @click="showBatchAttach = !showBatchAttach; showForm = false"
          />
          <UButton
            v-if="!showForm"
            icon="i-lucide-plus"
            label="New Certificate"
            size="sm"
            @click="showForm = true; showBatchAttach = false"
          />
        </template>
      </div>
    </div>

    <!-- Certificate detail view -->
    <template v-if="selectedCertId">
      <CertDetailView :cert-id="selectedCertId" />
    </template>

    <template v-else>
      <!-- Create form -->
      <div
        v-if="showForm"
        class="space-y-2 p-3 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/50"
      >
        <div class="text-xs font-semibold text-(--ui-text-highlighted)">
          New Certificate
        </div>
        <CertForm @submit="onCreateCert" />
        <p
          v-if="formError"
          class="text-xs text-red-500"
        >
          {{ formError }}
        </p>
        <div class="flex justify-end">
          <UButton
            variant="ghost"
            size="xs"
            label="Cancel"
            @click="showForm = false; formError = ''"
          />
        </div>
      </div>

      <!-- Batch attach -->
      <div
        v-if="showBatchAttach"
        class="space-y-2 p-3 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/50"
      >
        <div class="text-xs font-semibold text-(--ui-text-highlighted)">
          Batch Attach Certificate
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-xs text-(--ui-text-muted) mb-0.5">Certificate</label>
            <USelect
              v-model="batchCertId"
              :items="certOptions"
              placeholder="Select certificate"
              size="sm"
              value-key="value"
            />
          </div>
          <div>
            <label class="block text-xs text-(--ui-text-muted) mb-0.5">Part IDs (comma or newline separated)</label>
            <UTextarea
              v-model="batchPartIds"
              size="sm"
              placeholder="part_00001, part_00002&#10;part_00003"
              :rows="3"
            />
          </div>
        </div>
        <p
          v-if="batchError"
          class="text-xs text-red-500"
        >
          {{ batchError }}
        </p>
        <p
          v-if="batchSuccess"
          class="text-xs text-green-600"
        >
          {{ batchSuccess }}
        </p>
        <div class="flex gap-2 justify-end">
          <UButton
            variant="ghost"
            size="xs"
            label="Cancel"
            @click="showBatchAttach = false; batchError = ''; batchSuccess = ''"
          />
          <UButton
            size="xs"
            label="Attach"
            :loading="batchSaving"
            @click="onBatchAttach"
          />
        </div>
      </div>

      <!-- Loading -->
      <div
        v-if="loading"
        class="flex items-center gap-2 text-sm text-(--ui-text-muted)"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="animate-spin size-4"
        />
        Loading certificates...
      </div>

      <!-- Empty state -->
      <div
        v-else-if="!certs.length && !showForm"
        class="text-sm text-(--ui-text-muted) py-8 text-center"
      >
        No certificates yet. Create a certificate to start tracking material and process certs.
      </div>

      <!-- Cert list -->
      <div
        v-else
        class="space-y-1.5"
      >
        <div
          v-for="c in certs"
          :key="c.id"
          class="flex items-center justify-between px-3 py-2 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/50 cursor-pointer hover:border-(--ui-primary) transition-colors"
          @click="openCertDetail(c.id)"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-(--ui-text-highlighted)">{{ c.name }}</span>
              <UBadge
                size="xs"
                :color="c.type === 'material' ? 'primary' : 'info'"
                variant="subtle"
              >
                {{ c.type }}
              </UBadge>
            </div>
            <div class="text-xs text-(--ui-text-muted) mt-0.5">
              {{ metadataPreview(c) }} · {{ formatDate(c.createdAt) }}
            </div>
          </div>
          <UIcon
            name="i-lucide-chevron-right"
            class="size-4 text-(--ui-text-muted) shrink-0 ml-2"
          />
        </div>
      </div>
    </template>
  </div>
</template>
