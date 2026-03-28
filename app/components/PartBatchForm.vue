<script setup lang="ts">
import type { Certificate, Part } from '~/server/types/domain'

const props = defineProps<{
  jobId: string
  pathId: string
}>()

const emit = defineEmits<{
  created: [parts: Part[]]
}>()

const { batchCreateParts } = useParts()
const { requireUser } = useUsers()

const quantity = ref(1)
const selectedCertId = ref<string | undefined>(undefined)
const saving = ref(false)
const error = ref('')

const certs = ref<Certificate[]>([])
const certsLoading = ref(false)

async function loadCerts() {
  certsLoading.value = true
  try {
    certs.value = await $fetch<Certificate[]>('/api/certs')
  } catch {
    certs.value = []
  } finally {
    certsLoading.value = false
  }
}

const certOptions = computed(() =>
  certs.value.map(c => ({ label: `${c.name} (${c.type})`, value: c.id }))
)

async function onSubmit() {
  error.value = ''
  if (quantity.value < 1) {
    error.value = 'Quantity must be at least 1'
    return
  }

  let userId: string
  try {
    userId = requireUser().id
  } catch {
    error.value = 'Please select a user before creating parts'
    return
  }

  saving.value = true
  try {
    const parts = await batchCreateParts({
      jobId: props.jobId,
      pathId: props.pathId,
      quantity: quantity.value,
      certId: selectedCertId.value || undefined,
      userId
    })
    quantity.value = 1
    selectedCertId.value = undefined
    emit('created', parts)
  } catch (e: any) {
    error.value = e?.data?.message ?? e?.message ?? 'Failed to create parts'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadCerts()
})
</script>

<template>
  <form
    class="flex items-end gap-2 flex-wrap"
    @submit.prevent="onSubmit"
  >
    <div>
      <label class="block text-xs text-(--ui-text-muted) mb-0.5">Quantity</label>
      <UInput
        v-model.number="quantity"
        type="number"
        size="sm"
        :min="1"
        class="w-20"
      />
    </div>
    <div>
      <label class="block text-xs text-(--ui-text-muted) mb-0.5">Cert (optional)</label>
      <USelect
        v-model="selectedCertId"
        :items="certOptions"
        placeholder="None"
        size="sm"
        class="w-48"
        value-key="value"
      />
    </div>
    <UButton
      type="submit"
      size="sm"
      icon="i-lucide-plus"
      label="Create Parts"
      :loading="saving"
    />
    <p
      v-if="error"
      class="text-xs text-red-500 w-full"
    >
      {{ error }}
    </p>
  </form>
</template>
