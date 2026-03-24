import { ref } from 'vue'
import { nanoid } from 'nanoid'
import type { Job, Path, TemplateRoute } from '~/server/types/domain'

// ---- Exported Interfaces ----

export interface StepDraft {
  _clientId: string
  name: string
  location: string
  optional: boolean
  dependencyType: 'physical' | 'preferred' | 'completion_gate'
}

export interface PathDraft {
  _clientId: string
  _existingId?: string
  name: string
  goalQuantity: number
  advancementMode: 'strict' | 'flexible' | 'per_step'
  steps: StepDraft[]
}

export interface JobDraft {
  name: string
  goalQuantity: number
}

export interface JobFormValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: JobFormValidationError[]
}

// ---- Helpers ----

function createStepDraft(overrides?: Partial<Omit<StepDraft, '_clientId'>>): StepDraft {
  return {
    _clientId: nanoid(),
    name: overrides?.name ?? '',
    location: overrides?.location ?? '',
    optional: overrides?.optional ?? false,
    dependencyType: overrides?.dependencyType ?? 'preferred',
  }
}

function createPathDraft(goalQuantity: number, overrides?: Partial<Omit<PathDraft, '_clientId' | 'steps'>> & { steps?: StepDraft[] }): PathDraft {
  return {
    _clientId: nanoid(),
    _existingId: overrides?._existingId,
    name: overrides?.name ?? '',
    goalQuantity: overrides?.goalQuantity ?? goalQuantity,
    advancementMode: overrides?.advancementMode ?? 'strict',
    steps: overrides?.steps ?? [createStepDraft()],
  }
}

function hasPathChanges(draft: PathDraft, original: Path): boolean {
  if (draft.name.trim() !== original.name) return true
  if (draft.goalQuantity !== original.goalQuantity) return true
  if (draft.advancementMode !== original.advancementMode) return true
  if (draft.steps.length !== original.steps.length) return true
  for (let i = 0; i < draft.steps.length; i++) {
    const s = draft.steps[i]
    const o = original.steps[i]
    if (s.name.trim() !== o.name) return true
    if ((s.location.trim() || '') !== (o.location || '')) return true
    if (s.optional !== o.optional) return true
    if (s.dependencyType !== o.dependencyType) return true
  }
  return false
}

export function computePathChanges(originalPaths: Path[], currentDrafts: PathDraft[]) {
  const draftExistingIds = new Set(
    currentDrafts.filter(d => d._existingId).map(d => d._existingId!),
  )

  const toDelete = originalPaths.filter(p => !draftExistingIds.has(p.id))
  const toCreate = currentDrafts.filter(d => !d._existingId)
  const toUpdate = currentDrafts.filter((d) => {
    if (!d._existingId) return false
    const original = originalPaths.find(p => p.id === d._existingId)
    return original ? hasPathChanges(d, original) : false
  })

  return { toDelete, toCreate, toUpdate }
}

// ---- Main Composable ----

export function useJobForm(mode: 'create' | 'edit', existingJob?: Job & { paths: Path[] }) {
  const { createJob, updateJob } = useJobs()
  const { createPath, updatePath, deletePath } = usePaths()

  // ---- State ----
  const jobDraft = ref<JobDraft>(
    mode === 'edit' && existingJob
      ? { name: existingJob.name, goalQuantity: existingJob.goalQuantity }
      : { name: '', goalQuantity: 1 },
  )

  const pathDrafts = ref<PathDraft[]>(
    mode === 'edit' && existingJob
      ? existingJob.paths.map(p => createPathDraft(p.goalQuantity, {
          _existingId: p.id,
          name: p.name,
          goalQuantity: p.goalQuantity,
          advancementMode: p.advancementMode,
          steps: p.steps
            .slice()
            .sort((a, b) => a.order - b.order)
            .map(s => createStepDraft({
              name: s.name,
              location: s.location ?? '',
              optional: s.optional,
              dependencyType: s.dependencyType,
            })),
        }))
      : [],
  )

  const originalPaths = mode === 'edit' && existingJob ? [...existingJob.paths] : []

  const errors = ref<JobFormValidationError[]>([])
  const submitting = ref(false)
  const submitError = ref<string | null>(null)

  // ---- Path Operations ----

  function addPath(): void {
    pathDrafts.value.push(createPathDraft(jobDraft.value.goalQuantity))
  }

  function removePath(clientId: string): void {
    pathDrafts.value = pathDrafts.value.filter(p => p._clientId !== clientId)
  }

  // ---- Step Operations ----

  function addStep(pathClientId: string): void {
    const path = pathDrafts.value.find(p => p._clientId === pathClientId)
    if (!path) return
    path.steps.push(createStepDraft())
  }

  function removeStep(pathClientId: string, stepClientId: string): void {
    const path = pathDrafts.value.find(p => p._clientId === pathClientId)
    if (!path) return
    if (path.steps.length <= 1) return
    path.steps = path.steps.filter(s => s._clientId !== stepClientId)
  }

  function moveStep(pathClientId: string, stepClientId: string, direction: -1 | 1): void {
    const path = pathDrafts.value.find(p => p._clientId === pathClientId)
    if (!path) return
    const idx = path.steps.findIndex(s => s._clientId === stepClientId)
    if (idx === -1) return
    const targetIdx = idx + direction
    if (targetIdx < 0 || targetIdx >= path.steps.length) return
    const temp = path.steps[idx]
    path.steps[idx] = path.steps[targetIdx]
    path.steps[targetIdx] = temp
  }

  // ---- Template Application ----

  function applyTemplate(pathClientId: string, template: TemplateRoute): void {
    const path = pathDrafts.value.find(p => p._clientId === pathClientId)
    if (!path) return
    path.steps = template.steps
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(ts => createStepDraft({
        name: ts.name,
        location: ts.location ?? '',
        optional: ts.optional,
        dependencyType: ts.dependencyType,
      }))
  }

  // ---- Validation ----

  function validate(): ValidationResult {
    const errs: JobFormValidationError[] = []

    if (!jobDraft.value.name.trim()) {
      errs.push({ field: 'job.name', message: 'Job name is required' })
    }
    if (jobDraft.value.goalQuantity < 1) {
      errs.push({ field: 'job.goalQuantity', message: 'Goal quantity must be at least 1' })
    }

    pathDrafts.value.forEach((p, pi) => {
      if (!p.name.trim()) {
        errs.push({ field: `paths[${pi}].name`, message: 'Path name is required' })
      }
      if (p.goalQuantity < 1) {
        errs.push({ field: `paths[${pi}].goalQuantity`, message: 'Path goal quantity must be at least 1' })
      }
      if (p.steps.length === 0) {
        errs.push({ field: `paths[${pi}].steps`, message: 'At least one step is required per path' })
      }
      p.steps.forEach((s, si) => {
        if (!s.name.trim()) {
          errs.push({ field: `paths[${pi}].steps[${si}].name`, message: 'Step name is required' })
        }
      })
    })

    errors.value = errs
    return { valid: errs.length === 0, errors: errs }
  }

  // ---- Submission ----

  async function submit(): Promise<string> {
    const result = validate()
    if (!result.valid) {
      throw new Error('Validation failed')
    }

    submitting.value = true
    submitError.value = null

    try {
      if (mode === 'create') {
        return await submitCreate()
      } else {
        return await submitEdit()
      }
    } catch (e: any) {
      const msg = e?.data?.message ?? e?.message ?? 'An unexpected error occurred'
      submitError.value = msg
      throw e
    } finally {
      submitting.value = false
    }
  }

  async function submitCreate(): Promise<string> {
    const job = await createJob({
      name: jobDraft.value.name.trim(),
      goalQuantity: jobDraft.value.goalQuantity,
    })

    for (const draft of pathDrafts.value) {
      await createPath({
        jobId: job.id,
        name: draft.name.trim(),
        goalQuantity: draft.goalQuantity,
        advancementMode: draft.advancementMode,
        steps: draft.steps.map(s => ({
          name: s.name.trim(),
          location: s.location.trim() || undefined,
          optional: s.optional,
          dependencyType: s.dependencyType,
        })),
      })
    }

    return job.id
  }

  async function submitEdit(): Promise<string> {
    if (!existingJob) throw new Error('No existing job for edit mode')

    const jobId = existingJob.id

    await updateJob(jobId, {
      name: jobDraft.value.name.trim(),
      goalQuantity: jobDraft.value.goalQuantity,
    })

    const changes = computePathChanges(originalPaths, pathDrafts.value)

    // Deletes first
    for (const path of changes.toDelete) {
      await deletePath(path.id)
    }

    // Then updates
    for (const draft of changes.toUpdate) {
      await updatePath(draft._existingId!, {
        name: draft.name.trim(),
        goalQuantity: draft.goalQuantity,
        advancementMode: draft.advancementMode,
        steps: draft.steps.map(s => ({
          name: s.name.trim(),
          location: s.location.trim() || undefined,
          optional: s.optional,
          dependencyType: s.dependencyType,
        })),
      })
    }

    // Then creates
    for (const draft of changes.toCreate) {
      await createPath({
        jobId,
        name: draft.name.trim(),
        goalQuantity: draft.goalQuantity,
        advancementMode: draft.advancementMode,
        steps: draft.steps.map(s => ({
          name: s.name.trim(),
          location: s.location.trim() || undefined,
          optional: s.optional,
          dependencyType: s.dependencyType,
        })),
      })
    }

    return jobId
  }

  // ---- Error Helpers ----

  function getFieldError(field: string): string | undefined {
    return errors.value.find(e => e.field === field)?.message
  }

  function clearFieldError(field: string): void {
    errors.value = errors.value.filter(e => e.field !== field)
  }

  return {
    jobDraft,
    pathDrafts,
    errors,
    submitting,
    submitError,
    addPath,
    removePath,
    addStep,
    removeStep,
    moveStep,
    applyTemplate,
    validate,
    submit,
    getFieldError,
    clearFieldError,
  }
}
