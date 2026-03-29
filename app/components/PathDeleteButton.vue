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
const loading = ref(false)
const error = ref<string | null>(null)

const canDelete = computed(() => props.partCount === 0)

async function handleDelete() {
  if (!confirming.value) {
    confirming.value = true
    return
  }

  loading.value = true
  error.value = null
  try {
    await $fetch(`/api/paths/${encodeURIComponent(props.pathId)}`, {
      method: 'DELETE',
    })
    confirming.value = false
    emit('deleted')
  } catch (e: any) {
    error.value = e?.data?.message ?? e?.message ?? 'Failed to delete path'
  } finally {
    loading.value = false
  }
}

function cancelDelete() {
  confirming.value = false
}
</script>

<template>
  <div class="inline-flex items-center gap-1">
    <template v-if="!canDelete">
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-trash-2"
        disabled
        title="Cannot delete path with parts"
      />
    </template>
    <template v-else-if="confirming">
      <span class="text-xs text-(--ui-error)">Delete "{{ pathName }}"?</span>
      <UButton size="xs" color="error" label="Yes" :loading="loading" @click="handleDelete" />
      <UButton size="xs" variant="ghost" label="No" @click="cancelDelete" />
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
    </template>
    <p v-if="error" class="text-xs text-(--ui-error)">{{ error }}</p>
  </div>
</template>
