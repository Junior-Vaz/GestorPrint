<script setup lang="ts">
import { ref, shallowRef, computed, watch, onUnmounted } from 'vue'
import { useGLTF } from '@tresjs/cientos'
import * as THREE from 'three'

const props = defineProps<{
  /** Largura da lona em metros */
  widthM: number
  /** Altura da lona em metros */
  heightM: number
  /** Cor de fundo do tecido (sobrepõe o albedo quando não há arte) */
  bgColor: string
  /** URL da arte do cliente (data URL ou /api/files/...) — projetada na frente da lona */
  artUrl: string | null
  /** Acabamento — define se renderiza ilhós (esferas escuras nos cantos) */
  finishing: 'none' | 'hem' | 'grommet' | 'tape'
  /** Modo de ajuste da arte: 'cover' = cobre tudo (corta excesso), 'contain' = encaixa toda (com margens), 'stretch' = estica (default) */
  artFit?: 'cover' | 'contain' | 'stretch'
  /** Escala da arte (1 = 100%) */
  artScale?: number
  /** Deslocamento da arte no eixo X (-1 a 1, em fração da lona) */
  artOffsetX?: number
  /** Deslocamento da arte no eixo Y (-1 a 1, em fração da lona) */
  artOffsetY?: number
  /** Rotação da arte em radianos */
  artRotation?: number
  /** Espelhar arte horizontalmente */
  artFlipX?: boolean
  /** Espelhar arte verticalmente */
  artFlipY?: boolean
  /** Intensidade da iluminação ambiente (afeta brilho geral do tecido) */
  lightIntensity?: number
}>()

// ── Carrega o GLB ─────────────────────────────────────────────────────────────
const { nodes, materials, execute } = useGLTF('/models3D/banner.glb', { draco: false })
await execute()

const matsVal = (materials.value ?? {}) as Record<string, THREE.Material>
const nodesVal = (nodes.value ?? {}) as Record<string, THREE.Object3D>

const baseMat = (Object.values(matsVal)[0]) as THREE.MeshStandardMaterial | undefined
if (!baseMat) throw new Error('banner.glb: no materials found')

// Clona o material pra não alterar o original (singleton do GLB)
const fabricMat = ref<THREE.MeshStandardMaterial>(baseMat.clone())
fabricMat.value.roughness = 0.85
fabricMat.value.metalness = 0

// Carrega normalMap e roughnessMap como assets separados (lazy)
const texLoader = new THREE.TextureLoader()
texLoader.loadAsync('/models3D/banner-normal.webp').then(tex => {
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.NoColorSpace
  fabricMat.value.normalMap = tex
  fabricMat.value.normalScale = new THREE.Vector2(0.5, 0.5)
  fabricMat.value.needsUpdate = true
}).catch(() => {})

texLoader.loadAsync('/models3D/banner-roughness.webp').then(tex => {
  tex.colorSpace = THREE.NoColorSpace
  fabricMat.value.roughnessMap = tex
  fabricMat.value.needsUpdate = true
}).catch(() => {})

// Cor de fundo reativa — multiplica o albedo
watch(() => props.bgColor, (hex) => {
  fabricMat.value.color.set(hex)
  fabricMat.value.needsUpdate = true
}, { immediate: true })

// Pega o mesh principal do GLB
const bannerNode = (Object.values(nodesVal).find(n => (n as THREE.Mesh).isMesh)) as THREE.Mesh
if (!bannerNode) throw new Error('banner.glb: no Mesh node found')
const bannerGeometry = computed(() => bannerNode.geometry)

// ── Escala dinâmica baseada nas dimensões reais ───────────────────────────────
// O modelo original tem ~1.303 × 0.876m (proporção 3:2). Escalamos pra bater
// com width×height passados pelo usuário.
const ORIGINAL_WIDTH  = 1.303
const ORIGINAL_HEIGHT = 0.876
const meshScale = computed<[number, number, number]>(() => {
  const sx = (props.widthM || 1) / ORIGINAL_WIDTH
  const sy = (props.heightM || 1) / ORIGINAL_HEIGHT
  // Z mantém escala 1 — relevo do tecido inalterado
  return [sx, sy, 1]
})

// ── Decal de arte do cliente ──────────────────────────────────────────────────
const artTexture = shallowRef<THREE.Texture | null>(null)
const artImageAspect = ref<number>(1) // proporção natural da imagem (w/h)

watch(() => props.artUrl, async (url) => {
  if (artTexture.value) { artTexture.value.dispose(); artTexture.value = null }
  if (!url) return
  try {
    const tex = await new THREE.TextureLoader().loadAsync(url)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.flipY = false
    tex.anisotropy = 16
    tex.needsUpdate = true
    if (tex.image && tex.image.width && tex.image.height) {
      artImageAspect.value = tex.image.width / tex.image.height
    }
    artTexture.value = tex
  } catch (e) {
    console.error('[BannerMesh] failed to load art texture:', e)
  }
}, { immediate: true })

// Aplica fit/flip/rotation diretamente nas UVs da textura (mais barato que reconstruir geometria)
watch(
  [
    artTexture,
    () => props.artFit,
    () => props.artFlipX,
    () => props.artFlipY,
    () => props.artRotation,
    () => props.widthM,
    () => props.heightM,
  ],
  () => {
    const tex = artTexture.value
    if (!tex) return
    const fit = props.artFit ?? 'stretch'
    const lonaAspect = (props.widthM || ORIGINAL_WIDTH) / (props.heightM || ORIGINAL_HEIGHT)
    let repeatX = 1, repeatY = 1, offsetX = 0, offsetY = 0
    if (fit !== 'stretch') {
      // Calcula repeat/offset pra manter proporção
      const ratio = artImageAspect.value / lonaAspect
      if (fit === 'cover') {
        if (ratio > 1) { repeatX = 1 / ratio; offsetX = (1 - repeatX) / 2 }
        else          { repeatY = ratio;     offsetY = (1 - repeatY) / 2 }
      } else if (fit === 'contain') {
        // contain: textura "encolhe" pra caber inteira → vamos usar geometria por baixo
        // Implementado via plane geometry com proporção da imagem
        if (ratio > 1) { repeatY = ratio;     offsetY = (1 - repeatY) / 2 }
        else          { repeatX = 1 / ratio; offsetX = (1 - repeatX) / 2 }
      }
    }
    if (props.artFlipX) { repeatX = -repeatX; offsetX = 1 - offsetX }
    if (props.artFlipY) { repeatY = -repeatY; offsetY = 1 - offsetY }
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    tex.repeat.set(repeatX, repeatY)
    tex.offset.set(offsetX, offsetY)
    tex.center.set(0.5, 0.5)
    tex.rotation = props.artRotation ?? 0
    tex.needsUpdate = true
  },
  { immediate: true },
)

// Geometria de plano simples na frente da lona (cobre toda a área visível)
const artGeometry = computed(() => {
  // Plano com mesma proporção do banner original — escala segue o mesh pai
  return new THREE.PlaneGeometry(ORIGINAL_WIDTH, ORIGINAL_HEIGHT)
})

// Posição/escala do decal — controlados via props (offset + scale)
const artScale = computed(() => {
  const s = props.artScale ?? 1
  return [s, s, 1] as [number, number, number]
})

const artPosition = computed<[number, number, number]>(() => {
  // Y centralizado no meio da lona; offsets em fração da dimensão
  const ox = (props.artOffsetX ?? 0) * ORIGINAL_WIDTH
  const oy = (props.artOffsetY ?? 0) * ORIGINAL_HEIGHT
  return [ox, ORIGINAL_HEIGHT / 2 + oy, 0.018]
})

const artMaterial = computed(() => {
  if (!artTexture.value) return null
  return new THREE.MeshBasicMaterial({
    map: artTexture.value,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
  })
})

// ── Acabamento: ilhós (4 esferinhas pretas nos cantos) ────────────────────────
// Só aparece quando finishing === 'grommet'
const grommetGeo = new THREE.SphereGeometry(0.025, 12, 12)
const grommetMat = new THREE.MeshStandardMaterial({
  color: '#1a1a1a', metalness: 0.7, roughness: 0.3,
})

// Posições dos 4 ilhós (cantos da lona, em coordenadas locais do modelo original)
const GROMMET_POSITIONS: [number, number, number][] = [
  [-0.62,  0.83, 0.01], // top-left
  [ 0.62,  0.83, 0.01], // top-right
  [-0.62,  0.05, 0.01], // bottom-left
  [ 0.62,  0.05, 0.01], // bottom-right
]

// ── Cleanup ───────────────────────────────────────────────────────────────────
onUnmounted(() => {
  artTexture.value?.dispose()
  fabricMat.value.normalMap?.dispose()
  fabricMat.value.roughnessMap?.dispose()
  fabricMat.value.dispose()
  grommetGeo.dispose()
  grommetMat.dispose()
})
</script>

<template>
  <!-- Lona principal — escala em X/Y conforme dimensões reais -->
  <TresGroup :scale="meshScale">
    <TresMesh
      :geometry="bannerGeometry"
      :material="fabricMat"
      :cast-shadow="true"
      :receive-shadow="true"
    />

    <!-- Arte do cliente projetada na frente -->
    <TresMesh
      v-if="artMaterial"
      :geometry="artGeometry"
      :material="artMaterial"
      :position="artPosition"
      :scale="artScale"
      :render-order="1"
    />

    <!-- Ilhós nos cantos quando o acabamento é 'grommet' -->
    <template v-if="finishing === 'grommet'">
      <TresMesh
        v-for="(pos, i) in GROMMET_POSITIONS"
        :key="`g-${i}`"
        :geometry="grommetGeo"
        :material="grommetMat"
        :position="pos"
      />
    </template>
  </TresGroup>
</template>
