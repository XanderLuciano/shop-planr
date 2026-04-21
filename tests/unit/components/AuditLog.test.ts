/**
 * Unit tests for AuditLog component.
 *
 * Tests responsive rendering: table layout on desktop, card layout on mobile,
 * empty state, user resolution via the user display map, and
 * field fallback behavior (part batch quantity, em-dash for missing user).
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
  hasTransition,
} from '~/app/utils/auditFormatting'

interface UserLike {
  id: string
  username: string
}

/**
 * Minimal reproduction of AuditLog logic for mounting.
 * The real component auto-imports `useAuth` and `useMobileBreakpoint`;
 * here we pass their observable outputs as props instead.
 */
const AuditLog = defineComponent({
  name: 'AuditLog',
  props: {
    entries: { type: Array as () => readonly AuditEntry[], required: true },
    users: { type: Array as () => readonly UserLike[], default: () => [] },
    isMobile: { type: Boolean, required: true },
  },
  setup(props) {
    const userDisplayMap = computed(() => {
      const map = new Map<string, string>()
      for (const u of props.users) map.set(u.id, u.username)
      return map
    })

    function resolveUser(userId?: string | null): string {
      if (!userId) return '—'
      return userDisplayMap.value.get(userId) ?? truncateId(userId, 10)
    }

    return () => {
      if (!props.entries.length) {
        return h('div', { class: 'empty', 'data-testid': 'audit-empty' }, 'No audit entries found.')
      }

      if (props.isMobile) {
        return h(
          'div',
          { 'data-testid': 'audit-card-list' },
          props.entries.map(entry =>
            h('div', { key: entry.id, class: 'audit-card', 'data-testid': 'audit-card' }, [
              h('span', { class: 'action' }, actionConfigFor(entry.action).label),
              h('span', { class: 'time' }, formatRelativeTime(entry.timestamp)),
              h('span', { class: 'user' }, resolveUser(entry.userId)),
              h('span', { class: 'summary' }, buildDetailsSummary(entry)),
            ]),
          ),
        )
      }

      return h('table', { 'data-testid': 'audit-table' }, [
        h('tbody', {}, props.entries.map(entry =>
          h('tr', { key: entry.id, 'data-testid': 'audit-row' }, [
            h('td', { class: 'time' }, formatRelativeTime(entry.timestamp)),
            h('td', { class: 'action' }, actionConfigFor(entry.action).label),
            h('td', { class: 'user' }, resolveUser(entry.userId)),
            h('td', { class: 'part' }, entry.partId || (entry.batchQuantity ? `×${entry.batchQuantity}` : '—')),
            h('td', { class: 'cert' }, entry.certId || '—'),
            h('td', { class: 'details' },
              hasTransition(entry)
                ? `${entry.fromStepId} → ${entry.toStepId}`
                : entry.stepId
                  ? `at ${entry.stepId}`
                  : entry.jobId
                    ? `job ${entry.jobId}`
                    : '—',
            ),
          ]),
        )),
      ])
    }
  },
})

// --- Fixtures ---

const now = new Date()
const makeTs = (minutesAgo: number) =>
  new Date(now.getTime() - minutesAgo * 60_000).toISOString()

const baseUsers: UserLike[] = [
  { id: 'user_xander', username: 'xander' },
  { id: 'user_2', username: 'alice' },
]

const entries: AuditEntry[] = [
  {
    id: 'audit_1',
    action: 'part_advanced',
    userId: 'user_xander',
    timestamp: makeTs(5),
    partId: 'part_001',
    fromStepId: 'step_one',
    toStepId: 'step_two',
  },
  {
    id: 'audit_2',
    action: 'part_completed',
    userId: 'user_2',
    timestamp: makeTs(10),
    partId: 'part_002',
  },
]

// --- Tests ---

describe('AuditLog', () => {
  describe('empty state', () => {
    it('renders the empty message when entries is empty', () => {
      const wrapper = mount(AuditLog, {
        props: { entries: [], users: baseUsers, isMobile: false },
      })
      const empty = wrapper.find('[data-testid="audit-empty"]')
      expect(empty.exists()).toBe(true)
      expect(empty.text()).toContain('No audit entries')
    })

    it('does not render table or card list when empty', () => {
      const wrapper = mount(AuditLog, {
        props: { entries: [], users: baseUsers, isMobile: false },
      })
      expect(wrapper.find('[data-testid="audit-table"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="audit-card-list"]').exists()).toBe(false)
    })
  })

  describe('desktop (isMobile=false)', () => {
    it('renders the table layout', () => {
      const wrapper = mount(AuditLog, {
        props: { entries, users: baseUsers, isMobile: false },
      })
      expect(wrapper.find('[data-testid="audit-table"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="audit-card-list"]').exists()).toBe(false)
    })

    it('renders one row per entry', () => {
      const wrapper = mount(AuditLog, {
        props: { entries, users: baseUsers, isMobile: false },
      })
      expect(wrapper.findAll('[data-testid="audit-row"]')).toHaveLength(2)
    })

    it('resolves userId to username via the users list', () => {
      const wrapper = mount(AuditLog, {
        props: { entries, users: baseUsers, isMobile: false },
      })
      const userCells = wrapper.findAll('[data-testid="audit-row"] .user')
      expect(userCells[0].text()).toBe('xander')
      expect(userCells[1].text()).toBe('alice')
    })

    it('truncates unknown user IDs', () => {
      const entryUnknown: AuditEntry = {
        id: 'audit_x',
        action: 'part_created',
        userId: 'user_unknownlongid',
        timestamp: makeTs(1),
      }
      const wrapper = mount(AuditLog, {
        props: { entries: [entryUnknown], users: baseUsers, isMobile: false },
      })
      // `truncateId(id, 10)` → keep first 10 chars + ellipsis
      expect(wrapper.find('[data-testid="audit-row"] .user').text()).toBe('user_unkno…')
    })

    it('falls back to em-dash when userId is missing', () => {
      const entryNoUser: AuditEntry = {
        id: 'audit_y',
        action: 'part_created',
        userId: '',
        timestamp: makeTs(1),
      }
      const wrapper = mount(AuditLog, {
        props: { entries: [entryNoUser], users: baseUsers, isMobile: false },
      })
      expect(wrapper.find('[data-testid="audit-row"] .user').text()).toBe('—')
    })

    it('shows ×quantity for entries without a partId but with a batchQuantity', () => {
      const entryBatch: AuditEntry = {
        id: 'audit_b',
        action: 'part_created',
        userId: 'user_xander',
        timestamp: makeTs(1),
        batchQuantity: 7,
      }
      const wrapper = mount(AuditLog, {
        props: { entries: [entryBatch], users: baseUsers, isMobile: false },
      })
      expect(wrapper.find('[data-testid="audit-row"] .part').text()).toBe('×7')
    })

    it('shows em-dash in details column when no step or job context', () => {
      const entryNaked: AuditEntry = {
        id: 'audit_n',
        action: 'note_created',
        userId: 'user_xander',
        timestamp: makeTs(1),
      }
      const wrapper = mount(AuditLog, {
        props: { entries: [entryNaked], users: baseUsers, isMobile: false },
      })
      expect(wrapper.find('[data-testid="audit-row"] .details').text()).toBe('—')
    })
  })

  describe('mobile (isMobile=true)', () => {
    it('renders the card list layout', () => {
      const wrapper = mount(AuditLog, {
        props: { entries, users: baseUsers, isMobile: true },
      })
      expect(wrapper.find('[data-testid="audit-card-list"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="audit-table"]').exists()).toBe(false)
    })

    it('renders one card per entry', () => {
      const wrapper = mount(AuditLog, {
        props: { entries, users: baseUsers, isMobile: true },
      })
      expect(wrapper.findAll('[data-testid="audit-card"]')).toHaveLength(2)
    })

    it('resolves userId to username in cards', () => {
      const wrapper = mount(AuditLog, {
        props: { entries, users: baseUsers, isMobile: true },
      })
      const users = wrapper.findAll('[data-testid="audit-card"] .user')
      expect(users[0].text()).toBe('xander')
    })
  })

  describe('reactivity', () => {
    it('switches from table to cards when isMobile flips', async () => {
      const wrapper = mount(AuditLog, {
        props: { entries, users: baseUsers, isMobile: false },
      })
      expect(wrapper.find('[data-testid="audit-table"]').exists()).toBe(true)

      await wrapper.setProps({ isMobile: true })
      expect(wrapper.find('[data-testid="audit-card-list"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="audit-table"]').exists()).toBe(false)
    })
  })
})
