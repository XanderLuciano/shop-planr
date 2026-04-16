<script setup lang="ts">
import type { Tag } from '~/types/domain'
import { extractApiError } from '~/utils/apiError'

const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const { tags, loading, fetchTags, createTag } = useTags()
const { isAdmin } = useAuth()

const open = ref(false)
const newTagName = ref('')
const newTagColor = ref('#8b5cf6')
const showCreateForm = ref(false)
const createLoading = ref(false)
const createError = ref('')

onMounted(() => fetchTags())

watch(open, (isOpen) => {
  if (!isOpen) {
    showCreateForm.value = false
    createError.value = ''
  }
})

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
  createError.value = ''
  try {
    const tag = await createTag(name, newTagColor.value)
    emit('update:modelValue', [...props.modelValue, tag.id])
    newTagName.value = ''
    newTagColor.value = '#8b5cf6'
    showCreateForm.value = false
  } catch (e) {
    createError.value = extractApiError(e, 'Failed to create tag')
  } finally {
    createLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-2">
    <!-- Dropdown trigger first so pills below don't shift it -->
    <UPopover v-model:open="open">
      <UButton
        variant="outline"
        color="neutral"
        size="sm"
        icon="i-lucide-tag"
        trailing-icon="i-lucide-chevron-down"
        :label="selectedTags.length ? `Tags (${selectedTags.length})` : 'Tags'"
        :loading="loading"
        class="w-28"
      />
      <template #content>
        <div class="w-56">
          <div class="max-h-48 overflow-y-auto divide-y divide-(--ui-border)">
            <button
              v-for="tag in tags"
              :key="tag.id"
              type="button"
              class="w-full flex items-center gap-2 px-3 py-2 hover:bg-(--ui-bg-elevated) text-sm text-left"
              @click="toggleTag(tag)"
            >
              <UCheckbox
                :model-value="isSelected(tag)"
                tabindex="-1"
                class="pointer-events-none"
              />
              <JobTagPill :tag="tag" />
            </button>
            <div
              v-if="!tags.length"
              class="px-3 py-2 text-sm text-(--ui-text-muted)"
            >
              No tags available
            </div>
          </div>

          <!-- Create new tag -->
          <div
            v-if="isAdmin"
            class="border-t border-(--ui-border)"
          >
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
                <p
                  v-if="createError"
                  class="text-xs text-(--ui-error)"
                >
                  {{ createError }}
                </p>
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
                    @keydown.escape.stop="showCreateForm = false"
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
      </template>
    </UPopover>

    <!-- Selected pills — always reserve a line so adding the first tag doesn't shift layout -->
    <div class="flex flex-wrap gap-1 min-h-6">
      <JobTagPill
        v-for="tag in selectedTags"
        :key="tag.id"
        :tag="tag"
      >
        <button
          type="button"
          class="hover:opacity-75 leading-none"
          :aria-label="`Remove tag ${tag.name}`"
          @click="removeTag(tag.id)"
        >
          <UIcon
            name="i-lucide-x"
            class="size-3"
          />
        </button>
      </JobTagPill>
      <span
        v-if="!selectedTags.length"
        class="text-xs text-(--ui-text-dimmed) leading-6"
      >No tags selected</span>
    </div>
  </div>
</template>
