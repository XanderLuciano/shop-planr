<script setup lang="ts">
const emit = defineEmits<{
  scanned: [value: string]
  close: []
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const stream = ref<MediaStream | null>(null)
const errorMessage = ref<string | null>(null)
const scanning = ref(false)
let animationFrameId: number | null = null

const hasBarcodeDetector = typeof (globalThis as any).BarcodeDetector !== 'undefined'

async function startCamera() {
  errorMessage.value = null
  try {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    })
    stream.value = mediaStream
    if (videoRef.value) {
      videoRef.value.srcObject = mediaStream
      await videoRef.value.play()
      scanning.value = true
      if (hasBarcodeDetector) {
        detectLoop()
      } else {
        errorMessage.value = 'BarcodeDetector API not available in this browser. Use Chrome or Edge for camera scanning.'
        scanning.value = false
      }
    }
  } catch (err: any) {
    if (err.name === 'NotAllowedError') {
      errorMessage.value = 'Camera permission denied. Please allow camera access and try again.'
    } else if (err.name === 'NotFoundError') {
      errorMessage.value = 'No camera found on this device.'
    } else {
      errorMessage.value = `Camera error: ${err.message || 'Unknown error'}`
    }
  }
}

function detectLoop() {
  if (!scanning.value || !videoRef.value) return

  const detector = new (globalThis as any).BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8'] })

  async function tick() {
    if (!scanning.value || !videoRef.value) return
    try {
      const barcodes = await detector.detect(videoRef.value)
      if (barcodes.length > 0) {
        const value = barcodes[0].rawValue
        if (value) {
          stopCamera()
          emit('scanned', value)
          return
        }
      }
    } catch {
      // Detection can fail on some frames — just continue
    }
    animationFrameId = requestAnimationFrame(tick)
  }

  animationFrameId = requestAnimationFrame(tick)
}

function stopCamera() {
  scanning.value = false
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop())
    stream.value = null
  }
}

function handleClose() {
  stopCamera()
  emit('close')
}

onMounted(() => {
  startCamera()
})

onUnmounted(() => {
  stopCamera()
})
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
    @click.self="handleClose"
  >
    <div class="relative bg-(--ui-bg) rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
      <div class="flex items-center justify-between px-4 py-2 border-b border-(--ui-border)">
        <span class="text-sm font-medium">Scan QR / Barcode</span>
        <UButton
          icon="i-lucide-x"
          size="xs"
          variant="ghost"
          color="neutral"
          aria-label="Close scanner"
          @click="handleClose"
        />
      </div>

      <div class="relative aspect-square bg-black">
        <video
          ref="videoRef"
          class="w-full h-full object-cover"
          autoplay
          playsinline
          muted
        />
        <!-- Scanning overlay guide -->
        <div
          v-if="scanning"
          class="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div class="w-48 h-48 border-2 border-white/60 rounded-lg" />
        </div>
      </div>

      <div
        v-if="errorMessage"
        class="px-4 py-3"
      >
        <UAlert
          color="error"
          variant="subtle"
          :title="errorMessage"
          icon="i-lucide-alert-circle"
        />
      </div>

      <div class="px-4 py-2 text-center text-xs text-(--ui-text-muted)">
        Point camera at a QR code or barcode
      </div>
    </div>
  </div>
</template>
