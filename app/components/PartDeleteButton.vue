<script setup lang="ts">
const props = defineProps<{
  partId: string
  partStatus: string
}>()

const emit = defineEmits<{
  deleted: []
}>()

const showModal = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

const { isAdmin } = useAuth()
const $api = useAuthFetch()

async function performDelete() {
  loading.value = true
  error.value = null
  try {
    await $api(`/api/parts/${encodeURIComponent(props.partId)}`, {
      method: 'DELETE',
    })
    showModal.value = false
    emit('deleted')
  } catch (e: unknown) {
    const err = e as { response?: { status?: number }, statusCode?: number, data?: { message?: string }, message?: string } | null
    const status = err?.response?.status ?? err?.statusCode
    if (status === 403) {
      error.value = 'Admin access required'
    } else {
      error.value = err?.data?.message ?? err?.message ?? 'Failed to delete part'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div
    v-if="isAdmin"
    class="inline-flex items-center gap-1"
  >
    <UButton
      size="xs"
      variant="ghost"
      color="error"
      icon="i-lucide-trash-2"
      label="Delete Part"
      class="hidden sm:inline-flex"
      @click="showModal = true"
    />
    <UButton
      size="xs"
      variant="ghost"
      color="error"
      icon="i-lucide-trash-2"
      class="sm:hidden"
      @click="showModal = true"
    />

    <p
      v-if="error && !showModal"
      class="text-xs text-(--ui-error)"
    >
      {{ error }}
    </p>

    <UModal
      v-model:open="showModal"
      title="Delete Part"
      description="Confirm permanent deletion of this part and all associated data."
      :close="false"
      :ui="{
        header: 'p-3 sm:px-4 min-h-0',
        body: 'p-3 sm:p-4',
        footer: 'p-3 sm:px-4 justify-end',
        title: 'text-(--ui-error) font-bold',
        description: 'sr-only',
      }"
    >
      <template #title>
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-alert-triangle"
            class="size-5 shrink-0"
          />
          <span>Delete Part</span>
        </div>
      </template>
      <template #body>
        <div class="space-y-3">
          <p class="text-(--ui-text-muted)">
            <span class="font-medium text-(--ui-text-highlighted)">WARNING:</span>
            This will permanently delete part <span class="font-mono font-medium text-(--ui-text-highlighted)">{{ partId }}</span>
            and all associated data (certificates, step statuses, overrides). This action cannot be undone.
          </p>
          <p class="text-(--ui-text-highlighted) font-medium">
            Are you sure?
          </p>
          <p
            v-if="error"
            class="text-xs text-(--ui-error)"
          >
            {{ error }}
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            variant="outline"
            color="neutral"
            label="Cancel"
            :disabled="loading"
            @click="showModal = false"
          />
          <UButton
            color="error"
            variant="solid"
            label="Delete"
            icon="i-lucide-trash-2"
            :loading="loading"
            @click="performDelete"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
