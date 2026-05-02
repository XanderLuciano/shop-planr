<script setup lang="ts">
import type { WorkflowVariable } from '~/utils/n8nVariables'

const JIRA_VERSION_STORAGE_KEY = 'shopPlanr:n8n:jiraVersion'

const props = defineProps<{
  parameters: Record<string, unknown>
  variables: WorkflowVariable[]
}>()

const emit = defineEmits<{
  'update:parameters': [params: Record<string, unknown>]
}>()

function get(key: string): unknown {
  return props.parameters[key]
}

function set(key: string, value: unknown) {
  emit('update:parameters', { ...props.parameters, [key]: value })
}

// ---- Jira Version (persisted in localStorage) ----

/** Read the saved default from localStorage, falling back to 'serverPat'. */
function getSavedJiraVersion(): string {
  if (import.meta.client) {
    return localStorage.getItem(JIRA_VERSION_STORAGE_KEY) ?? 'serverPat'
  }
  return 'serverPat'
}

// On mount, if the node doesn't have a jiraVersion yet, apply the saved default
onMounted(() => {
  if (!get('jiraVersion')) {
    set('jiraVersion', getSavedJiraVersion())
  }
})

function setJiraVersion(v: string) {
  set('jiraVersion', v)
  if (import.meta.client) {
    localStorage.setItem(JIRA_VERSION_STORAGE_KEY, v)
  }
}

function setNested(path: string[], value: unknown) {
  const params = structuredClone(props.parameters)
  let cursor: Record<string, unknown> = params
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i]!
    if (typeof cursor[seg] !== 'object' || cursor[seg] === null) {
      cursor[seg] = {}
    }
    cursor = cursor[seg] as Record<string, unknown>
  }
  cursor[path[path.length - 1]!] = value
  emit('update:parameters', params)
}

const operation = computed<string>(() => {
  // n8n's Jira node uses separate `resource` and `operation` fields.
  // "Add Comment" lives under resource=issueComment, operation=add.
  // "Transition" is resource=issue, operation=update with updateFields.statusId.
  // We expose a single composite value in the UI for simplicity.
  const resource = String(get('resource') ?? 'issue')
  const op = String(get('operation') ?? 'create')
  if (resource === 'issueComment' && op === 'add') return 'addComment'
  // Detect transition mode: update with our _uiMode marker, or legacy operation=transition
  if (get('_uiMode') === 'transition') return 'transition'
  return op
})

/** When the user picks an operation from the dropdown, set both `resource` and `operation`. */
function setOperation(composite: string) {
  if (composite === 'addComment') {
    emit('update:parameters', { ...props.parameters, resource: 'issueComment', operation: 'add', _uiMode: undefined })
  } else if (composite === 'transition') {
    // n8n performs transitions via the update operation with updateFields.statusId.
    // We keep a dedicated UI for transitions but map to the correct n8n structure.
    emit('update:parameters', { ...props.parameters, resource: 'issue', operation: 'update', _uiMode: 'transition' })
  } else {
    emit('update:parameters', { ...props.parameters, resource: 'issue', operation: composite, _uiMode: undefined })
  }
}

// ---- Custom fields (used by both create and update) ----

interface CustomFieldRow {
  fieldId: string
  fieldValue: string
  /** Action for update — 'set' replaces, 'add' appends (multi-select), 'remove' removes */
  action?: 'set' | 'add' | 'remove'
}

function customFieldsPath(): string[] {
  return operation.value === 'create'
    ? ['additionalFields', 'customFieldsUi', 'customFieldsValues']
    : ['updateFields', 'customFieldsUi', 'customFieldsValues']
}

function customFieldsList(): CustomFieldRow[] {
  const bucket = operation.value === 'create' ? get('additionalFields') : get('updateFields')
  const container = (bucket as { customFieldsUi?: { customFieldsValues?: unknown[] } } | undefined)?.customFieldsUi
  const arr = container?.customFieldsValues ?? []
  return arr.map((item) => {
    const r = item as Record<string, unknown>
    return {
      fieldId: String(r.fieldId ?? ''),
      fieldValue: String(r.fieldValue ?? ''),
      action: (r.action as CustomFieldRow['action']) ?? (operation.value === 'create' ? 'set' : 'set'),
    }
  })
}

function setCustomFields(rows: CustomFieldRow[]) {
  setNested(customFieldsPath(), rows)
}

function addCustomField() {
  setCustomFields([...customFieldsList(), { fieldId: '', fieldValue: '', action: 'set' }])
}

function updateCustomField(idx: number, patch: Partial<CustomFieldRow>) {
  const list = customFieldsList()
  const row = list[idx]
  if (!row) return
  list[idx] = { ...row, ...patch }
  setCustomFields(list)
}

function removeCustomField(idx: number) {
  const list = customFieldsList()
  list.splice(idx, 1)
  setCustomFields(list)
}

// ---- Labels (tag input) ----

function labelsPath(): string[] {
  return operation.value === 'create'
    ? ['additionalFields', 'labels']
    : ['updateFields', 'labels']
}

function labelsList(): string[] {
  const bucket = operation.value === 'create' ? get('additionalFields') : get('updateFields')
  const arr = (bucket as { labels?: unknown[] } | undefined)?.labels ?? []
  return arr.map(String)
}

function setLabels(list: string[]) {
  setNested(labelsPath(), list)
}

const newLabel = ref('')
function addLabel() {
  const val = newLabel.value.trim()
  if (!val) return
  const list = labelsList()
  if (list.includes(val)) {
    newLabel.value = ''
    return
  }
  setLabels([...list, val])
  newLabel.value = ''
}

function removeLabel(label: string) {
  setLabels(labelsList().filter(l => l !== label))
}

// ---- Helpers for additional/update field access ----

function getAdditionalField(key: string): string {
  const bucket = get('additionalFields') as Record<string, unknown> | undefined
  return String(bucket?.[key] ?? '')
}

function setAdditionalField(key: string, value: string) {
  setNested(['additionalFields', key], value)
}

function getUpdateField(key: string): string {
  const bucket = get('updateFields') as Record<string, unknown> | undefined
  return String(bucket?.[key] ?? '')
}

function setUpdateField(key: string, value: string) {
  setNested(['updateFields', key], value)
}

// ---- Tooltip / example helpers ----

const CUSTOM_FIELD_HINT = 'Jira custom field ID like "customfield_10001" (find it under Jira → Settings → Custom fields).'

const INCREMENT_EXAMPLE = `{{ ($input.first().json.currentValue || 0) + ($json.body.count || 1) }}`
</script>

<template>
  <div class="space-y-3">
    <!-- Operation picker -->
    <UFormField label="Operation">
      <USelect
        :model-value="operation"
        :items="[
          { label: 'Create Issue', value: 'create' },
          { label: 'Update Issue', value: 'update' },
          { label: 'Add Comment', value: 'addComment' },
          { label: 'Transition (Change Status)', value: 'transition' },
          { label: 'Get Issue (read current values)', value: 'get' },
        ]"
        size="sm"
        class="w-full"
        @update:model-value="(v: string) => setOperation(v)"
      />
    </UFormField>

    <!-- ========== CREATE ========== -->
    <template v-if="operation === 'create'">
      <UFormField label="Project Key">
        <N8nVariableInput
          :model-value="String(get('project') ?? '')"
          :variables="variables"
          placeholder="PROJ"
          @update:model-value="(v: string) => set('project', v)"
        />
      </UFormField>

      <UFormField label="Issue Type">
        <USelect
          :model-value="String(get('issueType') ?? 'Task')"
          :items="[
            { label: 'Task', value: 'Task' },
            { label: 'Bug', value: 'Bug' },
            { label: 'Story', value: 'Story' },
            { label: 'Epic', value: 'Epic' },
            { label: 'Sub-task', value: 'Sub-task' },
          ]"
          size="sm"
          class="w-full"
          @update:model-value="(v: string) => set('issueType', v)"
        />
      </UFormField>

      <UFormField label="Summary">
        <N8nVariableInput
          :model-value="String(get('summary') ?? '')"
          :variables="variables"
          placeholder="{{ $json.body.summary }}"
          @update:model-value="(v: string) => set('summary', v)"
        />
      </UFormField>

      <UFormField label="Description">
        <N8nVariableInput
          :model-value="getAdditionalField('description')"
          :variables="variables"
          multiline
          :rows="4"
          placeholder="Event: {{ $json.body.event }}&#10;User: {{ $json.body.user }}&#10;Summary: {{ $json.body.summary }}"
          @update:model-value="(v: string) => setAdditionalField('description', v)"
        />
      </UFormField>

      <UFormField label="Assignee (account ID)">
        <N8nVariableInput
          :model-value="getAdditionalField('assignee')"
          :variables="variables"
          placeholder="5b10a2844c20165700ede21g (leave blank for unassigned)"
          @update:model-value="(v: string) => setAdditionalField('assignee', v)"
        />
      </UFormField>

      <UFormField label="Priority">
        <USelect
          :model-value="getAdditionalField('priority') || SELECT_NONE"
          :items="[
            { label: 'Keep default', value: SELECT_NONE },
            { label: 'Highest', value: 'Highest' },
            { label: 'High', value: 'High' },
            { label: 'Medium', value: 'Medium' },
            { label: 'Low', value: 'Low' },
            { label: 'Lowest', value: 'Lowest' },
          ]"
          size="sm"
          class="w-full"
          @update:model-value="(v: string) => setAdditionalField('priority', v === SELECT_NONE ? '' : v)"
        />
      </UFormField>

      <UFormField label="Parent Issue Key (for sub-tasks / epic link)">
        <N8nVariableInput
          :model-value="getAdditionalField('parentIssueKey')"
          :variables="variables"
          placeholder="PROJ-123"
          @update:model-value="(v: string) => setAdditionalField('parentIssueKey', v)"
        />
      </UFormField>

      <!-- Labels -->
      <div>
        <p class="text-xs font-medium text-(--ui-text-highlighted) mb-1.5">
          Labels
        </p>
        <div class="flex items-center gap-1 mb-1.5">
          <UInput
            v-model="newLabel"
            placeholder="Add label..."
            size="xs"
            class="flex-1 min-w-0"
            @keydown.enter.prevent="addLabel"
          />
          <UButton
            icon="i-lucide-plus"
            variant="ghost"
            size="xs"
            :disabled="!newLabel.trim()"
            @click="addLabel"
          />
        </div>
        <div class="flex flex-wrap gap-1">
          <UBadge
            v-for="l in labelsList()"
            :key="l"
            variant="subtle"
            color="neutral"
            size="xs"
            class="group cursor-pointer"
            @click="removeLabel(l)"
          >
            {{ l }}
            <UIcon
              name="i-lucide-x"
              class="size-3 ml-1 opacity-60 group-hover:opacity-100"
            />
          </UBadge>
        </div>
      </div>
    </template>

    <!-- ========== UPDATE ========== -->
    <template v-else-if="operation === 'update'">
      <UFormField label="Issue Key">
        <N8nVariableInput
          :model-value="String(get('issueKey') ?? '')"
          :variables="variables"
          placeholder="PROJ-123"
          @update:model-value="(v: string) => set('issueKey', v)"
        />
      </UFormField>

      <UFormField label="Summary (leave blank to skip)">
        <N8nVariableInput
          :model-value="getUpdateField('summary')"
          :variables="variables"
          placeholder="{{ $json.body.summary }}"
          @update:model-value="(v: string) => setUpdateField('summary', v)"
        />
      </UFormField>

      <UFormField label="Description (leave blank to skip)">
        <N8nVariableInput
          :model-value="getUpdateField('description')"
          :variables="variables"
          multiline
          :rows="3"
          placeholder="Latest update: {{ $json.body.summary }}"
          @update:model-value="(v: string) => setUpdateField('description', v)"
        />
      </UFormField>

      <UFormField label="Assignee (account ID, leave blank to skip)">
        <N8nVariableInput
          :model-value="getUpdateField('assignee')"
          :variables="variables"
          placeholder="5b10a2844c20165700ede21g"
          @update:model-value="(v: string) => setUpdateField('assignee', v)"
        />
      </UFormField>

      <UFormField label="Priority">
        <USelect
          :model-value="getUpdateField('priority') || SELECT_NONE"
          :items="[
            { label: 'Keep current', value: SELECT_NONE },
            { label: 'Highest', value: 'Highest' },
            { label: 'High', value: 'High' },
            { label: 'Medium', value: 'Medium' },
            { label: 'Low', value: 'Low' },
            { label: 'Lowest', value: 'Lowest' },
          ]"
          size="sm"
          class="w-full"
          @update:model-value="(v: string) => setUpdateField('priority', v === SELECT_NONE ? '' : v)"
        />
      </UFormField>

      <div class="p-2 bg-(--ui-bg-elevated) rounded text-[11px] text-(--ui-text-muted) leading-relaxed">
        <p class="font-medium text-(--ui-text-highlighted) mb-0.5">
          Tip: Increment / decrement a numeric field
        </p>
        To add the affected count to an existing value, chain a <code class="bg-(--ui-bg) px-1 rounded">Jira → Get Issue</code> node first,
        then reference it in a Custom Field expression below:
        <code class="block mt-1 bg-(--ui-bg) px-1.5 py-1 rounded font-mono">{{ INCREMENT_EXAMPLE }}</code>
      </div>
    </template>

    <!-- ========== ADD COMMENT ========== -->
    <template v-else-if="operation === 'addComment'">
      <UFormField label="Issue Key">
        <N8nVariableInput
          :model-value="String(get('issueKey') ?? '')"
          :variables="variables"
          placeholder="PROJ-123"
          @update:model-value="(v: string) => set('issueKey', v)"
        />
      </UFormField>

      <UFormField label="Comment Body">
        <N8nVariableInput
          :model-value="String(get('comment') ?? '')"
          :variables="variables"
          multiline
          :rows="5"
          placeholder="{{ $json.body.user }} advanced {{ ($json.body.partIds || []).length }} part(s): {{ $json.body.summary }}"
          @update:model-value="(v: string) => set('comment', v)"
        />
      </UFormField>

      <div class="p-2 bg-(--ui-bg-elevated) rounded text-[11px] text-(--ui-text-muted)">
        The n8n Jira node wraps the text in Atlassian Document Format automatically.
        For formatting use <code class="bg-(--ui-bg) px-1 rounded">*bold*</code>,
        <code class="bg-(--ui-bg) px-1 rounded">_italic_</code>, backticks for code.
      </div>
    </template>

    <!-- ========== TRANSITION ========== -->
    <template v-else-if="operation === 'transition'">
      <UFormField label="Issue Key">
        <N8nVariableInput
          :model-value="String(get('issueKey') ?? '')"
          :variables="variables"
          placeholder="PROJ-123"
          @update:model-value="(v: string) => set('issueKey', v)"
        />
      </UFormField>

      <UFormField label="Transition ID or Name">
        <N8nVariableInput
          :model-value="String(get('transitionId') ?? '')"
          :variables="variables"
          placeholder="31 (the numeric transition ID) or 'Done'"
          @update:model-value="(v: string) => set('transitionId', v)"
        />
      </UFormField>

      <UFormField label="Resolution (optional)">
        <USelect
          :model-value="String(get('resolution') ?? SELECT_NONE)"
          :items="[
            { label: 'None', value: SELECT_NONE },
            { label: 'Done', value: 'Done' },
            { label: 'Won\'t Do', value: 'Won\'t Do' },
            { label: 'Duplicate', value: 'Duplicate' },
            { label: 'Cannot Reproduce', value: 'Cannot Reproduce' },
          ]"
          size="sm"
          class="w-full"
          @update:model-value="(v: string) => set('resolution', v === SELECT_NONE ? '' : v)"
        />
      </UFormField>

      <UFormField label="Comment on transition (optional)">
        <N8nVariableInput
          :model-value="String(get('transitionComment') ?? '')"
          :variables="variables"
          multiline
          :rows="2"
          placeholder="Auto-resolved by Shop Planr: {{ $json.body.summary }}"
          @update:model-value="(v: string) => set('transitionComment', v)"
        />
      </UFormField>

      <div class="p-2 bg-(--ui-bg-elevated) rounded text-[11px] text-(--ui-text-muted)">
        Find transition IDs by calling
        <code class="bg-(--ui-bg) px-1 rounded">GET /rest/api/3/issue/PROJ-123/transitions</code>
        or under Jira workflow settings.
      </div>
    </template>

    <!-- ========== GET ========== -->
    <template v-else-if="operation === 'get'">
      <UFormField label="Issue Key">
        <N8nVariableInput
          :model-value="String(get('issueKey') ?? '')"
          :variables="variables"
          placeholder="PROJ-123"
          @update:model-value="(v: string) => set('issueKey', v)"
        />
      </UFormField>

      <div class="p-2 bg-(--ui-bg-elevated) rounded text-[11px] text-(--ui-text-muted)">
        Returns the full issue as JSON so downstream nodes can read current values
        (e.g. <code class="bg-(--ui-bg) px-1 rounded">$json.fields.customfield_10050</code>)
        to compute increments or conditional updates.
      </div>
    </template>

    <!-- ========== Custom fields (shown for create + update) ========== -->
    <template v-if="['create', 'update'].includes(operation)">
      <USeparator />
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <div>
            <label class="text-xs font-medium text-(--ui-text-highlighted) block">
              Custom Fields
            </label>
            <p class="text-[10px] text-(--ui-text-muted) mt-0.5">
              {{ CUSTOM_FIELD_HINT }}
            </p>
          </div>
          <UButton
            icon="i-lucide-plus"
            variant="ghost"
            size="xs"
            @click="addCustomField"
          />
        </div>
        <div
          v-if="customFieldsList().length === 0"
          class="text-[11px] text-(--ui-text-dimmed) px-1.5 py-2 border border-dashed border-(--ui-border) rounded"
        >
          No custom fields. Click + to add.
        </div>
        <div
          v-for="(row, idx) in customFieldsList()"
          :key="idx"
          class="space-y-1 p-2 mb-1.5 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/30"
        >
          <div class="flex items-center gap-1">
            <UInput
              :model-value="row.fieldId"
              placeholder="customfield_10001"
              size="xs"
              class="flex-1 min-w-0 font-mono"
              @update:model-value="(v: string) => updateCustomField(idx, { fieldId: v })"
            />
            <USelect
              v-if="operation === 'update'"
              :model-value="row.action ?? 'set'"
              :items="[
                { label: 'Set', value: 'set' },
                { label: 'Add (multi)', value: 'add' },
                { label: 'Remove (multi)', value: 'remove' },
              ]"
              size="xs"
              class="w-24 shrink-0"
              @update:model-value="(v: string) => updateCustomField(idx, { action: v as 'set' | 'add' | 'remove' })"
            />
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              color="error"
              size="xs"
              @click="removeCustomField(idx)"
            />
          </div>
          <N8nVariableInput
            :model-value="row.fieldValue"
            :variables="variables"
            placeholder="Value (literal, variable, or expression)"
            @update:model-value="(v: string) => updateCustomField(idx, { fieldValue: v })"
          />
        </div>
        <div
          v-if="operation === 'update' && customFieldsList().length > 0"
          class="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded text-[11px] text-amber-700 dark:text-amber-300"
        >
          <strong>Set</strong> overwrites the value.
          <strong>Add</strong>/<strong>Remove</strong> mutate array-valued fields
          (components, labels, multi-select options) in place — see
          <a
            href="https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-issueidorkey-put"
            target="_blank"
            rel="noopener"
            class="underline"
          >Jira REST docs</a>.
        </div>
      </div>
    </template>

    <!-- ========== Configure (collapsible) ========== -->
    <USeparator />
    <UCollapsible>
      <UButton
        variant="ghost"
        size="xs"
        class="w-full justify-between"
        trailing-icon="i-lucide-chevron-down"
      >
        <span class="text-[11px] text-(--ui-text-muted)">Configure</span>
      </UButton>

      <template #content>
        <div class="pt-2 space-y-2">
          <UFormField label="Jira Version">
            <USelect
              :model-value="String(get('jiraVersion') ?? getSavedJiraVersion())"
              :items="[
                { label: 'Server (PAT)', value: 'serverPat' },
                { label: 'Server (Basic Auth)', value: 'server' },
                { label: 'Cloud', value: 'cloud' },
              ]"
              size="sm"
              class="w-full"
              @update:model-value="(v: string) => setJiraVersion(v)"
            />
          </UFormField>
          <p class="text-[10px] text-(--ui-text-dimmed)">
            Must match the credential type configured in n8n. Saved as default for new Jira nodes.
          </p>
        </div>
      </template>
    </UCollapsible>
  </div>
</template>
