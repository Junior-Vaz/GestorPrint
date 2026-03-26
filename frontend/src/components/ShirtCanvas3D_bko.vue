<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import { OrbitControls, Environment } from '@tresjs/cientos'
import ShirtMesh from './ShirtMesh.vue'

defineProps<{
  logoUrl: string | null
  shirtColor: string
  isLogoTexture: boolean
  isFullTexture: boolean
  fullDecalUrl: string | null
}>()
</script>

<template>
  <TresCanvas
    class="w-full h-full"
    :clear-color="'#2d2d2d'"
    :alpha="false"
  >
    <!-- Camera -->
    <TresPerspectiveCamera
      :position="[0, 0, 2.5]"
      :fov="25"
      :near="0.1"
      :far="100"
    />

    <!-- Controls -->
    <OrbitControls
      :enable-zoom="false"
      :enable-pan="false"
      :auto-rotate="true"
      :auto-rotate-speed="1.2"
      :min-polar-angle="Math.PI / 4"
      :max-polar-angle="Math.PI * 0.65"
    />

    <!-- Lighting -->
    <TresAmbientLight :intensity="0.6" />
    <TresDirectionalLight :position="[5, 5, 5]" :intensity="1.2" :cast-shadow="true" />
    <TresDirectionalLight :position="[-3, 3, -3]" :intensity="0.4" />

    <!-- Environment (HDR lighting) — async, needs own Suspense -->
    <Suspense>
      <Environment preset="city" />
    </Suspense>

    <!-- 3D Shirt model — async, wrapped in Suspense -->
    <Suspense>
      <ShirtMesh
        :logo-url="logoUrl"
        :shirt-color="shirtColor"
        :is-logo-texture="isLogoTexture"
        :is-full-texture="isFullTexture"
        :full-decal-url="fullDecalUrl"
      />
    </Suspense>
  </TresCanvas>
</template>
