<template>
  <div class="multi-grid-container" :class="gridClass">
    <!-- 平铺网格：最大化时其余设备仅 v-show 隐藏、保持挂载，
         避免 v-if 互斥渲染导致全员 disconnect 再重连（断连风暴） -->
    <div 
      v-for="id in activeDeviceIds" 
      :key="id" 
      v-show="!maximizedDevice || maximizedDevice === id"
      class="grid-cell"
      :class="{ 'grid-cell-maximized': maximizedDevice === id }"
    >
      <MultiDeviceItem 
        :deviceId="id" 
        :isMini="maximizedDevice === id ? false : isMiniMode" 
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import MultiDeviceItem from './MultiDeviceItem.vue'

const deviceStore = useDeviceStore()
const activeDeviceIds = computed(() => deviceStore.activeDeviceIds)
const maximizedDevice = computed(() => deviceStore.maximizedDeviceId)

const count = computed(() => activeDeviceIds.value.length)

const gridClass = computed(() => {
  if (maximizedDevice.value) return 'layout-maximized'
  if (count.value === 1) return 'layout-1'
  if (count.value === 2) return 'layout-2'
  if (count.value === 3) return 'layout-3'
  if (count.value === 4) return 'layout-4'
  if (count.value <= 6) return 'layout-6'
  if (count.value <= 9) return 'layout-9'
  return 'layout-dense'
})

const isMiniMode = computed(() => count.value > 4 && !maximizedDevice.value)
</script>

<style scoped>
.multi-grid-container {
  display: grid;
  gap: 12px;
  width: 100%;
  height: 100%;
  padding: 12px;
  box-sizing: border-box;
  background: #090d13;
  overflow: auto;
}

/* 最大化的格子铺满整个网格（其余格子 v-show 隐藏，不参与布局） */
.grid-cell-maximized {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
  min-height: 0;
}

.grid-cell {
  width: 100%;
  height: 100%;
  min-height: 240px;
  display: flex;
  overflow: hidden;
}

/* 1台 */
.layout-1 {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
  /* 不写 max-width：横屏视频需要随面板拉宽持续放大；竖屏视频受高度限制，宽度放开无影响 */
}

/* 2台：左右双列平铺 (黄金比例) */
.layout-2 {
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: 1fr;
}

/* 3台：横向三列 */
.layout-3 {
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: 1fr;
}

/* 4台：2x2 四宫格 */
.layout-4 {
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
}

/* 5~6台：3列 2行 */
.layout-6 {
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
}

/* 7~9台：3列 3行 */
.layout-9 {
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
}

/* >9台：高密自适应 */
.layout-dense {
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  grid-auto-rows: minmax(360px, 1fr);
}

@media (max-width: 900px) {
  .layout-2, .layout-3, .layout-4, .layout-6, .layout-9 {
    grid-template-columns: 1fr;
    grid-auto-rows: minmax(400px, 1fr);
  }
}
</style>
