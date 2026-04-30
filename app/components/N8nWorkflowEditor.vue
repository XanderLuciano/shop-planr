<script setup lang="ts">
import { VueFlow, useVueFlow } from '@vue-flow/core'
import type { Node, Edge, Connection } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import type { N8nWorkflowDefinition, WebhookEventType } from '~/types/domain'
import { buildVariablesForEventTypes } from '~/utils/n8nVariables'

const props = defineProps<{
  modelValue: N8nWorkflowDefinition
  /** Event types this automation subscribes to — used to populate the variable picker */
  eventTypes: WebhookEventType[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: N8nWorkflowDefinition]
}>()

// ---- Node templates for the palette ----
const NODE_TEMPLATES = [
  {
    category: 'Transform',
    nodes: [
      { type: 'n8n-nodes-base.set', label: 'Set Fields', icon: 'i-lucide-pencil', description: 'Build a new payload shape with variable interpolation' },
      { type: 'n8n-nodes-base.code', label: 'Code', icon: 'i-lucide-code', description: 'Run custom JavaScript to transform data' },
    ],
  },
  {
    category: 'Control Flow',
    nodes: [
      { type: 'n8n-nodes-base.if', label: 'IF', icon: 'i-lucide-git-branch', description: 'Route data to true/false branches based on conditions' },
      { type: 'n8n-nodes-base.filter', label: 'Filter', icon: 'i-lucide-filter', description: 'Pass through items matching all conditions' },
    ],
  },
  {
    category: 'Destinations',
    nodes: [
      { type: 'n8n-nodes-base.httpRequest', label: 'HTTP Request', icon: 'i-lucide-globe', description: 'Send data to any HTTP endpoint with headers, query params, body' },
      { type: 'n8n-nodes-base.slack', label: 'Slack', icon: 'i-lucide-message-square', description: 'Post messages to Slack channels' },
      { type: 'n8n-nodes-base.jira', label: 'Jira', icon: 'i-lucide-ticket', description: 'Create or update Jira issues' },
      { type: 'n8n-nodes-base.gmail', label: 'Email (Gmail)', icon: 'i-lucide-mail', description: 'Send email notifications' },
      { type: 'n8n-nodes-base.discord', label: 'Discord', icon: 'i-lucide-hash', description: 'Post to Discord via webhook URL' },
      { type: 'n8n-nodes-base.microsoftTeams', label: 'MS Teams', icon: 'i-lucide-users', description: 'Post to Teams via incoming webhook' },
    ],
  },
] as const

// ---- Trigger constants ----
const TRIGGER_NODE_ID = 'trigger-node'
const TRIGGER_NODE_NAME = 'Shop Planr Event'
const TRIGGER_NODE_TYPE = 'shop-planr-trigger'

// ---- Variables derived from subscribed event types ----
const variables = computed(() => buildVariablesForEventTypes(props.eventTypes))

// ---- Vue Flow setup ----
const { onConnect, addEdges, removeNodes, removeEdges, fitView, onNodesChange, onEdgesChange } = useVueFlow()

// ---- Convert workflow JSON <-> Vue Flow nodes/edges ----
function workflowToFlow(workflow: N8nWorkflowDefinition): { nodes: Node[], edges: Edge[] } {
  const hasTrigger = workflow.nodes.some(n => n.type === TRIGGER_NODE_TYPE || n.id === TRIGGER_NODE_ID)

  const nodes: Node[] = []

  // Always prepend the trigger node if it's not already in the workflow
  if (!hasTrigger) {
    nodes.push({
      id: TRIGGER_NODE_ID,
      type: 'shopPlanrNode',
      position: { x: 40, y: 160 },
      deletable: false,
      data: {
        label: TRIGGER_NODE_NAME,
        nodeType: TRIGGER_NODE_TYPE,
        parameters: {},
        typeVersion: 1,
        isTrigger: true,
      },
    })
  }

  for (const n of workflow.nodes) {
    nodes.push({
      id: n.id,
      type: 'shopPlanrNode',
      position: { x: n.position[0], y: n.position[1] },
      deletable: n.type !== TRIGGER_NODE_TYPE && n.id !== TRIGGER_NODE_ID,
      data: {
        label: n.name,
        nodeType: n.type,
        parameters: n.parameters,
        typeVersion: n.typeVersion,
        isTrigger: n.type === TRIGGER_NODE_TYPE || n.id === TRIGGER_NODE_ID,
      },
    })
  }

  const edges: Edge[] = []
  for (const [sourceName, rawConns] of Object.entries(workflow.connections)) {
    const sourceNode = nodes.find(n => (n.data?.label) === sourceName)
    const conns = rawConns as { main?: Array<Array<{ node: string, type: string, index: number }>> } | undefined
    if (!sourceNode || !conns?.main) continue
    // Each entry in conns.main[] represents one output branch (0 = default, 1 = IF false branch)
    conns.main.forEach((outputs, branchIdx) => {
      for (const conn of outputs) {
        const targetNode = nodes.find(n => (n.data?.label) === conn.node)
        if (!targetNode) continue
        const isIf = sourceNode.data?.nodeType === 'n8n-nodes-base.if'
        const sourceHandle = isIf ? (branchIdx === 0 ? 'true' : 'false') : undefined
        edges.push({
          id: `${sourceNode.id}-${targetNode.id}-${branchIdx}`,
          source: sourceNode.id,
          target: targetNode.id,
          sourceHandle,
          animated: true,
          type: 'default',
        })
      }
    })
  }

  return { nodes, edges }
}

function flowToWorkflow(currentNodes: Node[], currentEdges: Edge[]): N8nWorkflowDefinition {
  const n8nNodes = currentNodes.map(n => ({
    id: n.id,
    name: String(n.data?.label ?? ''),
    type: String(n.data?.nodeType ?? ''),
    typeVersion: Number(n.data?.typeVersion ?? 1),
    position: [Math.round(n.position.x), Math.round(n.position.y)] as [number, number],
    parameters: (n.data?.parameters as Record<string, unknown>) ?? {},
  }))

  const connections: Record<string, { main: Array<Array<{ node: string, type: string, index: number }>> }> = {}
  for (const edge of currentEdges) {
    const sourceNode = n8nNodes.find(n => n.id === edge.source)
    const targetNode = n8nNodes.find(n => n.id === edge.target)
    if (!sourceNode || !targetNode) continue

    // Initialize with enough branches for IF nodes
    if (!connections[sourceNode.name]) {
      const isIf = sourceNode.type === 'n8n-nodes-base.if'
      connections[sourceNode.name] = { main: isIf ? [[], []] : [[]] }
    }
    const entry = connections[sourceNode.name]!
    const branchIdx = edge.sourceHandle === 'false' ? 1 : 0
    if (!entry.main[branchIdx]) entry.main[branchIdx] = []
    entry.main[branchIdx]!.push({
      node: targetNode.name,
      type: 'main',
      index: 0,
    })
  }

  return { nodes: n8nNodes, connections: connections as Record<string, unknown> }
}

// ---- Reactive state ----
const initial = workflowToFlow(props.modelValue)
const nodes = ref<Node[]>(initial.nodes)
const edges = ref<Edge[]>(initial.edges)

// Track selected node for the properties panel
const selectedNodeId = ref<string | null>(null)
const selectedNode = computed(() => {
  if (!selectedNodeId.value) return null
  return nodes.value.find(n => n.id === selectedNodeId.value) ?? null
})

// Inject isSelected into node data for visual feedback
watchEffect(() => {
  for (const n of nodes.value) {
    const shouldBeSelected = n.id === selectedNodeId.value
    if (n.data) {
      n.data.isSelected = shouldBeSelected
    }
  }
})

// Other node names (for uniqueness validation on rename)
const otherNodeNames = computed(() => {
  if (!selectedNode.value) return []
  return nodes.value
    .filter(n => n.id !== selectedNode.value!.id)
    .map(n => String(n.data?.label ?? ''))
})

// ---- Emit changes (debounced to coalesce bursts from drag / typing) ----
let emitTimer: ReturnType<typeof setTimeout> | null = null
function scheduleEmit() {
  if (emitTimer) clearTimeout(emitTimer)
  emitTimer = setTimeout(() => {
    const workflow = flowToWorkflow(nodes.value, edges.value)
    // Strip the synthetic trigger node from `nodes` (the service re-adds it at deploy time),
    // but preserve any connections FROM the trigger so the service knows where to wire it.
    workflow.nodes = workflow.nodes.filter(n => n.type !== TRIGGER_NODE_TYPE && n.id !== TRIGGER_NODE_ID)
    emit('update:modelValue', workflow)
  }, 100)
}

watch(nodes, scheduleEmit, { deep: true })
watch(edges, scheduleEmit, { deep: true })

// ---- Cleanup orphan edges when nodes are removed ----
onNodesChange((changes) => {
  for (const change of changes) {
    if (change.type === 'remove') {
      // Remove edges connected to the deleted node
      const toRemove = edges.value.filter(e => e.source === change.id || e.target === change.id)
      if (toRemove.length > 0) {
        removeEdges(toRemove)
      }
      if (selectedNodeId.value === change.id) {
        selectedNodeId.value = null
      }
    }
  }
})

onEdgesChange(() => {
  // Handled by reactive binding — nothing extra
})

// ---- Connection handling ----
onConnect((connection: Connection) => {
  // Prevent connecting from the trigger back to itself or creating cycles to trigger
  if (connection.target === TRIGGER_NODE_ID) return

  // Avoid duplicate connections (same source + handle + target)
  const exists = edges.value.some(e =>
    e.source === connection.source
    && e.target === connection.target
    && (e.sourceHandle ?? null) === (connection.sourceHandle ?? null),
  )
  if (exists) return

  addEdges([{
    ...connection,
    id: `${connection.source}-${connection.target}-${connection.sourceHandle ?? 'main'}-${Date.now()}`,
    animated: true,
  }])
})

// ---- Node operations ----
function addNode(template: { type: string, label: string }) {
  // Generate a unique name
  const existingNames = new Set(nodes.value.map(n => String(n.data?.label ?? '')))
  const baseName = template.label
  let candidate = baseName
  let counter = 1
  while (existingNames.has(candidate)) {
    counter++
    candidate = `${baseName} ${counter}`
  }

  const id = `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const triggerNode = nodes.value.find(n => n.id === TRIGGER_NODE_ID)
  const baseX = triggerNode ? triggerNode.position.x + 260 : 320
  const lastNonTrigger = nodes.value.filter(n => n.id !== TRIGGER_NODE_ID).pop()
  const position = lastNonTrigger
    ? { x: lastNonTrigger.position.x + 240, y: lastNonTrigger.position.y }
    : { x: baseX, y: 160 }

  const newNode: Node = {
    id,
    type: 'shopPlanrNode',
    position,
    data: {
      label: candidate,
      nodeType: template.type,
      parameters: getDefaultParameters(template.type),
      typeVersion: 1,
    },
  }
  nodes.value = [...nodes.value, newNode]
  selectedNodeId.value = id
}

function deleteSelectedNode() {
  if (!selectedNodeId.value || selectedNodeId.value === TRIGGER_NODE_ID) return
  const nodeToRemove = nodes.value.find(n => n.id === selectedNodeId.value)
  if (nodeToRemove) {
    removeNodes([nodeToRemove])
    const connectedEdges = edges.value.filter(
      e => e.source === selectedNodeId.value || e.target === selectedNodeId.value,
    )
    if (connectedEdges.length > 0) {
      removeEdges(connectedEdges)
    }
  }
  selectedNodeId.value = null
}

function onNodeClick(event: { node: { id: string } }) {
  selectedNodeId.value = event.node.id
}

function onPaneClick() {
  selectedNodeId.value = null
}

// ---- Handle rename: rewrite connections keyed on node name ----
function handleRename(oldName: string, newName: string) {
  // Vue Flow uses node IDs, not names, for edges — so edges are unaffected.
  // The flowToWorkflow function derives connection keys from the current
  // data.label, so next emit will use the new name automatically.
  // Nothing to do here beyond the automatic re-emit.
  void oldName
  void newName
}

// ---- Update handler for the properties panel ----
function handleNodeUpdate(newData: { label: string, nodeType: string, parameters: Record<string, unknown>, typeVersion: number, isTrigger?: boolean }) {
  const node = nodes.value.find(n => n.id === selectedNodeId.value)
  if (!node || !node.data) return
  node.data.label = newData.label
  node.data.parameters = newData.parameters
  // Force reactive update
  nodes.value = [...nodes.value]
}

// ---- Default parameters per node type ----
function getDefaultParameters(type: string): Record<string, unknown> {
  switch (type) {
    case 'n8n-nodes-base.httpRequest':
      return {
        method: 'POST',
        url: '',
        authentication: 'none',
        contentType: 'json',
        body: '',
        headers: [],
        queryParameters: [],
      }
    case 'n8n-nodes-base.slack':
      return { channel: '', text: '{{ $json.body.summary }}', authentication: 'oAuth2' }
    case 'n8n-nodes-base.discord':
      return { webhookUri: '', content: '{{ $json.body.summary }}' }
    case 'n8n-nodes-base.jira':
      return { operation: 'create', project: '', issueType: 'Task', summary: '{{ $json.body.summary }}', description: '' }
    case 'n8n-nodes-base.gmail':
      return { to: '', subject: 'Shop Planr: {{ $json.body.event }}', message: '{{ $json.body.summary }}' }
    case 'n8n-nodes-base.microsoftTeams':
      return { webhookUri: '', message: '{{ $json.body.summary }}' }
    case 'n8n-nodes-base.set':
      return { assignments: { assignments: [] } }
    case 'n8n-nodes-base.code':
      return { language: 'javaScript', jsCode: '// Access input at $input.first().json.body\n// Return an array of items to pass downstream\nreturn items;' }
    case 'n8n-nodes-base.if':
      return { conditions: { conditions: [] } }
    case 'n8n-nodes-base.filter':
      return { conditions: { conditions: [] } }
    default:
      return {}
  }
}

// ---- Warning detection: nodes with empty required fields ----
function getWarningFor(node: Node): string | undefined {
  if (!node.data) return undefined
  const t = node.data.nodeType as string
  const p = (node.data.parameters ?? {}) as Record<string, unknown>

  // Check connectivity: a non-trigger node with no inbound edge is orphaned
  if (!node.data.isTrigger && !edges.value.some(e => e.target === node.id)) {
    return 'Not connected to trigger'
  }

  switch (t) {
    case 'n8n-nodes-base.httpRequest':
      if (!p.url) return 'URL is empty'
      break
    case 'n8n-nodes-base.slack':
      if (!p.channel) return 'Channel is empty'
      break
    case 'n8n-nodes-base.discord':
      if (!p.webhookUri) return 'Webhook URL is empty'
      break
    case 'n8n-nodes-base.jira':
      if (!p.project && p.operation === 'create') return 'Project key is empty'
      break
    case 'n8n-nodes-base.gmail':
      if (!p.to) return 'To address is empty'
      break
    case 'n8n-nodes-base.microsoftTeams':
      if (!p.webhookUri) return 'Webhook URL is empty'
      break
  }
  return undefined
}

// Inject warnings into node data reactively
watchEffect(() => {
  for (const n of nodes.value) {
    if (n.data) {
      n.data.warning = getWarningFor(n)
    }
  }
})

// ---- Fit view on mount ----
onMounted(() => {
  setTimeout(() => fitView({ padding: 0.2 }), 100)
})
</script>

<template>
  <div class="flex gap-3 h-[640px]">
    <!-- Node Palette (left sidebar) -->
    <div class="w-52 shrink-0 border border-(--ui-border) rounded-lg overflow-y-auto bg-(--ui-bg) flex flex-col">
      <div class="p-3 border-b border-(--ui-border) shrink-0">
        <h4 class="text-xs font-semibold text-(--ui-text-highlighted) uppercase tracking-wide">
          Add Nodes
        </h4>
        <p class="text-[10px] text-(--ui-text-muted) mt-0.5">
          Click to add after the trigger
        </p>
      </div>
      <div class="p-2 space-y-3 overflow-y-auto flex-1">
        <div
          v-for="cat in NODE_TEMPLATES"
          :key="cat.category"
        >
          <p class="text-[10px] font-semibold text-(--ui-text-muted) uppercase tracking-wide px-1 mb-1">
            {{ cat.category }}
          </p>
          <div class="space-y-0.5">
            <button
              v-for="template in cat.nodes"
              :key="template.type"
              class="w-full flex items-start gap-2 px-2 py-1.5 rounded-md text-left hover:bg-(--ui-bg-elevated) transition-colors cursor-pointer"
              :title="template.description"
              @click="addNode(template)"
            >
              <UIcon
                :name="template.icon"
                class="size-4 shrink-0 text-(--ui-text-muted) mt-0.5"
              />
              <div class="flex-1 min-w-0">
                <p class="text-xs font-medium text-(--ui-text-highlighted) truncate">
                  {{ template.label }}
                </p>
                <p class="text-[10px] text-(--ui-text-muted) line-clamp-2 leading-tight mt-0.5">
                  {{ template.description }}
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Canvas -->
    <div class="flex-1 border border-(--ui-border) rounded-lg overflow-hidden relative bg-(--ui-bg-elevated)">
      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        :default-viewport="{ zoom: 0.85, x: 50, y: 50 }"
        :min-zoom="0.3"
        :max-zoom="2"
        :nodes-draggable="true"
        :nodes-connectable="true"
        :default-edge-options="{ type: 'default', animated: true }"
        fit-view-on-init
        class="h-full"
        @node-click="onNodeClick"
        @pane-click="onPaneClick"
      >
        <Background
          pattern-color="var(--ui-border)"
          :gap="20"
          :size="1"
        />
        <Controls
          :show-interactive="false"
          position="bottom-left"
        />

        <!-- Custom node template: renders our N8nFlowNode component -->
        <template #node-shopPlanrNode="{ id, data }">
          <N8nFlowNode
            :id="id"
            :data="data"
          />
        </template>
      </VueFlow>

      <!-- Legend overlay -->
      <div class="absolute top-2 right-2 bg-(--ui-bg)/90 backdrop-blur border border-(--ui-border) rounded-md px-2 py-1.5 text-[10px] flex items-center gap-3 pointer-events-none">
        <div class="flex items-center gap-1">
          <div class="size-2 rounded-full bg-violet-500" />
          <span>Trigger</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="size-2 rounded-full bg-emerald-500" />
          <span>Transform</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="size-2 rounded-full bg-amber-500" />
          <span>Control</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="size-2 rounded-full bg-blue-500" />
          <span>Destination</span>
        </div>
      </div>
    </div>

    <!-- Properties Panel (right sidebar) -->
    <div class="w-80 shrink-0 border border-(--ui-border) rounded-lg overflow-y-auto bg-(--ui-bg)">
      <div class="p-3 border-b border-(--ui-border) sticky top-0 bg-(--ui-bg) z-10">
        <h4 class="text-xs font-semibold text-(--ui-text-highlighted) uppercase tracking-wide">
          {{ selectedNode ? 'Node Properties' : 'Properties' }}
        </h4>
      </div>

      <div
        v-if="!selectedNode"
        class="p-4 text-center flex flex-col items-center gap-2"
      >
        <UIcon
          name="i-lucide-mouse-pointer-click"
          class="size-8 text-(--ui-text-dimmed)"
        />
        <p class="text-xs text-(--ui-text-muted)">
          Click a node on the canvas to edit its properties
        </p>
        <p class="text-[10px] text-(--ui-text-dimmed) mt-1">
          Drag from the <span class="inline-block size-2 rounded-full bg-violet-500 align-middle" /> handle to connect nodes
        </p>
      </div>

      <div
        v-else
        class="p-3"
      >
        <N8nNodeEditor
          :key="selectedNode.id"
          :node-data="{
            label: String(selectedNode.data?.label ?? ''),
            nodeType: String(selectedNode.data?.nodeType ?? ''),
            parameters: (selectedNode.data?.parameters as Record<string, unknown>) ?? {},
            typeVersion: Number(selectedNode.data?.typeVersion ?? 1),
            isTrigger: Boolean(selectedNode.data?.isTrigger),
          }"
          :variables="variables"
          :other-node-names="otherNodeNames"
          @update:node-data="handleNodeUpdate"
          @delete="deleteSelectedNode"
          @rename="handleRename"
        />
      </div>
    </div>
  </div>
</template>

<style>
/* Vue Flow theme overrides */
.vue-flow__edge-path {
  stroke: var(--ui-border);
  stroke-width: 2;
}

.vue-flow__edge.animated .vue-flow__edge-path {
  stroke: rgb(139 92 246);
  stroke-dasharray: 5;
  animation: dashdraw 0.5s linear infinite;
}

.vue-flow__edge.selected .vue-flow__edge-path {
  stroke: rgb(139 92 246);
  stroke-width: 3;
}

@keyframes dashdraw {
  to {
    stroke-dashoffset: -10;
  }
}

.vue-flow__handle {
  cursor: crosshair;
}

.vue-flow__handle:hover {
  transform: scale(1.3);
}

.vue-flow__controls {
  box-shadow: none;
}

.vue-flow__controls-button {
  background: var(--ui-bg);
  border-color: var(--ui-border);
  color: var(--ui-text-muted);
}

.vue-flow__controls-button:hover {
  background: var(--ui-bg-elevated);
}

.vue-flow__controls-button svg {
  fill: currentColor;
}
</style>
