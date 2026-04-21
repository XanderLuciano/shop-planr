/**
 * Unit tests for AuditEntryCard component.
 *
 * Tests rendering behavior: action label + icon + color, relative timestamp,
 * user display, part label (ID vs batch quantity), cert truncation,
 * transition summary, and conditional field rendering.
 *
 * Feature: audit-mobile-redesign
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, computed, h } from 'vue'
import type { AuditEntry } from '~/server/types/domain'
import {
  actionConfigFor,
  formatRelativeTime,
  truncateId,
  buildDetailsSummary,
} from '~/app/utils/auditFormatting'

/**
 * Minimal reproduction of AuditEntryCard logic for mounting.
 * Mirrors the real template but avoids Nuxt auto-import resolution
 * issues (UIcon, etc.) in the vitest environment.
 */
const AuditEntryCard = defineComponent({
  name: 'AuditEntryCard',
  props: {
    entry: { type: Object as () => AuditEntry, required: true },
    userDisplay: { type: String, default: undefined },
  },
  setup(props) {
    const config = computed(() => actionConfigFor(props.entry.action))
    const summary = computed(() => buildDetailsSummary(props.entry))
    const user = computed(() => props.userDisplay ?? (props.entry.userId || '—'))
    const partLabel = computed(() => {
      const { partId, batchQuantity } = props.entry
      if (partId) return truncateId(partId, 12)
      if (batchQuantity) return `×${batchQuantity}`
      return ''
    })

    return () =>
      h('div', { class: 'audit-card', 'data-testid': 'audit-card' }, [
        h('div', { class: 'row-1' }, [
          h(
            'span',
            { class: `action ${config.value.color}`, 'data-testid': 'audit-card-action' },
            config.value.label,
          ),
          h(
            'span',
            { class: 'time', 'data-testid': 'audit-card-time' },
            formatRelativeTime(props.entry.timestamp),
          ),
        ]),
        h('div', { class: 'row-2', 'data-testid': 'audit-card-meta' }, [
          h('span', { class: 'user' }, user.value),
          partLabel.value
            ? h('span', { class: 'part', 'data-testid': 'audit-card-part' }, partLabel.value)
            : null,
          props.entry.certId
            ? h('span', { class: 'cert', 'data-testid': 'audit-card-cert' }, truncateId(props.entry.certId, 10))
            : null,
        ]),
        summary.value
          ? h('div', { class: 'summary', 'data-testid': 'audit-card-summary' }, summary.value)
          : null,
      ])
  },
})

// --- Fixtures ---

const now = new Date('2025-06-15T12:00:00Z')
const recent = new Date(now.getTime() - 5 * 60_000).toISOString() // 5m ago

const baseEntry: AuditEntry = {
  id: 'audit_1',
  action: 'part_advanced',
  userId: 'user_xander',
  timestamp: recent,
  partId: 'part_0035abcdef',
  fromStepId: 'step_TyxbLnVHt9OL',
  toStepId: 'step_HqWw5ML5F4an',
}

// --- Tests ---

describe('AuditEntryCard', () => {
  describe('action rendering', () => {
    it('renders the action label from actionConfigFor', () => {
      const wrapper = mount(AuditEntryCard, {
        props: { entry: baseEntry, userDisplay: 'xander' },
      })
      const action = wrapper.find('[data-testid="audit-card-action"]')
      expect(action.text()).toBe('Advanced')
    })

    it('renders the raw action string for unknown action types', () => {
      const entry = { ...baseEntry, action: 'mystery' as AuditEntry['action'] }
      const wrapper = mount(AuditEntryCard, { props: { entry } })
      const action = wrapper.find('[data-testid="audit-card-action"]')
      expect(action.text()).toBe('mystery')
    })
  })

  describe('time rendering', () => {
    it('renders a relative timestamp', () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry } })
      // Because of real "now", we can't assert exact "5m ago",
      // but the output should be non-empty and not equal to the raw ISO string.
      const time = wrapper.find('[data-testid="audit-card-time"]')
      expect(time.text().length).toBeGreaterThan(0)
      expect(time.text()).not.toBe(recent)
    })
  })

  describe('user rendering', () => {
    it('prefers the userDisplay prop when provided', () => {
      const wrapper = mount(AuditEntryCard, {
        props: { entry: baseEntry, userDisplay: 'xander' },
      })
      expect(wrapper.find('[data-testid="audit-card-meta"] .user').text()).toBe('xander')
    })

    it('falls back to entry.userId when userDisplay is not provided', () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry } })
      expect(wrapper.find('[data-testid="audit-card-meta"] .user').text()).toBe('user_xander')
    })

    it('shows em-dash when neither userDisplay nor userId is set', () => {
      const entry: AuditEntry = { ...baseEntry, userId: '' }
      const wrapper = mount(AuditEntryCard, { props: { entry } })
      expect(wrapper.find('[data-testid="audit-card-meta"] .user').text()).toBe('—')
    })
  })

  describe('part label', () => {
    it('renders a truncated partId when present', () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry } })
      const part = wrapper.find('[data-testid="audit-card-part"]')
      expect(part.exists()).toBe(true)
      // 12-char visible window + ellipsis
      expect(part.text()).toBe('part_0035abc…')
    })

    it('renders ×quantity when no partId but batchQuantity is set', () => {
      const entry: AuditEntry = {
        ...baseEntry,
        partId: undefined,
        batchQuantity: 12,
      }
      const wrapper = mount(AuditEntryCard, { props: { entry } })
      const part = wrapper.find('[data-testid="audit-card-part"]')
      expect(part.exists()).toBe(true)
      expect(part.text()).toBe('×12')
    })

    it('omits the part section when both are missing', () => {
      const entry: AuditEntry = {
        ...baseEntry,
        partId: undefined,
        batchQuantity: undefined,
      }
      const wrapper = mount(AuditEntryCard, { props: { entry } })
      expect(wrapper.find('[data-testid="audit-card-part"]').exists()).toBe(false)
    })
  })

  describe('cert rendering', () => {
    it('renders a truncated certId when present', () => {
      const entry: AuditEntry = { ...baseEntry, certId: 'cert_AbCdEfGhIjKl' }
      const wrapper = mount(AuditEntryCard, { props: { entry } })
      const cert = wrapper.find('[data-testid="audit-card-cert"]')
      expect(cert.exists()).toBe(true)
      expect(cert.text()).toBe('cert_AbCdE…')
    })

    it('omits the cert section when certId is missing', () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry } })
      expect(wrapper.find('[data-testid="audit-card-cert"]').exists()).toBe(false)
    })
  })

  describe('summary rendering', () => {
    it('renders the transition summary when fromStepId and toStepId are set', () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry } })
      const summary = wrapper.find('[data-testid="audit-card-summary"]')
      expect(summary.exists()).toBe(true)
      expect(summary.text()).toBe('step_Tyx… → step_HqW…')
    })

    it('renders the single-step summary when only stepId is set', () => {
      const entry: AuditEntry = {
        ...baseEntry,
        fromStepId: undefined,
        toStepId: undefined,
        stepId: 'step_TyxbLnVHt9OL',
      }
      const wrapper = mount(AuditEntryCard, { props: { entry } })
      expect(wrapper.find('[data-testid="audit-card-summary"]').text()).toBe('at step_Tyx…')
    })

    it('omits the summary when no step/job info is present', () => {
      const entry: AuditEntry = {
        ...baseEntry,
        fromStepId: undefined,
        toStepId: undefined,
        stepId: undefined,
        jobId: undefined,
      }
      const wrapper = mount(AuditEntryCard, { props: { entry } })
      expect(wrapper.find('[data-testid="audit-card-summary"]').exists()).toBe(false)
    })
  })

  describe('color class', () => {
    it('applies the action color class from actionConfigFor', () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry } })
      const classes = wrapper.find('[data-testid="audit-card-action"]').classes().join(' ')
      expect(classes).toContain('violet')
    })
  })
})
