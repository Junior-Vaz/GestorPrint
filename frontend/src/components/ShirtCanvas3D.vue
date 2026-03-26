<script setup lang="ts">
import { ref } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { OrbitControls, Environment } from '@tresjs/cientos'
import ShirtMesh from './ShirtMesh.vue'

const wrapperRef = ref<HTMLDivElement | null>(null)

function capturePreview(): string {
  const canvas = wrapperRef.value?.querySelector('canvas')
  if (!canvas) return ''
  return canvas.toDataURL('image/jpeg', 0.88)
}

defineExpose({ capturePreview })

const props = defineProps<{
  shirtType: string
  shirtColor: string
  isFullTexture: boolean
  fullDecalUrl: string | null
  stickers: Array<{ id: string; url: string; name: string; x: number; y: number; z: number; size: number; flipX: boolean; flipY: boolean; rotation: number; faceAngle: number }>
  selectedStickerId: string | null
}>()

</script>

<template>
  <div ref="wrapperRef" class="w-full h-full">
  <TresCanvas
    class="w-full h-full"
    :clear-color="'#2d2d2d'"
    :alpha="false"
    :preserve-drawing-buffer="true"
  >
    <!-- Camera -->
    <TresPerspectiveCamera
      :position="[0, 0, 2.5]"
      :fov="25"
      :near="0.1"
      :far="100"
    />

    <!-- Controls — auto-rotate pauses while a sticker is selected -->
    <OrbitControls
      :enable-zoom="true"
      :enable-pan="false"
      :auto-rotate="!props.selectedStickerId"
      :auto-rotate-speed="1.2"
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

    <!-- 3D Shirt model -->
    <Suspense>
      <ShirtMesh
        :shirt-type="props.shirtType"
        :shirt-color="props.shirtColor"
        :is-full-texture="props.isFullTexture"
        :full-decal-url="props.fullDecalUrl"
        :stickers="props.stickers"
      />
    </Suspense>
  </TresCanvas>
  </div>
</template>
