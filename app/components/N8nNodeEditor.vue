<script setup lang="ts">
import type { WorkflowVariable } from '~/utils/n8nVariables'

interface NodeData {
  label: string
  nodeType: string
  parameters: Record<string, unknown>
  typeVersion: number
  isTrigger?: boolean
}

const props = defineProps<{
  nodeData: NodeData
  variables: WorkflowVariable[]
  /** Names of all other nodes — used for validating uniqueness */
  otherNodeNames: string[]
}>()

const emit = defineEmits<{
  'update:nodeData': [data: NodeData]
  delete: []
  rename: [oldName: string, newName: string]
}>()

// ---- Local reactive copy ----
// We mutate the reactive object directly so parent watches pick up changes
const data = computed(() => props.nodeData)

function getParams(): Record<string, unknown> {
  return data.value.parameters as Record<string, unknown>
}

function setParam(key: string, value: unknown) {
  const params = { ...getParams(), [key]: value }
  emit('update:nodeData', { ...data.value, parameters: params })
}

function setNestedParam(path: string[], value: unknown) {
  const params = structuredClone(getParams())
  let cursor: Record<string, unknown> = params
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i]!
    if (typeof cursor[segment] !== 'object' || cursor[segment] === null) {
      cursor[segment] = {}
    }
    cursor = cursor[segment] as Record<string, unknown>
  }
  cursor[path[path.length - 1]!] = value
  emit('update:nodeData', { ...data.value, parameters: params })
}

// ---- Name editing ----
const nameInput = ref(data.value.label)
const nameError = ref<string | null>(null)
watch(() => data.value.label, (newName) => {
  nameInput.value = newName
  nameError.value = null
})

function commitName() {
  const trimmed = nameInput.value.trim()
  if (!trimmed) {
    nameError.value = 'Name is required'
    nameInput.value = data.value.label
    return
  }
  if (trimmed === data.value.label) return
  if (props.otherNodeNames.includes(trimmed)) {
    nameError.value = 'Another node already has this name'
    nameInput.value = data.value.label
    return
  }
  const oldName = data.value.label
  emit('update:nodeData', { ...data.value, label: trimmed })
  emit('rename', oldName, trimmed)
  nameError.value = null
}

// ---- HTTP headers / query params editor (repeated key/value table) ----
interface KvRow {
  key: string
  value: string
}

function kvListFromParam(key: string): KvRow[] {
  const val = getParams()[key]
  if (!Array.isArray(val)) return []
  return val.map(item => ({
    key: String((item as Record<string, unknown>)?.name ?? ''),
    value: String((item as Record<string, unknown>)?.value ?? ''),
  }))
}

function setKvList(key: string, rows: KvRow[]) {
  const shaped = rows.map(r => ({ name: r.key, value: r.value }))
  setParam(key, shaped)
}

function addKvRow(key: string) {
  const rows = kvListFromParam(key)
  rows.push({ key: '', value: '' })
  setKvList(key, rows)
}

function updateKvRow(key: string, idx: number, field: 'key' | 'value', val: string) {
  const rows = kvListFromParam(key)
  const row = rows[idx]
  if (!row) return
  row[field] = val
  setKvList(key, rows)
}

function removeKvRow(key: string, idx: number) {
  const rows = kvListFromParam(key)
  rows.splice(idx, 1)
  setKvList(key, rows)
}

// ---- Assignments editor (for Set node) ----
interface Assignment {
  name: string
  value: string
  type: 'string' | 'number' | 'boolean'
}

function assignmentsFromParam(): Assignment[] {
  const params = getParams()
  const container = params.assignments as { assignments?: Assignment[] } | undefined
  return Array.isArray(container?.assignments) ? container.assignments : []
}

function setAssignments(list: Assignment[]) {
  setNestedParam(['assignments', 'assignments'], list)
}

function addAssignment() {
  const list = assignmentsFromParam()
  list.push({ name: '', value: '', type: 'string' })
  setAssignments(list)
}

function updateAssignment(idx: number, field: keyof Assignment, value: string) {
  const list = assignmentsFromParam()
  const row = list[idx]
  if (!row) return
  if (field === 'type' && (value === 'string' || value === 'number' || value === 'boolean')) {
    row.type = value
  } else if (field === 'name' || field === 'value') {
    row[field] = value
  }
  setAssignments(list)
}

function removeAssignment(idx: number) {
  const list = assignmentsFromParam()
  list.splice(idx, 1)
  setAssignments(list)
}

// ---- Condition editor (for IF / Filter nodes) ----
interface ConditionRow {
  leftValue: string
  operation: string
  rightValue: string
}

function conditionsFromParam(): ConditionRow[] {
  const params = getParams()
  const container = params.conditions as { conditions?: ConditionRow[] } | undefined
  return Array.isArray(container?.conditions) ? container.conditions : []
}

function setConditions(list: ConditionRow[]) {
  setNestedParam(['conditions', 'conditions'], list)
}

function addCondition() {
  const list = conditionsFromParam()
  list.push({ leftValue: '', operation: 'equal', rightValue: '' })
  setConditions(list)
}

function updateCondition(idx: number, field: keyof ConditionRow, value: string) {
  const list = conditionsFromParam()
  const row = list[idx]
  if (!row) return
  row[field] = value
  setConditions(list)
}

function removeCondition(idx: number) {
  const list = conditionsFromParam()
  list.splice(idx, 1)
  setConditions(list)
}

const CONDITION_OPS = [
  { label: '=', value: 'equal' },
  { label: '≠', value: 'notEqual' },
  { label: 'contains', value: 'contains' },
  { label: 'does not contain', value: 'notContains' },
  { label: 'starts with', value: 'startsWith' },
  { label: 'ends with', value: 'endsWith' },
  { label: '>', value: 'greater' },
  { label: '<', value: 'less' },
  { label: 'is empty', value: 'isEmpty' },
  { label: 'is not empty', value: 'isNotEmpty' },
]

// ---- Raw JSON input (fallback for unknown node types) ----
function onRawJsonInput(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    emit('update:nodeData', { ...data.value, parameters: parsed })
  } catch {
    // ignore invalid JSON while typing
  }
}

// ---- Node type display name ----
const nodeTypeLabel = computed(() =>
  data.value.nodeType.replace('n8n-nodes-base.', '').replace(/([A-Z])/g, ' $1').trim(),
)
</script>

<template>
  <div class="space-y-3">
    <!-- Node name (not editable for trigger) -->
    <UFormField
      label="Name"
      :error="nameError ?? undefined"
    >
      <UInput
        v-model="nameInput"
        :disabled="data.isTrigger"
        size="sm"
        class="w-full"
        @blur="commitName"
        @keydown.enter="(e: KeyboardEvent) => (e.target as HTMLInputElement)?.blur()"
      />
    </UFormField>

    <!-- Node type badge -->
    <div class="flex items-center gap-2">
      <span class="text-xs text-(--ui-text-muted)">Type</span>
      <UBadge
        variant="subtle"
        color="neutral"
        size="xs"
      >
        {{ nodeTypeLabel }}
      </UBadge>
    </div>

    <USeparator />

    <!-- ============ TRIGGER NODE ============ -->
    <template v-if="data.isTrigger">
      <div class="p-2.5 rounded-md bg-violet-500/10 border border-violet-500/30 space-y-1.5">
        <p class="text-xs font-medium text-violet-700 dark:text-violet-300">
          Shop Planr Webhook Trigger
        </p>
        <p class="text-[11px] text-(--ui-text-muted) leading-relaxed">
          This node receives Shop Planr events via an HTTP POST. The payload is available
          in downstream nodes as <code class="bg-(--ui-bg) px-1 rounded">$json.body.*</code>.
        </p>
      </div>
      <div>
        <p class="text-xs font-medium text-(--ui-text-highlighted) mb-1.5">
          Available Variables
        </p>
        <div class="space-y-1 max-h-64 overflow-y-auto border border-(--ui-border) rounded-md p-1.5 bg-(--ui-bg-elevated)/30">
          <div
            v-for="v in variables"
            :key="v.expression"
            class="text-[11px] px-1.5 py-1"
          >
            <div class="flex items-center justify-between gap-2">
              <code class="font-mono text-(--ui-text-highlighted)">{{ v.label }}</code>
              <span class="text-(--ui-text-dimmed)">{{ v.type }}</span>
            </div>
            <p
              v-if="v.description"
              class="text-(--ui-text-muted) mt-0.5"
            >
              {{ v.description }}
            </p>
          </div>
        </div>
      </div>
    </template>

    <!-- ============ HTTP REQUEST ============ -->
    <template v-else-if="data.nodeType === 'n8n-nodes-base.httpRequest'">
      <UFormField label="Method">
        <USelect
          :model-value="(getParams().method as string) ?? 'POST'"
          :items="[
            { label: 'POST', value: 'POST' },
            { label: 'GET', value: 'GET' },
            { label: 'PUT', value: 'PUT' },
            { label: 'PATCH', value: 'PATCH' },
            { label: 'DELETE', value: 'DELETE' },
          ]"
          size="sm"
          class="w-full"
          @update:model-value="(v: string) => setParam('method', v)"
        />
      </UFormField>

      <UFormField label="URL">
        <N8nVariableInput
          :model-value="(getParams().url as string) ?? ''"
          :variables="variables"
          placeholder="https://api.example.com/webhook"
          @update:model-value="(v: string) => setParam('url', v)"
        />
      </UFormField>

      <UFormField label="Authentication">
        <USelect
          :model-value="(getParams().authentication as string) ?? 'none'"
          :items="[
            { label: 'None', value: 'none' },
            { label: 'Bearer Token', value: 'bearer' },
            { label: 'Basic Auth', value: 'basicAuth' },
            { label: 'Header Auth', value: 'headerAuth' },
          ]"
          size="sm"
          class="w-full"
          @update:model-value="(v: string) => setParam('authentication', v)"
        />
      </UFormField>

      <UFormField
        v-if="getParams().authentication === 'bearer'"
        label="Bearer Token"
      >
        <N8nVariableInput
          :model-value="(getParams().bearerToken as string) ?? ''"
          :variables="variables"
          placeholder="your-token"
          @update:model-value="(v: string) => setParam('bearerToken', v)"
        />
      </UFormField>

      <!-- Headers -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="text-xs font-medium text-(--ui-text-highlighted)">
            Headers
          </label>
          <UButton
            icon="i-lucide-plus"
            variant="ghost"
            size="xs"
            @click="addKvRow('headers')"
          />
        </div>
        <div
          v-if="kvListFromParam('headers').length === 0"
          class="text-[11px] text-(--ui-text-dimmed) px-1.5 py-1"
        >
          No custom headers. Click + to add.
        </div>
        <div
          v-for="(row, idx) in kvListFromParam('headers')"
          :key="idx"
          class="flex items-center gap-1 mb-1"
        >
          <UInput
            :model-value="row.key"
            placeholder="Name"
            size="xs"
            class="flex-1 min-w-0"
            @update:model-value="(v: string) => updateKvRow('headers', idx, 'key', v)"
          />
          <N8nVariableInput
            :model-value="row.value"
            :variables="variables"
            placeholder="Value"
            class="flex-1 min-w-0"
            @update:model-value="(v: string) => updateKvRow('headers', idx, 'value', v)"
          />
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            color="error"
            size="xs"
            @click="removeKvRow('headers', idx)"
          />
        </div>
      </div>

      <!-- Query Params -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="text-xs font-medium text-(--ui-text-highlighted)">
            Query Parameters
          </label>
          <UButton
            icon="i-lucide-plus"
            variant="ghost"
            size="xs"
            @click="addKvRow('queryParameters')"
          />
        </div>
        <div
          v-if="kvListFromParam('queryParameters').length === 0"
          class="text-[11px] text-(--ui-text-dimmed) px-1.5 py-1"
        >
          No query params. Click + to add.
        </div>
        <div
          v-for="(row, idx) in kvListFromParam('queryParameters')"
          :key="idx"
          class="flex items-center gap-1 mb-1"
        >
          <UInput
            :model-value="row.key"
            placeholder="Name"
            size="xs"
            class="flex-1 min-w-0"
            @update:model-value="(v: string) => updateKvRow('queryParameters', idx, 'key', v)"
          />
          <N8nVariableInput
            :model-value="row.value"
            :variables="variables"
            placeholder="Value"
            class="flex-1 min-w-0"
            @update:model-value="(v: string) => updateKvRow('queryParameters', idx, 'value', v)"
          />
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            color="error"
            size="xs"
            @click="removeKvRow('queryParameters', idx)"
          />
        </div>
      </div>

      <!-- Body -->
      <UFormField
        v-if="['POST', 'PUT', 'PATCH'].includes((getParams().method as string) ?? 'POST')"
        label="Body Format"
      >
        <USelect
          :model-value="(getParams().contentType as string) ?? 'json'"
          :items="[
            { label: 'JSON', value: 'json' },
            { label: 'Form URL-encoded', value: 'form' },
            { label: 'Raw', value: 'raw' },
          ]"
          size="sm"
          class="w-full"
          @update:model-value="(v: string) => setParam('contentType', v)"
        />
      </UFormField>

      <UFormField
        v-if="['POST', 'PUT', 'PATCH'].includes((getParams().method as string) ?? 'POST')"
        label="Body"
      >
        <N8nVariableInput
          :model-value="(getParams().body as string) ?? ''"
          :variables="variables"
          multiline
          :rows="5"
          input-class="font-mono text-xs"
          :placeholder="(getParams().contentType as string) === 'json' ? '{\n  &quot;message&quot;: &quot;{{ $json.body.summary }}&quot;\n}' : 'Request body'"
          @update:model-value="(v: string) => setParam('body', v)"
        />
      </UFormField>
    </template>

    <!-- ============ SLACK ============ -->
    <template v-else-if="data.nodeType === 'n8n-nodes-base.slack'">
      <UFormField label="Channel">
        <N8nVariableInput
          :model-value="(getParams().channel as string) ?? ''"
          :variables="variables"
          placeholder="#general or C01234567"
          @update:model-value="(v: string) => setParam('channel', v)"
        />
      </UFormField>
      <UFormField label="Message Text">
        <N8nVariableInput
          :model-value="(getParams().text as string) ?? ''"
          :variables="variables"
          multiline
          :rows="4"
          placeholder="{{ $json.body.summary }}"
          @update:model-value="(v: string) => setParam('text', v)"
        />
      </UFormField>
      <div class="p-2 bg-(--ui-bg-elevated) rounded text-[11px] text-(--ui-text-muted)">
        Requires a Slack OAuth2 credential configured in your n8n instance.
      </div>
    </template>

    <!-- ============ DISCORD ============ -->
    <template v-else-if="data.nodeType === 'n8n-nodes-base.discord'">
      <UFormField label="Webhook URL">
        <N8nVariableInput
          :model-value="(getParams().webhookUri as string) ?? ''"
          :variables="variables"
          placeholder="https://discord.com/api/webhooks/..."
          @update:model-value="(v: string) => setParam('webhookUri', v)"
        />
      </UFormField>
      <UFormField label="Message Content">
        <N8nVariableInput
          :model-value="(getParams().content as string) ?? ''"
          :variables="variables"
          multiline
          :rows="4"
          placeholder="{{ $json.body.summary }}"
          @update:model-value="(v: string) => setParam('content', v)"
        />
      </UFormField>
    </template>

    <!-- ============ JIRA (dedicated component) ============ -->
    <template v-else-if="data.nodeType === 'n8n-nodes-base.jira'">
      <N8nJiraEditor
        :parameters="getParams()"
        :variables="variables"
        @update:parameters="(p: Record<string, unknown>) => emit('update:nodeData', { ...data, parameters: p })"
      />
    </template>

    <!-- ============ GMAIL ============ -->
    <template v-else-if="data.nodeType === 'n8n-nodes-base.gmail'">
      <UFormField label="To">
        <N8nVariableInput
          :model-value="(getParams().to as string) ?? ''"
          :variables="variables"
          placeholder="user@example.com"
          @update:model-value="(v: string) => setParam('to', v)"
        />
      </UFormField>
      <UFormField label="Subject">
        <N8nVariableInput
          :model-value="(getParams().subject as string) ?? ''"
          :variables="variables"
          placeholder="Shop Planr: {{ $json.body.event }}"
          @update:model-value="(v: string) => setParam('subject', v)"
        />
      </UFormField>
      <UFormField label="Message">
        <N8nVariableInput
          :model-value="(getParams().message as string) ?? ''"
          :variables="variables"
          multiline
          :rows="5"
          placeholder="{{ $json.body.summary }}"
          @update:model-value="(v: string) => setParam('message', v)"
        />
      </UFormField>
    </template>

    <!-- ============ MS TEAMS ============ -->
    <template v-else-if="data.nodeType === 'n8n-nodes-base.microsoftTeams'">
      <UFormField label="Webhook URL">
        <N8nVariableInput
          :model-value="(getParams().webhookUri as string) ?? ''"
          :variables="variables"
          placeholder="https://outlook.office.com/webhook/..."
          @update:model-value="(v: string) => setParam('webhookUri', v)"
        />
      </UFormField>
      <UFormField label="Message">
        <N8nVariableInput
          :model-value="(getParams().message as string) ?? ''"
          :variables="variables"
          multiline
          :rows="4"
          placeholder="{{ $json.body.summary }}"
          @update:model-value="(v: string) => setParam('message', v)"
        />
      </UFormField>
    </template>

    <!-- ============ SET FIELDS ============ -->
    <template v-else-if="data.nodeType === 'n8n-nodes-base.set'">
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="text-xs font-medium text-(--ui-text-highlighted)">
            Field Assignments
          </label>
          <UButton
            icon="i-lucide-plus"
            variant="ghost"
            size="xs"
            @click="addAssignment"
          />
        </div>
        <div
          v-if="assignmentsFromParam().length === 0"
          class="text-[11px] text-(--ui-text-dimmed) px-1.5 py-2 border border-dashed border-(--ui-border) rounded"
        >
          No fields. Click + to add an output field.
        </div>
        <div
          v-for="(a, idx) in assignmentsFromParam()"
          :key="idx"
          class="space-y-1 p-2 mb-1.5 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/30"
        >
          <div class="flex items-center gap-1">
            <UInput
              :model-value="a.name"
              placeholder="Field name"
              size="xs"
              class="flex-1 min-w-0"
              @update:model-value="(v: string) => updateAssignment(idx, 'name', v)"
            />
            <USelect
              :model-value="a.type"
              :items="[
                { label: 'String', value: 'string' },
                { label: 'Number', value: 'number' },
                { label: 'Boolean', value: 'boolean' },
              ]"
              size="xs"
              class="w-24 shrink-0"
              @update:model-value="(v: string) => updateAssignment(idx, 'type', v)"
            />
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              color="error"
              size="xs"
              @click="removeAssignment(idx)"
            />
          </div>
          <N8nVariableInput
            :model-value="a.value"
            :variables="variables"
            placeholder="Value"
            @update:model-value="(v: string) => updateAssignment(idx, 'value', v)"
          />
        </div>
      </div>
    </template>

    <!-- ============ CODE ============ -->
    <template v-else-if="data.nodeType === 'n8n-nodes-base.code'">
      <UFormField label="Language">
        <USelect
          :model-value="(getParams().language as string) ?? 'javaScript'"
          :items="[
            { label: 'JavaScript', value: 'javaScript' },
            { label: 'Python', value: 'python' },
          ]"
          size="sm"
          class="w-full"
          @update:model-value="(v: string) => setParam('language', v)"
        />
      </UFormField>
      <UFormField label="Code">
        <textarea
          :value="(getParams().jsCode as string) ?? ''"
          rows="10"
          class="w-full px-2.5 py-1.5 text-xs rounded-md border border-(--ui-border) bg-(--ui-bg) text-(--ui-text-highlighted) focus:outline-none focus:ring-2 focus:ring-(--ui-primary) focus:border-transparent font-mono resize-y"
          placeholder="// Access input with $input.first().json&#10;// Return shaped items&#10;return items;"
          @input="(e: Event) => setParam('jsCode', (e.target as HTMLTextAreaElement).value)"
        />
      </UFormField>
      <div class="p-2 bg-(--ui-bg-elevated) rounded text-[11px] text-(--ui-text-muted) space-y-1">
        <p class="font-medium">
          Available in code:
        </p>
        <ul class="space-y-0.5">
          <li><code>$input.first().json.body</code> — the Shop Planr payload</li>
          <li><code>items</code> — array of input items</li>
          <li>Return an array of <code>{ json: {...} }</code> objects</li>
        </ul>
      </div>
    </template>

    <!-- ============ IF / FILTER ============ -->
    <template v-else-if="['n8n-nodes-base.if', 'n8n-nodes-base.filter'].includes(data.nodeType)">
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="text-xs font-medium text-(--ui-text-highlighted)">
            Conditions
          </label>
          <UButton
            icon="i-lucide-plus"
            variant="ghost"
            size="xs"
            @click="addCondition"
          />
        </div>
        <div
          v-if="conditionsFromParam().length === 0"
          class="text-[11px] text-(--ui-text-dimmed) px-1.5 py-2 border border-dashed border-(--ui-border) rounded"
        >
          No conditions. Click + to add.
        </div>
        <div
          v-for="(c, idx) in conditionsFromParam()"
          :key="idx"
          class="space-y-1 p-2 mb-1.5 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/30"
        >
          <N8nVariableInput
            :model-value="c.leftValue"
            :variables="variables"
            placeholder="Left value, e.g. {{ $json.body.event }}"
            @update:model-value="(v: string) => updateCondition(idx, 'leftValue', v)"
          />
          <div class="flex items-center gap-1">
            <USelect
              :model-value="c.operation"
              :items="CONDITION_OPS"
              size="xs"
              class="flex-1 min-w-0"
              @update:model-value="(v: string) => updateCondition(idx, 'operation', v)"
            />
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              color="error"
              size="xs"
              @click="removeCondition(idx)"
            />
          </div>
          <N8nVariableInput
            v-if="!['isEmpty', 'isNotEmpty'].includes(c.operation)"
            :model-value="c.rightValue"
            :variables="variables"
            placeholder="Right value"
            @update:model-value="(v: string) => updateCondition(idx, 'rightValue', v)"
          />
        </div>
        <p
          v-if="data.nodeType === 'n8n-nodes-base.if'"
          class="text-[11px] text-(--ui-text-muted) mt-1"
        >
          IF outputs to <strong>true</strong> branch when all conditions match, else <strong>false</strong> branch.
        </p>
        <p
          v-else
          class="text-[11px] text-(--ui-text-muted) mt-1"
        >
          Filter passes through items that match all conditions.
        </p>
      </div>
    </template>

    <!-- ============ SWITCH (dedicated component) ============ -->
    <template v-else-if="data.nodeType === 'n8n-nodes-base.switch'">
      <N8nSwitchEditor
        :parameters="getParams()"
        :variables="variables"
        @update:parameters="(p: Record<string, unknown>) => emit('update:nodeData', { ...data, parameters: p })"
      />
    </template>

    <!-- ============ MERGE ============ -->
    <template v-else-if="data.nodeType === 'n8n-nodes-base.merge'">
      <UFormField label="Mode">
        <USelect
          :model-value="(getParams().mode as string) ?? 'append'"
          :items="[
            { label: 'Append (concatenate all inputs)', value: 'append' },
            { label: 'Combine by position', value: 'combineByPosition' },
            { label: 'Combine by matching fields', value: 'combineByFields' },
            { label: 'Choose branch (pass one through)', value: 'chooseBranch' },
          ]"
          size="sm"
          class="w-full"
          @update:model-value="(v: string) => setParam('mode', v)"
        />
      </UFormField>
      <div class="p-2 bg-(--ui-bg-elevated) rounded text-[11px] text-(--ui-text-muted)">
        Connect multiple source branches into the Merge node's input. Useful after an IF/Switch
        when you want to rejoin the flows before a shared destination.
      </div>
    </template>

    <!-- ============ LOOP OVER ITEMS (split in batches) ============ -->
    <template v-else-if="data.nodeType === 'n8n-nodes-base.splitInBatches'">
      <UFormField label="Batch Size">
        <UInput
          :model-value="String(getParams().batchSize ?? 1)"
          type="number"
          size="sm"
          class="w-full"
          @update:model-value="(v: string) => setParam('batchSize', Number(v) || 1)"
        />
      </UFormField>
      <div class="p-2 bg-(--ui-bg-elevated) rounded text-[11px] text-(--ui-text-muted) space-y-1">
        <p class="font-medium text-(--ui-text-highlighted)">
          Looping over partIds
        </p>
        <p>
          Feed this node an array item (e.g. via a <code class="bg-(--ui-bg) px-1 rounded">Code</code>
          node that returns <code class="bg-(--ui-bg) px-1 rounded">$json.body.partIds.map(id => ({ json: { partId: id } }))</code>).
          The <strong>LOOP</strong> output fires once per item; wire your per-item destination to it
          and send back the last node to this Loop node's input to iterate.
        </p>
        <p>
          The <strong>DONE</strong> output fires once when iteration finishes — use it for a
          final summary Slack/email notification.
        </p>
      </div>
    </template>

    <!-- ============ WAIT ============ -->
    <template v-else-if="data.nodeType === 'n8n-nodes-base.wait'">
      <UFormField label="Resume">
        <USelect
          :model-value="(getParams().resume as string) ?? 'timeInterval'"
          :items="[
            { label: 'After time interval', value: 'timeInterval' },
            { label: 'At specific time', value: 'specificTime' },
            { label: 'On webhook call', value: 'webhook' },
          ]"
          size="sm"
          class="w-full"
          @update:model-value="(v: string) => setParam('resume', v)"
        />
      </UFormField>
      <template v-if="(getParams().resume as string ?? 'timeInterval') === 'timeInterval'">
        <div class="flex gap-2">
          <UFormField
            label="Amount"
            class="flex-1"
          >
            <UInput
              :model-value="String(getParams().amount ?? 5)"
              type="number"
              size="sm"
              class="w-full"
              @update:model-value="(v: string) => setParam('amount', Number(v) || 0)"
            />
          </UFormField>
          <UFormField
            label="Unit"
            class="flex-1"
          >
            <USelect
              :model-value="(getParams().unit as string) ?? 'seconds'"
              :items="[
                { label: 'Seconds', value: 'seconds' },
                { label: 'Minutes', value: 'minutes' },
                { label: 'Hours', value: 'hours' },
                { label: 'Days', value: 'days' },
              ]"
              size="sm"
              class="w-full"
              @update:model-value="(v: string) => setParam('unit', v)"
            />
          </UFormField>
        </div>
      </template>
      <template v-else-if="(getParams().resume as string) === 'specificTime'">
        <UFormField label="DateTime (ISO 8601)">
          <N8nVariableInput
            :model-value="String(getParams().dateTime ?? '')"
            :variables="variables"
            placeholder="2026-05-01T09:00:00Z"
            @update:model-value="(v: string) => setParam('dateTime', v)"
          />
        </UFormField>
      </template>
    </template>

    <!-- ============ STOP & ERROR ============ -->
    <template v-else-if="data.nodeType === 'n8n-nodes-base.stopAndError'">
      <UFormField label="Error Message">
        <N8nVariableInput
          :model-value="String(getParams().errorMessage ?? '')"
          :variables="variables"
          multiline
          :rows="3"
          placeholder="Halted because {{ $json.body.event }} was unexpected"
          @update:model-value="(v: string) => setParam('errorMessage', v)"
        />
      </UFormField>
      <div class="p-2 bg-(--ui-bg-elevated) rounded text-[11px] text-(--ui-text-muted)">
        Useful at the end of an IF "false" branch to explicitly fail the run with a
        readable message (appears in n8n executions log).
      </div>
    </template>

    <!-- ============ NO OP ============ -->
    <template v-else-if="data.nodeType === 'n8n-nodes-base.noOp'">
      <div class="p-2 bg-(--ui-bg-elevated) rounded text-[11px] text-(--ui-text-muted)">
        No Op does nothing — pass-through. Use it as a visual join point after an IF or Switch,
        or as a placeholder to make the diagram clearer.
      </div>
    </template>

    <!-- ============ UNKNOWN ============ -->
    <template v-else>
      <UFormField label="Parameters (Raw JSON)">
        <textarea
          :value="JSON.stringify(data.parameters, null, 2)"
          rows="8"
          class="w-full px-2.5 py-1.5 text-xs rounded-md border border-(--ui-border) bg-(--ui-bg) text-(--ui-text-highlighted) focus:outline-none focus:ring-2 focus:ring-(--ui-primary) focus:border-transparent font-mono resize-y"
          @input="onRawJsonInput"
        />
      </UFormField>
    </template>

    <USeparator v-if="!data.isTrigger" />

    <!-- Delete node (not for trigger) -->
    <UButton
      v-if="!data.isTrigger"
      label="Delete Node"
      icon="i-lucide-trash-2"
      color="error"
      variant="soft"
      size="sm"
      block
      @click="emit('delete')"
    />
  </div>
</template>
