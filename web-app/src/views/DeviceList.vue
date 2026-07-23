<template>
  <div class="device-list-page">
    <header class="page-header">
      <div class="header-left">
        <h2 class="page-title">所有虚机</h2>
        <span v-if="deviceStore.showOfflineOnly" class="device-count">{{ filteredOfflineDevices.length }} / {{ deviceStore.offlineDevices.length }} 台离线</span>
        <span v-else class="device-count">{{ filteredDevices.length }} / {{ deviceStore.devices.length }} 台在线</span>
      </div>
      
      <div class="header-controls">
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <circle cx="11" cy="11" r="7"></circle>
            <path d="M20 20l-4-4"></path>
          </svg>
          <input
            v-model="searchQuery"
            type="search"
            placeholder="搜索设备或标签"
          >
        </div>
        <div class="size-control">
          <span class="label">卡片</span>
          <input
            type="range"
            v-model="cardSize"
            min="150"
            max="400"
            step="10"
            class="size-slider"
          >
          <span class="size-value">{{ cardSize }}px</span>
        </div>

        <div class="preview-mode-switch">
          <label class="switch-label" title="开启后，可视区域内的虚机将使用 WebCodecs 硬件加速播放 10fps 实时预览">
            <input
              type="checkbox"
              v-model="deviceStore.globalPreviewMode"
              class="switch-checkbox"
            >
            <span class="switch-text">高频预览</span>
          </label>
        </div>

        <div class="preview-mode-switch">
          <label 
            class="switch-label" 
            :class="{ 'disabled': !deviceStore.globalPreviewMode }" 
            title="开启后，可直接点击列表里的预览画面进行触控和按键控制，无需进入详情页 (需要先开启高频预览)"
          >
            <input
              type="checkbox"
              v-model="deviceStore.globalInteractiveMode"
              :disabled="!deviceStore.globalPreviewMode"
              class="switch-checkbox"
            >
            <span class="switch-text">预览直控</span>
          </label>
        </div>

        <!-- 群控快捷工具栏 -->
        <div v-if="groupControlStore.isGroupControlActive" class="group-quick-actions animate-fade-in">
          <span class="group-mode-badge">群控主控: {{ groupControlStore.masterId }}</span>
          <button class="action-btn-mini" @click.stop="selectAllOnline" title="全选所有在线设备">全选在线</button>
          <button class="action-btn-mini" @click.stop="clearSlaves" title="清空已勾选设备">清空</button>
          
          <div class="tag-select-dropdown">
            <button class="action-btn-mini dropdown-trigger" @click.stop="showTagDropdown = !showTagDropdown">
              按标签勾选 ▾
            </button>
            <div v-if="showTagDropdown" class="tag-dropdown-menu" @click.stop>
              <div 
                v-for="tag in tagStore.tags" 
                :key="tag.id" 
                class="tag-dropdown-item"
                @click="selectByTag(tag.id)"
              >
                <span class="tag-color-dot" :style="{ backgroundColor: tag.color }"></span>
                <span class="tag-name-text">{{ tag.name }}</span>
              </div>
              <div v-if="tagStore.tags.length === 0" class="tag-dropdown-empty">暂无标签</div>
            </div>
          </div>
          <span class="selected-count-badge">已选 {{ groupControlStore.selectedSlaveIds.length }} 台</span>
          <button 
            v-if="groupControlStore.selectedSlaveIds.length > 0"
            class="action-btn-mini primary-mini-btn"
            @click.stop="openTagManager('batch')"
            title="批量为选中的设备打标签"
          >
            打标签
          </button>
        </div>

        <div class="header-actions">
          <button class="deploy-btn secondary mobile-tag-action" @click="openTagManager('full')" title="标签管理" aria-label="标签管理">
            <svg class="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
              <path d="M20 12v7a1 1 0 0 1-1 1h-7L4 12V5a1 1 0 0 1 1-1h7l8 8z"></path>
              <circle cx="8.5" cy="8.5" r="1.4"></circle>
            </svg>
            <span class="btn-label">标签管理</span>
          </button>
          <button class="deploy-btn secondary" @click="openGlobalSettings" title="全局默认设置" aria-label="全局设置">
            <svg class="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.2 3h-4.4l-.3 2.7a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.3 2.7h4.4l.3-2.7a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"></path>
            </svg>
            <span class="btn-label">全局设置</span>
          </button>
        </div>
      </div>
    </header>

    <div class="content-layout">
      <section class="mobile-tag-bar">
        <button
          class="tag-filter"
          :class="{ active: tagStore.selectedTagIds.length === 0 && !deviceStore.showOfflineOnly }"
          @click="selectAllTags"
        >
          <span class="tag-dot all"></span>
          <span class="tag-name">全部设备</span>
          <span class="tag-count">{{ deviceStore.devices.length }}</span>
        </button>
        <button
          v-for="tag in tagStore.tags"
          :key="tag.id"
          class="tag-filter"
          :class="{ active: tagStore.selectedTagIds.includes(tag.id) }"
          :style="tagFilterStyle(tag)"
          @click="toggleSelectedTag(tag.id)"
        >
          <span class="tag-dot" :style="{ background: tag.color }"></span>
          <span class="tag-name">{{ tag.name }}</span>
          <span class="tag-count">{{ getTagDeviceCount(tag.id) }}</span>
        </button>
        <button
          class="tag-filter"
          :class="{ active: deviceStore.showOfflineOnly }"
          @click="toggleOfflineView"
        >
          <span class="tag-dot offline"></span>
          <span class="tag-name">离线设备</span>
          <span class="tag-count">{{ deviceStore.offlineDevices.length }}</span>
        </button>
      </section>

      <main class="grid-container">
        <div v-if="deviceStore.loading && deviceStore.devices.length === 0" class="state-view">
          <div class="spinner"></div>
          <p>正在获取虚机列表...</p>
        </div>

        <div v-else-if="deviceStore.devices.length === 0 && deviceStore.offlineDevices.length === 0" class="quickstart-container">
          <div class="quickstart-header">
            <div class="empty-icon">🔌</div>
            <h3 class="qs-title">快速接入您的第一台云手机</h3>
            <p class="qs-subtitle">当前系统中暂无在线设备。请使用以下方式之一，将 Android 设备（真机/模拟器/redroid 容器）注册至本控制端：</p>
          </div>

          <div class="quickstart-layout">
            <!-- 方式一：网页一键 USB 部署 -->
            <div class="qs-card-box highlight">
              <div class="qs-badge">推荐</div>
              <h4 class="qs-card-title">方式一：网页一键 USB 自动部署</h4>
              <p class="qs-card-desc">物理手机通过 USB 连接当前电脑，利用浏览器的 WebUSB/WebADB 功能免装任何环境，直接一键检测架构、推送并拉起投屏 Agent，适合个人调试物理手机。</p>
              <p class="qs-card-desc-warn">⚠️ 注意：此方式基于 WebUSB 协议直连物理端口，<b>不支持无线或网络 ADB 连接模式</b>。</p>
              <div class="qs-action-wrapper">
                <button class="qs-btn-primary" @click="goToDeploy">
                  <svg class="qs-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                  前往网页 USB 部署
                </button>
              </div>
            </div>

            <!-- 方式二：手动/命令行快速部署 -->
            <div class="qs-card-box">
              <h4 class="qs-card-title">方式二：手动 / 命令行一键部署</h4>
              <p class="qs-card-desc">适用于 Linux/macOS 物理设备、redroid 容器、远端虚拟机或已存在 adb 连接的集群。</p>

              <!-- 接入前准备工作 -->
              <div class="qs-prerequisites">
                <div class="qs-prereq-title">📋 接入前准备工作：</div>
                <ul class="qs-prereq-list">
                  <li><b>手机端配置</b>：需进入「设置 -> 开发者选项」开启「USB 调试」；物理机需用数据线连上电脑。</li>
                  <li><b>电脑端配置</b>：电脑需已安装并配置好 ADB 工具，并在命令行能成功识别到设备。</li>
                </ul>
              </div>

              <!-- 动态参数配置区 -->
              <div class="qs-form-grid">
                <div class="qs-form-item">
                  <label class="qs-form-label">信令服务器 IP:Port</label>
                  <input v-model="quickstartSignaling" class="qs-form-input" placeholder="例如: 192.168.1.100:8443">
                </div>
                <div class="qs-form-item">
                  <label class="qs-form-label">分配设备 ID (可选)</label>
                  <input v-model="quickstartDeviceId" class="qs-form-input" placeholder="例如: device_01">
                </div>
              </div>

              <!-- 核心配置展示 -->
              <div class="qs-real-config">
                <div class="qs-config-row">
                  <span class="qs-config-label">信令连接 (-signaling):</span>
                  <code class="qs-config-val">{{ signalingProtocol }}{{ quickstartSignaling }}/register_agent</code>
                  <button class="qs-config-copy" @click="copyText(`${signalingProtocol}${quickstartSignaling}/register_agent`)">复制</button>
                </div>
                <div class="qs-config-row">
                  <span class="qs-config-label">中转服务 (-ice-servers):</span>
                  <code class="qs-config-val">{{ computedIceServers }}</code>
                  <button class="qs-config-copy" @click="copyText(computedIceServers)">复制</button>
                </div>
              </div>

              <!-- 部署模式切换按键 -->
              <div class="qs-mode-selector">
                <button 
                  class="qs-mode-btn" 
                  :class="{ active: quickstartMode === 'adb' }" 
                  @click="quickstartMode = 'adb'"
                >
                  💻 电脑 ADB 一键部署 (无需 Root)
                </button>
                <button 
                  class="qs-mode-btn magisk-qs-mode" 
                  :class="{ active: quickstartMode === 'magisk' }" 
                  @click="quickstartMode = 'magisk'"
                >
                  📱 Magisk / KSU 刷机模块 (Root 开机自启)
                </button>
              </div>

              <!-- 模式 A：ADB 电脑一键部署 -->
              <template v-if="quickstartMode === 'adb'">
                <!-- 步骤一：下载部署包 -->
                <div class="qs-step-block">
                  <div class="qs-step-title">第一步：下载 ADB 部署包 (包含全架构 Agent 及一键执行脚本)</div>
                  <div class="qs-download-row">
                    <a href="/agent/agent-deploy.zip" download="agent-deploy.zip" class="qs-download-link">
                      <svg class="qs-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      下载统一部署包 (agent-deploy.zip)
                    </a>
                  </div>
                </div>

                <!-- 步骤二：运行命令 -->
                <div class="qs-step-block">
                  <div class="qs-step-title">第二步：解压 ZIP 并在连接了设备的电脑终端运行命令</div>
                  
                  <!-- 切换 OS 平台 -->
                  <div class="qs-tabs">
                    <button class="qs-tab" :class="{ active: qsActiveOs === 'unix' }" @click="qsActiveOs = 'unix'">Linux / macOS (一键)</button>
                    <button class="qs-tab" :class="{ active: qsActiveOs === 'win' }" @click="qsActiveOs = 'win'">Windows CMD (一键)</button>
                  </div>

                  <!-- 终端视口 -->
                  <div class="qs-terminal">
                    <pre v-if="qsActiveOs === 'unix'" class="qs-code-text"># 解压后在本地终端执行一键命令 (自动探测手机架构并推送拉起服务)
chmod +x run.sh
./run.sh -id "{{ quickstartDeviceId || 'device_01' }}" -signaling "{{ signalingProtocol }}{{ quickstartSignaling }}" -ice-servers "{{ computedIceServers }}"</pre>
                    <pre v-else-if="qsActiveOs === 'win'" class="qs-code-text">:: 解压后在本地 CMD 窗口执行一键命令 (自动探测手机架构并推送拉起服务)
run.bat -id "{{ quickstartDeviceId || 'device_01' }}" -signaling "{{ signalingProtocol }}{{ quickstartSignaling }}" -ice-servers "{{ computedIceServers }}"</pre>
                    <button class="qs-copy-btn" @click="copyCommandText">复制运行指令</button>
                  </div>
                </div>
              </template>

              <!-- 模式 B：Magisk / KSU 刷机模块部署 -->
              <template v-else-if="quickstartMode === 'magisk'">
                <!-- 步骤一：下载模块包 -->
                <div class="qs-step-block">
                  <div class="qs-step-title">第一步：下载 Magisk 模块刷机包 (物理真机已 Root 环境)</div>
                  <div class="qs-download-row">
                    <a href="/agent/cloudphone-agent-magisk.zip" download="cloudphone-agent-magisk.zip" class="qs-download-link magisk-qs-btn">
                      <svg class="qs-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                        <line x1="12" y1="18" x2="12.01" y2="18"></line>
                      </svg>
                      下载 Magisk 模块包 (cloudphone-agent-magisk.zip)
                    </a>
                  </div>
                </div>

                <!-- 步骤二：刷入与热重载 -->
                <div class="qs-step-block">
                  <div class="qs-step-title">第二步：手机端刷入模块重启，并执行命令配置信令服务器</div>
                  
                  <!-- 终端视口 -->
                  <div class="qs-terminal">
                    <pre class="qs-code-text"># 手机刷入模块重启后，在手机终端或 ADB shell 执行以下命令设置地址并重启服务:
su
cpctl set CP_AGENT_SIGNALING "{{ signalingProtocol }}{{ quickstartSignaling }}"<template v-if="quickstartDeviceId">
cpctl set CP_AGENT_ID "{{ quickstartDeviceId }}"</template>
cpctl restart</pre>
                    <button class="qs-copy-btn" @click="copyCommandText">复制运行指令</button>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <div v-else-if="noVisibleDevices" class="state-view">
          <div class="empty-icon">🔎</div>
          <h3>没有匹配结果</h3>
          <p>调整搜索关键字或标签筛选</p>
        </div>

        <div v-else>
          <!-- 离线筛选视图：只显示离线设备 -->
          <div
            v-if="deviceStore.showOfflineOnly"
            class="device-grid offline-grid"
            :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))` }"
          >
            <DeviceCard
              v-for="device in filteredOfflineDevices"
              :key="device.id"
              :device="device"
              :tags="tagStore.getTagsForDevice(device.id)"
              @connect="connectDevice"
              @settings="openSettings"
              @edit-tags="id => openTagManager('single', id)"
            />
          </div>
          <template v-else>
            <div 
              v-if="filteredDevices.length > 0"
              class="device-grid" 
              :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))` }"
            >
              <DeviceCard
                v-for="device in filteredDevices"
                :key="device.id"
                :device="device"
                :tags="tagStore.getTagsForDevice(device.id)"
                @connect="connectDevice"
                @settings="openSettings"
                @edit-tags="id => openTagManager('single', id)"
              />
            </div>

            <!-- 离线设备区块（数据来自服务端离线记录） -->
            <div v-if="filteredOfflineDevices.length > 0" class="offline-section">
              <div class="offline-section-header">
                <span class="offline-section-title">离线设备</span>
                <span class="offline-section-count">{{ filteredOfflineDevices.length }}</span>
              </div>
              <div 
                class="device-grid offline-grid" 
                :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))` }"
              >
                <DeviceCard
                  v-for="device in filteredOfflineDevices"
                  :key="device.id"
                  :device="device"
                  :tags="tagStore.getTagsForDevice(device.id)"
                  @connect="connectDevice"
                  @settings="openSettings"
                  @edit-tags="id => openTagManager('single', id)"
                />
              </div>
            </div>
          </template>
        </div>
      </main>
    </div>

    <SettingsModal 
      v-if="showSettingsModal" 
      :settings="localSettings" 
      :is-connected="false"
      :is-global="!selectedDeviceId"
      :is-custom="!!selectedDeviceId && hasCustomSettings(selectedDeviceId)"
      @close="closeSettings" 
      @save="saveSettings" 
      @reset="resetSettings"
    />

    <TagManagerModal
      v-if="showTagManager"
      :devices="tagManagerDevices"
      :mode="tagManagerMode"
      @close="closeTagManager"
    />
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDeviceStore } from '@/stores/devices'
import { useTagStore } from '@/stores/tags'
import DeviceCard from '@/components/DeviceCard.vue'
import SettingsModal from '@/components/SettingsModal.vue'
import TagManagerModal from '@/components/TagManagerModal.vue'

import { getDeviceSettings, saveDeviceSettings, hasCustomSettings, deleteDeviceSettings } from '@/utils/settings'
import { useGroupControlStore } from '@/stores/groupControl'

const router = useRouter()
const deviceStore = useDeviceStore()
const tagStore = useTagStore()
const groupControlStore = useGroupControlStore()
const savedCardSize = localStorage.getItem('cloudphone_card_size')
const cardSize = ref(savedCardSize ? parseInt(savedCardSize, 10) : 280)
const searchQuery = ref('')
const showTagDropdown = ref(false)

function selectAllOnline() {
  groupControlStore.selectAllOnline(deviceStore.devices)
}

function clearSlaves() {
  groupControlStore.clearSlaves()
}

function selectByTag(tagId) {
  groupControlStore.selectByTag(tagId, deviceStore.devices, tagStore)
  showTagDropdown.value = false
}

function closeTagDropdownMenu() {
  showTagDropdown.value = false
}

onMounted(() => {
  window.addEventListener('click', closeTagDropdownMenu)
})

onUnmounted(() => {
  window.removeEventListener('click', closeTagDropdownMenu)
})

watch(() => deviceStore.globalPreviewMode, (newVal) => {
  if (!newVal) {
    deviceStore.globalInteractiveMode = false
  }
})

watch(cardSize, (newVal) => {
  localStorage.setItem('cloudphone_card_size', newVal.toString())
})

let refreshInterval = null
const showSettingsModal = ref(false)
const selectedDeviceId = ref('')
const showTagManager = ref(false)
const tagManagerDevices = ref([])
const tagManagerMode = ref('full')

const localSettings = ref(getDeviceSettings(''))

const filteredDevices = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return deviceStore.devices.filter(device => {
    const deviceTags = tagStore.getTagsForDevice(device.id)
    const matchesTag = tagStore.selectedTagIds.length === 0 || 
      tagStore.selectedTagIds.every(id => deviceTags.some(tag => tag.id === id))
    if (!matchesTag) return false

    if (!query) return true

    const searchable = [
      device.id,
      device.info?.model,
      ...deviceTags.map(tag => tag.name)
    ].filter(Boolean).join(' ').toLowerCase()

    return searchable.includes(query)
  })
})

// 离线设备（服务端离线记录），与在线列表使用相同的搜索/标签筛选
const filteredOfflineDevices = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return deviceStore.offlineDevices.filter(device => {
    const deviceTags = tagStore.getTagsForDevice(device.id)
    const matchesTag = tagStore.selectedTagIds.length === 0 ||
      tagStore.selectedTagIds.every(id => deviceTags.some(tag => tag.id === id))
    if (!matchesTag) return false

    if (!query) return true

    const searchable = [
      device.id,
      device.info?.model,
      ...deviceTags.map(tag => tag.name)
    ].filter(Boolean).join(' ').toLowerCase()

    return searchable.includes(query)
  })
})

// 当前视图是否无可展示设备（离线筛选模式下只看离线列表）
const noVisibleDevices = computed(() => {
  if (deviceStore.showOfflineOnly) {
    return filteredOfflineDevices.value.length === 0
  }
  return filteredDevices.value.length === 0 && filteredOfflineDevices.value.length === 0
})

function selectAllTags() {
  tagStore.clearSelectedTags()
  deviceStore.showOfflineOnly = false
}

function toggleOfflineView() {
  deviceStore.showOfflineOnly = !deviceStore.showOfflineOnly
  if (deviceStore.showOfflineOnly) {
    // 离线筛选与标签筛选互斥
    tagStore.clearSelectedTags()
  }
}

// 离线列表清空时自动退出离线筛选视图
watch(() => deviceStore.offlineDevices.length, len => {
  if (len === 0 && deviceStore.showOfflineOnly) {
    deviceStore.showOfflineOnly = false
  }
})

function openGlobalSettings() {
  selectedDeviceId.value = ''
  localSettings.value = getDeviceSettings('')
  showSettingsModal.value = true
}

function goToDeploy() {
  window.dispatchEvent(new CustomEvent('cloudphone-navigate', { detail: '/deploy' }))
}

function openSettings(deviceId) {
  selectedDeviceId.value = deviceId
  localSettings.value = getDeviceSettings(deviceId)
  showSettingsModal.value = true
}

function closeSettings() {
  showSettingsModal.value = false
  selectedDeviceId.value = ''
}

function saveSettings(newSettings) {
  localSettings.value = newSettings
  saveDeviceSettings(selectedDeviceId.value, newSettings)
  
  if (selectedDeviceId.value) {
    connectDevice(selectedDeviceId.value)
  } else {
    closeSettings()
  }
}

function resetSettings() {
  if (selectedDeviceId.value) {
    deleteDeviceSettings(selectedDeviceId.value)
    closeSettings()
  }
}

function openTagManager(type, deviceId = '') {
  if (type === 'full') {
    tagManagerMode.value = 'full'
    tagManagerDevices.value = deviceStore.devices
  } else if (type === 'single' && deviceId) {
    tagManagerMode.value = 'assign'
    tagManagerDevices.value = deviceStore.devices.filter(d => d.id === deviceId)
  } else if (type === 'batch') {
    tagManagerMode.value = 'assign'
    const selectedIds = groupControlStore.selectedSlaveIds
    tagManagerDevices.value = deviceStore.devices.filter(d => selectedIds.includes(d.id))
  }
  showTagManager.value = true
}

function closeTagManager() {
  showTagManager.value = false
  tagManagerDevices.value = []
  tagManagerMode.value = 'full'
}

function tagFilterStyle(tag) {
  const active = tagStore.selectedTagIds.includes(tag.id)
  return {
    color: active ? '#fff' : 'var(--text-primary)',
    borderColor: `${tag.color}80`,
    background: active ? `${tag.color}35` : 'transparent'
  }
}

function getTagDeviceCount(tagId) {
  return deviceStore.devices.filter(device => tagStore.getTagIdsForDevice(device.id).includes(tagId)).length
}

const quickstartSignaling = ref('')
const quickstartDeviceId = ref('device_01')
const quickstartMode = ref('adb') // 'adb' | 'magisk'
const qsActiveOs = ref('unix')

const signalingProtocol = computed(() => {
  return window.location.protocol === 'https:' ? 'wss://' : 'ws://'
})

const fetchedIceServers = ref('')

const computedIceServers = computed(() => {
  if (fetchedIceServers.value) {
    return fetchedIceServers.value
  }
  const host = quickstartSignaling.value || window.location.host
  const ip = host.split(':')[0] || '127.0.0.1'
  return `turn:cloudphone_user:cloudphone_secure_password@${ip}:3478?transport=udp,stun:${ip}:3478`
})

// 格式化后端返回的 ICE Servers 数组为逗号分隔的参数格式
function formatIceServers(servers) {
  if (!Array.isArray(servers)) return ''
  const result = []
  servers.forEach(srv => {
    if (!srv.urls || !Array.isArray(srv.urls)) return
    srv.urls.forEach(url => {
      if ((url.startsWith('turn:') || url.startsWith('turns:')) && srv.username) {
        const prefix = url.startsWith('turn:') ? 'turn:' : 'turns:'
        const hostPart = url.substring(prefix.length)
        result.push(`${prefix}${srv.username}:${srv.credential || ''}@${hostPart}`)
      } else {
        result.push(url)
      }
    })
  })
  return result.join(',')
}

// 从后端接口动态拉取已配置的 ICE 服务器列表
async function fetchIceServers() {
  try {
    const res = await fetch('/api/ice_servers')
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        const formatted = formatIceServers(data)
        if (formatted) {
          fetchedIceServers.value = formatted
        }
      }
    }
  } catch (err) {
    console.error('获取 ICE Servers 失败:', err)
  }
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('已成功复制到剪贴板！')
  }).catch(err => {
    console.error('复制失败:', err)
    alert('复制失败，请手动选择复制。')
  })
}

function copyCommandText() {
  let cmd = ''
  if (quickstartMode.value === 'adb') {
    if (qsActiveOs.value === 'unix') {
      cmd = `./run.sh -id "${quickstartDeviceId.value || 'device_01'}" -signaling "${signalingProtocol.value}${quickstartSignaling.value}" -ice-servers "${computedIceServers.value}"`
    } else if (qsActiveOs.value === 'win') {
      cmd = `run.bat -id "${quickstartDeviceId.value || 'device_01'}" -signaling "${signalingProtocol.value}${quickstartSignaling.value}" -ice-servers "${computedIceServers.value}"`
    }
  } else if (quickstartMode.value === 'magisk') {
    const devIdCmd = quickstartDeviceId.value ? `\ncpctl set CP_AGENT_ID "${quickstartDeviceId.value}"` : ''
    cmd = `su\ncpctl set CP_AGENT_SIGNALING "${signalingProtocol.value}${quickstartSignaling.value}"${devIdCmd}\ncpctl restart`
  }
  copyText(cmd)
}

function toggleSelectedTag(tagId) {
  tagStore.toggleSelectedTag(tagId)
  // 选择标签时退出离线筛选视图
  deviceStore.showOfflineOnly = false
}

onMounted(async () => {
  quickstartSignaling.value = window.location.host
  deviceStore.fetchDevices()
  refreshInterval = setInterval(() => {
    deviceStore.fetchDevices()
  }, 10000)
  window.addEventListener('cloudphone-open-tag-manager', handleOpenTagManagerEvent)
  await fetchIceServers()
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
  window.removeEventListener('cloudphone-open-tag-manager', handleOpenTagManagerEvent)
})

function connectDevice(deviceId) {
  deviceStore.setActiveDevice(deviceId)
}

function handleOpenTagManagerEvent() {
  openTagManager('full')
}
</script>

<style scoped>
.device-list-page {
  padding: 24px;
  min-height: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.device-count {
  font-size: 13px;
  color: var(--text-secondary);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-box {
  width: 260px;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid var(--border);
  border-radius: 7px;
}

.search-box:focus-within {
  border-color: var(--accent);
}

.search-box svg {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

.search-box input {
  min-width: 0;
  flex: 1;
  color: var(--text-primary);
  background: transparent;
  border: none;
  outline: none;
  font-size: 13px;
}

.search-box input::placeholder {
  color: var(--text-secondary);
}

.deploy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 0;
  height: 36px;
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border);
  padding: 0 12px;
  border-radius: 7px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.toolbar-icon,
.btn-label {
  display: inline-flex;
  align-items: center;
}

.toolbar-icon {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

.deploy-btn.secondary {
  background: rgba(255, 255, 255, 0.035);
  color: #d0d7de;
}

.deploy-btn.primary {
  color: #fff;
  background: rgba(88, 166, 255, 0.18);
  border-color: rgba(88, 166, 255, 0.35);
}

.mobile-tag-action {
  display: none;
}

.deploy-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.16);
}

.deploy-btn.primary:hover {
  background: rgba(88, 166, 255, 0.26);
  border-color: rgba(88, 166, 255, 0.5);
}

.size-control {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid var(--border);
  border-radius: 7px;
}

.preview-mode-switch {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid var(--border);
  border-radius: 7px;
}

.switch-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.switch-label.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.switch-label.disabled .switch-checkbox {
  cursor: not-allowed;
}

.switch-checkbox {
  cursor: pointer;
  accent-color: var(--accent);
}

.switch-text {
  font-size: 13px;
  color: var(--text-secondary);
}

.size-control .label {
  font-size: 13px;
  color: var(--text-secondary);
}

.size-slider {
  width: 96px;
  height: 4px;
  -webkit-appearance: none;
  background: var(--border);
  border-radius: 2px;
  outline: none;
}

.size-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: var(--accent);
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.1s;
}

.size-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.size-value {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 40px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.content-layout {
  display: block;
}

.mobile-tag-bar {
  display: none;
}

.tag-filter {
  width: 100%;
  min-width: 0;
  height: 34px;
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-primary);
  background: transparent;
  text-align: left;
  font-size: 12px;
}

.tag-filter:hover {
  background: rgba(255, 255, 255, 0.06);
}

.tag-filter.active {
  border-color: var(--accent);
  background: rgba(233, 69, 96, 0.16);
}

.tag-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.tag-dot.all {
  background: var(--accent);
}

.tag-dot.offline {
  background: #8b949e;
}

.tag-name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.tag-count {
  min-width: 22px;
  padding: 1px 6px;
  border-radius: 999px;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.08);
  font-size: 11px;
  text-align: center;
}

.btn-refresh-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.btn-refresh-icon:hover {
  background: rgba(255, 255, 255, 0.05);
}

.grid-container {
  min-width: 0;
  width: 100%;
}

.device-grid {
  display: grid;
  gap: 20px;
}

.offline-section {
  margin-top: 28px;
  padding-top: 16px;
  border-top: 1px dashed var(--border);
}

.offline-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.offline-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary, #94a3b8);
}

.offline-section-count {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.15);
  color: var(--text-secondary, #94a3b8);
}

.offline-grid :deep(.device-card) {
  filter: grayscale(0.55);
  opacity: 0.72;
  transition: filter 0.2s ease, opacity 0.2s ease;
}

.offline-grid :deep(.device-card:hover) {
  filter: grayscale(0.2);
  opacity: 0.95;
}

.state-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 0;
  color: var(--text-secondary);
  text-align: center;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.state-view h3 {
  margin: 0 0 8px 0;
  color: var(--text-primary);
}

/* 移动端适配 */
@media (max-width: 1024px) {
  .device-list-page {
    padding: 8px 10px;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .page-header {
    align-items: stretch;
    gap: 8px;
    margin-bottom: 8px;
    padding-bottom: 8px;
    flex-direction: column;
  }

  .header-left {
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .device-count {
    flex: 0 0 auto;
    font-size: 12px;
  }

  .header-controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 36px 36px;
    gap: 8px;
    align-items: center;
  }

  .search-box {
    width: auto;
    height: 36px;
  }

  .header-actions {
    display: contents;
  }

  .mobile-tag-action {
    display: flex;
  }

  .deploy-btn {
    width: 36px;
    min-width: 36px;
    height: 36px;
    justify-content: center;
    padding: 0;
    border-radius: 8px;
  }

  .deploy-btn:hover {
    background: rgba(255, 255, 255, 0.09);
  }

  .deploy-btn .btn-label {
    display: none;
  }
  
  .size-control {
    display: none !important;
  }

  .content-layout {
    min-height: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mobile-tag-bar {
    display: flex;
    flex-direction: row;
    gap: 8px;
    padding: 0 0 2px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .mobile-tag-bar::-webkit-scrollbar {
    display: none;
  }

  .tag-filter {
    width: auto;
    min-width: max-content;
    height: 30px;
    grid-template-columns: 8px minmax(0, auto) auto;
    border-color: var(--border);
    border-radius: 999px;
  }

  .hide-on-mobile {
    display: none !important;
  }

  .grid-container {
    flex: 1;
    display: flex;
    align-items: stretch;
    overflow: hidden;
  }

  .device-grid {
    /* 移动端采用左右滑动模式 */
    display: flex !important;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    gap: 16px;
    padding: 12px 8px 18px;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    -webkit-overflow-scrolling: touch;
  }

  .device-grid::-webkit-scrollbar {
    display: none; /* 隐藏滑动条 */
  }

  .device-grid > * {
    /* 每个卡片宽度占据屏幕大部 */
    min-width: 80vw;
    max-width: 80vw;
    height: calc(100% - 4px);
    scroll-snap-align: center;
  }
  
  .page-title {
    font-size: 16px;
  }
}

/* 群控开关样式 */
/* 群控快捷操作面板 */
.group-quick-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 4px 10px;
  margin-right: 12px;
}

.action-btn-mini {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn-mini:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.2);
}

.action-btn-mini.dropdown-trigger {
  position: relative;
}

/* 标签下拉菜单 */
.tag-select-dropdown {
  position: relative;
}

.tag-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 6px;
  background: #161b22;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  z-index: 100;
  min-width: 130px;
  padding: 6px 0;
  max-height: 200px;
  overflow-y: auto;
}

.tag-dropdown-menu::-webkit-scrollbar {
  width: 4px;
}

.tag-dropdown-menu::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.tag-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s ease;
  font-size: 12px;
  color: var(--text-primary);
}

.tag-dropdown-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.tag-color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tag-dropdown-empty {
  padding: 8px 12px;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
}

.selected-count-badge {
  font-size: 11px;
  color: var(--accent);
  background: rgba(26, 115, 232, 0.12);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.group-mode-badge {
  font-size: 11px;
  color: #ff9f43;
  background: rgba(255, 159, 67, 0.12);
  border: 1px solid rgba(255, 159, 67, 0.25);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 简单淡入动画 */
.animate-fade-in {
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Quickstart 接入指引样式 */
.quickstart-container {
  max-width: 1200px;
  margin: 30px auto;
  padding: 0 24px;
  color: var(--text-primary);
}

.quickstart-header {
  text-align: center;
  margin-bottom: 32px;
}

.quickstart-header .empty-icon {
  font-size: 56px;
  margin-bottom: 16px;
}

.qs-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 12px 0;
  background: linear-gradient(135deg, #58a6ff 0%, #bc8cff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.qs-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 680px;
  margin: 0 auto;
  opacity: 0.85;
}

.quickstart-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

@media (min-width: 768px) {
  .quickstart-layout {
    grid-template-columns: 1fr 1fr;
  }
}

.qs-card-box {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 24px;
  position: relative;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
}

.qs-card-box:hover {
  transform: translateY(-2px);
  border-color: rgba(88, 166, 255, 0.4);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.3);
}

.qs-card-box.highlight {
  background: rgba(88, 166, 255, 0.03);
  border-color: rgba(88, 166, 255, 0.25);
}

.qs-card-box.highlight:hover {
  border-color: rgba(88, 166, 255, 0.6);
}

.qs-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  background: #238636;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 99px;
  text-transform: uppercase;
}

.qs-card-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: #c9d1d9;
}

.qs-card-box.highlight .qs-card-title {
  color: #58a6ff;
}

.qs-card-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 24px 0;
  flex: 1;
}

.qs-action-wrapper {
  margin-top: auto;
}

.qs-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 42px;
  background: #238636;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.qs-btn-primary:hover {
  background: #2ea043;
}

.qs-btn-icon {
  width: 16px;
  height: 16px;
}

/* 方式二：手动配置与命令行样式 */
.qs-form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-bottom: 18px;
}

@media (min-width: 480px) {
  .qs-form-grid {
    grid-template-columns: 1.2fr 1fr;
  }
}

.qs-form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.qs-form-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.qs-form-input {
  height: 34px;
  padding: 0 10px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
}

.qs-form-input:focus {
  border-color: var(--accent);
}

/* 真实配置列表 */
.qs-real-config {
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 18px;
}

.qs-config-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.qs-config-row:last-child {
  border-bottom: none;
}

.qs-config-label {
  color: var(--text-secondary);
  font-weight: 500;
  width: 120px;
  flex-shrink: 0;
}

.qs-config-val {
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: #58a6ff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.qs-config-copy {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
}

.qs-config-copy:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--text-primary);
}

/* 步骤块 */
.qs-step-block {
  margin-bottom: 18px;
}

.qs-step-title {
  font-size: 12px;
  font-weight: 600;
  color: #8b949e;
  margin-bottom: 10px;
}

.qs-download-row {
  display: flex;
}

.qs-download-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(88, 166, 255, 0.1);
  border: 1px solid rgba(88, 166, 255, 0.25);
  color: #58a6ff;
  border-radius: 8px;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
  width: 100%;
}

.qs-download-link:hover {
  background: rgba(88, 166, 255, 0.18);
  border-color: rgba(88, 166, 255, 0.5);
}

/* 终端/代码切换 */
.qs-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}

.qs-tab {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 4px 10px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.qs-tab:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}

.qs-tab.active {
  background: rgba(88, 166, 255, 0.15);
  color: #58a6ff;
  font-weight: 600;
}

.qs-mode-selector {
  display: flex;
  gap: 8px;
  background: rgba(0, 0, 0, 0.2);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--border);
  margin-bottom: 20px;
}

.qs-mode-btn {
  flex: 1;
  padding: 8px 12px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.qs-mode-btn:hover {
  color: var(--text-primary);
}

.qs-mode-btn.active {
  background: var(--bg-surface, rgba(88, 166, 255, 0.15));
  color: #58a6ff;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.qs-mode-btn.magisk-qs-mode.active {
  background: rgba(168, 85, 247, 0.2);
  color: #c084fc;
}

.qs-terminal {
  position: relative;
  background: #0d1117;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
  padding-bottom: 40px;
}

.qs-code-text {
  margin: 0;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 11.5px;
  color: #c9d1d9;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-x: auto;
}

.qs-copy-btn {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
  font-size: 11px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.qs-copy-btn:hover {
  background: #30363d;
  border-color: #8b949e;
}

.qs-download-link.magisk-qs-btn {
  background: rgba(168, 85, 247, 0.1);
  border-color: rgba(168, 85, 247, 0.4);
  color: #c084fc;
}

.qs-download-link.magisk-qs-btn:hover {
  background: rgba(168, 85, 247, 0.2);
  border-color: #a855f7;
  color: #e9d5ff;
}

/* 警告提示及准备条件样式 */
.qs-card-desc-warn {
  font-size: 11.5px;
  color: #ff7675;
  margin-top: -12px;
  margin-bottom: 20px;
  line-height: 1.5;
  background: rgba(255, 118, 117, 0.08);
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 118, 117, 0.15);
}

.qs-prerequisites {
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 20px;
}

.qs-prereq-title {
  font-size: 12px;
  font-weight: 600;
  color: #ff9f43;
  margin-bottom: 6px;
}

.qs-prereq-list {
  margin: 0;
  padding-left: 18px;
  font-size: 11.5px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.qs-prereq-list li {
  margin-bottom: 4px;
}

.qs-prereq-list li:last-child {
  margin-bottom: 0;
}
</style>
