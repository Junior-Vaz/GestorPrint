<script setup lang="ts">
import { ref, shallowRef, computed, watch, onUnmounted } from 'vue'
import { useGLTF } from '@tresjs/cientos'
import * as THREE from 'three'
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js'

const props = defineProps<{
  shirtType: string
  shirtColor: string
  isFullTexture: boolean
  fullDecalUrl: string | null
  stickers: Array<{ id: string; url: string; name: string; x: number; y: number; z: number; size: number; flipX: boolean; flipY: boolean; rotation: number; faceAngle: number }>
}>()

// ── Load GLTF ────────────────────────────────────────────────────────────────
const { nodes, materials, execute } = useGLTF('/models3D/tshirt.glb', { draco: false })
await execute()

const matsVal = (materials.value ?? {}) as Record<string, THREE.Material>
const nodesVal = (nodes.value ?? {}) as Record<string, THREE.Object3D>

const rawMat = (matsVal['lambert1'] ?? Object.values(matsVal)[0]) as THREE.MeshStandardMaterial
if (!rawMat) throw new Error('tshirt.glb: no materials found')

const mat = ref<THREE.MeshStandardMaterial>(rawMat.clone())
mat.value.roughness = 1

watch(
  () => props.shirtColor,
  (hex) => { mat.value.color.set(hex); mat.value.needsUpdate = true },
  { immediate: true },
)

const shirtNode = (
  nodesVal['T_Shirt_male'] ?? Object.values(nodesVal).find(n => (n as THREE.Mesh).isMesh)
) as THREE.Mesh
if (!shirtNode) throw new Error('tshirt.glb: no Mesh node found')

const shirtGeometry = computed(() => shirtNode.geometry)

// ── Full fill decal ──────────────────────────────────────────────────────────
const fullTexture = shallowRef<THREE.Texture | null>(null)

watch(
  () => props.fullDecalUrl,
  async (url) => {
    if (fullTexture.value) { fullTexture.value.dispose(); fullTexture.value = null }
    if (!url) return
    try {
      const tex = await new THREE.TextureLoader().loadAsync(url)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.flipY = false
      tex.needsUpdate = true
      fullTexture.value = tex
    } catch (e) {
      console.error('[ShirtMesh] failed to load full texture:', e)
    }
  },
  { immediate: true },
)

const fullDecalGeo = computed(() => {
  if (!props.isFullTexture || !fullTexture.value) return null
  return new DecalGeometry(shirtNode, new THREE.Vector3(0, 0, 0), new THREE.Euler(), new THREE.Vector3(1, 1, 1))
})

const fullDecalMat = computed(() => {
  if (!fullTexture.value) return null
  return new THREE.MeshBasicMaterial({
    map: fullTexture.value,
    transparent: true,
    depthTest: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
  })
})

// ── Sticker system ───────────────────────────────────────────────────────────
const stickerTextures = shallowRef(new Map<string, THREE.Texture>())

async function loadStickerTexture(id: string, url: string) {
  try {
    const tex = await new THREE.TextureLoader().loadAsync(url)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.flipY = false
    tex.anisotropy = 16
    tex.needsUpdate = true
    const next = new Map(stickerTextures.value)
    next.set(id, tex)
    stickerTextures.value = next
  } catch (e) {
    console.error('[ShirtMesh] failed to load sticker texture:', e)
  }
}

watch(
  () => props.stickers.map(s => s.id).join('|'),
  () => {
    const currentIds = new Set(props.stickers.map(s => s.id))
    for (const s of props.stickers) {
      if (!stickerTextures.value.has(s.id)) loadStickerTexture(s.id, s.url)
    }
    let changed = false
    const next = new Map(stickerTextures.value)
    for (const id of next.keys()) {
      if (!currentIds.has(id)) { next.get(id)?.dispose(); next.delete(id); changed = true }
    }
    if (changed) stickerTextures.value = next
  },
  { immediate: true },
)

const stickerDecals = computed(() => {
  const texMap = stickerTextures.value
  return props.stickers.flatMap(s => {
    const tex = texMap.get(s.id)
    if (!tex) return []
    let map = tex
    if (s.flipX || s.flipY) {
      map = tex.clone()
      map.wrapS = THREE.RepeatWrapping
      map.wrapT = THREE.RepeatWrapping
      map.repeat.set(s.flipX ? -1 : 1, s.flipY ? -1 : 1)
      map.offset.set(s.flipX ? 1 : 0, s.flipY ? 1 : 0)
      map.needsUpdate = true
    }
    return [{
      id: s.id,
      geo: new DecalGeometry(
        shirtNode,
        new THREE.Vector3(s.x, s.y, s.z),
        new THREE.Euler(0, s.faceAngle, s.rotation),
        new THREE.Vector3(s.size, s.size, s.size),
      ),
      mat: new THREE.MeshBasicMaterial({
        map, transparent: true, depthTest: false, depthWrite: true,
        polygonOffset: true, polygonOffsetFactor: -4,
      }),
    }]
  })
})

onUnmounted(() => {
  for (const tex of stickerTextures.value.values()) tex.dispose()
  fullTexture.value?.dispose()
})
</script>

<template>
  <TresMesh :geometry="shirtGeometry" :material="mat" :cast-shadow="true" />

  <TresMesh
    v-if="isFullTexture && fullDecalGeo && fullDecalMat"
    :geometry="fullDecalGeo"
    :material="fullDecalMat"
    :render-order="1"
  />

  <TresMesh
    v-for="d in stickerDecals"
    :key="d.id"
    :geometry="d.geo"
    :material="d.mat"
    :render-order="2"
  />
</template>
