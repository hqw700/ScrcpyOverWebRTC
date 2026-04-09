<template>
  <Teleport to="body">
    <div class="screenshot-modal" @click.self="$emit('close')">
      <div class="modal-content">
        <div class="modal-header">
          <h3>📷 截图</h3>
          <button class="close-btn" @click="$emit('close')">×</button>
        </div>
        <div class="modal-body">
          <img :src="imageUrl" alt="Screenshot" class="screenshot-image" />
        </div>
        <div class="modal-footer">
          <a :href="imageUrl" :download="downloadName" class="btn">下载</a>
          <button class="btn btn-secondary" @click="copyToClipboard">复制到剪贴板</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  imageData: {
    type: [String, Array, Object],
    default: null
  }
})

defineEmits(['close'])

const imageUrl = computed(() => {
  if (!props.imageData) return ''
  
  // 处理不同格式的图片数据
  if (typeof props.imageData === 'string') {
    // 如果已经是 base64 字符串
    if (props.imageData.startsWith('data:')) {
      return props.imageData
    }
    return 'data:image/png;base64,' + props.imageData
  }
  
  // 如果是数组或 ArrayBuffer
  let base64
  if (props.imageData instanceof Array) {
    base64 = btoa(String.fromCharCode.apply(null, props.imageData))
  } else if (props.imageData instanceof ArrayBuffer || props.imageData instanceof Uint8Array) {
    const arr = props.imageData instanceof Uint8Array ? props.imageData : new Uint8Array(props.imageData)
    base64 = btoa(arr.reduce((s, b) => s + String.fromCharCode(b), ''))
  } else {
    return ''
  }
  
  return 'data:image/png;base64,' + base64
})

const downloadName = computed(() => {
  const date = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
  return `screenshot_${date}.png`
})

async function copyToClipboard() {
  try {
    const response = await fetch(imageUrl.value)
    const blob = await response.blob()
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ])
    alert('已复制到剪贴板')
  } catch (e) {
    console.error('Copy failed:', e)
    alert('复制失败')
  }
}
</script>

<style scoped>
.screenshot-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: var(--bg-secondary);
  border-radius: 12px;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--text-secondary);
  font-size: 24px;
  border-radius: 8px;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.modal-body {
  flex: 1;
  overflow: auto;
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.screenshot-image {
  max-width: 100%;
  max-height: 60vh;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

.modal-footer {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
}

.modal-footer .btn {
  text-decoration: none;
}
</style>
