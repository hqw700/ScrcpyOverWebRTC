<template>
  <div class="batch-control-page">
    <!-- 侧边设备与标签选择器 -->
    <aside class="batch-sidebar">
      <div class="sidebar-header">
        <h3>群控设备列表</h3>
        <p>勾选需要同步控制或批量下发任务的虚拟机</p>
      </div>

      <!-- 标签快速选择 -->
      <div class="tag-selector-section">
        <div class="section-title">标签快速筛选</div>
        <div class="tag-pills">
          <button 
            class="tag-pill all" 
            :class="{ active: selectedTag === '' }"
            @click="filterByTag('')"
          >
            全部 ({{ deviceStore.onlineDevices.length }})
          </button>
          <button 
            v-for="t in allTags" 
            :key="t" 
            class="tag-pill"
            :class="{ active: selectedTag === t }"
            @click="filterByTag(t)"
          >
            {{ t }} ({{ getDeviceCountByTag(t) }})
          </button>
        </div>
      </div>

      <!-- 设备选择列表 -->
      <div class="device-list-section">
        <div class="section-action-bar">
          <label class="checkbox-container">
            <input type="checkbox" :checked="isAllFilteredSelected" @change="toggleSelectAllFiltered" />
            <span class="checkmark"></span>
            <span>全选 / 反选</span>
          </label>
          <span class="selected-count">已选 {{ selectedDeviceIds.length }} 台</span>
        </div>

        <div class="device-list-scroll">
          <div 
            v-for="dev in filteredDevices" 
            :key="dev.id" 
            class="device-item-row"
            :class="{ selected: selectedDeviceIds.includes(dev.id), 'is-master': masterDeviceId === dev.id }"
            @click="toggleDeviceSelection(dev.id)"
          >
            <label class="checkbox-container" @click.stop>
              <input type="checkbox" :value="dev.id" v-model="selectedDeviceIds" />
              <span class="checkmark"></span>
            </label>
            <div class="dev-meta">
              <span class="dev-name">{{ dev.name || dev.id }}</span>
              <div class="dev-tags">
                <span v-for="tag in dev.tags" :key="tag" class="dev-tag-badge">{{ tag }}</span>
              </div>
            </div>
            <button 
              v-if="selectedDeviceIds.includes(dev.id)"
              class="set-master-btn" 
              :class="{ active: masterDeviceId === dev.id }"
              @click.stop="setMasterDevice(dev.id)"
            >
              {{ masterDeviceId === dev.id ? '主控机' : '设为主控' }}
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- 主控与批量任务面板 -->
    <main class="batch-main-content">
      <!-- 顶部控制条 -->
      <header class="batch-toolbar">
        <div class="tab-buttons">
          <button 
            v-for="tab in tabs" 
            :key="tab.value" 
            class="tab-btn"
            :class="{ active: activeTab === tab.value }"
            @click="activeTab = tab.value"
          >
            <span class="tab-icon" v-html="tab.icon"></span>
            <span>{{ tab.label }}</span>
          </button>
        </div>

        <div class="sync-status" v-if="masterDeviceId">
          <span class="pulse-dot"></span>
          <span>同步操作中 (主控机: {{ masterDeviceId }})</span>
        </div>
      </header>

      <!-- 视图渲染 -->
      <div class="tab-viewport">
        <!-- 2. 批量安装与文件传输 -->
        <div v-if="activeTab === 'files'" class="tab-pane">
          <div class="task-form-card">
            <h4>批量安装与分发</h4>
            <p class="subtitle">采用内置 HTTP 分发拉取技术，适合大文件及 APK，避免浏览器网络过载。</p>
            
            <div class="form-group">
              <label>1. 上传文件到信令服务器 (APK 或 其他资源文件)</label>
              <div 
                class="upload-dropzone" 
                :class="{ dragging: isDraggingFile }"
                @dragover.prevent="isDraggingFile = true"
                @dragleave="isDraggingFile = false"
                @drop.prevent="handleFileDrop"
              >
                <input type="file" ref="fileInput" class="file-input-hidden" @change="handleFileSelect" />
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <div v-if="!uploadedFileName">
                  <span>拖拽文件至此，或 <a href="javascript:void(0)" @click="$refs.fileInput.click()">点击上传</a></span>
                  <p class="upload-tip">APK 将在上传完成后自动转换为批量静默安装任务</p>
                </div>
                <div v-else class="uploaded-info">
                  <span class="file-name">{{ uploadedFileName }}</span>
                  <span class="file-size">({{ formatBytes(uploadedFileSize) }})</span>
                  <button class="clear-file-btn" @click="clearUploadedFile">移除</button>
                </div>
                <div class="progress-bar-container" v-if="uploadProgress > 0 && uploadProgress < 100">
                  <div class="progress-bar" :style="{ width: uploadProgress + '%' }"></div>
                  <span class="progress-text">已上传 {{ uploadProgress }}%</span>
                </div>
              </div>
            </div>

            <div class="form-group" style="margin-top: 15px; margin-bottom: 15px;">
              <label>或者，从云端文件中心选择已有文件</label>
              <div class="cloud-file-selector">
                <select v-model="selectedCloudFileName" @change="handleCloudFileChange" class="form-select" style="width: 100%; height: 40px; background: #21262d; color: #c9d1d9; border: 1px solid #30363d; border-radius: 6px; padding: 0 10px;">
                  <option value="">-- 选择云端已有文件 --</option>
                  <option v-for="file in cloudFiles" :key="file.name" :value="file.name">
                    {{ file.name }} ({{ formatBytes(file.size) }})
                  </option>
                </select>
              </div>
            </div>

            <div class="form-row" v-if="uploadedFileName">
              <div class="form-group half">
                <label>任务类型</label>
                <select v-model="fileTaskType" class="form-select">
                  <option value="install">静默安装 APK</option>
                  <option value="push_file">传输文件并存盘</option>
                </select>
              </div>
              <div class="form-group half" v-if="fileTaskType === 'push_file'">
                <label>从手机目标存盘绝对路径</label>
                <input type="text" v-model="destPath" placeholder="例如: /sdcard/Download/file.bin" class="form-input" />
              </div>
            </div>

            <button 
              class="submit-task-btn" 
              :disabled="selectedDeviceIds.length === 0 || !uploadedFileName || isSubmitting"
              @click="submitFileTask"
            >
              {{ isSubmitting ? '任务下发中...' : '下发批量拉取任务 (' + selectedDeviceIds.length + ' 台设备)' }}
            </button>
          </div>
        </div>

        <!-- 3. 应用管理（批量打开/卸载） -->
        <div v-else-if="activeTab === 'apps'" class="tab-pane">
          <div class="task-form-card">
            <h4>批量应用控制</h4>
            <p class="subtitle">输入应用包名，对选定设备批量执行打开、关闭或卸载动作。</p>
            
            <div class="form-group">
              <label>应用包名 (Package Name)</label>
              <input type="text" v-model="packageName" placeholder="例如: com.tencent.tmgp.pubgmhd" class="form-input" />
            </div>

            <div class="button-actions-row">
              <button 
                class="action-btn-primary" 
                :disabled="selectedDeviceIds.length === 0 || !packageName || isSubmitting"
                @click="submitAppControl('open_app')"
              >
                批量打开应用
              </button>
              <button 
                class="action-btn-danger" 
                :disabled="selectedDeviceIds.length === 0 || !packageName || isSubmitting"
                @click="submitAppControl('uninstall')"
              >
                批量卸载应用
              </button>
            </div>
          </div>
        </div>


        <!-- 批量任务执行仪表盘 (Dashboard) -->
        <section class="task-dashboard-section" v-if="currentTask">
          <div class="dashboard-header">
            <div class="task-title-info">
              <h4>当前批量任务: <span class="task-id-badge">{{ currentTask.task_id }}</span></h4>
              <p>类型: {{ translateType(currentTask.type) }} | 创建时间: {{ formatTime(currentTask.created_at) }}</p>
            </div>
            <div class="global-progress">
              <div class="stat-item">
                <span class="label">完成度</span>
                <span class="value">{{ finishedCount }} / {{ totalCount }}</span>
              </div>
              <div class="stat-item success">
                <span class="label">成功</span>
                <span class="value">{{ successCount }}</span>
              </div>
              <div class="stat-item failed">
                <span class="label">失败</span>
                <span class="value">{{ failedCount }}</span>
              </div>
            </div>
          </div>

          <div class="progress-bar-container large">
            <div class="progress-bar success" :style="{ width: (successCount / totalCount) * 100 + '%' }"></div>
            <div class="progress-bar failed" :style="{ width: (failedCount / totalCount) * 100 + '%', left: (successCount / totalCount) * 100 + '%' }"></div>
          </div>

          <div class="subtask-table-wrapper">
            <table class="subtask-table">
              <thead>
                <tr>
                  <th>设备 ID</th>
                  <th>状态</th>
                  <th>进度</th>
                  <th>结果/错误原因</th>
                  <th>更新时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="sub in Object.values(currentTask.devices)" :key="sub.device_id">
                  <td><strong>{{ sub.device_id }}</strong></td>
                  <td>
                    <span class="status-badge" :class="sub.status">
                      {{ translateStatus(sub.status) }}
                    </span>
                  </td>
                  <td>
                    <div class="progress-cell">
                      <div class="progress-track">
                        <div class="progress-fill" :style="{ width: sub.progress + '%' }"></div>
                      </div>
                      <span>{{ sub.progress }}%</span>
                    </div>
                  </td>
                  <td class="log-cell">
                    <span v-if="sub.status === 'failed'" class="error-text" :title="sub.error_msg">
                      {{ sub.error_msg || '未知错误' }}
                    </span>
                    <span v-else-if="sub.status === 'success' && sub.error_msg" class="success-log" @click="showLogModal(sub.device_id, sub.error_msg)">
                      点击查看输出结果
                    </span>
                    <span v-else>-</span>
                  </td>
                  <td>{{ formatTime(sub.updated_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>

    <!-- 输出日志弹窗 -->
    <transition name="fade">
      <div v-if="activeLogOutput" class="log-modal-overlay" @click="activeLogOutput = null">
        <div class="log-modal-card" @click.stop>
          <header class="modal-header">
            <h4>设备 {{ activeLogDevice }} 执行输出</h4>
            <button class="close-btn" @click="activeLogOutput = null">✕</button>
          </header>
          <pre class="log-pre"><code>{{ activeLogOutput }}</code></pre>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import { useAuthStore } from '@/stores/auth'
import { useWebRTC } from '@/composables/useWebRTC'

const deviceStore = useDeviceStore()

// 视图 Tab 配置
const tabs = [
  { value: 'files', label: '批量安装/传输', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>' },
  { value: 'apps', label: '应用批量控制', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"></rect><rect x="14" y="3" width="7" height="5" rx="1"></rect><rect x="14" y="12" width="7" height="9" rx="1"></rect><rect x="3" y="16" width="7" height="5" rx="1"></rect></svg>' }
]
const activeTab = ref('files')

const cloudFiles = ref([])
const selectedCloudFileName = ref('')

const fetchCloudFiles = async () => {
  try {
    const token = localStorage.getItem('auth_token') || ''
    const res = await fetch('/api/files', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    if (res.ok) {
      cloudFiles.value = await res.json()
    }
  } catch(e) {
    console.warn('Failed to fetch cloud files:', e)
  }
}

const handleCloudFileChange = () => {
  if (!selectedCloudFileName.value) {
    clearUploadedFile()
    return
  }
  const file = cloudFiles.value.find(f => f.name === selectedCloudFileName.value)
  if (file) {
    uploadedFileName.value = file.name
    uploadedFileSize.value = file.size
    uploadProgress.value = 100 // 模拟已上传
    
    if (file.name.endsWith('.apk')) {
      fileTaskType.value = 'install'
    } else {
      fileTaskType.value = 'push_file'
    }
  }
}

// 标签筛选
const selectedTag = ref('')
const allTags = computed(() => {
  const tagsSet = new Set()
  deviceStore.onlineDevices.forEach(d => {
    if (d.tags) {
      d.tags.forEach(t => tagsSet.add(t))
    }
  })
  return Array.from(tagsSet)
})

const getDeviceCountByTag = (tag) => {
  return deviceStore.onlineDevices.filter(d => d.tags && d.tags.includes(tag)).length
}

const filteredDevices = computed(() => {
  if (selectedTag.value === '') return deviceStore.onlineDevices
  return deviceStore.onlineDevices.filter(d => d.tags && d.tags.includes(selectedTag.value))
})

const filterByTag = (tag) => {
  selectedTag.value = tag
}

// 设备多选逻辑
const selectedDeviceIds = ref([])
const masterDeviceId = ref('')

const isAllFilteredSelected = computed(() => {
  if (filteredDevices.value.length === 0) return false
  return filteredDevices.value.every(d => selectedDeviceIds.value.includes(d.id))
})

const toggleSelectAllFiltered = (e) => {
  const checked = e.target.checked
  const filteredIds = filteredDevices.value.map(d => d.id)
  if (checked) {
    // 合并选中
    const newSet = new Set([...selectedDeviceIds.value, ...filteredIds])
    selectedDeviceIds.value = Array.from(newSet)
  } else {
    // 移除选中
    selectedDeviceIds.value = selectedDeviceIds.value.filter(id => !filteredIds.includes(id))
  }
}

const toggleDeviceSelection = (id) => {
  const index = selectedDeviceIds.value.indexOf(id)
  if (index === -1) {
    selectedDeviceIds.value.push(id)
  } else {
    selectedDeviceIds.value.splice(index, 1)
  }
}

const slaveDeviceIds = computed(() => {
  return selectedDeviceIds.value.filter(id => id !== masterDeviceId.value)
})

// 主控机 WebRTC 及视频流绑定
let webrtc = null
const screenRef = ref(null)
const masterVideo = ref(null)

const setMasterDevice = (id) => {
  masterDeviceId.value = id
}

// 开启群控主视频绑定
watch(masterDeviceId, (newId) => {
  cleanupWebRTC()
  if (!newId) return

  webrtc = useWebRTC(newId, { audio: false })
  setTimeout(() => {
    if (!webrtc || !masterVideo.value) return
    webrtc.setVideoGetter(() => masterVideo.value)
    webrtc.connect()
  }, 50)
})

const cleanupWebRTC = () => {
  if (webrtc) {
    webrtc.disconnect()
    webrtc = null
  }
  if (masterVideo.value) {
    masterVideo.value.srcObject = null
  }
}

// 群控操作同步事件捕获
let isPointerDown = false
let touchSeq = 0

// 滑动限流状态
let lastMoveSentTs = 0
let lastMoveSentX = -999
let lastMoveSentY = -999
const THROTTLE_INTERVAL_MS = 25
const MOVE_DISTANCE_THRESHOLD_SQ = 16 // 4px^2

// 将 clientX/clientY 换算为主控设备绝对坐标 (x, y, w, h)
const getAbsoluteCoords = (e) => {
  const video = masterVideo.value
  if (!video || !video.videoWidth || !video.videoHeight) return null

  const videoW = video.videoWidth
  const videoH = video.videoHeight
  const rect = video.getBoundingClientRect()
  const clientW = rect.width
  const clientH = rect.height
  const videoRatio = videoW / videoH
  const clientRatio = clientW / clientH

  let actualW, actualH, offsetX, offsetY
  if (clientRatio > videoRatio) {
    actualH = clientH
    actualW = clientH * videoRatio
    offsetX = (clientW - actualW) / 2
    offsetY = 0
  } else {
    actualW = clientW
    actualH = clientW / videoRatio
    offsetX = 0
    offsetY = (clientH - actualH) / 2
  }

  const relativeX = e.clientX - rect.left - offsetX
  const relativeY = e.clientY - rect.top - offsetY

  const x = Math.round(Math.max(0, Math.min(1, relativeX / actualW)) * videoW)
  const y = Math.round(Math.max(0, Math.min(1, relativeY / actualH)) * videoH)

  return { x: Math.max(0, Math.min(videoW, x)), y: Math.max(0, Math.min(videoH, y)), w: videoW, h: videoH }
}

const handlePointerDown = (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return // 只处理左键
  isPointerDown = true
  screenRef.value.setPointerCapture(e.pointerId)

  const coords = getAbsoluteCoords(e)
  if (coords) {
    const seq = ++touchSeq
    lastMoveSentTs = 0 // 重置限流
    lastMoveSentX = coords.x
    lastMoveSentY = coords.y
    sendGroupControl({
      type: 'touch',
      action: 0, // DOWN
      x: coords.x,
      y: coords.y,
      w: coords.w,
      h: coords.h,
      id: e.pointerId,
      seq,
      client_ts_ms: Date.now()
    })
  }
}

const handlePointerMove = (e) => {
  if (!isPointerDown) return
  const coords = getAbsoluteCoords(e)
  if (!coords) return

  // 滑动限流：时间 + 位移双重节流
  const now = Date.now()
  const dx = coords.x - lastMoveSentX
  const dy = coords.y - lastMoveSentY
  const distSq = dx * dx + dy * dy

  if (now - lastMoveSentTs < THROTTLE_INTERVAL_MS && distSq < MOVE_DISTANCE_THRESHOLD_SQ) {
    return // 跳过此次 MOVE
  }

  lastMoveSentTs = now
  lastMoveSentX = coords.x
  lastMoveSentY = coords.y

  sendGroupControl({
    type: 'touch',
    action: 2, // MOVE
    x: coords.x,
    y: coords.y,
    w: coords.w,
    h: coords.h,
    id: e.pointerId,
    seq: ++touchSeq,
    client_ts_ms: now
  })
}

const handlePointerUp = (e) => {
  if (!isPointerDown) return
  isPointerDown = false
  screenRef.value.releasePointerCapture(e.pointerId)

  const coords = getAbsoluteCoords(e)
  if (coords) {
    lastMoveSentTs = 0 // 重置限流
    sendGroupControl({
      type: 'touch',
      action: 1, // UP
      x: coords.x,
      y: coords.y,
      w: coords.w,
      h: coords.h,
      id: e.pointerId,
      seq: ++touchSeq,
      client_ts_ms: Date.now()
    })
  }
}

const handlePointerLeave = (e) => {
  if (isPointerDown) {
    handlePointerUp(e)
  }
}

const handleWheel = (e) => {
  const coords = getAbsoluteCoords(e)
  if (coords) {
    sendGroupControl({
      type: 'inject_scroll',
      x: coords.x,
      y: coords.y,
      w: coords.w,
      h: coords.h,
      scroll_h: e.deltaX > 0 ? 1 : (e.deltaX < 0 ? -1 : 0),
      scroll_v: e.deltaY > 0 ? 1 : (e.deltaY < 0 ? -1 : 0),
      seq: ++touchSeq,
      client_ts_ms: Date.now()
    })
  }
}

const sendKey = (keycode) => {
  // 物理键：先发送 DOWN (0)，再发送 UP (1)
  sendGroupControl({ type: 'inject_keycode', action: 0, keycode })
  setTimeout(() => {
    sendGroupControl({ type: 'inject_keycode', action: 1, keycode })
  }, 50)
}

const sendGroupControl = (payload) => {
  if (slaveDeviceIds.value.length === 0) return
  // 同时向主控设备的直连发送 (通过已有的 WebRTC DataChannel)
  if (webrtc) {
    if (payload.type === 'touch') {
      webrtc.sendTouch(payload.action, 0, 0, payload.id, { x: payload.x, y: payload.y, isRotated: true })
    } else if (payload.type === 'inject_scroll') {
      webrtc.sendScroll(0, 0, payload.scroll_h, payload.scroll_v, { x: payload.x, y: payload.y, isRotated: true })
    } else if (payload.type === 'inject_keycode') {
      webrtc.sendInjectKeycode(payload.action, payload.keycode, 0, 0)
    }
  }
  // 使用 WebSocket 将事件群发中转给其他从设备
  deviceStore.sendGroupControlEvent(slaveDeviceIds.value, payload)
}


// --- 批量文件安装及传输 ---
const isDraggingFile = ref(false)
const fileInput = ref(null)
const uploadedFileName = ref('')
const uploadedFileSize = ref(0)
const uploadProgress = ref(0)
const fileTaskType = ref('install')
const destPath = ref('/sdcard/Download/')
const isSubmitting = ref(false)

const handleFileSelect = (e) => {
  const file = e.target.files?.[0]
  if (file) startUploadFile(file)
}

const handleFileDrop = (e) => {
  isDraggingFile.value = false
  const file = e.dataTransfer.files?.[0]
  if (file) startUploadFile(file)
}

const startUploadFile = (file) => {
  uploadedFileName.value = file.name
  uploadedFileSize.value = file.size
  uploadProgress.value = 1
  
  if (file.name.toLowerCase().endsWith('.apk')) {
    fileTaskType.value = 'install'
  } else {
    fileTaskType.value = 'push_file'
    destPath.value = `/sdcard/Download/${file.name}`
  }

  const xhr = new XMLHttpRequest()
  // 组装上传请求地址，支持跨域
  const protocol = location.protocol
  const host = location.host
  xhr.open('POST', `${protocol}//${host}/upload?type=file&name=${encodeURIComponent(file.name)}`, true)
  
  const token = localStorage.getItem('auth_token') || ''
  xhr.setRequestHeader('Authorization', `Bearer ${token}`)

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      uploadProgress.value = Math.min(Math.floor((e.loaded / e.total) * 100), 99)
    }
  }

  xhr.onload = () => {
    if (xhr.status === 200) {
      uploadProgress.value = 100
      fetchCloudFiles()
    } else {
      alert('文件上传至服务器失败: ' + xhr.responseText)
      clearUploadedFile()
    }
  }

  xhr.onerror = () => {
    alert('网络传输错误，文件上传失败')
    clearUploadedFile()
  }

  xhr.send(file)
}

const clearUploadedFile = () => {
  uploadedFileName.value = ''
  uploadedFileSize.value = 0
  uploadProgress.value = 0
  if (fileInput.value) fileInput.value.value = ''
}

const submitFileTask = async () => {
  if (selectedDeviceIds.value.length === 0) {
    alert('请在左侧勾选目标虚拟机。')
    return
  }
  isSubmitting.value = true
  const token = localStorage.getItem('auth_token') || ''
  
  const protocol = location.protocol
  const host = location.host
  const fileUrl = `${protocol}//${host}/downloads/${encodeURIComponent(uploadedFileName.value)}`

  try {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        type: fileTaskType.value,
        targets: selectedDeviceIds.value,
        payload: fileUrl,
        dest_path: fileTaskType.value === 'push_file' ? destPath.value : ''
      })
    })

    const data = await res.json()
    if (res.ok && data.status === 'success') {
      deviceStore.startTrackingTask(data.task_id)
      clearUploadedFile()
      selectedCloudFileName.value = ''
      fetchCloudFiles()
    } else {
      alert('下发批量拉取任务失败: ' + (data.error || '未知错误'))
    }
  } catch(e) {
    alert('请求创建任务失败: ' + e.message)
  } finally {
    isSubmitting.value = false
  }
}

// --- 批量应用管理 ---
const packageName = ref('')
const submitAppControl = async (type) => {
  if (selectedDeviceIds.value.length === 0) {
    alert('请在左侧勾选目标设备。')
    return
  }
  isSubmitting.value = true
  const token = localStorage.getItem('auth_token') || ''
  try {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        type: type,
        targets: selectedDeviceIds.value,
        payload: packageName.value
      })
    })

    const data = await res.json()
    if (res.ok && data.status === 'success') {
      deviceStore.startTrackingTask(data.task_id)
    } else {
      alert('下发应用控制任务失败: ' + (data.error || '未知错误'))
    }
  } catch(e) {
    alert('请求应用控制失败: ' + e.message)
  } finally {
    isSubmitting.value = false
  }
}

// --- 批量 Shell 指令下发 ---
const shellCommand = ref('')
const submitShellTask = async () => {
  if (selectedDeviceIds.value.length === 0) {
    alert('请在左侧勾选目标设备。')
    return
  }
  isSubmitting.value = true
  const token = localStorage.getItem('auth_token') || ''
  try {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        type: 'shell',
        targets: selectedDeviceIds.value,
        payload: shellCommand.value
      })
    })

    const data = await res.json()
    if (res.ok && data.status === 'success') {
      deviceStore.startTrackingTask(data.task_id)
      shellCommand.value = ''
    } else {
      alert('下发 Shell 任务失败: ' + (data.error || '未知错误'))
    }
  } catch(e) {
    alert('请求 Shell 指令下发失败: ' + e.message)
  } finally {
    isSubmitting.value = false
  }
}

// --- 批量任务仪表盘与细节追踪 ---
const currentTask = computed(() => deviceStore.currentTask)

// 统计计算
const totalCount = computed(() => {
  return currentTask.value ? Object.keys(currentTask.value.devices).length : 0
})
const successCount = computed(() => {
  if (!currentTask.value) return 0
  return Object.values(currentTask.value.devices).filter(sub => sub.status === 'success').length
})
const failedCount = computed(() => {
  if (!currentTask.value) return 0
  return Object.values(currentTask.value.devices).filter(sub => sub.status === 'failed').length
})
const finishedCount = computed(() => {
  if (!currentTask.value) return 0
  return Object.values(currentTask.value.devices).filter(sub => ['success', 'failed'].includes(sub.status)).length
})

// 查看指令输出弹窗
const activeLogOutput = ref(null)
const activeLogDevice = ref('')
const showLogModal = (deviceId, output) => {
  activeLogDevice.value = deviceId
  activeLogOutput.value = output
}

// 工具函数
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatTime = (timeStr) => {
  if (!timeStr) return '-'
  const d = new Date(timeStr)
  return d.toLocaleTimeString('zh-CN', { hour12: false })
}

const translateType = (type) => {
  const map = {
    'install': '安装 APK',
    'push_file': '传输文件',
    'uninstall': '卸载应用',
    'open_app': '启动应用',
    'shell': '执行指令'
  }
  return map[type] || type
}

const translateStatus = (status) => {
  const map = {
    'queued': '队列排队',
    'running': '执行中',
    'success': '成功',
    'failed': '失败'
  }
  return map[status] || status
}

onMounted(() => {
  // 群控为管理员专属：普通用户直达此页时强制回首页
  const authStore = useAuthStore()
  if (!authStore.isAdmin) {
    window.dispatchEvent(new CustomEvent('cloudphone-navigate', { detail: '/' }))
    return
  }
  fetchCloudFiles()
})

onUnmounted(() => {
  cleanupWebRTC()
})
</script>

<style scoped>
.batch-control-page {
  display: flex;
  height: calc(100vh - 64px);
  width: 100%;
  background: #0d1117;
  color: #c9d1d9;
}

/* 侧边栏样式 */
.batch-sidebar {
  width: 320px;
  background: #161b22;
  border-right: 1px solid #30363d;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #30363d;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 16px;
  color: #f0f6fc;
}

.sidebar-header p {
  margin: 5px 0 0 0;
  font-size: 12px;
  color: #8b949e;
}

.tag-selector-section {
  padding: 15px 20px;
  border-bottom: 1px solid #30363d;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #8b949e;
  text-transform: uppercase;
  margin-bottom: 10px;
}

.tag-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-pill {
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 11px;
  color: #c9d1d9;
  cursor: pointer;
  transition: all 0.2s;
}

.tag-pill:hover, .tag-pill.active {
  background: #388bfd;
  border-color: #58a6ff;
  color: #ffffff;
}

.tag-pill.all.active {
  background: #238636;
  border-color: #2ea043;
}

.device-list-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section-action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: #21262d;
  border-bottom: 1px solid #30363d;
}

.selected-count {
  font-size: 12px;
  color: #58a6ff;
  font-weight: 600;
}

.device-list-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.device-item-row {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 6px;
  background: #161b22;
  margin-bottom: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.device-item-row:hover {
  background: #21262d;
}

.device-item-row.selected {
  border-color: #388bfd;
  background: #1f2937;
}

.device-item-row.is-master {
  background: #1c2d42;
  border-color: #58a6ff;
}

.dev-meta {
  flex: 1;
  margin-left: 12px;
  overflow: hidden;
}

.dev-name {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #f0f6fc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dev-tags {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.dev-tag-badge {
  font-size: 10px;
  background: #30363d;
  color: #8b949e;
  padding: 1px 5px;
  border-radius: 3px;
}

.set-master-btn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.set-master-btn:hover, .set-master-btn.active {
  background: #238636;
  border-color: #2ea043;
  color: #ffffff;
}

/* 主内容区 */
.batch-main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #0d1117;
}

.batch-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: #161b22;
  border-bottom: 1px solid #30363d;
}

.tab-buttons {
  display: flex;
  gap: 12px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  color: #8b949e;
  font-size: 14px;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #c9d1d9;
  background: #21262d;
}

.tab-btn.active {
  color: #ffffff;
  background: #388bfd;
}

.tab-icon {
  width: 16px;
  height: 16px;
  display: inline-block;
}

.tab-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.sync-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #3fcf8e;
  font-weight: 500;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: #3fcf8e;
  border-radius: 50%;
  box-shadow: 0 0 0 0 rgba(63, 207, 142, 0.4);
  animation: pulse 1.6s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(63, 207, 142, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(63, 207, 142, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(63, 207, 142, 0); }
}

.tab-viewport {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.tab-pane {
  display: flex;
  flex-direction: column;
}

/* 实时群控布局 */
.control-pane-layout {
  flex: 1;
  display: flex;
  gap: 20px;
  min-height: 500px;
}

.master-screen-wrapper {
  flex: 1;
  display: flex;
  gap: 20px;
}

.screen-container {
  flex: 1;
  background: #000000;
  border: 1px solid #30363d;
  border-radius: 12px;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  cursor: crosshair;
}

.master-video {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.screen-overlay-tip {
  position: absolute;
  top: 15px;
  left: 15px;
  background: rgba(0, 0, 0, 0.6);
  padding: 5px 12px;
  border-radius: 4px;
  font-size: 12px;
  color: #8b949e;
  border: 1px solid #30363d;
  pointer-events: none;
}

.master-control-sidebar {
  width: 240px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.master-control-sidebar h4 {
  margin: 0;
  font-size: 14px;
  color: #f0f6fc;
}

.control-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.action-btn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
  padding: 10px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #30363d;
  color: #ffffff;
  border-color: #8b949e;
}

.sync-info-box {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 12px;
  margin-top: auto;
}

.sync-info-box h5 {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #8b949e;
}

.sync-info-box ul {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
}

.sync-info-box li {
  margin-bottom: 6px;
  display: flex;
  justify-content: space-between;
}

/* 表单卡片样式 */
.task-form-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.task-form-card h4 {
  margin: 0;
  font-size: 18px;
  color: #f0f6fc;
}

.task-form-card .subtitle {
  margin: 5px 0 20px 0;
  font-size: 13px;
  color: #8b949e;
}

.form-group {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-row {
  display: flex;
  gap: 20px;
}

.form-group.half {
  flex: 1;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: #c9d1d9;
}

.form-input, .form-select, .form-textarea {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 10px 12px;
  color: #f0f6fc;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.form-input:focus, .form-select:focus, .form-textarea:focus {
  border-color: #58a6ff;
}

.button-actions-row {
  display: flex;
  gap: 15px;
  margin-top: 10px;
}

.action-btn-primary {
  background: #238636;
  border: 1px solid #2ea043;
  color: #ffffff;
  font-weight: 600;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn-primary:hover:not(:disabled) {
  background: #2ea043;
}

.action-btn-danger {
  background: #da3637;
  border: 1px solid #f85149;
  color: #ffffff;
  font-weight: 600;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn-danger:hover:not(:disabled) {
  background: #f85149;
}

.submit-task-btn {
  width: 100%;
  background: #388bfd;
  border: 1px solid #58a6ff;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 10px;
}

.submit-task-btn:hover:not(:disabled) {
  background: #58a6ff;
}

.submit-task-btn:disabled, .action-btn-primary:disabled, .action-btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 上传拖拽区 */
.upload-dropzone {
  border: 2px dashed #30363d;
  border-radius: 8px;
  padding: 30px;
  text-align: center;
  background: #0d1117;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.upload-dropzone:hover, .upload-dropzone.dragging {
  border-color: #58a6ff;
  background: #1f2937;
}

.upload-dropzone svg {
  width: 32px;
  height: 32px;
  color: #8b949e;
  margin-bottom: 12px;
}

.upload-dropzone span {
  display: block;
  font-size: 14px;
  color: #c9d1d9;
}

.upload-dropzone a {
  color: #58a6ff;
  text-decoration: none;
}

.upload-tip {
  margin: 5px 0 0 0;
  font-size: 11px;
  color: #8b949e;
}

.file-input-hidden {
  display: none;
}

.uploaded-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.uploaded-info .file-name {
  font-weight: 600;
  color: #58a6ff;
}

.clear-file-btn {
  background: transparent;
  border: none;
  color: #f85149;
  cursor: pointer;
  font-size: 12px;
  text-decoration: underline;
}

.progress-bar-container {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 24px;
  background: rgba(48, 54, 61, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: #238636;
  z-index: 1;
  transition: width 0.1s;
}

.progress-text {
  position: relative;
  z-index: 2;
  font-size: 11px;
  font-weight: 600;
  color: #ffffff;
}

/* 批量任务仪表盘 */
.task-dashboard-section {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  padding: 24px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.task-title-info h4 {
  margin: 0;
  font-size: 16px;
  color: #f0f6fc;
}

.task-id-badge {
  font-family: monospace;
  background: #30363d;
  color: #f0f6fc;
  padding: 2px 6px;
  border-radius: 4px;
}

.task-title-info p {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: #8b949e;
}

.global-progress {
  display: flex;
  gap: 20px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.stat-item .label {
  font-size: 11px;
  color: #8b949e;
  text-transform: uppercase;
}

.stat-item .value {
  font-size: 20px;
  font-weight: 700;
  color: #f0f6fc;
}

.stat-item.success .value { color: #3fcf8e; }
.stat-item.failed .value { color: #f85149; }

.progress-bar-container.large {
  height: 8px;
  background: #30363d;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
  margin-bottom: 24px;
}

.progress-bar.success {
  background: #3fcf8e;
  height: 100%;
  position: absolute;
}

.progress-bar.failed {
  background: #f85149;
  height: 100%;
  position: absolute;
}

.subtask-table-wrapper {
  overflow-x: auto;
}

.subtask-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.subtask-table th, .subtask-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #30363d;
  font-size: 13px;
}

.subtask-table th {
  color: #8b949e;
  font-weight: 500;
}

.status-badge {
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.status-badge.queued { background: rgba(139, 148, 158, 0.15); color: #8b949e; }
.status-badge.running { background: rgba(56, 139, 253, 0.15); color: #58a6ff; }
.status-badge.success { background: rgba(63, 207, 142, 0.15); color: #3fcf8e; }
.status-badge.failed { background: rgba(248, 81, 73, 0.15); color: #f85149; }

.progress-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-track {
  width: 80px;
  height: 6px;
  background: #30363d;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #58a6ff;
  transition: width 0.2s;
}

.error-text {
  color: #f85149;
  max-width: 250px;
  display: inline-block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.success-log {
  color: #58a6ff;
  cursor: pointer;
  text-decoration: underline;
}

/* 日志模态弹窗 */
.log-modal-overlay, .contact-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.log-modal-card {
  width: 80%;
  max-width: 800px;
  height: 70%;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 16px 24px;
  border-bottom: 1px solid #30363d;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h4 {
  margin: 0;
  font-size: 16px;
  color: #f0f6fc;
}

.close-btn {
  background: transparent;
  border: none;
  color: #8b949e;
  font-size: 18px;
  cursor: pointer;
}

.close-btn:hover {
  color: #ffffff;
}

.log-pre {
  flex: 1;
  overflow: auto;
  background: #0d1117;
  padding: 20px;
  margin: 0;
  font-family: monospace;
  font-size: 13px;
  line-height: 1.6;
}

/* Checkbox 美化 */
.checkbox-container {
  display: block;
  position: relative;
  padding-left: 24px;
  cursor: pointer;
  font-size: 13px;
  user-select: none;
}

.checkbox-container input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkmark {
  position: absolute;
  top: 0;
  left: 0;
  height: 16px;
  width: 16px;
  background-color: #161b22;
  border: 1px solid #30363d;
  border-radius: 4px;
}

.checkbox-container:hover input ~ .checkmark {
  border-color: #8b949e;
}

.checkbox-container input:checked ~ .checkmark {
  background-color: #388bfd;
  border-color: #58a6ff;
}

.checkmark:after {
  content: "";
  position: absolute;
  display: none;
}

.checkbox-container input:checked ~ .checkmark:after {
  display: block;
}

.checkbox-container .checkmark:after {
  left: 5px;
  top: 2px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-state svg {
  width: 64px;
  height: 64px;
  color: #30363d;
  margin-bottom: 20px;
}

.empty-state h3 {
  margin: 0 0 10px 0;
  font-size: 18px;
  color: #f0f6fc;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
  color: #8b949e;
  max-width: 400px;
}

/* 移动端适配 (<=1024px)：侧栏与主区纵向堆叠、工具条换行、网格收窄 */
@media (max-width: 1024px) {
  .batch-control-page {
    flex-direction: column;
    height: auto;
    min-height: calc(100vh - 64px);
    overflow-y: auto;
  }

  /* 侧边设备选择器改为顶部通栏 */
  .batch-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid #30363d;
    flex-shrink: 0;
  }

  .sidebar-header {
    padding: 14px 16px;
  }

  .tag-selector-section {
    padding: 10px 16px;
  }

  .device-list-scroll {
    flex: none;
    max-height: 220px;
  }

  /* 顶部工具条允许换行，标签按钮组可横向滚动 */
  .batch-toolbar {
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 12px;
  }

  .tab-buttons {
    overflow-x: auto;
    gap: 8px;
    max-width: 100%;
  }

  .tab-btn {
    padding: 6px 12px;
    font-size: 13px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .sync-status {
    font-size: 12px;
  }

  .tab-viewport {
    padding: 12px;
    gap: 14px;
    overflow: visible;
  }

  /* 主控画面区与从机网格/控制侧栏纵向堆叠 */
  .control-pane-layout,
  .master-screen-wrapper {
    flex-direction: column;
    min-height: 0;
  }

  .screen-container {
    min-height: 300px;
  }

  .master-control-sidebar {
    width: 100%;
    padding: 14px;
  }

  /* 从机/操作网格收窄，375px 下至少两列 */
  .control-grid {
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 8px;
  }

  .action-btn {
    padding: 8px;
    font-size: 11px;
  }

  /* 表单卡片与按钮压缩 */
  .task-form-card {
    padding: 16px;
  }

  .task-form-card h4 {
    font-size: 16px;
  }

  .form-row {
    flex-direction: column;
    gap: 0;
  }

  .button-actions-row {
    flex-wrap: wrap;
    gap: 10px;
  }

  .action-btn-primary,
  .action-btn-danger {
    flex: 1;
    padding: 10px 12px;
    font-size: 13px;
  }

  .upload-dropzone {
    padding: 20px 12px;
  }

  /* 任务仪表盘头部换行堆叠 */
  .task-dashboard-section {
    padding: 14px;
  }

  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .global-progress {
    gap: 14px;
    flex-wrap: wrap;
  }

  .stat-item {
    align-items: flex-start;
  }

  .stat-item .value {
    font-size: 16px;
  }

  /* 子任务表格容器横向滚动，压缩单元格 */
  .subtask-table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .subtask-table th,
  .subtask-table td {
    padding: 8px 10px;
    font-size: 12px;
    white-space: nowrap;
  }

  .error-text {
    max-width: 160px;
  }

  /* 日志弹窗限宽 */
  .log-modal-card {
    width: 94vw;
    max-width: 94vw;
    height: 80%;
  }
}
</style>
