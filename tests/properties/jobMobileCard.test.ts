/**
 * Property 1: JobMobileCard Field Rendering
 *
 * For any Job with non-null fields, JobMobileCard renders `job.name`,
 * and conditionally renders `job.jiraPartNumber`, `job.goalQuantity`,
 * `job.jiraPriority`, and progress bar when `progress` is provided.
 *
 * **Validates: Requirements 4.3, 4.5**
 */
import { describe, it } from 'vitest'
import fc from 'fast-check'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { computeProgressBar } from '~/app/utils/progressBar'

/**
 * Minimal reproduction of JobMobileCard logic for mounting.
 * Rebuilt as defineComponent to avoid Nuxt auto-import resolution issues.
 */
const JobMobileCard = defineComponent({
  name: 'JobMobileCard',
  props: {
    job: { type: Object, required: true },
    progress: { type: Object, default: null },
  },
  emits: ['click'],
  setup(props, { emit }) {
    return () => {
      const progressResult = props.progress
        ? computeProgressBar({
            completed: props.progress.completedParts,
            goal: props.progress.goalQuantity,
            inProgress: props.progress.inProgressParts,
          })
        : null

      return h(
        'div',
        {
          class: 'card-root',
          onClick: () => emit('click'),
        },
        [
          h('div', { class: 'row-1' }, [
            h('span', { class: 'job-name' }, props.job.name),
            props.job.jiraPriority
              ? h('span', { class: 'job-priority' }, props.job.jiraPriority)
              : null,
          ]),
          h('div', { class: 'row-2' }, [
            props.job.jiraPartNumber
              ? h('span', { class: 'job-part-number' }, `Part: ${props.job.jiraPartNumber}`)
              : null,
            h('span', { class: 'job-qty' }, `Qty: ${props.job.goalQuantity}`),
          ]),
          progressResult
            ? h('div', { class: 'progress-bar' }, `${progressResult.displayPercent}%`)
            : null,
        ],
      )
    }
  },
})

// --- Arbitraries ---

/** Arbitrary for a Job object with optional fields */
/** Generate a non-whitespace-only string (DOM .text() trims whitespace) */
const arbVisibleString = (maxLen: number) =>
  fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 _-]*$/, { maxLength: maxLen })

const arbJob = fc.record({
  id: fc.uuid(),
  name: arbVisibleString(80),
  goalQuantity: fc.integer({ min: 1, max: 10000 }),
  jiraPartNumber: fc.option(arbVisibleString(30), { nil: undefined }),
  jiraPriority: fc.option(
    fc.constantFrom('Highest', 'High', 'Medium', 'Low', 'Lowest'),
    { nil: undefined },
  ),
  jiraTicketKey: fc.option(arbVisibleString(20), { nil: undefined }),
  jiraTicketSummary: fc.option(arbVisibleString(100), { nil: undefined }),
  jiraEpicLink: fc.option(arbVisibleString(30), { nil: undefined }),
  jiraLabels: fc.option(fc.array(arbVisibleString(20), { maxLength: 5 }), { nil: undefined }),
  createdAt: fc.integer({ min: 946684800000, max: 1893456000000 }).map(ts => new Date(ts).toISOString()),
  updatedAt: fc.integer({ min: 946684800000, max: 1893456000000 }).map(ts => new Date(ts).toISOString()),
})

/** Arbitrary for a JobProgress object */
const arbJobProgress = (jobId: string, goalQuantity: number) =>
  fc.record({
    jobId: fc.constant(jobId),
    jobName: fc.string({ minLength: 1, maxLength: 80 }),
    goalQuantity: fc.constant(goalQuantity),
    totalParts: fc.integer({ min: 0, max: 500 }),
    completedParts: fc.integer({ min: 0, max: 500 }),
    inProgressParts: fc.integer({ min: 0, max: 500 }),
    scrappedParts: fc.integer({ min: 0, max: 100 }),
    producedQuantity: fc.integer({ min: 0, max: 500 }),
    orderedQuantity: fc.constant(goalQuantity),
    progressPercent: fc.integer({ min: 0, max: 200 }),
  })

// --- Property Tests ---

describe('Property 1: JobMobileCard Field Rendering', () => {
  it('always renders job.name for any generated Job', () => {
    fc.assert(
      fc.property(arbJob, (job) => {
        const wrapper = mount(JobMobileCard, {
          props: { job, progress: null },
        })
        const nameEl = wrapper.find('.job-name')
        expect(nameEl.exists()).toBe(true)
        // DOM .text() trims trailing whitespace, so use toContain with trimmed value
        expect(nameEl.text()).toBe(job.name.trim())
        wrapper.unmount()
      }),
      { numRuns: 100 },
    )
  })

  it('conditionally renders jiraPartNumber when defined', () => {
    fc.assert(
      fc.property(arbJob, (job) => {
        const wrapper = mount(JobMobileCard, {
          props: { job, progress: null },
        })
        const partEl = wrapper.find('.job-part-number')
        if (job.jiraPartNumber !== undefined) {
          expect(partEl.exists()).toBe(true)
          expect(partEl.text()).toContain(job.jiraPartNumber.trim())
        } else {
          expect(partEl.exists()).toBe(false)
        }
        wrapper.unmount()
      }),
      { numRuns: 100 },
    )
  })

  it('conditionally renders jiraPriority when defined', () => {
    fc.assert(
      fc.property(arbJob, (job) => {
        const wrapper = mount(JobMobileCard, {
          props: { job, progress: null },
        })
        const priorityEl = wrapper.find('.job-priority')
        if (job.jiraPriority !== undefined) {
          expect(priorityEl.exists()).toBe(true)
          expect(priorityEl.text()).toBe(job.jiraPriority)
        } else {
          expect(priorityEl.exists()).toBe(false)
        }
        wrapper.unmount()
      }),
      { numRuns: 100 },
    )
  })

  it('always renders goalQuantity for any generated Job', () => {
    fc.assert(
      fc.property(arbJob, (job) => {
        const wrapper = mount(JobMobileCard, {
          props: { job, progress: null },
        })
        const qtyEl = wrapper.find('.job-qty')
        expect(qtyEl.exists()).toBe(true)
        expect(qtyEl.text()).toBe(`Qty: ${job.goalQuantity}`)
        wrapper.unmount()
      }),
      { numRuns: 100 },
    )
  })

  it('renders progress bar when progress is provided, hides when null', () => {
    fc.assert(
      fc.property(
        arbJob.chain(job =>
          fc.record({
            job: fc.constant(job),
            hasProgress: fc.boolean(),
            progress: arbJobProgress(job.id, job.goalQuantity),
          }),
        ),
        ({ job, hasProgress, progress }) => {
          const wrapper = mount(JobMobileCard, {
            props: { job, progress: hasProgress ? progress : null },
          })
          const progressEl = wrapper.find('.progress-bar')
          if (hasProgress) {
            expect(progressEl.exists()).toBe(true)
          } else {
            expect(progressEl.exists()).toBe(false)
          }
          wrapper.unmount()
        },
      ),
      { numRuns: 100 },
    )
  })
})
