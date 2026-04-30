import type { WebhookEventType } from '~/types/domain'
import { WEBHOOK_PAYLOAD_SCHEMAS, extractPayloadFields } from '~/utils/webhookPayloadDocs'

export type VariableGroup = 'envelope' | 'payload' | 'computed' | 'flow'

export interface WorkflowVariable {
  /** The n8n expression, e.g. `{{ $json.body.partId }}` */
  expression: string
  /** Friendly label, e.g. `partId` */
  label: string
  /** Type hint, e.g. `string` or `string[]` */
  type: string
  /** Description from the schema */
  description: string
  /** Which event types this variable appears in (empty = always present) */
  availableIn: WebhookEventType[]
  /** Grouping bucket for the picker */
  group: VariableGroup
}

// ---- Computed helper expressions ----

/**
 * Handy derived expressions users commonly want: counts, first element
 * of an array, default fallbacks, fresh timestamps. These are always
 * available regardless of event type because they're just JavaScript.
 */
const COMPUTED_HELPERS: WorkflowVariable[] = [
  {
    expression: '{{ ($json.body.partIds || []).length }}',
    label: 'partIds count',
    type: 'number',
    description: 'Number of parts in the batch (0 if partIds is not set)',
    availableIn: [],
    group: 'computed',
  },
  {
    expression: '{{ ($json.body.partIds || [$json.body.partId]).filter(Boolean)[0] }}',
    label: 'first part id',
    type: 'string',
    description: 'First part ID — works for both single and batch events',
    availableIn: [],
    group: 'computed',
  },
  {
    expression: '{{ ($json.body.partIds || [$json.body.partId]).filter(Boolean).join(", ") }}',
    label: 'part ids (csv)',
    type: 'string',
    description: 'Comma-separated list of part IDs — works for single or batch',
    availableIn: [],
    group: 'computed',
  },
  {
    expression: '{{ $json.body.count || ($json.body.partIds || []).length || 1 }}',
    label: 'affected count',
    type: 'number',
    description: 'How many parts the event affected (uses count or partIds length or 1)',
    availableIn: [],
    group: 'computed',
  },
  {
    expression: '{{ $now.toISO() }}',
    label: 'now (ISO)',
    type: 'string',
    description: 'Current timestamp in ISO 8601',
    availableIn: [],
    group: 'computed',
  },
  {
    expression: '{{ $now.toFormat("yyyy-LL-dd") }}',
    label: 'today (date)',
    type: 'string',
    description: 'Today\'s date as YYYY-MM-DD',
    availableIn: [],
    group: 'computed',
  },
  {
    expression: '{{ DateTime.fromISO($json.body.timestamp).toRelative() }}',
    label: 'timestamp (relative)',
    type: 'string',
    description: 'Event timestamp as relative text (e.g. "5 minutes ago")',
    availableIn: [],
    group: 'computed',
  },
]

/**
 * Build the list of variables available inside a workflow given the
 * event types that trigger it. Includes the always-present envelope
 * fields (event, summary, timestamp), per-event payload fields, and
 * a library of computed helper expressions.
 */
export function buildVariablesForEventTypes(eventTypes: WebhookEventType[]): WorkflowVariable[] {
  const variables: WorkflowVariable[] = [
    {
      expression: '{{ $json.body.event }}',
      label: 'event',
      type: 'string',
      description: 'The event type identifier (e.g. "part_advanced")',
      availableIn: [],
      group: 'envelope',
    },
    {
      expression: '{{ $json.body.summary }}',
      label: 'summary',
      type: 'string',
      description: 'Human-readable one-line description of the event',
      availableIn: [],
      group: 'envelope',
    },
    {
      expression: '{{ $json.body.timestamp }}',
      label: 'timestamp',
      type: 'string',
      description: 'ISO 8601 timestamp of when the event occurred',
      availableIn: [],
      group: 'envelope',
    },
  ]

  // Track payload fields we've already added to avoid duplicates across event types
  const seen = new Map<string, WorkflowVariable>()

  for (const eventType of eventTypes) {
    const schema = WEBHOOK_PAYLOAD_SCHEMAS[eventType]
    if (!schema) continue
    const fields = extractPayloadFields(schema)
    for (const field of fields) {
      const expression = `{{ $json.body.${field.name} }}`
      const existing = seen.get(field.name)
      if (existing) {
        if (!existing.availableIn.includes(eventType)) {
          existing.availableIn.push(eventType)
        }
      } else {
        const v: WorkflowVariable = {
          expression,
          label: field.name,
          type: field.type,
          description: field.description,
          availableIn: [eventType],
          group: 'payload',
        }
        seen.set(field.name, v)
        variables.push(v)
      }
    }
  }

  // If a payload field is available in ALL subscribed event types, blank
  // `availableIn` so the picker shows "Always available" for it.
  for (const v of variables) {
    if (v.group !== 'payload') continue
    if (v.availableIn.length === eventTypes.length && eventTypes.length > 0) {
      v.availableIn = []
    }
  }

  // Append computed helpers last — always useful, always available.
  variables.push(...COMPUTED_HELPERS)

  return variables
}

/**
 * Variables that represent the CURRENT loop iteration inside a
 * Split-In-Batches (Loop Over Items) branch. These are surfaced in the
 * picker only when the user is editing a node downstream of such a loop.
 */
export const LOOP_VARIABLES: WorkflowVariable[] = [
  {
    expression: '{{ $json }}',
    label: 'loop item',
    type: 'object',
    description: 'The current item being processed by the loop',
    availableIn: [],
    group: 'flow',
  },
  {
    expression: '{{ $itemIndex }}',
    label: 'loop index',
    type: 'number',
    description: 'Zero-based index of the current iteration',
    availableIn: [],
    group: 'flow',
  },
]

/**
 * Insert a variable expression at the cursor position of an input/textarea.
 * Returns the new value string so the caller can update the model.
 */
export function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement,
  expression: string,
): string {
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  const before = el.value.slice(0, start)
  const after = el.value.slice(end)
  const newValue = `${before}${expression}${after}`
  // Schedule cursor positioning after Vue updates the DOM
  requestAnimationFrame(() => {
    el.focus()
    const pos = start + expression.length
    el.setSelectionRange(pos, pos)
  })
  return newValue
}
