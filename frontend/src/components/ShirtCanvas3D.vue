<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { OrbitControls, Environment } from '@tresjs/cientos'
import ShirtMesh from './ShirtMesh.vue'

const wrapperRef = ref<HTMLDivElement | null>(null)

function capturePreview(): string {
  const canvas = wrapperRef.value?.querySelector('canvas')
  if (!canvas) return ''
  return canvas.toDataURL('image/jpeg', 0.88)
}

const props = defineProps<{
  shirtType: string
  shirtColor: string
  isFullTexture: boolean
  fullDecalUrl: string | null
  stickers: Array<{ id: string; url: string; name: string; x: number; y: number; z: number; size: number; flipX: boolean; flipY: boolean; rotation: number; faceAngle: number }>
  selectedStickerId: string | null
}>()

// ── Camera presets ─────────────────────────────────────────────────────────
const VIEW_PRESETS: Record<string, [number, number, number]> = {
  front:        [0, 0, 2.5],
  threequarter: [1.6, 0.5, 1.8],
  side:         [2.4, 0, 0.4],
  back:         [0, 0, -2.5],
  top:          [0, 2.2, 0.3],
  // Vistas focadas em ombros — perfeito pra logo no peito e ombros
  'left-shoulder':  [-2.0, 0.4, 0.8],   // ombro esquerdo do cliente (= direita do espectador)
  'right-shoulder': [2.0, 0.4, 0.8],
}

// Posição reativa da câmera (animada via tween)
const cameraPos = ref<[number, number, number]>([0, 1.8, 4.5]) // posição inicial elevada+afastada
const currentView = ref('front')

// ── Easing ─────────────────────────────────────────────────────────────────
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

let activeTween: number | null = null
function animateCamera(target: [number, number, number], duration = 800) {
  if (activeTween) cancelAnimationFrame(activeTween)
  const start = [...cameraPos.value] as [number, number, number]
  const startTime = performance.now()
  const tick = (now: number) => {
    const t = Math.min(1, (now - startTime) / duration)
    const e = easeOutCubic(t)
    cameraPos.value = [
      start[0] + (target[0] - start[0]) * e,
      start[1] + (target[1] - start[1]) * e,
      start[2] + (target[2] - start[2]) * e,
    ]
    if (t < 1) activeTween = requestAnimationFrame(tick)
    else activeTween = null
  }
  activeTween = requestAnimationFrame(tick)
}

function goToView(name: keyof typeof VIEW_PRESETS) {
  const target = VIEW_PRESETS[name]
  if (!target) return
  currentView.value = name
  animateCamera(target, 700)
}

// ── Auto-rotate quando ocioso ──────────────────────────────────────────────
const userInteracting = ref(false)
const idleAutoRotate = ref(false)
let idleTimer: ReturnType<typeof setTimeout> | null = null
const IDLE_DELAY = 4000 // 4s sem interação ativa o auto-rotate

function resetIdleTimer() {
  idleAutoRotate.value = false
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    if (!props.selectedStickerId) idleAutoRotate.value = true
  }, IDLE_DELAY)
}

function onUserInteract() {
  userInteracting.value = true
  resetIdleTimer()
}

watch(() => props.selectedStickerId, (id) => {
  if (id) {
    idleAutoRotate.value = false
    if (idleTimer) clearTimeout(idleTimer)
  } else {
    resetIdleTimer()
  }
})

// Auto-rotate ativo só se: ocioso E nenhum sticker selecionado E nenhum tween ativo
const autoRotateActive = computed(() =>
  idleAutoRotate.value && !props.selectedStickerId,
)

// ── Transição suave de cor ─────────────────────────────────────────────────
const animatedColor = ref(props.shirtColor)
let colorTween: number | null = null

function lerpColor(from: string, to: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '')
    return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)]
  }
  const [r1, g1, b1] = parse(from)
  const [r2, g2, b2] = parse(to)
  const r = Math.round(r1! + (r2! - r1!) * t)
  const g = Math.round(g1! + (g2! - g1!) * t)
  const b = Math.round(b1! + (b2! - b1!) * t)
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

watch(() => props.shirtColor, (newColor, oldColor) => {
  if (!oldColor || newColor === oldColor) { animatedColor.value = newColor; return }
  if (colorTween) cancelAnimationFrame(colorTween)
  const from = animatedColor.value
  const startTime = performance.now()
  const duration = 300
  const tick = (now: number) => {
    const t = Math.min(1, (now - startTime) / duration)
    const e = easeOutCubic(t)
    animatedColor.value = lerpColor(from, newColor, e)
    if (t < 1) colorTween = requestAnimationFrame(tick)
    else colorTween = null
  }
  colorTween = requestAnimationFrame(tick)
})

// ── Mount: animação de entrada ─────────────────────────────────────────────
onMounted(() => {
  setTimeout(() => animateCamera([0, 0, 2.5], 1100), 100)
  resetIdleTimer()
})

defineExpose({ capturePreview, goToView })
</script>

<template>
  <div ref="wrapperRef" class="w-full h-full relative"
       @mousedown="onUserInteract" @touchstart="onUserInteract"
       @wheel="onUserInteract">
  <TresCanvas
    class="w-full h-full"
    :clear-color="'#2d2d2d'"
    :alpha="false"
    :preserve-drawing-buffer="true"
  >
    <!-- Camera (posição reativa pra animação) -->
    <TresPerspectiveCamera
      :position="cameraPos"
      :fov="25"
      :near="0.1"
      :far="100"
    />

    <!-- Controls com inércia + auto-rotate apenas no modo ocioso -->
    <OrbitControls
      :enable-zoom="true"
      :enable-pan="false"
      :enable-damping="true"
      :damping-factor="0.08"
      :auto-rotate="autoRotateActive"
      :auto-rotate-speed="0.6"
      :min-polar-angle="Math.PI / 4"
      :max-polar-angle="Math.PI * 0.65"
    />

    <!-- Lighting -->
    <TresAmbientLight :intensity="0.6" />
    <TresDirectionalLight :position="[5, 5, 5]" :intensity="1.2" :cast-shadow="true" />
    <TresDirectionalLight :position="[-3, 3, -3]" :intensity="0.4" />

    <!-- Environment (HDR lighting) -->
    <Suspense>
      <Environment preset="city" />
    </Suspense>

    <!-- 3D Shirt model (cor com lerp animado) -->
    <Suspense>
      <ShirtMesh
        :shirt-type="props.shirtType"
        :shirt-color="animatedColor"
        :is-full-texture="props.isFullTexture"
        :full-decal-url="props.fullDecalUrl"
        :stickers="props.stickers"
      />
    </Suspense>
  </TresCanvas>

  <!-- ── Camera preset pills (canto superior-direito do canvas) ── -->
  <div class="absolute top-3 right-3 flex gap-1 px-1.5 py-1 bg-white/10 backdrop-blur-md border border-white/15 rounded-full text-[10px] font-medium pointer-events-auto">
    <button v-for="v in [
      { k: 'front', l: 'Frente' },
      { k: 'threequarter', l: '3/4' },
      { k: 'side', l: 'Lado' },
      { k: 'back', l: 'Costas' },
      { k: 'top', l: 'Topo' },
    ]" :key="v.k" type="button"
      @click="goToView(v.k as any)"
      :class="['px-2.5 py-1 rounded-full transition-colors',
        currentView === v.k ? 'bg-white text-slate-900' : 'text-white/80 hover:bg-white/15']">
      {{ v.l }}
    </button>
  </div>

  <!-- Indicador de auto-rotate (canto inferior-esquerdo) -->
  <Transition
    enter-active-class="transition-opacity duration-300"
    leave-active-class="transition-opacity duration-300"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div v-if="autoRotateActive" class="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-md border border-white/15 rounded-full text-[10px] text-white/80 pointer-events-none">
      <svg class="w-3 h-3 animate-spin" style="animation-duration: 3s" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
      Auto-rotate
    </div>
  </Transition>
  </div>
</template>
