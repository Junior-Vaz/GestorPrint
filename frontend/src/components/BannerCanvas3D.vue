<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { OrbitControls, Environment } from '@tresjs/cientos'
import BannerMesh from './BannerMesh.vue'

const wrapperRef = ref<HTMLDivElement | null>(null)

function capturePreview(): string {
  const canvas = wrapperRef.value?.querySelector('canvas')
  if (!canvas) return ''
  return canvas.toDataURL('image/jpeg', 0.88)
}

const props = defineProps<{
  widthM: number
  heightM: number
  bgColor: string
  artUrl: string | null
  finishing: 'none' | 'hem' | 'grommet' | 'tape'
  artFit?: 'cover' | 'contain' | 'stretch'
  artScale?: number
  artOffsetX?: number
  artOffsetY?: number
  artRotation?: number
  artFlipX?: boolean
  artFlipY?: boolean
  lightIntensity?: number
}>()

// ── Camera presets ────────────────────────────────────────────────────────────
// Lona é plana (eixo Y=altura, X=largura, Z=profundidade ~zero).
// Posicionamos a câmera de forma que ela enquadre tanto banners pequenos quanto
// grandes — usamos "diag" baseado em widthM/heightM pra distância adaptativa.
const VIEW_PRESETS: Record<string, [number, number, number]> = {
  front:        [0, 0.6, 2.2],   // de frente, ligeiramente acima do centro
  threequarter: [1.3, 0.7, 1.7], // 3/4 (canto)
  side:         [2.0, 0.6, 0.3], // de perfil
  closeup:      [0, 0.5, 1.2],   // mais perto pra ver detalhe da arte
  wide:         [0, 1.0, 3.5],   // afastada — mostra ambiente
}

const cameraPos = ref<[number, number, number]>([0, 1.2, 4.5])
const currentView = ref('front')

// Distância adaptativa: lona maior precisa de câmera mais afastada
const adaptiveDistance = computed(() => {
  const maxDim = Math.max(props.widthM || 1, props.heightM || 1)
  return Math.max(1.5, maxDim * 1.4) // mínimo 1.5m, escala com o maior lado
})

// ── Easing ────────────────────────────────────────────────────────────────────
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

let activeTween: number | null = null
function animateCamera(target: [number, number, number], duration = 700) {
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
  const preset = VIEW_PRESETS[name]
  if (!preset) return
  currentView.value = name as string
  // Ajusta a distância pelo tamanho real da lona
  const scale = adaptiveDistance.value
  animateCamera([preset[0] * scale * 0.5, preset[1], preset[2] * scale * 0.5], 700)
}

// ── Auto-rotate manual (toggle pelo usuário) ──────────────────────────────────
const autoRotate = ref(false)
function toggleAutoRotate() { autoRotate.value = !autoRotate.value }
// stub mantido pra compatibilidade com handlers existentes
function onUserInteract() {}
function resetIdleTimer() {}

// Quando dimensões mudam, reposiciona a câmera pra acompanhar
watch([() => props.widthM, () => props.heightM], () => {
  goToView(currentView.value as any)
})

// ── Mount: animação de entrada ────────────────────────────────────────────────
onMounted(() => {
  setTimeout(() => goToView('front'), 100)
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
      <!-- Camera -->
      <TresPerspectiveCamera
        :position="cameraPos"
        :fov="32"
        :near="0.1"
        :far="100"
      />

      <!-- Controls com inércia + auto-rotate apenas no modo ocioso -->
      <OrbitControls
        :enable-zoom="true"
        :enable-pan="false"
        :enable-damping="true"
        :damping-factor="0.08"
        :auto-rotate="autoRotate"
        :auto-rotate-speed="0.7"
        :min-polar-angle="Math.PI / 5"
        :max-polar-angle="Math.PI * 0.6"
        :target="[0, props.heightM / 2, 0]"
      />

      <!-- Lighting: cima + lateral pra dar volume na textura do tecido -->
      <TresAmbientLight :intensity="0.55 * (props.lightIntensity ?? 1)" />
      <TresDirectionalLight :position="[3, 4, 5]" :intensity="1.1 * (props.lightIntensity ?? 1)" :cast-shadow="true" />
      <TresDirectionalLight :position="[-2, 3, -2]" :intensity="0.35 * (props.lightIntensity ?? 1)" />

      <!-- Environment HDR -->
      <Suspense>
        <Environment preset="city" />
      </Suspense>

      <!-- Banner mesh -->
      <Suspense>
        <BannerMesh
          :width-m="props.widthM"
          :height-m="props.heightM"
          :bg-color="props.bgColor"
          :art-url="props.artUrl"
          :finishing="props.finishing"
          :art-fit="props.artFit"
          :art-scale="props.artScale"
          :art-offset-x="props.artOffsetX"
          :art-offset-y="props.artOffsetY"
          :art-rotation="props.artRotation"
          :art-flip-x="props.artFlipX"
          :art-flip-y="props.artFlipY"
        />
      </Suspense>
    </TresCanvas>

    <!-- ── Camera preset pills + auto-rotate toggle (canto superior-direito) ── -->
    <div class="absolute top-3 right-3 z-30 flex gap-1 px-1.5 py-1 bg-white/10 backdrop-blur-md border border-white/15 rounded-full text-[10px] font-medium pointer-events-auto">
      <button v-for="v in [
        { k: 'front', l: 'Frente' },
        { k: 'threequarter', l: '3/4' },
        { k: 'side', l: 'Lado' },
        { k: 'closeup', l: 'Zoom' },
        { k: 'wide', l: 'Afastar' },
      ]" :key="v.k" type="button"
        @click="goToView(v.k as any)"
        :class="['px-2.5 py-1 rounded-full transition-colors',
          currentView === v.k ? 'bg-white text-slate-900' : 'text-white/80 hover:bg-white/15']">
        {{ v.l }}
      </button>
      <!-- Divider -->
      <div class="w-px bg-white/15 mx-0.5"></div>
      <!-- Auto-rotate toggle -->
      <button type="button" @click="toggleAutoRotate"
        :class="['px-2.5 py-1 rounded-full transition-colors flex items-center gap-1',
          autoRotate ? 'bg-white text-slate-900' : 'text-white/80 hover:bg-white/15']"
        :title="autoRotate ? 'Parar rotação automática' : 'Iniciar rotação automática'">
        <svg :class="['w-3 h-3', autoRotate ? 'animate-spin' : '']" :style="autoRotate ? 'animation-duration: 3s' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        {{ autoRotate ? 'Parar' : 'Auto' }}
      </button>
    </div>

    <!-- Indicador de dimensões (top-center, longe dos cards laterais) -->
    <div class="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 bg-white/10 backdrop-blur-md border border-white/15 rounded-full text-[10px] font-mono text-white/80 pointer-events-none">
      {{ widthM.toFixed(2) }}m × {{ heightM.toFixed(2) }}m
    </div>
  </div>
</template>
