/**
 * Unit tests for AuditEntryCard component.
 *
 * Tests rendering behavior: action label + icon + color, relative timestamp,
 * user display + avatar, part label (ID vs batch quantity), cert truncation,
 * transition summary, conditional field rendering, and the tap-to-expand
 * behavior that reveals full (untruncated) IDs and metadata.
 *
 * Feature: audit-mobile-redesign
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, computed, h, ref } from 'vue'
import type { AuditEntry } from '~/server/types/domain'
import {
  actionConfigFor,
  formatRelativeTime,
  truncateId,
  buildDetailsSummary,
} from '~/app/utils/auditFormatting'
import { getAvatarColor, getInitials } from '~/app/utils/avatarHelpers'

interface UserInfo {
  username: string
  displayName: string
}

/**
 * Minimal reproduction of AuditEntryCard logic for mounting.
 * Mirrors the real template but avoids Nuxt auto-import resolution
 * issues (UIcon, UserAvatar, etc.) in the vitest environment.
 */
const AuditEntryCard = defineComponent({
  name: 'AuditEntryCard',
  props: {
    entry: { type: Object as () => AuditEntry, required: true },
    user: { type: Object as () => UserInfo | null, default: null },
  },
  setup(props) {
    const expanded = ref(false)

    const config = computed(() => actionConfigFor(props.entry.action))
    const summary = computed(() => buildDetailsSummary(props.entry))

    const userName = computed(() => {
      if (props.user) return props.user.displayName || props.user.username
      return props.entry.userId || '—'
    })

    const partLabel = computed(() => {
      const { partId, batchQuantity } = props.entry
      if (partId) return truncateId(partId, 12)
      if (batchQuantity) return `×${batchQuantity}`
      return ''
    })

    const absoluteTime = computed(() => {
      const d = new Date(props.entry.timestamp)
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    })

    const expandedFields = computed<{ label: string, value: string }[]>(() => {
      const rows: { label: string, value: string }[] = []
      const e = props.entry
      if (e.partId) rows.push({ label: 'Part', value: e.partId })
      if (e.batchQuantity) rows.push({ label: 'Batch', value: `×${e.batchQuantity}` })
      if (e.certId) rows.push({ label: 'Cert', value: e.certId })
      if (e.jobId) rows.push({ label: 'Job', value: e.jobId })
      if (e.pathId) rows.push({ label: 'Path', value: e.pathId })
      if (e.stepId && !e.fromStepId) rows.push({ label: 'Step', value: e.stepId })
      if (e.fromStepId) rows.push({ label: 'From', value: e.fromStepId })
      if (e.toStepId) rows.push({ label: 'To', value: e.toStepId })
      if (e.userId) rows.push({ label: 'User ID', value: e.userId })
      return rows
    })

    const hasMetadata = computed(() =>
      props.entry.metadata != null && Object.keys(props.entry.metadata).length > 0,
    )

    function toggleExpanded() {
      expanded.value = !expanded.value
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        toggleExpanded()
      }
    }

    return () =>
      h(
        'div',
        {
          class: 'audit-card',
          'data-testid': 'audit-card',
          role: 'button',
          tabindex: '0',
          'aria-expanded': String(expanded.value),
          onClick: toggleExpanded,
          onKeydown: onKey,
        },
        [
          h('div', { class: 'row-top' }, [
            props.user
              ? h(
                  'div',
                  {
                    class: 'avatar',
                    'data-testid': 'audit-card-avatar',
                    'data-username': props.user.username,
                    'data-color': getAvatarColor(props.user.username),
                  },
                  getInitials(props.user.displayName),
                )
              : h(
                  'div',
                  { class: 'avatar-placeholder', 'data-testid': 'audit-card-avatar-placeholder' },
                  '?',
                ),
            h('div', { class: 'body' }, [
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
              h('div', { 'data-testid': 'audit-card-meta' }, [
                h('span', { class: 'user', 'data-testid': 'audit-card-user' }, userName.value),
                partLabel.value
                  ? h('span', { class: 'part', 'data-testid': 'audit-card-part' }, partLabel.value)
                  : null,
                props.entry.certId
                  ? h(
                      'span',
                      { class: 'cert', 'data-testid': 'audit-card-cert' },
                      truncateId(props.entry.certId, 10),
                    )
                  : null,
              ]),
              summary.value && !expanded.value
                ? h(
                    'div',
                    { class: 'summary', 'data-testid': 'audit-card-summary' },
                    summary.value,
                  )
                : null,
            ]),
            h('span', { 'data-testid': 'audit-card-chevron' }, expanded.value ? '▲' : '▼'),
          ]),
          expanded.value
            ? h('div', { 'data-testid': 'audit-card-expanded' }, [
                h(
                  'div',
                  { 'data-testid': 'audit-card-absolute-time' },
                  absoluteTime.value,
                ),
                ...expandedFields.value.map(row =>
                  h('div', { 'data-testid': 'audit-card-field' }, [
                    h('span', { class: 'label' }, row.label),
                    h('span', { class: 'value' }, row.value),
                  ]),
                ),
                !expandedFields.value.length && !hasMetadata.value
                  ? h('div', { 'data-testid': 'audit-card-no-details' }, 'No additional details.')
                  : null,
                hasMetadata.value
                  ? h(
                      'pre',
                      { 'data-testid': 'audit-card-metadata' },
                      JSON.stringify(props.entry.metadata, null, 2),
                    )
                  : null,
              ])
            : null,
        ],
      )
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

const userXander: UserInfo = { username: 'xander', displayName: 'Xander R' }

// --- Tests ---

describe('AuditEntryCard', () => {
  describe('action rendering', () => {
    it('renders the action label from actionConfigFor', () => {
      const wrapper = mount(AuditEntryCard, {
        props: { entry: baseEntry, user: userXander },
      })
      const action = wrapper.find('[data-testid="audit-card-action"]')
      expect(action.text()).toBe('Advanced')
    })

    it('renders the raw action string for unknown action types', () => {
      const entry = { ...baseEntry, action: 'mystery' as AuditEntry['action'] }
      const wrapper = mount(AuditEntryCard, { props: { entry, user: userXander } })
      expect(wrapper.find('[data-testid="audit-card-action"]').text()).toBe('mystery')
    })
  })

  describe('time rendering', () => {
    it('renders a relative timestamp', () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user: userXander } })
      const time = wrapper.find('[data-testid="audit-card-time"]')
      expect(time.text().length).toBeGreaterThan(0)
      expect(time.text()).not.toBe(recent)
    })
  })

  describe('user rendering', () => {
    it('uses displayName when the user prop is provided', () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user: userXander } })
      expect(wrapper.find('[data-testid="audit-card-user"]').text()).toBe('Xander R')
    })

    it('falls back to username when displayName is empty', () => {
      const user: UserInfo = { username: 'xander', displayName: '' }
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user } })
      expect(wrapper.find('[data-testid="audit-card-user"]').text()).toBe('xander')
    })

    it('falls back to entry.userId when user prop is null', () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user: null } })
      expect(wrapper.find('[data-testid="audit-card-user"]').text()).toBe('user_xander')
    })

    it('shows em-dash when neither user nor userId is set', () => {
      const entry: AuditEntry = { ...baseEntry, userId: '' }
      const wrapper = mount(AuditEntryCard, { props: { entry, user: null } })
      expect(wrapper.find('[data-testid="audit-card-user"]').text()).toBe('—')
    })
  })

  describe('avatar', () => {
    it('renders a UserAvatar with initials when the user prop is provided', () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user: userXander } })
      const avatar = wrapper.find('[data-testid="audit-card-avatar"]')
      expect(avatar.exists()).toBe(true)
      expect(avatar.text()).toBe('XR')
    })

    it('derives the avatar background color from the username', () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user: userXander } })
      const avatar = wrapper.find('[data-testid="audit-card-avatar"]')
      expect(avatar.attributes('data-color')).toBe(getAvatarColor('xander'))
    })

    it('renders a placeholder instead when no user info is available', () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user: null } })
      expect(wrapper.find('[data-testid="audit-card-avatar"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="audit-card-avatar-placeholder"]').exists()).toBe(true)
    })
  })

  describe('part label', () => {
    it('renders a truncated partId when present', () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user: userXander } })
      expect(wrapper.find('[data-testid="audit-card-part"]').text()).toBe('part_0035abc…')
    })

    it('renders ×quantity when no partId but batchQuantity is set', () => {
      const entry: AuditEntry = { ...baseEntry, partId: undefined, batchQuantity: 12 }
      const wrapper = mount(AuditEntryCard, { props: { entry, user: userXander } })
      expect(wrapper.find('[data-testid="audit-card-part"]').text()).toBe('×12')
    })

    it('omits the part section when both are missing', () => {
      const entry: AuditEntry = { ...baseEntry, partId: undefined, batchQuantity: undefined }
      const wrapper = mount(AuditEntryCard, { props: { entry, user: userXander } })
      expect(wrapper.find('[data-testid="audit-card-part"]').exists()).toBe(false)
    })
  })

  describe('cert rendering', () => {
    it('renders a truncated certId when present', () => {
      const entry: AuditEntry = { ...baseEntry, certId: 'cert_AbCdEfGhIjKl' }
      const wrapper = mount(AuditEntryCard, { props: { entry, user: userXander } })
      expect(wrapper.find('[data-testid="audit-card-cert"]').text()).toBe('cert_AbCdE…')
    })

    it('omits the cert section when certId is missing', () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user: userXander } })
      expect(wrapper.find('[data-testid="audit-card-cert"]').exists()).toBe(false)
    })
  })

  describe('summary rendering (collapsed)', () => {
    it('renders the transition summary when collapsed', () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user: userXander } })
      expect(wrapper.find('[data-testid="audit-card-summary"]').text()).toBe('step_Tyx… → step_HqW…')
    })

    it('hides the summary once expanded (replaced by full fields)', async () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user: userXander } })
      await wrapper.find('[data-testid="audit-card"]').trigger('click')
      expect(wrapper.find('[data-testid="audit-card-summary"]').exists()).toBe(false)
    })
  })

  describe('tap-to-expand', () => {
    it('starts collapsed', () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user: userXander } })
      expect(wrapper.find('[data-testid="audit-card-expanded"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="audit-card"]').attributes('aria-expanded')).toBe('false')
    })

    it('expands on click', async () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user: userXander } })
      await wrapper.find('[data-testid="audit-card"]').trigger('click')
      expect(wrapper.find('[data-testid="audit-card-expanded"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="audit-card"]').attributes('aria-expanded')).toBe('true')
    })

    it('collapses again on second click', async () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user: userXander } })
      const card = wrapper.find('[data-testid="audit-card"]')
      await card.trigger('click')
      await card.trigger('click')
      expect(wrapper.find('[data-testid="audit-card-expanded"]').exists()).toBe(false)
    })

    it('expands on Enter key', async () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user: userXander } })
      await wrapper.find('[data-testid="audit-card"]').trigger('keydown', { key: 'Enter' })
      expect(wrapper.find('[data-testid="audit-card-expanded"]').exists()).toBe(true)
    })

    it('expands on Space key', async () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user: userXander } })
      await wrapper.find('[data-testid="audit-card"]').trigger('keydown', { key: ' ' })
      expect(wrapper.find('[data-testid="audit-card-expanded"]').exists()).toBe(true)
    })

    it('ignores unrelated keys', async () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user: userXander } })
      await wrapper.find('[data-testid="audit-card"]').trigger('keydown', { key: 'Tab' })
      expect(wrapper.find('[data-testid="audit-card-expanded"]').exists()).toBe(false)
    })
  })

  describe('expanded details', () => {
    it('renders an absolute timestamp', async () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user: userXander } })
      await wrapper.find('[data-testid="audit-card"]').trigger('click')
      const time = wrapper.find('[data-testid="audit-card-absolute-time"]')
      expect(time.exists()).toBe(true)
      // At minimum includes year and a 4-digit-like timestamp
      expect(time.text()).toMatch(/\d{4}/)
    })

    it('shows a From/To row pair for transitions (full untruncated IDs)', async () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user: userXander } })
      await wrapper.find('[data-testid="audit-card"]').trigger('click')
      const fields = wrapper.findAll('[data-testid="audit-card-field"]')
      const fromRow = fields.find(f => f.text().includes('From'))
      const toRow = fields.find(f => f.text().includes('To'))
      expect(fromRow?.text()).toContain('step_TyxbLnVHt9OL')
      expect(toRow?.text()).toContain('step_HqWw5ML5F4an')
    })

    it('shows a single Step row when only stepId is set', async () => {
      const entry: AuditEntry = {
        ...baseEntry,
        fromStepId: undefined,
        toStepId: undefined,
        stepId: 'step_TyxbLnVHt9OL',
      }
      const wrapper = mount(AuditEntryCard, { props: { entry, user: userXander } })
      await wrapper.find('[data-testid="audit-card"]').trigger('click')
      const fields = wrapper.findAll('[data-testid="audit-card-field"]')
      const stepRow = fields.find(f => f.text().includes('Step'))
      expect(stepRow?.text()).toContain('step_TyxbLnVHt9OL')
      expect(fields.some(f => f.text().startsWith('From'))).toBe(false)
    })

    it('shows full untruncated part ID', async () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user: userXander } })
      await wrapper.find('[data-testid="audit-card"]').trigger('click')
      const fields = wrapper.findAll('[data-testid="audit-card-field"]')
      const partRow = fields.find(f => f.text().includes('Part'))
      expect(partRow?.text()).toContain('part_0035abcdef')
    })

    it('shows batch quantity instead of part ID when applicable', async () => {
      const entry: AuditEntry = {
        ...baseEntry,
        partId: undefined,
        batchQuantity: 25,
      }
      const wrapper = mount(AuditEntryCard, { props: { entry, user: userXander } })
      await wrapper.find('[data-testid="audit-card"]').trigger('click')
      const fields = wrapper.findAll('[data-testid="audit-card-field"]')
      const batchRow = fields.find(f => f.text().includes('Batch'))
      expect(batchRow?.text()).toContain('×25')
    })

    it('shows the no-details message when the entry has no meaningful fields', async () => {
      const entry: AuditEntry = {
        id: 'audit_n',
        action: 'note_created',
        userId: '',
        timestamp: recent,
      }
      const wrapper = mount(AuditEntryCard, { props: { entry, user: null } })
      await wrapper.find('[data-testid="audit-card"]').trigger('click')
      expect(wrapper.find('[data-testid="audit-card-no-details"]').exists()).toBe(true)
    })

    it('renders a metadata block when entry.metadata is non-empty', async () => {
      const entry: AuditEntry = {
        ...baseEntry,
        metadata: { reason: 'tooling failure', operator: 'xander' },
      }
      const wrapper = mount(AuditEntryCard, { props: { entry, user: userXander } })
      await wrapper.find('[data-testid="audit-card"]').trigger('click')
      const meta = wrapper.find('[data-testid="audit-card-metadata"]')
      expect(meta.exists()).toBe(true)
      expect(meta.text()).toContain('tooling failure')
    })

    it('does not render a metadata block when entry.metadata is empty or missing', async () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user: userXander } })
      await wrapper.find('[data-testid="audit-card"]').trigger('click')
      expect(wrapper.find('[data-testid="audit-card-metadata"]').exists()).toBe(false)
    })
  })

  describe('color class', () => {
    it('applies the action color class from actionConfigFor', () => {
      const wrapper = mount(AuditEntryCard, { props: { entry: baseEntry, user: userXander } })
      const classes = wrapper.find('[data-testid="audit-card-action"]').classes().join(' ')
      expect(classes).toContain('violet')
    })
  })
})
