<template>
  <div class="dashboard-container">
    <!-- 区域 A: 全局指标切换与摘要卡片 -->
    <div class="summary-cards">
      <div 
        v-for="card in metricConfigs" 
        :key="card.key"
        class="summary-card"
        :class="{ active: currentMetric === card.key }"
        @click="currentMetric = card.key"
      >
        <div class="card-icon" :style="{ color: card.color }">
          <div v-html="card.iconSvg"></div>
        </div>
        <div class="card-info">
          <span class="card-label">{{ card.label }}</span>
          <span class="card-value">{{ getClusterValueStr(card.key) }}</span>
        </div>
        <div class="card-stats">
          <div class="stat-item">
            <span class="stat-lbl">告警数</span>
            <span class="stat-val" :class="{ warning: getWarningCount(card.key) > 0 }">
              {{ getWarningCount(card.key) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 数据大盘汇总信息栏 -->
    <div class="global-bar">
      <div class="bar-item">
        <span class="bar-label">在线设备数</span>
        <span class="bar-value accent">{{ onlineCount }}</span>
      </div>
      <div class="bar-item">
        <span class="bar-label">监控频率</span>
        <span class="bar-value">5秒 / 次</span>
      </div>
      <div class="bar-item">
        <span class="bar-label">告警判定</span>
        <span class="bar-value text-warning">{{ currentMetricConfig.warningLabel }}</span>
      </div>
    </div>

    <!-- 区域 B: 折线趋势图 -->
    <div class="chart-section">
      <div class="chart-header">
        <div class="title-area">
          <span class="chart-title">{{ currentMetricConfig.label }} 实时趋势图 (最近 {{ timeWindow === 60 ? '5' : (timeWindow === 120 ? '10' : '30') }} 分钟)</span>
          <select v-model="timeWindow" class="window-select">
            <option :value="60">5 分钟</option>
            <option :value="120">10 分钟</option>
            <option :value="360">30 分钟</option>
          </select>
        </div>
        <span class="chart-subtitle">
          提示: 默认仅展示告警设备。点击下方矩阵方块可锁定/移除指定设备的趋势线。
        </span>
      </div>
      <div class="chart-wrapper">
        <div ref="chartRef" class="realtime-chart"></div>
      </div>
    </div>

    <!-- 区域 C: 设备热力状态矩阵 -->
    <div class="matrix-section">
      <div class="matrix-header">
        <span class="matrix-title">设备热力状态矩阵</span>
        <div class="legend-group">
          <span class="legend-item"><span class="dot normal"></span>正常</span>
          <span class="legend-item"><span class="dot alert-yellow"></span>告警</span>
          <span class="legend-item"><span class="dot alert-red"></span>严重</span>
          <span class="legend-item"><span class="dot alert-offline"></span>离线/休眠</span>
        </div>
      </div>
      <div class="matrix-grid">
        <!-- 在线设备 -->
        <div 
          v-for="dev in onlineDevices" 
          :key="dev.id"
          class="device-tile"
          :class="[getDeviceStatusClass(dev), { selected: selectedDeviceIds.has(dev.id) }]"
          @click="toggleDeviceSelection(dev.id)"
        >
          <div class="tile-header">
            <span class="tile-id" :title="dev.id">{{ dev.id }}</span>
            <span class="tile-checkbox" v-if="selectedDeviceIds.has(dev.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
          </div>
          <div class="tile-body">
            <span class="tile-val">{{ getDeviceMetricValueStr(dev) }}</span>
          </div>
        </div>

        <!-- 离线/休眠设备 -->
        <div 
          v-for="dev in offlineDevices" 
          :key="dev.id"
          class="device-tile status-offline"
          :title="'掉线时间: ' + formatTimeStr(dev.lastOffline) + '\n最后在线: ' + formatTimeStr(dev.lastSeen)"
          @click="showOfflineDetail(dev)"
        >
          <div class="tile-header">
            <span class="tile-id" :title="dev.id">{{ dev.id }}</span>
            <span class="tile-offline-badge">离线</span>
          </div>
          <div class="tile-body">
            <span class="tile-val">OFFLINE</span>
          </div>
        </div>

        <div v-if="onlineDevices.length === 0 && offlineDevices.length === 0" class="no-devices-placeholder">
          暂无在线或离线设备数据进行指标采集
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import * as echarts from 'echarts'

const deviceStore = useDeviceStore()
const currentMetric = ref('cpu')
const timeWindow = ref(60)
const selectedDeviceIds = ref(new Set())
const offlineDevices = computed(() => deviceStore.offlineDevices)
const chartRef = ref(null)
let chartInstance = null

const metricConfigs = [
  {
    key: 'cpu',
    label: 'CPU 使用率',
    unit: '%',
    color: '#3b82f6',
    warningLabel: '正常 <=70% | 告警 >70% | 严重 >85%',
    iconSvg: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <line x1="9" y1="9" x2="15" y2="9" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="15" y2="17" />
      </svg>
    `
  },
  {
    key: 'memory',
    label: '内存使用率',
    unit: '%',
    color: '#10b981',
    warningLabel: '正常 <=75% | 告警 >75% | 严重 >90%',
    iconSvg: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="6" y1="9" x2="6" y2="15" />
        <line x1="10" y1="9" x2="10" y2="15" />
        <line x1="14" y1="9" x2="14" y2="15" />
        <line x1="18" y1="9" x2="18" y2="15" />
      </svg>
    `
  },
  {
    key: 'disk',
    label: '系统盘占用',
    unit: '%',
    color: '#f59e0b',
    warningLabel: '正常 <=80% | 告警 >80% | 严重 >90%',
    iconSvg: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;">
        <path d="M22 12H2" />
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6L18.55 5.11A2 2 0 0 0 16.73 4H7.27a2 2 0 0 0-1.82 1.11z" />
        <circle cx="6" cy="16" r="1" />
        <circle cx="10" cy="16" r="1" />
      </svg>
    `
  },
  {
    key: 'temp',
    label: '设备温度',
    unit: '℃',
    color: '#ef4444',
    warningLabel: '正常 <=65℃ | 告警 >65℃ | 严重 >75℃',
    iconSvg: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;">
        <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
      </svg>
    `
  },
  {
    key: 'downSpeed',
    label: '下载速度',
    unit: ' KB/s',
    color: '#818cf8',
    warningLabel: '实时下行带宽流量 (无限制)',
    iconSvg: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;">
        <line x1="12" y1="5" x2="12" y2="19" />
        <polyline points="19 12 12 19 5 12" />
      </svg>
    `
  },
  {
    key: 'upSpeed',
    label: '上传速度',
    unit: ' KB/s',
    color: '#c084fc',
    warningLabel: '实时上行带宽流量 (无限制)',
    iconSvg: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;">
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
      </svg>
    `
  }
]

const currentMetricConfig = computed(() => {
  return metricConfigs.find(c => c.key === currentMetric.value)
})

const onlineDevices = computed(() => deviceStore.onlineDevices)
const onlineCount = computed(() => onlineDevices.value.length)

function getMetricRawValue(device, key) {
  if (!device.metrics) return 0
  if (key === 'cpu') return device.metrics.cpu || 0
  if (key === 'memory') return device.metrics.memory_percent || 0
  if (key === 'disk') return device.metrics.disk_percent || 0
  if (key === 'temp') return device.metrics.temperature || 0
  if (key === 'downSpeed') return device.metrics.download_speed || 0
  if (key === 'upSpeed') return device.metrics.upload_speed || 0
  return 0
}

function getClusterValueStr(metricKey) {
  let devs = onlineDevices.value.filter(d => d.metrics)
  if (selectedDeviceIds.value.size > 0) {
    const selectedDevs = devs.filter(d => selectedDeviceIds.value.has(d.id))
    if (selectedDevs.length > 0) {
      devs = selectedDevs
    }
  }

  if (devs.length === 0) {
    if (metricKey === 'downSpeed' || metricKey === 'upSpeed') return '0.0 KB/s'
    return '0.0' + (metricKey === 'temp' ? '℃' : '%')
  }
  let sum = 0
  devs.forEach(d => {
    sum += getMetricRawValue(d, metricKey)
  })
  const avg = sum / devs.length

  if (metricKey === 'downSpeed' || metricKey === 'upSpeed') {
    if (avg >= 1024) {
      return (avg / 1024.0).toFixed(1) + ' MB/s'
    }
    return avg.toFixed(1) + ' KB/s'
  }
  const unit = metricKey === 'temp' ? '℃' : '%'
  return avg.toFixed(1) + unit
}

function getWarningCount(metricKey) {
  if (metricKey === 'downSpeed' || metricKey === 'upSpeed') return 0
  let devs = onlineDevices.value
  if (selectedDeviceIds.value.size > 0) {
    const selectedDevs = devs.filter(d => selectedDeviceIds.value.has(d.id))
    if (selectedDevs.length > 0) {
      devs = selectedDevs
    }
  }

  let count = 0
  devs.forEach(d => {
    if (d.metrics) {
      const val = getMetricRawValue(d, metricKey)
      if (metricKey === 'cpu' && val > 70) count++
      else if (metricKey === 'memory' && val > 75) count++
      else if (metricKey === 'disk' && val > 80) count++
      else if (metricKey === 'temp' && val > 65) count++
    }
  })
  return count
}

function getDeviceStatusClass(device) {
  if (!device.metrics) return 'status-none'
  const key = currentMetric.value
  const val = getMetricRawValue(device, key)
  if (key === 'downSpeed' || key === 'upSpeed') return 'status-green'
  if (key === 'cpu') {
    if (val > 85) return 'status-red'
    if (val > 70) return 'status-yellow'
  } else if (key === 'memory') {
    if (val > 90) return 'status-red'
    if (val > 75) return 'status-yellow'
  } else if (key === 'disk') {
    if (val > 90) return 'status-red'
    if (val > 80) return 'status-yellow'
  } else if (key === 'temp') {
    if (val > 75) return 'status-red'
    if (val > 65) return 'status-yellow'
  }
  return 'status-green'
}

function getDeviceMetricValueStr(device) {
  if (!device.metrics) return 'N/A'
  const key = currentMetric.value
  const val = getMetricRawValue(device, key)
  if (key === 'downSpeed' || key === 'upSpeed') {
    if (val >= 1024) {
      return (val / 1024.0).toFixed(1) + ' MB/s'
    }
    return val.toFixed(1) + ' KB/s'
  }
  const unit = key === 'temp' ? '℃' : '%'
  return val.toFixed(1) + unit
}

function toggleDeviceSelection(deviceId) {
  if (selectedDeviceIds.value.has(deviceId)) {
    selectedDeviceIds.value.delete(deviceId)
  } else {
    selectedDeviceIds.value.add(deviceId)
  }
  selectedDeviceIds.value = new Set(selectedDeviceIds.value)
  updateChart()
}

function updateChart() {
  if (!chartInstance) return

  let devicesToRender = []
  if (selectedDeviceIds.value.size > 0) {
    devicesToRender = onlineDevices.value.filter(d => selectedDeviceIds.value.has(d.id))
  } else {
    const warningDevs = onlineDevices.value.filter(d => {
      const cls = getDeviceStatusClass(d)
      return cls === 'status-red' || cls === 'status-yellow'
    })
    if (warningDevs.length > 0) {
      devicesToRender = warningDevs.slice(0, 3)
    } else {
      devicesToRender = onlineDevices.value.slice(0, 3)
    }
  }

  const series = []
  let globalTimestamps = []
  const L = timeWindow.value

  devicesToRender.forEach(dev => {
    const history = deviceStore.deviceHistory[dev.id]
    if (history && history.timestamps && history.timestamps.length > 0) {
      const slicedTimestamps = history.timestamps.slice(-L)
      if (slicedTimestamps.length > globalTimestamps.length) {
        globalTimestamps = slicedTimestamps
      }

      let rawData = []
      if (currentMetric.value === 'cpu') rawData = history.cpu
      else if (currentMetric.value === 'memory') rawData = history.memory
      else if (currentMetric.value === 'disk') rawData = history.disk
      else if (currentMetric.value === 'temp') rawData = history.temp
      else if (currentMetric.value === 'downSpeed') rawData = history.downSpeed
      else if (currentMetric.value === 'upSpeed') rawData = history.upSpeed

      series.push({
        name: dev.id,
        type: 'line',
        data: rawData.slice(-L),
        smooth: true,
        showSymbol: false,
        lineStyle: {
          width: 3
        },
        areaStyle: {
          opacity: 0.05
        }
      })
    }
  })

  if (globalTimestamps.length === 0) {
    const dummyCount = Math.min(L, 12)
    globalTimestamps = Array.from({ length: dummyCount }, (_, i) => {
      const d = new Date(Date.now() - (dummyCount - i) * 5000)
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
    })
  }

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(30, 41, 59, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      borderWidth: 1,
      textStyle: {
        color: '#f3f4f6',
        fontSize: 12
      },
      axisPointer: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.2)',
          type: 'dashed'
        }
      }
    },
    legend: {
      data: devicesToRender.map(d => d.id),
      textStyle: {
        color: '#9ca3af'
      },
      top: 0
    },
    grid: {
      left: '2%',
      right: '2%',
      bottom: '3%',
      top: '12%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: globalTimestamps,
      axisLabel: {
        color: '#9ca3af',
        fontSize: 11
      },
      axisLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.08)'
        }
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#9ca3af',
        fontSize: 11,
        formatter: (value) => {
          const unit = currentMetricConfig.value.unit;
          if (unit.trim() === 'KB/s') {
            if (value >= 1024) {
              return (value / 1024.0).toFixed(1) + ' MB/s';
            }
            return value.toFixed(0) + ' KB/s';
          }
          return value + ' ' + unit;
        }
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.04)'
        }
      },
      axisLine: {
        show: false
      }
    },
    series: series
  }

  chartInstance.setOption(option, true)
}

function handleResize() {
  if (chartInstance) {
    chartInstance.resize()
  }
}

watch(
  () => deviceStore.deviceHistory,
  () => {
    updateChart()
  },
  { deep: true }
)

watch(currentMetric, () => {
  updateChart()
})

watch(timeWindow, () => {
  updateChart()
})

onMounted(() => {
  if (chartRef.value) {
    chartInstance = echarts.init(chartRef.value, 'dark')
    updateChart()
  }
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
})

function formatTimeStr(isoStr) {
  if (!isoStr) return '未知'
  try {
    const d = new Date(isoStr)
    const yyyy = d.getFullYear()
    const MM = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`
  } catch (e) {
    return isoStr
  }
}

function showOfflineDetail(device) {
  let msg = `设备 ID: ${device.id}\n状态: 离线 / 休眠断联\n\n`
  if (device.lastOffline) {
    msg += `掉线时间: ${formatTimeStr(device.lastOffline)}\n`
  }
  if (device.lastSeen) {
    msg += `最后在线时间: ${formatTimeStr(device.lastSeen)}\n`
  }
  if (device.metrics) {
    msg += `\n掉线前最后采集指标:\n`
    msg += `- CPU 使用率: ${(device.metrics.cpu || 0).toFixed(1)}%\n`
    msg += `- 内存使用率: ${(device.metrics.memory_percent || 0).toFixed(1)}%\n`
    msg += `- 系统盘占用: ${(device.metrics.disk_percent || 0).toFixed(1)}%\n`
    msg += `- 设备核心温度: ${(device.metrics.temperature || 0).toFixed(1)}℃\n`
  } else {
    msg += `\n(该设备无历史指标上报纪录)`
  }
  alert(msg)
}
</script>

<style scoped>
.dashboard-container {
  padding: 24px;
  background: var(--bg-main, #0f172a);
  min-height: calc(100vh - 120px);
  color: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
}

/* 区域 A: 摘要卡片 */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.summary-card {
  background: rgba(30, 41, 59, 0.5);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.summary-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 100%);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.summary-card:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
}

.summary-card:hover::before {
  opacity: 1;
}

.summary-card.active {
  background: rgba(30, 41, 59, 0.85);
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: 0 0 15px rgba(99, 102, 241, 0.15);
}

.card-icon {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-info {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

.card-label {
  font-size: 13px;
  color: #94a3b8;
  font-weight: 500;
}

.card-value {
  font-size: 20px;
  font-weight: 700;
  color: #f1f5f9;
  margin-top: 2px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.card-stats {
  font-size: 11px;
  color: #64748b;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  padding-left: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.stat-lbl {
  color: #64748b;
  margin-bottom: 2px;
}

.stat-val {
  font-weight: 600;
  color: #94a3b8;
}

.stat-val.warning {
  color: #f59e0b;
}

/* 汇总信息栏 */
.global-bar {
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 12px 20px;
  display: flex;
  gap: 32px;
  font-size: 13px;
}

.bar-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bar-label {
  color: #64748b;
}

.bar-value {
  font-weight: 600;
  color: #cbd5e1;
}

.bar-value.accent {
  color: #6366f1;
}

.text-warning {
  color: #f59e0b !important;
}

/* 区域 B: 折线图 */
.chart-section {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}

.title-area {
  display: flex;
  align-items: center;
  gap: 8px;
}

.window-select {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #cbd5e1;
  font-size: 12px;
  padding: 4px 8px;
  outline: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.window-select:hover {
  background: rgba(30, 41, 59, 0.85);
  border-color: rgba(99, 102, 241, 0.4);
}

.chart-title {
  font-size: 15px;
  font-weight: 600;
  color: #cbd5e1;
}

.chart-subtitle {
  font-size: 12px;
  color: #64748b;
}

.chart-wrapper {
  height: 280px;
  position: relative;
}

.realtime-chart {
  width: 100%;
  height: 100%;
}

/* 区域 C: 热力状态矩阵 */
.matrix-section {
  background: rgba(30, 41, 59, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 12px;
  padding: 20px;
}

.matrix-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.matrix-title {
  font-size: 15px;
  font-weight: 600;
  color: #cbd5e1;
}

.legend-group {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #94a3b8;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot.normal { background: #10b981; }
.dot.alert-yellow { background: #f59e0b; }
.dot.alert-red { background: #ef4444; }
.dot.alert-offline { background: #64748b; }

.matrix-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 12px;
}

.device-tile {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  user-select: none;
}

.device-tile:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.device-tile.selected {
  border-color: #6366f1;
  box-shadow: 0 0 10px rgba(99, 102, 241, 0.2);
}

.tile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.tile-id {
  font-size: 12px;
  font-weight: 500;
  color: #94a3b8;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile-checkbox {
  width: 14px;
  height: 14px;
  background: #6366f1;
  color: white;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tile-checkbox svg {
  width: 10px;
  height: 10px;
}

.tile-body {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 6px 0;
}

.tile-val {
  font-size: 18px;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* 状态色定义 */
.status-green {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.2);
  color: #a7f3d0;
}
.status-green:hover {
  border-color: rgba(16, 185, 129, 0.4);
}

.status-yellow {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.25);
  color: #fde68a;
  animation: pulse-yellow 2s infinite ease-in-out;
}
.status-yellow:hover {
  border-color: rgba(245, 158, 11, 0.45);
}

.status-red {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  animation: pulse-red 2s infinite ease-in-out;
}
.status-red:hover {
  border-color: rgba(239, 68, 68, 0.5);
}

.status-none {
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.05);
  color: #64748b;
}

.no-devices-placeholder {
  grid-column: 1 / -1;
  padding: 40px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.04);
}

@keyframes pulse-yellow {
  0%, 100% { box-shadow: 0 0 0 rgba(245, 158, 11, 0); }
  50% { box-shadow: 0 0 6px rgba(245, 158, 11, 0.15); }
}

@keyframes pulse-red {
  0%, 100% { box-shadow: 0 0 0 rgba(239, 68, 68, 0); }
  50% { box-shadow: 0 0 8px rgba(239, 68, 68, 0.25); }
}

.status-offline {
  background: rgba(148, 163, 184, 0.03) !important;
  border: 1px dashed rgba(148, 163, 184, 0.2) !important;
  color: #64748b !important;
}

.status-offline:hover {
  border-color: rgba(148, 163, 184, 0.4) !important;
  background: rgba(148, 163, 184, 0.08) !important;
  transform: translateY(-1px);
}

.tile-offline-badge {
  font-size: 10px;
  background: rgba(148, 163, 184, 0.12);
  color: #94a3b8;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 600;
}

/* 移动端适配 (<=1024px)：卡片两列、图表与矩阵纵向堆叠、标题行允许换行 */
@media (max-width: 1024px) {
  .dashboard-container {
    padding: 12px;
    gap: 14px;
  }

  /* 摘要卡片改 2 列网格，压缩间距与字号 */
  .summary-cards {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .summary-card {
    padding: 10px 12px;
    gap: 10px;
  }

  .card-icon {
    width: 34px;
    height: 34px;
  }

  .card-label {
    font-size: 11px;
  }

  .card-value {
    font-size: 15px;
  }

  .card-stats {
    display: none;
  }

  /* 汇总信息栏允许换行 */
  .global-bar {
    flex-wrap: wrap;
    gap: 8px 20px;
    padding: 10px 14px;
    font-size: 12px;
  }

  /* 图表区与矩阵区保持纵向堆叠并压缩内边距 */
  .chart-section,
  .matrix-section {
    padding: 14px;
  }

  /* 标题行纵向换行，避免与下拉框互相挤压 */
  .chart-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .title-area {
    flex-wrap: wrap;
  }

  .chart-title {
    font-size: 14px;
  }

  .chart-subtitle {
    font-size: 11px;
  }

  .chart-wrapper {
    height: 220px;
    overflow-x: auto;
  }

  .matrix-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .legend-group {
    flex-wrap: wrap;
    gap: 6px 12px;
    font-size: 11px;
  }

  /* 设备矩阵方块收窄，保证 375px 至少两列 */
  .matrix-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
  }

  .device-tile {
    padding: 8px;
  }

  .tile-id {
    max-width: 70px;
    font-size: 11px;
  }

  .tile-val {
    font-size: 15px;
  }

  .no-devices-placeholder {
    padding: 24px 12px;
  }
}
</style>
