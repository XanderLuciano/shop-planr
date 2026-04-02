#!/usr/bin/env node
/**
 * Shop Planr MCP Server
 *
 * A Model Context Protocol server that wraps the Shop Planr HTTP API,
 * allowing AI agents to query and create jobs, paths, parts, and users.
 *
 * Uses the low-level Server API with raw JSON Schema to avoid zod
 * serialization issues between MCP SDK and zod v4.
 *
 * Usage:
 *   node mcp-server/dist/index.mjs
 *
 * Expects the Nuxt dev server running at BASE_URL (default: http://localhost:3000).
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const BASE_URL = process.env.SHOP_PLANR_URL || 'http://localhost:3000'

// ---- HTTP helpers ----

async function apiGet(path: string) {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GET ${path} failed (${res.status}): ${text}`)
  }
  return res.json()
}

async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST ${path} failed (${res.status}): ${text}`)
  }
  return res.json()
}

async function apiPut(path: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PUT ${path} failed (${res.status}): ${text}`)
  }
  return res.json()
}

async function apiDelete(path: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DELETE ${path} failed (${res.status}): ${text}`)
  }
  return res.json()
}

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function err(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true }
}

// ---- Tool definitions with raw JSON Schema ----

interface ToolDef {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: (args: Record<string, unknown>) => Promise<unknown>
}

const tools: ToolDef[] = []

function defineTool(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
  handler: (args: Record<string, unknown>) => Promise<unknown>,
) {
  tools.push({
    name,
    description,
    inputSchema: { type: 'object', properties, required },
    handler,
  })
}

// ============================================================
// JOBS
// ============================================================

defineTool('list_jobs', 'List all production jobs', {}, [], async () =>
  ok(await apiGet('/api/jobs')),
)

defineTool('get_job', 'Get a job by ID with paths, steps, and progress', {
  jobId: { type: 'string', description: 'The job ID' },
}, ['jobId'], async ({ jobId }) =>
  ok(await apiGet(`/api/jobs/${jobId}`)),
)

defineTool('create_job', 'Create a new production job', {
  name: { type: 'string', description: 'Job name' },
  goalQuantity: { type: 'number', description: 'Target quantity to produce' },
}, ['name', 'goalQuantity'], async (args) =>
  ok(await apiPost('/api/jobs', args)),
)

defineTool('update_job', 'Update an existing job', {
  jobId: { type: 'string', description: 'The job ID to update' },
  name: { type: 'string', description: 'New job name' },
  goalQuantity: { type: 'number', description: 'New goal quantity' },
}, ['jobId'], async ({ jobId, ...body }) =>
  ok(await apiPut(`/api/jobs/${jobId}`, body)),
)

defineTool('delete_job', 'Delete a job (must have no paths/parts/BOM refs)', {
  jobId: { type: 'string', description: 'The job ID to delete' },
}, ['jobId'], async ({ jobId }) =>
  ok(await apiDelete(`/api/jobs/${jobId}`)),
)

// ============================================================
// PATHS
// ============================================================

defineTool('get_path', 'Get a path by ID with steps, distribution, and completed count', {
  pathId: { type: 'string', description: 'The path ID' },
}, ['pathId'], async ({ pathId }) =>
  ok(await apiGet(`/api/paths/${pathId}`)),
)

defineTool('create_path', 'Create a new path (route) for a job with process steps', {
  jobId: { type: 'string', description: 'The job this path belongs to' },
  name: { type: 'string', description: 'Path name' },
  goalQuantity: { type: 'number', description: 'How many parts to route' },
  advancementMode: { type: 'string', enum: ['strict', 'flexible', 'per_step'], description: 'Default: strict' },
  steps: {
    type: 'array',
    description: 'Ordered process steps',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Step name' },
        location: { type: 'string', description: 'Physical location' },
        optional: { type: 'boolean', description: 'Can be skipped' },
        dependencyType: { type: 'string', enum: ['physical', 'preferred', 'completion_gate'] },
      },
      required: ['name'],
    },
  },
}, ['jobId', 'name', 'goalQuantity', 'steps'], async (args) =>
  ok(await apiPost('/api/paths', args)),
)

defineTool('update_path', 'Update a path', {
  pathId: { type: 'string', description: 'The path ID' },
  name: { type: 'string', description: 'New path name' },
  goalQuantity: { type: 'number', description: 'New goal quantity' },
  advancementMode: { type: 'string', enum: ['strict', 'flexible', 'per_step'] },
  steps: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Existing step ID to preserve' },
        name: { type: 'string' },
        location: { type: 'string' },
        optional: { type: 'boolean' },
        dependencyType: { type: 'string', enum: ['physical', 'preferred', 'completion_gate'] },
      },
      required: ['name'],
    },
  },
}, ['pathId'], async ({ pathId, ...body }) =>
  ok(await apiPut(`/api/paths/${pathId}`, body)),
)

defineTool('delete_path', 'Delete a path with cascade (admin only)', {
  pathId: { type: 'string', description: 'The path ID' },
  userId: { type: 'string', description: 'Admin user ID' },
}, ['pathId', 'userId'], async ({ pathId, userId }) =>
  ok(await apiDelete(`/api/paths/${pathId}`, { userId })),
)

// ============================================================
// PARTS
// ============================================================

defineTool('list_parts', 'List all parts with enriched info (job, path, step, status)', {}, [], async () =>
  ok(await apiGet('/api/parts')),
)

defineTool('get_part', 'Get a single part by ID', {
  partId: { type: 'string', description: 'The part ID' },
}, ['partId'], async ({ partId }) =>
  ok(await apiGet(`/api/parts/${partId}`)),
)

defineTool('create_parts', 'Batch-create parts for a job/path', {
  jobId: { type: 'string', description: 'The job ID' },
  pathId: { type: 'string', description: 'The path ID' },
  quantity: { type: 'number', description: 'Number of parts to create' },
  userId: { type: 'string', description: 'User ID performing creation' },
  certId: { type: 'string', description: 'Optional certificate ID to auto-attach' },
}, ['jobId', 'pathId', 'quantity', 'userId'], async (args) =>
  ok(await apiPost('/api/parts', args)),
)

defineTool('advance_part', 'Advance a part to its next step', {
  partId: { type: 'string', description: 'The part ID' },
  userId: { type: 'string', description: 'User ID' },
}, ['partId', 'userId'], async ({ partId, userId }) =>
  ok(await apiPost(`/api/parts/${partId}/advance`, { userId })),
)

defineTool('get_part_route', 'Get full routing info for a part', {
  partId: { type: 'string', description: 'The part ID' },
}, ['partId'], async ({ partId }) =>
  ok(await apiGet(`/api/parts/${partId}/full-route`)),
)

defineTool('get_part_step_statuses', 'Get step-by-step status history for a part', {
  partId: { type: 'string', description: 'The part ID' },
}, ['partId'], async ({ partId }) =>
  ok(await apiGet(`/api/parts/${partId}/step-statuses`)),
)

// ============================================================
// USERS
// ============================================================

defineTool('list_users', 'List all active users', {}, [], async () =>
  ok(await apiGet('/api/users')),
)

defineTool('create_user', 'Create a new user', {
  username: { type: 'string', description: 'Unique username' },
  displayName: { type: 'string', description: 'Display name' },
  isAdmin: { type: 'boolean', description: 'Admin privileges (default: false)' },
}, ['username', 'displayName'], async (args) =>
  ok(await apiPost('/api/users', args)),
)

defineTool('update_user', 'Update an existing user', {
  userId: { type: 'string', description: 'The user ID' },
  username: { type: 'string' },
  displayName: { type: 'string' },
  isAdmin: { type: 'boolean' },
  active: { type: 'boolean' },
}, ['userId'], async ({ userId, ...body }) =>
  ok(await apiPut(`/api/users/${userId}`, body)),
)

// ============================================================
// TEMPLATES
// ============================================================

defineTool('list_templates', 'List all route templates', {}, [], async () =>
  ok(await apiGet('/api/templates')),
)

defineTool('get_template', 'Get a route template by ID', {
  templateId: { type: 'string', description: 'The template ID' },
}, ['templateId'], async ({ templateId }) =>
  ok(await apiGet(`/api/templates/${templateId}`)),
)

defineTool('create_template', 'Create a reusable route template', {
  name: { type: 'string', description: 'Template name' },
  steps: {
    type: 'array',
    description: 'Ordered steps',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        location: { type: 'string' },
      },
      required: ['name'],
    },
  },
}, ['name', 'steps'], async (args) =>
  ok(await apiPost('/api/templates', args)),
)

defineTool('apply_template', 'Apply a template to create a path on a job', {
  templateId: { type: 'string', description: 'The template ID' },
  jobId: { type: 'string', description: 'The job ID' },
  goalQuantity: { type: 'number', description: 'Goal quantity' },
  pathName: { type: 'string', description: 'Custom path name' },
}, ['templateId', 'jobId', 'goalQuantity'], async ({ templateId, ...body }) =>
  ok(await apiPost(`/api/templates/${templateId}/apply`, body)),
)

// ============================================================
// CERTIFICATES
// ============================================================

defineTool('list_certs', 'List all certificates', {}, [], async () =>
  ok(await apiGet('/api/certs')),
)

defineTool('create_cert', 'Create a certificate (material or process)', {
  type: { type: 'string', enum: ['material', 'process'], description: 'Certificate type' },
  name: { type: 'string', description: 'Certificate name' },
}, ['type', 'name'], async (args) =>
  ok(await apiPost('/api/certs', args)),
)

defineTool('batch_attach_cert', 'Attach a certificate to multiple parts', {
  certId: { type: 'string', description: 'The certificate ID' },
  partIds: { type: 'array', items: { type: 'string' }, description: 'Part IDs' },
  userId: { type: 'string', description: 'User performing attachment' },
}, ['certId', 'partIds', 'userId'], async (args) =>
  ok(await apiPost('/api/certs/batch-attach', args)),
)

// ============================================================
// AUDIT
// ============================================================

defineTool('list_audit_entries', 'List audit trail entries', {}, [], async () =>
  ok(await apiGet('/api/audit')),
)

defineTool('get_part_audit', 'Get audit entries for a specific part', {
  partId: { type: 'string', description: 'The part ID' },
}, ['partId'], async ({ partId }) =>
  ok(await apiGet(`/api/audit/part/${partId}`)),
)

// ============================================================
// OPERATOR / WORK QUEUE
// ============================================================

defineTool('get_work_queue', 'Get operator work queue grouped by step', {}, [], async () =>
  ok(await apiGet('/api/operator/work-queue')),
)

defineTool('get_step_view', 'Get detailed step view for a process step', {
  stepId: { type: 'string', description: 'The step ID' },
}, ['stepId'], async ({ stepId }) =>
  ok(await apiGet(`/api/operator/step/${stepId}`)),
)

defineTool('get_user_queue', 'Get work queue for a specific user', {
  userId: { type: 'string', description: 'The user ID' },
}, ['userId'], async ({ userId }) =>
  ok(await apiGet(`/api/operator/queue/${userId}`)),
)

// ============================================================
// NOTES
// ============================================================

defineTool('create_note', 'Create a process step note/defect', {
  jobId: { type: 'string' },
  pathId: { type: 'string' },
  stepId: { type: 'string' },
  partIds: { type: 'array', items: { type: 'string' } },
  text: { type: 'string', description: 'Note text' },
  createdBy: { type: 'string', description: 'User ID' },
}, ['jobId', 'pathId', 'stepId', 'partIds', 'text', 'createdBy'], async (args) =>
  ok(await apiPost('/api/notes', args)),
)

defineTool('get_notes_by_step', 'Get notes for a step', {
  stepId: { type: 'string' },
}, ['stepId'], async ({ stepId }) =>
  ok(await apiGet(`/api/notes/step/${stepId}`)),
)

defineTool('get_notes_by_part', 'Get notes for a part', {
  partId: { type: 'string' },
}, ['partId'], async ({ partId }) =>
  ok(await apiGet(`/api/notes/part/${partId}`)),
)

// ============================================================
// LIFECYCLE
// ============================================================

defineTool('scrap_part', 'Scrap a part with a reason', {
  partId: { type: 'string' },
  reason: { type: 'string', enum: ['out_of_tolerance', 'process_defect', 'damaged', 'operator_error', 'other'] },
  explanation: { type: 'string', description: 'Required when reason is "other"' },
  userId: { type: 'string' },
}, ['partId', 'reason', 'userId'], async ({ partId, ...body }) =>
  ok(await apiPost(`/api/parts/${partId}/scrap`, body)),
)

defineTool('force_complete_part', 'Force-complete a part (skip remaining steps)', {
  partId: { type: 'string' },
  reason: { type: 'string' },
  userId: { type: 'string' },
}, ['partId', 'userId'], async ({ partId, ...body }) =>
  ok(await apiPost(`/api/parts/${partId}/force-complete`, body)),
)

defineTool('advance_part_to_step', 'Advance a part to a specific step', {
  partId: { type: 'string' },
  targetStepId: { type: 'string', description: 'The step to advance to' },
  userId: { type: 'string' },
}, ['partId', 'targetStepId', 'userId'], async ({ partId, ...body }) =>
  ok(await apiPost(`/api/parts/${partId}/advance-to`, body)),
)

// ============================================================
// SETTINGS
// ============================================================

defineTool('get_settings', 'Get application settings', {}, [], async () =>
  ok(await apiGet('/api/settings')),
)

// ============================================================
// Server setup (low-level API — no zod serialization)
// ============================================================

const server = new Server(
  { name: 'shop-planr', version: '1.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = tools.find(t => t.name === request.params.name)
  if (!tool) {
    return err(`Unknown tool: ${request.params.name}`)
  }
  try {
    const args = (request.params.arguments ?? {}) as Record<string, unknown>
    return await tool.handler(args) as { content: { type: 'text'; text: string }[] }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return err(message)
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`Shop Planr MCP server running (API: ${BASE_URL})`)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
