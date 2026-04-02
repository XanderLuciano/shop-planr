<script setup lang="ts">
const props = defineProps<{
  pathId: string
  pathName: string
  partCount: number
}>()

const emit = defineEmits<{
  deleted: []
}>()

const confirming = ref(false)
const showModal = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

const { requireUser } = useUsers()

async function performDelete() {
  loading.value = true
  error.value = null
  try {
    await $fetch(`/api/paths/${encodeURIComponent(props.pathId)}`, {
      method: 'DELETE',
      body: { userId: requireUser().id },
    })
    confirming.value = false
    showModal.value = false
    emit('deleted')
  } catch (e: any) {
    const status = e?.response?.status ?? e?.statusCode
    if (status === 403) {
      error.value = 'Admin access required'
    } else {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to delete path'
    }
  } finally {
    loading.value = false
  }
}

function handleDelete() {
  if (props.partCount > 0) {
    showModal.value = true
    return
  }
  if (!confirming.value) {
    confirming.value = true
    return
  }
  performDelete()
}

function cancelDelete() {
  confirming.value = false
}

function cancelModal() {
  showModal.value = false
}
</script>

<template>
  <div class="inline-flex items-center gap-1">
    <template v-if="confirming && partCount === 0">
      <span class="text-xs text-(--ui-error)">Delete "{{ pathName }}"?</span>
      <UButton
        size="xs"
        color="error"
        label="Yes"
        :loading="loading"
        @click="performDelete"
      />
      <UButton
        size="xs"
        variant="ghost"
        label="No"
        @click="cancelDelete"
      />
    </template>
    <template v-else>
      <UButton
        size="xs"
        variant="ghost"
        color="error"
        icon="i-lucide-trash-2"
        title="Delete path"
        @click="handleDelete"
      />
      <UBadge v-if="partCount > 0" color="error" size="xs">
        {{ partCount }} {{ partCount === 1 ? 'part' : 'parts' }}
      </UBadge>
    </template>
    <p v-if="error" class="text-xs text-(--ui-error)">{{ error }}</p>

    <UModal v-model:open="showModal" title="Delete Path" :close="false">
      <template #body>
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-2 text-(--ui-error)">
            <UIcon name="i-lucide-alert-triangle" class="size-5 shrink-0" />
            <span class="font-medium">Warning</span>
          </div>
          <p class="text-sm text-(--ui-text-muted)">
            This will permanently delete path "{{ pathName }}" and all {{ partCount }} {{ partCount === 1 ? 'part' : 'parts' }}. This action cannot be undone.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            variant="ghost"
            label="Cancel"
            @click="cancelModal"
          />
          <UButton
            color="error"
            label="Delete"
            :loading="loading"
            @click="performDelete"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
