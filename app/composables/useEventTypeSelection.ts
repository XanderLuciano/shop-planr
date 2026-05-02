import type { WebhookEventType } from '~/types/domain'
import { WEBHOOK_EVENT_TYPES } from '~/types/domain'

/**
 * Composable for managing webhook event type checkbox selection.
 *
 * Shared between the Webhooks registration form and the N8n Automations
 * event type picker. Provides toggle-all, toggle-single, and allSelected
 * computed state.
 */
export function useEventTypeSelection(formEventTypes: Ref<WebhookEventType[]>) {
  const allSelected = computed(() => formEventTypes.value.length === WEBHOOK_EVENT_TYPES.length)

  function toggleSubscribeAll(checked: boolean | 'indeterminate') {
    if (checked === true) {
      formEventTypes.value = [...WEBHOOK_EVENT_TYPES]
    } else {
      formEventTypes.value = []
    }
  }

  function toggleEventType(type: WebhookEventType, checked: boolean | 'indeterminate') {
    if (checked === true) {
      if (!formEventTypes.value.includes(type)) {
        formEventTypes.value = [...formEventTypes.value, type]
      }
    } else {
      formEventTypes.value = formEventTypes.value.filter(t => t !== type)
    }
  }

  return {
    allSelected,
    toggleSubscribeAll,
    toggleEventType,
  }
}
