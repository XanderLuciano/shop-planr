import type { WebhookEventType } from '~/types/domain'
import { WEBHOOK_PAYLOAD_SCHEMAS, extractPayloadFields } from '~/utils/webhookPayloadDocs'

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
}

/**
 * Build the list of variables available inside a workflow given the
 * event types that trigger it. Includes the always-present envelope
 * fields (event, summary, timestamp) plus per-event payload fields.
 */
export function buildVariablesForEventTypes(eventTypes: WebhookEventType[]): WorkflowVariable[] {
  const variables: WorkflowVariable[] = [
    {
      expression: '{{ $json.body.event }}',
      label: 'event',
      type: 'string',
      description: 'The event type identifier (e.g. "part_advanced")',
      availableIn: [],
    },
    {
      expression: '{{ $json.body.summary }}',
      label: 'summary',
      type: 'string',
      description: 'Human-readable one-line description of the event',
      availableIn: [],
    },
    {
      expression: '{{ $json.body.timestamp }}',
      label: 'timestamp',
      type: 'string',
      description: 'ISO 8601 timestamp of when the event occurred',
      availableIn: [],
    },
  ]

  // Track fields we've already added to avoid duplicates across event types
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
        }
        seen.set(field.name, v)
        variables.push(v)
      }
    }
  }

  // If a field is available in ALL subscribed event types, mark it as "always"
  for (const v of variables) {
    if (v.availableIn.length === eventTypes.length && eventTypes.length > 0) {
      v.availableIn = []
    }
  }

  return variables
}

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
