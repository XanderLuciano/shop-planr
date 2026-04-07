<script setup lang="ts">
import type { StepNote } from '~/types/domain'

const props = defineProps<{
  jobId: string
  pathId: string
  stepId: string
  partIds: string[]
  jiraTicketKey?: string
  jiraPushEnabled?: boolean
}>()

const emit = defineEmits<{
  created: [note: StepNote]
}>()

const { createNote, loading, error } = useNotes()
const { pushNoteAsComment } = useJira()
const { authenticatedUser } = useAuth()

const text = ref('')
const localError = ref('')
const pushToJira = ref(false)
const pushingToJira = ref(false)
const jiraPushResult = ref('')
const jiraPushIsError = ref(false)

const canPushToJira = computed(() =>
  !!props.jiraTicketKey && !!props.jiraPushEnabled,
)

async function onSubmit() {
  const trimmed = text.value.trim()
  if (!trimmed) return

  localError.value = ''
  jiraPushResult.value = ''
  jiraPushIsError.value = false
  if (!authenticatedUser.value) {
    localError.value = 'Authentication required — please sign in again'
    return
  }
  try {
    const user = authenticatedUser.value
    const note = await createNote({
      jobId: props.jobId,
      pathId: props.pathId,
      stepId: props.stepId,
      partIds: props.partIds,
      text: trimmed,
      userId: user.id,
    })

    // Push to Jira if checked
    if (pushToJira.value && canPushToJira.value) {
      pushingToJira.value = true
      try {
        const result = await pushNoteAsComment(props.jobId, note.id)
        if (result.success) {
          jiraPushResult.value = 'Pushed to Jira'
        } else {
          jiraPushResult.value = result.error ?? 'Jira push failed'
          jiraPushIsError.value = true
        }
      } catch (e) {
        jiraPushResult.value = e?.data?.message ?? e?.message ?? 'Jira push failed'
        jiraPushIsError.value = true
      } finally {
        pushingToJira.value = false
      }
    }

    text.value = ''
    pushToJira.value = false
    emit('created', note)
  } catch (e) {
    localError.value = e?.data?.message ?? e?.message ?? 'Failed to create note'
  }
}
</script>

<template>
  <div class="space-y-1.5">
    <UTextarea
      v-model="text"
      size="sm"
      placeholder="Add a note or defect report..."
      :rows="2"
      autoresize
      class="w-full"
    />
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <p
          v-if="localError || error"
          class="text-xs text-red-500 truncate"
        >
          {{ localError || error }}
        </p>
        <p
          v-else-if="jiraPushResult"
          class="text-xs truncate"
          :class="jiraPushIsError ? 'text-red-500' : 'text-green-500'"
        >
          {{ jiraPushResult }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <label
          v-if="canPushToJira"
          class="flex items-center gap-1.5 text-xs text-(--ui-text-muted) cursor-pointer"
        >
          <input
            v-model="pushToJira"
            type="checkbox"
            class="rounded size-3"
          >
          Push to Jira
        </label>
        <UButton
          size="xs"
          label="Add Note"
          icon="i-lucide-message-square-plus"
          :loading="loading || pushingToJira"
          :disabled="!text.trim()"
          @click="onSubmit"
        />
      </div>
    </div>
  </div>
</template>
