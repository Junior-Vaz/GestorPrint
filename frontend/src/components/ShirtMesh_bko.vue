<script setup lang="ts">
import { ref, shallowRef, computed, watch } from 'vue'
import { useGLTF } from '@tresjs/cientos'
import * as THREE from 'three'
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js'

const props = defineProps<{
  logoUrl: string | null
  shirtColor: string
  isLogoTexture: boolean
  isFullTexture: boolean
  fullDecalUrl: string | null
}>()

// useGLTF v5: synchronous — returns ComputedRefs + execute() to trigger async load
const { nodes, materials, execute } = useGLTF('/shirt_baked.glb', { draco: false })
await execute()

const matsVal = (materials.value ?? {}) as Record<string, THREE.Material>
const nodesVal = (nodes.value ?? {}) as Record<string, THREE.Object3D>

// Defensive material lookup — try lambert1 first, then first available
const rawMat = (matsVal['lambert1'] ?? Object.values(matsVal)[0]) as THREE.MeshStandardMaterial
if (!rawMat) throw new Error('shirt_baked.glb: no materials found')

// Reactive material — clone once and update color reactively
const mat = ref<THREE.MeshStandardMaterial>(rawMat.clone())
mat.value.roughness = 1

watch(() => props.shirtColor, (hex) => {
  mat.value.color.set(hex)
  mat.value.needsUpdate = true
}, { immediate: true })

// Defensive node lookup — try T_Shirt_male first, then first Mesh
const shirtNode = (nodesVal['T_Shirt_male'] ?? Object.values(nodesVal).find(n => (n as THREE.Mesh).isMesh)) as THREE.Mesh
if (!shirtNode) throw new Error('shirt_baked.glb: no Mesh node found')

const shirtGeometry = computed(() => shirtNode.geometry)

// ── Logo decal (chest area) ───────────────────────────────────────────────────
// shallowRef is required — Three.js Texture is a complex object, deep ref breaks reactivity
const logoTexture = shallowRef<THREE.Texture | null>(null)

watch(() => props.logoUrl, async (url) => {
  if (logoTexture.value) {
    logoTexture.value.dispose()
    logoTexture.value = null
  }
  if (!url) return
  try {
    const loader = new THREE.TextureLoader()
    const tex = await loader.loadAsync(url)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.flipY = false
    tex.anisotropy = 16
    tex.needsUpdate = true
    logoTexture.value = tex
  } catch (e) {
    console.error('[ShirtMesh] failed to load logo texture:', e)
  }
}, { immediate: true })

const logoDecalGeo = computed(() => {
  if (!props.isLogoTexture || !logoTexture.value) return null
  return new DecalGeometry(
    shirtNode,
    new THREE.Vector3(0, 0.04, 0.15),
    new THREE.Euler(0, 0, 0),
    new THREE.Vector3(0.15, 0.15, 0.15),
  )
})

const logoDecalMat = computed(() => {
  if (!logoTexture.value) return null
  return new THREE.MeshBasicMaterial({
    map: logoTexture.value,
    transparent: true,
    depthTest: false,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -4,
  })
})

// ── Full fill decal (entire shirt) ────────────────────────────────────────────
const fullTexture = shallowRef<THREE.Texture | null>(null)

watch(() => props.fullDecalUrl, async (url) => {
  if (fullTexture.value) {
    fullTexture.value.dispose()
    fullTexture.value = null
  }
  if (!url) return
  try {
    const loader = new THREE.TextureLoader()
    const tex = await loader.loadAsync(url)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.flipY = false
    tex.needsUpdate = true
    fullTexture.value = tex
  } catch (e) {
    console.error('[ShirtMesh] failed to load full texture:', e)
  }
}, { immediate: true })

const fullDecalGeo = computed(() => {
  if (!props.isFullTexture || !fullTexture.value) return null
  return new DecalGeometry(
    shirtNode,
    new THREE.Vector3(0, 0, 0),
    new THREE.Euler(0, 0, 0),
    new THREE.Vector3(1, 1, 1),
  )
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
</script>

<template>
  <!-- Shirt body -->
  <TresMesh :geometry="shirtGeometry" :material="mat" :cast-shadow="true" />

  <!-- Full fill decal — covers entire shirt surface -->
  <TresMesh
    v-if="isFullTexture && fullDecalGeo && fullDecalMat"
    :geometry="fullDecalGeo"
    :material="fullDecalMat"
    :render-order="1"
  />

  <!-- Logo chest decal — projected onto shirt surface -->
  <TresMesh
    v-if="isLogoTexture && logoDecalGeo && logoDecalMat"
    :geometry="logoDecalGeo"
    :material="logoDecalMat"
    :render-order="2"
  />
</template>
