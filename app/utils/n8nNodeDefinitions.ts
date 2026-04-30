/**
 * Single source of truth for n8n node types that the editor knows how to render.
 *
 * Each entry describes the palette metadata, the default parameter shape, and
 * the number of output handles the node has (for routing in the canvas).
 */

export type NodeCategory = 'trigger' | 'transform' | 'control' | 'destination'

export interface NodeDefinition {
  /** The n8n node type string that will be written to the workflow JSON. */
  type: string
  /** Human-readable label shown in the palette and as the default node name. */
  label: string
  /** Iconify icon used in the palette and on the canvas node. */
  icon: string
  /** One-line description shown as palette tooltip / hint. */
  description: string
  /** Broad category used for coloring nodes. */
  category: NodeCategory
  /** Output handle definitions, in branch order. Default = single "main" output. */
  outputs?: Array<{ id: string, label: string, color?: string }>
  /** The default parameters this node should be created with. */
  defaultParameters: () => Record<string, unknown>
  /** Optional typeVersion override (default 1). */
  typeVersion?: number
}

// ---- Default-parameter factories ----

function httpRequestDefaults(): Record<string, unknown> {
  return {
    method: 'POST',
    url: '',
    authentication: 'none',
    contentType: 'json',
    body: '',
    headers: [],
    queryParameters: [],
  }
}

function slackDefaults(): Record<string, unknown> {
  return { channel: '', text: '{{ $json.body.summary }}', authentication: 'oAuth2' }
}

function discordDefaults(): Record<string, unknown> {
  return { webhookUri: '', content: '{{ $json.body.summary }}' }
}

function jiraDefaults(): Record<string, unknown> {
  return {
    resource: 'issue',
    operation: 'create',
    project: '',
    issueType: 'Task',
    summary: '{{ $json.body.summary }}',
    additionalFields: {
      description: '',
      assignee: '',
      labels: [],
      priority: '',
      parentIssueKey: '',
      customFieldsUi: { customFieldsValues: [] },
    },
    updateFields: {
      summary: '',
      description: '',
      assignee: '',
      labels: [],
      priority: '',
      status: '',
      customFieldsUi: { customFieldsValues: [] },
    },
    issueKey: '',
    commentBody: '',
    transitionId: '',
    transitionName: '',
  }
}

function gmailDefaults(): Record<string, unknown> {
  return {
    to: '',
    subject: 'Shop Planr: {{ $json.body.event }}',
    message: '{{ $json.body.summary }}',
  }
}

function teamsDefaults(): Record<string, unknown> {
  return { webhookUri: '', message: '{{ $json.body.summary }}' }
}

function setDefaults(): Record<string, unknown> {
  return { assignments: { assignments: [] } }
}

function codeDefaults(): Record<string, unknown> {
  return {
    language: 'javaScript',
    jsCode: [
      '// Access input at $input.first().json.body',
      '// Return an array of items to pass downstream',
      'return items;',
    ].join('\n'),
  }
}

function ifDefaults(): Record<string, unknown> {
  return { conditions: { conditions: [] } }
}

function filterDefaults(): Record<string, unknown> {
  return { conditions: { conditions: [] } }
}

function switchDefaults(): Record<string, unknown> {
  return {
    mode: 'rules',
    rules: { values: [] },
    fallbackOutput: 'extra',
    options: { allMatchingOutputs: false },
  }
}

function mergeDefaults(): Record<string, unknown> {
  return { mode: 'append', options: {} }
}

function waitDefaults(): Record<string, unknown> {
  return { amount: 5, unit: 'seconds', resume: 'timeInterval' }
}

function splitInBatchesDefaults(): Record<string, unknown> {
  return { batchSize: 1, options: {} }
}

function stopAndErrorDefaults(): Record<string, unknown> {
  return { errorMessage: 'Stopped by Shop Planr automation', errorType: 'errorMessage' }
}

function noOpDefaults(): Record<string, unknown> {
  return {}
}

// ---- The registry ----

export const NODE_DEFINITIONS: NodeDefinition[] = [
  // ── Transform ──
  {
    type: 'n8n-nodes-base.set',
    label: 'Set Fields',
    icon: 'i-lucide-pencil',
    description: 'Build a new payload shape with variable interpolation',
    category: 'transform',
    defaultParameters: setDefaults,
  },
  {
    type: 'n8n-nodes-base.code',
    label: 'Code',
    icon: 'i-lucide-code',
    description: 'Run custom JavaScript to transform data',
    category: 'transform',
    defaultParameters: codeDefaults,
  },

  // ── Control Flow ──
  {
    type: 'n8n-nodes-base.if',
    label: 'IF',
    icon: 'i-lucide-git-branch',
    description: 'Route data to true/false branches based on conditions',
    category: 'control',
    outputs: [
      { id: 'true', label: 'TRUE', color: 'green' },
      { id: 'false', label: 'FALSE', color: 'red' },
    ],
    defaultParameters: ifDefaults,
  },
  {
    type: 'n8n-nodes-base.switch',
    label: 'Switch',
    icon: 'i-lucide-split-square-vertical',
    description: 'Route to multiple outputs based on rules, with a default fallback',
    category: 'control',
    outputs: [
      { id: '0', label: 'Route 1' },
      { id: '1', label: 'Route 2' },
      { id: '2', label: 'Route 3' },
      { id: '3', label: 'Route 4' },
      { id: 'default', label: 'Default', color: 'gray' },
    ],
    defaultParameters: switchDefaults,
    typeVersion: 3,
  },
  {
    type: 'n8n-nodes-base.filter',
    label: 'Filter',
    icon: 'i-lucide-filter',
    description: 'Pass through items matching all conditions',
    category: 'control',
    defaultParameters: filterDefaults,
  },
  {
    type: 'n8n-nodes-base.merge',
    label: 'Merge',
    icon: 'i-lucide-merge',
    description: 'Combine data streams from multiple branches',
    category: 'control',
    defaultParameters: mergeDefaults,
    typeVersion: 3,
  },
  {
    type: 'n8n-nodes-base.splitInBatches',
    label: 'Loop Over Items',
    icon: 'i-lucide-repeat',
    description: 'Iterate over an array (e.g. partIds) one batch at a time',
    category: 'control',
    outputs: [
      { id: 'done', label: 'DONE', color: 'green' },
      { id: 'loop', label: 'LOOP', color: 'amber' },
    ],
    defaultParameters: splitInBatchesDefaults,
    typeVersion: 3,
  },
  {
    type: 'n8n-nodes-base.wait',
    label: 'Wait',
    icon: 'i-lucide-timer',
    description: 'Pause the workflow for a fixed time or until a webhook resume',
    category: 'control',
    defaultParameters: waitDefaults,
  },
  {
    type: 'n8n-nodes-base.stopAndError',
    label: 'Stop & Error',
    icon: 'i-lucide-octagon-x',
    description: 'Halt the workflow with an error message (useful after an IF false branch)',
    category: 'control',
    defaultParameters: stopAndErrorDefaults,
  },
  {
    type: 'n8n-nodes-base.noOp',
    label: 'No Op',
    icon: 'i-lucide-circle-dashed',
    description: 'Does nothing — useful as a merge point or branch terminator',
    category: 'control',
    defaultParameters: noOpDefaults,
  },

  // ── Destinations ──
  {
    type: 'n8n-nodes-base.httpRequest',
    label: 'HTTP Request',
    icon: 'i-lucide-globe',
    description: 'Send data to any HTTP endpoint with headers, query params, body',
    category: 'destination',
    defaultParameters: httpRequestDefaults,
    typeVersion: 4,
  },
  {
    type: 'n8n-nodes-base.slack',
    label: 'Slack',
    icon: 'i-lucide-message-square',
    description: 'Post messages to Slack channels',
    category: 'destination',
    defaultParameters: slackDefaults,
  },
  {
    type: 'n8n-nodes-base.jira',
    label: 'Jira',
    icon: 'i-lucide-ticket',
    description: 'Create, update, comment on, or transition Jira issues — with custom field support',
    category: 'destination',
    defaultParameters: jiraDefaults,
  },
  {
    type: 'n8n-nodes-base.gmail',
    label: 'Email (Gmail)',
    icon: 'i-lucide-mail',
    description: 'Send email notifications',
    category: 'destination',
    defaultParameters: gmailDefaults,
  },
  {
    type: 'n8n-nodes-base.discord',
    label: 'Discord',
    icon: 'i-lucide-hash',
    description: 'Post to Discord via webhook URL',
    category: 'destination',
    defaultParameters: discordDefaults,
  },
  {
    type: 'n8n-nodes-base.microsoftTeams',
    label: 'MS Teams',
    icon: 'i-lucide-users',
    description: 'Post to Teams via incoming webhook',
    category: 'destination',
    defaultParameters: teamsDefaults,
  },
]

// ---- Lookup helpers ----

export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return NODE_DEFINITIONS.find(d => d.type === type)
}

export function getOutputsForNode(type: string): NodeDefinition['outputs'] {
  return getNodeDefinition(type)?.outputs ?? [{ id: 'main', label: '' }]
}

export function getDefaultParameters(type: string): Record<string, unknown> {
  const def = getNodeDefinition(type)
  return def?.defaultParameters() ?? {}
}

/** Group nodes by category for rendering the palette. */
export function getPaletteGroups(): Array<{ category: string, nodes: NodeDefinition[] }> {
  const groups: Record<NodeCategory, NodeDefinition[]> = {
    trigger: [],
    transform: [],
    control: [],
    destination: [],
  }
  for (const def of NODE_DEFINITIONS) {
    groups[def.category].push(def)
  }
  return [
    { category: 'Transform', nodes: groups.transform },
    { category: 'Control Flow', nodes: groups.control },
    { category: 'Destinations', nodes: groups.destination },
  ]
}
