<script setup lang="ts">
import type { Tag } from '~/types/domain'

const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const { tags, loading, fetchTags, createTag } = useTags()

const open = ref(false)
const newTagName = ref('')
const newTagColor = ref('#8b5cf6')
const showCreateForm = ref(false)
const createLoading = ref(false)

onMounted(() => fetchTags())

const selectedTags = computed(() =>
  tags.value.filter(t => props.modelValue.includes(t.id)),
)

function isSelected(tag: Tag) {
  return props.modelValue.includes(tag.id)
}

function toggleTag(tag: Tag) {
  const current = props.modelValue
  if (current.includes(tag.id)) {
    emit('update:modelValue', current.filter(id => id !== tag.id))
  } else {
    emit('update:modelValue', [...current, tag.id])
  }
}

function removeTag(tagId: string) {
  emit('update:modelValue', props.modelValue.filter(id => id !== tagId))
}

async function handleCreateTag() {
  const name = newTagName.value.trim()
  if (!name) return
  createLoading.value = true
  try {
    const tag = await createTag(name, newTagColor.value)
    emit('update:modelValue', [...props.modelValue, tag.id])
    newTagName.value = ''
    newTagColor.value = '#8b5cf6'
    showCreateForm.value = false
  } finally {
    createLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-2">
    <!-- Selected pills -->
    <div
      v-if="selectedTags.length"
      class="flex flex-wrap gap-1"
    >
      <span
        v-for="tag in selectedTags"
        :key="tag.id"
        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
        :style="{ backgroundColor: tag.color }"
      >
        {{ tag.name }}
        <button
          type="button"
          class="hover:opacity-75 leading-none"
          @click="removeTag(tag.id)"
        >
          <UIcon
            name="i-lucide-x"
            class="size-3"
          />
        </button>
      </span>
    </div>

    <!-- Dropdown trigger -->
    <div class="relative">
      <UButton
        variant="outline"
        color="neutral"
        size="sm"
        icon="i-lucide-tag"
        trailing-icon="i-lucide-chevron-down"
        :label="selectedTags.length ? `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''} selected` : 'Add tags'"
        :loading="loading"
        @click="open = !open"
      />

      <!-- Backdrop to close dropdown -->
      <div
        v-if="open"
        class="fixed inset-0 z-40"
        @click="open = false; showCreateForm = false"
      />

      <!-- Dropdown panel -->
      <div
        v-if="open"
        class="absolute z-50 mt-1 w-56 rounded-md border border-(--ui-border) bg-(--ui-bg) shadow-lg"
      >
        <div class="max-h-48 overflow-y-auto divide-y divide-(--ui-border)">
          <div
            v-for="tag in tags"
            :key="tag.id"
            class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-(--ui-bg-elevated) text-sm"
            @click="toggleTag(tag)"
          >
            <UIcon
              :name="isSelected(tag) ? 'i-lucide-check-square' : 'i-lucide-square'"
              class="size-4 shrink-0 text-(--ui-text-muted)"
            />
            <JobTagPill :tag="tag" />
          </div>
          <div
            v-if="!tags.length"
            class="px-3 py-2 text-sm text-(--ui-text-muted)"
          >
            No tags available
          </div>
        </div>

        <!-- Create new tag -->
        <div class="border-t border-(--ui-border)">
          <template v-if="!showCreateForm">
            <button
              type="button"
              class="w-full flex items-center gap-2 px-3 py-2 text-sm text-(--ui-text-muted) hover:bg-(--ui-bg-elevated)"
              @click="showCreateForm = true"
            >
              <UIcon
                name="i-lucide-plus"
                class="size-4"
              />
              Create new tag
            </button>
          </template>
          <template v-else>
            <div class="p-2 space-y-2">
              <div class="flex items-center gap-2">
                <input
                  v-model="newTagColor"
                  type="color"
                  class="w-7 h-7 rounded cursor-pointer border border-(--ui-border) shrink-0"
                >
                <UInput
                  v-model="newTagName"
                  placeholder="Tag name"
                  size="xs"
                  class="flex-1"
                  @keyup.enter="handleCreateTag"
                  @keyup.escape="showCreateForm = false"
                />
              </div>
              <div class="flex gap-1 justify-end">
                <UButton
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  label="Cancel"
                  @click="showCreateForm = false"
                />
                <UButton
                  size="xs"
                  variant="soft"
                  color="primary"
                  label="Create"
                  :loading="createLoading"
                  @click="handleCreateTag"
                />
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
