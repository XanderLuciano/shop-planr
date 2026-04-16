<script setup lang="ts">
import type { Tag } from '~/types/domain'
import { extractApiError, extractApiErrorCode } from '~/utils/apiError'

const { tags, loading, error, fetchTags, createTag, updateTag, deleteTag } = useTags()
const { isAdmin } = useAuth()

const newName = ref('')
const newColor = ref('#8b5cf6')

// Edit state
const editingId = ref<string | null>(null)
const editName = ref('')
const editColor = ref('')

// Delete modal state
const showDeleteModal = ref(false)
const tagToDelete = ref<Tag | null>(null)
const deleteLoading = ref(false)
const deleteError = ref<string | null>(null)
const deleteRequiresForce = ref(false)

onMounted(() => fetchTags())

async function handleCreate() {
  const name = newName.value.trim()
  if (!name) return
  await createTag(name, newColor.value)
  newName.value = ''
  newColor.value = '#8b5cf6'
}

function startEdit(tag: Tag) {
  editingId.value = tag.id
  editName.value = tag.name
  editColor.value = tag.color
}

async function saveEdit(id: string) {
  const name = editName.value.trim()
  if (!name) return
  await updateTag(id, { name, color: editColor.value })
  editingId.value = null
}

function cancelEdit() {
  editingId.value = null
}

function confirmDelete(tag: Tag) {
  tagToDelete.value = tag
  deleteError.value = null
  deleteRequiresForce.value = false
  showDeleteModal.value = true
}

async function performDelete(force = false) {
  if (!tagToDelete.value) return
  deleteLoading.value = true
  deleteError.value = null
  try {
    await deleteTag(tagToDelete.value.id, force)
    showDeleteModal.value = false
    tagToDelete.value = null
    deleteRequiresForce.value = false
  } catch (e) {
    deleteError.value = extractApiError(e, 'Failed to delete tag')
    if (extractApiErrorCode(e) === 'TAG_IN_USE') {
      deleteRequiresForce.value = true
    }
  } finally {
    deleteLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <p
      v-if="error"
      class="text-sm text-(--ui-error)"
    >
      {{ error }}
    </p>

    <!-- Tag list -->
    <div class="border border-(--ui-border) rounded-md divide-y divide-(--ui-border)">
      <div
        v-for="tag in tags"
        :key="tag.id"
        class="px-3 py-2 flex items-center gap-3 text-sm"
      >
        <!-- View mode -->
        <template v-if="editingId !== tag.id">
          <JobTagPill
            :tag="tag"
            class="shrink-0"
          />
          <span class="flex-1 text-(--ui-text-muted) font-mono text-xs">{{ tag.color }}</span>
          <div
            v-if="isAdmin"
            class="flex items-center gap-1 shrink-0"
          >
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-pencil"
              @click="startEdit(tag)"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              @click="confirmDelete(tag)"
            />
          </div>
        </template>

        <!-- Edit mode -->
        <template v-else>
          <input
            v-model="editColor"
            type="color"
            class="w-8 h-8 rounded cursor-pointer border border-(--ui-border) shrink-0"
          >
          <UInput
            v-model="editName"
            size="sm"
            class="flex-1"
            @keyup.enter="saveEdit(tag.id)"
            @keyup.escape="cancelEdit"
          />
          <div class="flex items-center gap-1 shrink-0">
            <UButton
              size="xs"
              variant="soft"
              color="primary"
              label="Save"
              :loading="loading"
              @click="saveEdit(tag.id)"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              label="Cancel"
              @click="cancelEdit"
            />
          </div>
        </template>
      </div>

      <div
        v-if="!tags.length"
        class="px-3 py-2 text-sm text-(--ui-text-muted)"
      >
        No tags defined
      </div>
    </div>

    <!-- Create form (admin only) -->
    <div
      v-if="isAdmin"
      class="flex items-center gap-2"
    >
      <input
        v-model="newColor"
        type="color"
        class="w-8 h-8 rounded cursor-pointer border border-(--ui-border) shrink-0"
      >
      <UInput
        v-model="newName"
        placeholder="New tag name"
        size="sm"
        class="flex-1"
        @keyup.enter="handleCreate"
      />
      <UButton
        size="sm"
        label="Add"
        :loading="loading"
        @click="handleCreate"
      />
    </div>

    <!-- Delete confirmation modal -->
    <UModal
      v-model:open="showDeleteModal"
      :close="false"
      :ui="{
        header: 'p-3 sm:px-4 min-h-0',
        body: 'p-3 sm:p-4',
        footer: 'p-3 sm:px-4 justify-end',
        title: 'text-(--ui-error) font-bold',
        description: 'sr-only',
      }"
      description="Confirm tag deletion"
    >
      <template #title>
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-alert-triangle"
            class="size-5 shrink-0"
          />
          <span>Delete Tag</span>
        </div>
      </template>
      <template #body>
        <div class="space-y-3">
          <p class="text-(--ui-text-muted)">
            Delete tag
            <JobTagPill
              v-if="tagToDelete"
              :tag="tagToDelete"
              class="mx-1"
            />?
          </p>
          <p
            v-if="deleteError"
            class="text-xs text-(--ui-error)"
          >
            {{ deleteError }}
          </p>
          <p
            v-if="deleteRequiresForce"
            class="text-xs text-(--ui-text-muted)"
          >
            Removing the tag will strip it from every job currently using it. This cannot be undone.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            variant="outline"
            color="neutral"
            label="Cancel"
            :disabled="deleteLoading"
            @click="showDeleteModal = false"
          />
          <UButton
            v-if="!deleteRequiresForce"
            color="error"
            variant="solid"
            label="Delete"
            icon="i-lucide-trash-2"
            :loading="deleteLoading"
            @click="performDelete(false)"
          />
          <UButton
            v-else
            color="error"
            variant="solid"
            label="Remove from all jobs and delete"
            icon="i-lucide-trash-2"
            :loading="deleteLoading"
            @click="performDelete(true)"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
