<script setup lang="ts">
import type { OperatorStepView } from '~/server/types/computed'
import type { StepNote } from '~/server/types/domain'

const props = defineProps<{
  data: OperatorStepView
  notes?: StepNote[]
}>()

const emit = defineEmits<{
  noteCreated: []
}>()

const showNoteForm = ref(false)

const currentColumns = [
  { key: 'partId', label: 'Part' },
  { key: 'jobName', label: 'Job' },
  { key: 'pathName', label: 'Path' },
  { key: 'nextStep', label: 'Next Step → Location' },
]

const upstreamColumns = [
  { key: 'partId', label: 'Part' },
  { key: 'jobName', label: 'Job' },
  { key: 'pathName', label: 'Path' },
]

function formatNextStep(row: { nextStepName?: string; nextStepLocation?: string }): string {
  if (!row.nextStepName) return '— (final step)'
  return row.nextStepLocation ? `${row.nextStepName} → ${row.nextStepLocation}` : row.nextStepName
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header stats -->
    <div class="flex items-center gap-3 flex-wrap">
      <div class="text-sm font-semibold text-(--ui-text-highlighted)">
        {{ data.stepName }}
      </div>
      <span v-if="data.location" class="text-xs text-(--ui-text-muted)">
        📍 {{ data.location }}
      </span>
      <UBadge v-if="data.vendorPartsCount > 0" color="warning" variant="subtle" size="sm">
        {{ data.vendorPartsCount }} vendor part{{ data.vendorPartsCount !== 1 ? 's' : '' }}
      </UBadge>
    </div>

    <!-- Current Parts -->
    <div>
      <div class="flex items-center gap-2 mb-1">
        <span class="text-xs font-semibold text-(--ui-text-highlighted)">Current Parts</span>
        <UBadge color="primary" variant="subtle" size="xs">
          {{ data.currentParts.length }}
        </UBadge>
      </div>
      <div
        v-if="data.currentParts.length"
        class="border border-(--ui-border) rounded-md overflow-hidden"
      >
        <table class="w-full text-xs">
          <thead>
            <tr class="bg-(--ui-bg-elevated)/50">
              <th
                v-for="col in currentColumns"
                :key="col.key"
                class="text-left px-2 py-1 font-medium text-(--ui-text-muted)"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="part in data.currentParts"
              :key="part.partId"
              class="border-t border-(--ui-border)"
            >
              <td class="px-2 py-1 font-mono">
                {{ part.partId }}
              </td>
              <td class="px-2 py-1">
                {{ part.jobName }}
              </td>
              <td class="px-2 py-1">
                {{ part.pathName }}
              </td>
              <td class="px-2 py-1 text-(--ui-text-muted)">
                {{ formatNextStep(part) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="text-xs text-(--ui-text-muted)">No parts currently at this step.</p>
    </div>

    <!-- Coming Soon -->
    <div>
      <div class="flex items-center gap-2 mb-1">
        <span class="text-xs font-semibold text-(--ui-text-highlighted)">Coming Soon</span>
        <UBadge color="info" variant="subtle" size="xs">
          {{ data.comingSoon.length }}
        </UBadge>
      </div>
      <div
        v-if="data.comingSoon.length"
        class="border border-(--ui-border) rounded-md overflow-hidden"
      >
        <table class="w-full text-xs">
          <thead>
            <tr class="bg-(--ui-bg-elevated)/50">
              <th
                v-for="col in upstreamColumns"
                :key="col.key"
                class="text-left px-2 py-1 font-medium text-(--ui-text-muted)"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="part in data.comingSoon"
              :key="part.partId"
              class="border-t border-(--ui-border)"
            >
              <td class="px-2 py-1 font-mono">
                {{ part.partId }}
              </td>
              <td class="px-2 py-1">
                {{ part.jobName }}
              </td>
              <td class="px-2 py-1">
                {{ part.pathName }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="text-xs text-(--ui-text-muted)">No parts one step upstream.</p>
    </div>

    <!-- Backlog -->
    <div>
      <div class="flex items-center gap-2 mb-1">
        <span class="text-xs font-semibold text-(--ui-text-highlighted)">Backlog</span>
        <UBadge color="neutral" variant="subtle" size="xs">
          {{ data.backlog.length }}
        </UBadge>
      </div>
      <div
        v-if="data.backlog.length"
        class="border border-(--ui-border) rounded-md overflow-hidden"
      >
        <table class="w-full text-xs">
          <thead>
            <tr class="bg-(--ui-bg-elevated)/50">
              <th
                v-for="col in upstreamColumns"
                :key="col.key"
                class="text-left px-2 py-1 font-medium text-(--ui-text-muted)"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="part in data.backlog"
              :key="part.partId"
              class="border-t border-(--ui-border)"
            >
              <td class="px-2 py-1 font-mono">
                {{ part.partId }}
              </td>
              <td class="px-2 py-1">
                {{ part.jobName }}
              </td>
              <td class="px-2 py-1">
                {{ part.pathName }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="text-xs text-(--ui-text-muted)">No parts further upstream.</p>
    </div>

    <!-- Step Notes -->
    <div>
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-(--ui-text-highlighted)">Notes</span>
          <UBadge v-if="notes?.length" color="warning" variant="subtle" size="xs">
            {{ notes.length }}
          </UBadge>
        </div>
        <UButton
          v-if="!showNoteForm && data.currentParts.length"
          size="xs"
          variant="ghost"
          icon="i-lucide-message-square-plus"
          label="Add Note"
          @click="showNoteForm = true"
        />
      </div>

      <div
        v-if="showNoteForm && data.stepIds.length && data.currentParts.length"
        class="mb-2 p-2 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/30"
      >
        <StepNoteForm
          :job-id="data.currentParts[0]!.jobId"
          :path-id="data.currentParts[0]!.pathId"
          :step-id="data.stepIds[0]!"
          :part-ids="data.currentParts.map((p) => p.partId)"
          @created="
            showNoteForm = false
            emit('noteCreated')
          "
        />
        <div class="flex justify-end mt-1">
          <UButton size="xs" variant="ghost" label="Cancel" @click="showNoteForm = false" />
        </div>
      </div>

      <StepNoteList :notes="notes ?? []" />
    </div>
  </div>
</template>
