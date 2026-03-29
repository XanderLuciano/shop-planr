<script setup lang="ts">
type ScanResult = { value: string; type: 'part' | 'certificate' | 'unknown' }

const props = withDefaults(
  defineProps<{
    placeholder?: string
  }>(),
  {
    placeholder: 'Scan or type Part / Cert...',
  }
)

const emit = defineEmits<{
  scanned: [result: ScanResult]
  cameraClick: []
}>()

const { barcodeInputRef } = useBarcode()

const showQRScanner = ref(false)

function openQRScanner() {
  showQRScanner.value = true
  emit('cameraClick')
}

function handleQRScanned(value: string) {
  showQRScanner.value = false
  emit('scanned', { value, type: detectScanType(value) })
}

function closeQRScanner() {
  showQRScanner.value = false
}

const inputValue = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function handleSubmit() {
  const trimmed = inputValue.value.trim()
  if (!trimmed) return

  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  emit('scanned', { value: trimmed, type: detectScanType(trimmed) })
  inputValue.value = ''
}

function handleInput() {
  // Debounce for scanner input — scanners type fast then stop
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    const trimmed = inputValue.value.trim()
    if (trimmed) {
      emit('scanned', { value: trimmed, type: detectScanType(trimmed) })
      inputValue.value = ''
    }
  }, 500)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    handleSubmit()
  }
}

// Expose the input ref so the composable's global hotkey can focus it
function setInputRef(el: any) {
  // UInput renders an <input> inside — grab the actual element
  if (el?.$el) {
    barcodeInputRef.value = el.$el.querySelector('input') ?? el.$el
  } else {
    barcodeInputRef.value = el
  }
}
</script>

<template>
  <div class="flex items-center gap-1">
    <UInput
      :ref="setInputRef"
      v-model="inputValue"
      :placeholder="props.placeholder"
      icon="i-lucide-scan-barcode"
      size="sm"
      class="w-56"
      @input="handleInput"
      @keydown="handleKeydown"
    />
    <UButton
      icon="i-lucide-camera"
      size="sm"
      variant="ghost"
      color="neutral"
      aria-label="Scan QR code with camera"
      @click="openQRScanner"
    />

    <QRScanner v-if="showQRScanner" @scanned="handleQRScanned" @close="closeQRScanner" />
  </div>
</template>
