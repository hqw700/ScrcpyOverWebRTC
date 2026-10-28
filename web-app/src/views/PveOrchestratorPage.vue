<template>
  <div class="orchestrator-page">
    <!-- 顶部大盘与概览统计 -->
    <header class="orchestrator-header">
      <div class="header-info">
        <h1 class="header-title">{{ $t('orchestrator.pageTitle') }}</h1>
        <p class="header-subtitle">{{ $t('orchestrator.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <button class="btn-secondary" @click="openConfigModal" :title="$t('orchestrator.btnPveConfig')">
          <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>{{ $t('orchestrator.btnPveConfig') }}</span>
        </button>
        <button class="btn-secondary" @click="fetchData" :disabled="loading">
          <svg class="action-icon" :class="{ spinning: loading }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          <span>{{ $t('orchestrator.btnRefresh') }}</span>
        </button>
        <button class="btn-primary" @click="openCreateModal">
          <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>{{ $t('orchestrator.btnCreateInstance') }}</span>
        </button>
      </div>
    </header>

    <!-- PVE 物理主机集群硬件资源大盘 -->
    <section class="host-resources-section" v-if="hosts.length > 0">
      <div class="host-section-header">
        <div class="host-title-group">
          <svg class="host-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
            <line x1="6" y1="6" x2="6.01" y2="6"></line>
            <line x1="6" y1="18" x2="6.01" y2="18"></line>
          </svg>
          <span class="host-section-title">{{ $t('orchestrator.hostResourcesTitle') }}</span>
          <span class="host-count-badge">{{ hosts.length }} {{ $t('orchestrator.unitNodes') }}</span>
        </div>
        <button class="btn-text-sm" @click="fetchHosts" :title="$t('orchestrator.refreshHostsTip')">
          <svg class="action-icon-sm" :class="{ spinning: loadingHosts }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          <span>{{ $t('orchestrator.refreshHosts') }}</span>
        </button>
      </div>

      <div class="hosts-grid">
        <div class="host-card" v-for="h in hosts" :key="h.cluster_id + '-' + h.node">
          <!-- 头部: 集群名/节点名与状态 -->
          <div class="host-card-header">
            <div class="host-name-box">
              <span class="host-name">{{ h.cluster_name || h.node }}</span>
              <span class="host-node-tag">{{ h.node }}</span>
              <span class="badge-default-cluster" v-if="h.is_default">{{ $t('orchestrator.badgeDefaultCluster') }}</span>
            </div>
            <div class="host-header-right">
              <button class="btn-host-term" @click="openClusterTerminal(h)" :title="$t('orchestrator.btnHostTerminal')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="4 17 10 11 4 5"></polyline>
                  <line x1="12" y1="19" x2="20" y2="19"></line>
                </svg>
                <span>{{ $t('orchestrator.btnHostTerminal') }}</span>
              </button>
              <span class="host-status-badge" :class="h.status === 'online' ? 'online' : 'error'">
                <span class="status-dot"></span>
                {{ h.status === 'online' ? $t('orchestrator.hostOnline') : $t('orchestrator.hostOffline') }}
              </span>
            </div>
          </div>

          <div class="host-metrics-grid" v-if="h.status === 'online'">
            <!-- CPU 指标 -->
            <div class="host-metric-item">
              <div class="metric-top">
                <span class="metric-name">CPU</span>
                <span class="metric-val" :class="getCpuColorClass(h.cpu_usage)">{{ Math.round((h.cpu_usage || 0) * 100) }}%</span>
              </div>
              <div class="host-progress-bar">
                <div class="host-progress-fill" :class="getCpuColorClass(h.cpu_usage)" :style="{ width: Math.round((h.cpu_usage || 0) * 100) + '%' }"></div>
              </div>
              <div class="metric-subtext" :title="(h.cpu_model || '') + (h.loadavg ? ' · 负载 ' + h.loadavg : '')">
                {{ h.cpu_cores ? h.cpu_cores + '核' : '' }} {{ h.loadavg ? '· 负载 ' + h.loadavg.split(',')[0].trim() : '' }}
              </div>
            </div>

            <!-- 物理内存 指标 -->
            <div class="host-metric-item">
              <div class="metric-top">
                <span class="metric-name">{{ $t('orchestrator.hostMetricMem') }}</span>
                <span class="metric-val text-blue">
                  {{ getPercent(h.mem_used_bytes, h.mem_total_bytes) }}%
                </span>
              </div>
              <div class="host-progress-bar">
                <div class="host-progress-fill fill-blue" :style="{ width: getPercent(h.mem_used_bytes, h.mem_total_bytes) + '%' }"></div>
              </div>
              <div class="metric-subtext" :title="formatBytes(h.mem_used_bytes) + ' / ' + formatBytes(h.mem_total_bytes)">
                {{ formatBytes(h.mem_used_bytes) }} / {{ formatBytes(h.mem_total_bytes) }}
              </div>
            </div>

            <!-- 根分区存储 指标 -->
            <div class="host-metric-item">
              <div class="metric-top">
                <span class="metric-name">{{ $t('orchestrator.hostMetricDisk') }}</span>
                <span class="metric-val text-purple">
                  {{ getPercent(h.disk_used_bytes, h.disk_total_bytes) }}%
                </span>
              </div>
              <div class="host-progress-bar">
                <div class="host-progress-fill fill-purple" :style="{ width: getPercent(h.disk_used_bytes, h.disk_total_bytes) + '%' }"></div>
              </div>
              <div class="metric-subtext" :title="formatBytes(h.disk_used_bytes) + ' / ' + formatBytes(h.disk_total_bytes)">
                {{ formatBytes(h.disk_used_bytes) }} / {{ formatBytes(h.disk_total_bytes) }}
              </div>
            </div>
          </div>

          <div class="host-error-box" v-else>
            {{ h.error_msg || $t('orchestrator.hostErrorNotice') }}
          </div>

          <!-- 底部概要信息 -->
          <div class="host-card-footer">
            <span class="footer-tag" :title="$t('orchestrator.containerCountTip')">
              📱 {{ $t('orchestrator.runningCount') }} <b>{{ h.running_containers || 0 }}</b> / {{ h.total_containers || 0 }}
            </span>
            <span class="footer-tag" :title="h.kernel || ''">
              🐧 {{ h.kernel ? h.kernel.split(' ')[0] : 'Linux' }}
            </span>
            <span class="footer-tag" v-if="h.uptime_sec">
              ⏱️ {{ formatUptimeDays(h.uptime_sec) }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- 状态指标看板 -->
    <section class="stats-overview">
      <div class="stat-card">
        <div class="stat-icon-wrapper total">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
            <line x1="12" y1="18" x2="12.01" y2="18"></line>
          </svg>
        </div>
        <div class="stat-content">
          <div class="stat-label">{{ $t('orchestrator.totalInstances') }}</div>
          <div class="stat-value">{{ instances.length }}</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper running">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </div>
        <div class="stat-content">
          <div class="stat-label">{{ $t('orchestrator.runningInstances') }}</div>
          <div class="stat-value text-green">{{ runningCount }}</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper stopped">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="6" y="6" width="12" height="12"></rect>
          </svg>
        </div>
        <div class="stat-content">
          <div class="stat-label">{{ $t('orchestrator.stoppedInstances') }}</div>
          <div class="stat-value text-gray">{{ stoppedCount }}</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper templates">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          </svg>
        </div>
        <div class="stat-content">
          <div class="stat-label">{{ $t('orchestrator.templateCount') }}</div>
          <div class="stat-value text-purple">{{ templates.length }}</div>
        </div>
      </div>
    </section>

    <!-- 筛选过滤与搜索工具栏 -->
    <div class="filter-toolbar">
      <div class="search-input-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          v-model="searchQuery"
          :placeholder="$t('orchestrator.searchPlaceholder')"
          class="search-input"
        />
      </div>

      <div class="filter-chips">
        <button
          class="filter-chip"
          :class="{ active: statusFilter === 'all' }"
          @click="statusFilter = 'all'"
        >
          {{ $t('orchestrator.filterAll') }} ({{ instances.length }})
        </button>
        <button
          class="filter-chip"
          :class="{ active: statusFilter === 'running' }"
          @click="statusFilter = 'running'"
        >
          <span class="chip-dot dot-green"></span>
          {{ $t('orchestrator.filterRunning') }} ({{ runningCount }})
        </button>
        <button
          class="filter-chip"
          :class="{ active: statusFilter === 'stopped' }"
          @click="statusFilter = 'stopped'"
        >
          <span class="chip-dot dot-gray"></span>
          {{ $t('orchestrator.filterStopped') }} ({{ stoppedCount }})
        </button>
      </div>
    </div>

    <!-- 实例卡片矩阵 -->
    <section class="instances-container">
      <div v-if="loading && instances.length === 0" class="loading-state">
        <div class="spinner"></div>
      </div>

      <div v-else-if="filteredInstances.length === 0" class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
          <line x1="12" y1="18" x2="12.01" y2="18"></line>
        </svg>
        <p>{{ instances.length === 0 ? $t('orchestrator.noInstances') : $t('orchestrator.noMatchingInstances') }}</p>
      </div>

      <div v-else class="instance-cards-grid">
        <div
          v-for="inst in filteredInstances"
          :key="inst.vmid"
          class="instance-card"
          :class="{ 'is-running': inst.status === 'running', 'is-stopped': inst.status === 'stopped' }"
        >
          <!-- 卡片头部: 状态指示与基础标识 -->
          <div class="card-header">
            <div class="instance-main-title">
              <span class="status-indicator" :class="inst.status"></span>
              <span class="instance-name" :title="inst.name">{{ inst.name }}</span>
            </div>
            <div class="header-badges">
              <button
                class="terminal-icon-btn"
                :class="{ 'is-active': inst.status === 'running' }"
                :disabled="inst.status !== 'running'"
                :title="inst.status === 'running' ? $t('orchestrator.btnTerminalTip') : $t('orchestrator.terminalStoppedTip')"
                @click="openTerminal(inst)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="4 17 10 11 4 5"></polyline>
                  <line x1="12" y1="19" x2="20" y2="19"></line>
                </svg>
                <span>{{ $t('orchestrator.btnTerminal') }}</span>
              </button>
              <span class="vmid-badge">CT {{ inst.vmid }}</span>
            </div>
          </div>

          <!-- 网络与 ADB 连接 -->
          <div class="endpoint-box">
            <div class="endpoint-row">
              <span class="endpoint-label">{{ $t('orchestrator.cardIp') }}:</span>
              <span class="endpoint-value">{{ inst.ip || '-' }}</span>
            </div>
            <div class="endpoint-row adb-row" v-if="inst.ip">
              <span class="endpoint-label">{{ $t('orchestrator.cardAdb') }}:</span>
              <span class="endpoint-value font-mono">{{ inst.ip }}:5555</span>
              <button class="copy-btn" @click="copyText(`${inst.ip}:5555`)" :title="$t('orchestrator.cardAdb')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          </div>

          <!-- 规格参数胶囊面板 -->
          <div class="specs-panel">
            <div class="spec-row">
              <span class="spec-name">{{ $t('orchestrator.cardSpec') }}</span>
              <span class="spec-badge">{{ inst.spec?.cores }}C / {{ Math.round((inst.spec?.memory_mb || 0) / 1024) }}GB / {{ inst.spec?.disk_gb }}GB</span>
            </div>
            <div class="spec-row">
              <span class="spec-name">{{ $t('orchestrator.cardDisplay') }}</span>
              <span class="spec-badge">{{ inst.display?.width }}x{{ inst.display?.height }} @ {{ inst.display?.fps }}fps</span>
            </div>
            <div class="spec-row">
              <span class="spec-name">{{ $t('orchestrator.cardOutlet') }}</span>
              <span class="spec-badge outlet-badge">{{ inst.outlet_name || inst.network_outlet || inst.outlet_id || '局域网直连' }}</span>
            </div>
            <div class="spec-row" v-if="inst.cluster_id || inst.node">
              <span class="spec-name">{{ $t('orchestrator.cardCluster') }}</span>
              <span class="spec-badge cluster-badge">{{ getClusterName(inst.cluster_id) }} ({{ inst.node || 'pve' }})</span>
            </div>
            <div class="spec-row" v-if="inst.template_name || inst.template_id || inst.template_vmid">
              <span class="spec-name">{{ $t('orchestrator.cardTemplate') }}</span>
              <span class="spec-badge template-badge">{{ inst.template_name || (inst.template_vmid ? 'Tmpl ' + inst.template_vmid : inst.template_id) }}</span>
            </div>
          </div>

          <!-- 实时资源占用监控条 (仅在运行中展示) -->
          <div class="metrics-panel" v-if="inst.status === 'running'">
            <!-- 1. CPU -->
            <div class="metric-item">
              <div class="metric-header">
                <span class="metric-title">CPU</span>
                <span class="metric-val">{{ Math.round((inst.cpu_usage || 0) * 100) }}%</span>
              </div>
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :class="{
                    'fill-green': (inst.cpu_usage || 0) < 0.7,
                    'fill-yellow': (inst.cpu_usage || 0) >= 0.7 && (inst.cpu_usage || 0) < 0.85,
                    'fill-red': (inst.cpu_usage || 0) >= 0.85
                  }"
                  :style="{ width: Math.min(100, Math.round((inst.cpu_usage || 0) * 100)) + '%' }"
                ></div>
              </div>
            </div>
            <!-- 2. 内存 (Mem) -->
            <div class="metric-item">
              <div class="metric-header">
                <span class="metric-title">{{ $t('orchestrator.metricMem') }}</span>
                <span class="metric-val">{{ inst.mem_used_mb || 0 }} / {{ inst.spec?.memory_mb || '-' }} MB</span>
              </div>
              <div class="progress-bar">
                <div
                  class="progress-fill fill-blue"
                  :style="{ width: Math.min(100, Math.round(((inst.mem_used_mb || 0) / (inst.spec?.memory_mb || 1)) * 100)) + '%' }"
                ></div>
              </div>
            </div>
            <!-- 3. 存储 (ROM) -->
            <div class="metric-item">
              <div class="metric-header">
                <span class="metric-title">{{ $t('orchestrator.metricDisk') }}</span>
                <span class="metric-val">{{ (inst.disk_used_gb || 0).toFixed(1) }} / {{ inst.spec?.disk_gb || '-' }} GB</span>
              </div>
              <div class="progress-bar">
                <div
                  class="progress-fill fill-purple"
                  :style="{ width: Math.min(100, Math.round(((inst.disk_used_gb || 0) / (inst.spec?.disk_gb || 1)) * 100)) + '%' }"
                ></div>
              </div>
            </div>
          </div>

          <!-- 操作动作栏 (两行优雅栅格，防止小卡片横向拥挤导致文字竖向换行) -->
          <div class="card-footer-actions">
            <!-- 第 1 行：日常电源控制 -->
            <div class="footer-power-row">
              <button
                v-if="inst.status === 'stopped'"
                class="btn-action start-btn full-width"
                :disabled="actionPending[inst.vmid]"
                @click="handlePowerAction(inst, 'start')"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span>{{ $t('orchestrator.btnPowerStart') }}</span>
              </button>

              <template v-else-if="inst.status === 'running'">
                <button
                  class="btn-action stop-btn"
                  :disabled="actionPending[inst.vmid]"
                  @click="handlePowerAction(inst, 'stop')"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="6" y="6" width="12" height="12"></rect>
                  </svg>
                  <span>{{ $t('orchestrator.btnPowerStop') }}</span>
                </button>

                <button
                  class="btn-action restart-btn"
                  :disabled="actionPending[inst.vmid]"
                  @click="handlePowerAction(inst, 'restart')"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                  </svg>
                  <span>{{ $t('orchestrator.btnPowerRestart') }}</span>
                </button>
              </template>
            </div>

            <!-- 第 2 行：运维与母本高级操作 -->
            <div class="footer-ops-row">
              <!-- 快速重置 (2秒重建) -->
              <button
                class="btn-action reset-btn"
                :disabled="actionPending[inst.vmid]"
                :title="$t('orchestrator.btnResetTip')"
                @click="handleReset(inst)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
                </svg>
                <span>{{ $t('orchestrator.btnReset') }}</span>
              </button>

              <!-- 固化为母本 -->
              <button
                class="btn-action convert-btn"
                :disabled="actionPending[inst.vmid]"
                :title="$t('orchestrator.btnConvertToTemplateTip')"
                @click="openConvertModal(inst)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                <span>{{ $t('orchestrator.btnConvertToTemplate') }}</span>
              </button>

              <!-- 永久销毁 -->
              <button
                class="btn-action danger-btn"
                :disabled="actionPending[inst.vmid]"
                :title="$t('orchestrator.btnDestroyTip')"
                @click="handleDestroy(inst)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 开通实例模态窗 (Modal) - 防误触：禁止点击空白遮罩退出 -->
    <div class="modal-overlay" v-if="showCreateModal">
      <div class="modal-box create-modal">
        <div class="modal-header">
          <h3>{{ $t('orchestrator.createModalTitle') }}</h3>
          <button class="modal-close-btn" @click="showCreateModal = false">✕</button>
        </div>

        <div class="modal-body">
          <!-- 1. 基础信息与母本镜像 -->
          <div class="form-section">
            <h4 class="section-subheading">{{ $t('orchestrator.stepTemplate') }}</h4>
            <div class="form-grid">
              <div class="form-item">
                <label class="form-label">{{ $t('orchestrator.labelInstanceName') }}</label>
                <input
                  type="text"
                  v-model="createForm.name"
                  :placeholder="$t('orchestrator.placeholderInstanceName')"
                  class="form-input"
                />
              </div>

              <div class="form-item">
                <label class="form-label">{{ $t('orchestrator.labelTemplate') }}</label>
                <select v-model="createForm.template_id" class="form-select">
                  <option v-for="tmpl in templates" :key="tmpl.id" :value="tmpl.id">
                    {{ tmpl.is_tar_zst ? '📦 ' : '📋 [' + tmpl.vmid + '] ' }}{{ tmpl.name }} ({{ tmpl.description || tmpl.base_disk_gb + 'GB' }})
                  </option>
                </select>
              </div>

              <div class="form-item" v-if="clusters.length > 1">
                <label class="form-label">{{ $t('orchestrator.labelSelectCluster') }}</label>
                <select v-model="createForm.cluster_id" class="form-select">
                  <option v-for="c in clusters" :key="c.id" :value="c.id">
                    {{ c.name || c.id }} ({{ c.node }}) {{ c.is_default ? '★ ' + $t('orchestrator.badgeDefaultCluster') : '' }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <!-- 2. 算力规格选择 -->
          <div class="form-section">
            <h4 class="section-subheading">{{ $t('orchestrator.stepSpec') }}</h4>
            <div class="preset-buttons">
              <button
                type="button"
                class="preset-btn"
                :class="{ active: specPreset === 'entry' }"
                @click="applySpecPreset('entry')"
              >
                {{ $t('orchestrator.presetEntry') }}
              </button>
              <button
                type="button"
                class="preset-btn"
                :class="{ active: specPreset === 'standard' }"
                @click="applySpecPreset('standard')"
              >
                {{ $t('orchestrator.presetStandard') }}
              </button>
              <button
                type="button"
                class="preset-btn"
                :class="{ active: specPreset === 'premium' }"
                @click="applySpecPreset('premium')"
              >
                {{ $t('orchestrator.presetPremium') }}
              </button>
              <button
                type="button"
                class="preset-btn"
                :class="{ active: specPreset === 'custom' }"
                @click="specPreset = 'custom'"
              >
                {{ $t('orchestrator.presetCustom') }}
              </button>
            </div>

            <div class="form-grid cols-3">
              <div class="form-item">
                <label class="form-label">{{ $t('orchestrator.labelCores') }}</label>
                <input
                  type="number"
                  v-model.number="createForm.spec.cores"
                  min="1"
                  max="16"
                  class="form-input"
                />
              </div>
              <div class="form-item">
                <label class="form-label">{{ $t('orchestrator.labelMemory') }}</label>
                <input
                  type="number"
                  v-model.number="createForm.spec.memory_mb"
                  step="1024"
                  min="1024"
                  max="32768"
                  class="form-input"
                />
              </div>
              <div class="form-item">
                <label class="form-label">{{ $t('orchestrator.labelDisk') }}</label>
                <input
                  type="number"
                  v-model.number="createForm.spec.disk_gb"
                  min="16"
                  max="128"
                  class="form-input"
                />
              </div>
            </div>
          </div>

          <!-- 3. 显示与启动参数 -->
          <div class="form-section">
            <h4 class="section-subheading">{{ $t('orchestrator.stepDisplay') }}</h4>
            <div class="preset-buttons">
              <button
                type="button"
                class="preset-btn"
                :class="{ active: displayPreset === 'portrait720' }"
                @click="applyDisplayPreset('portrait720')"
              >
                {{ $t('orchestrator.resPortrait720') }}
              </button>
              <button
                type="button"
                class="preset-btn"
                :class="{ active: displayPreset === 'portrait1080' }"
                @click="applyDisplayPreset('portrait1080')"
              >
                {{ $t('orchestrator.resPortrait1080') }}
              </button>
              <button
                type="button"
                class="preset-btn"
                :class="{ active: displayPreset === 'landscape720' }"
                @click="applyDisplayPreset('landscape720')"
              >
                {{ $t('orchestrator.resLandscape720') }}
              </button>
              <button
                type="button"
                class="preset-btn"
                :class="{ active: displayPreset === 'landscape1080' }"
                @click="applyDisplayPreset('landscape1080')"
              >
                {{ $t('orchestrator.resLandscape1080') }}
              </button>
              <button
                type="button"
                class="preset-btn"
                :class="{ active: displayPreset === 'custom' }"
                @click="displayPreset = 'custom'"
              >
                {{ $t('orchestrator.resCustom') }}
              </button>
            </div>

            <div class="form-grid cols-4">
              <div class="form-item">
                <label class="form-label">{{ $t('orchestrator.labelWidth') }}</label>
                <input type="number" v-model.number="createForm.display.width" class="form-input" />
              </div>
              <div class="form-item">
                <label class="form-label">{{ $t('orchestrator.labelHeight') }}</label>
                <input type="number" v-model.number="createForm.display.height" class="form-input" />
              </div>
              <div class="form-item">
                <label class="form-label">{{ $t('orchestrator.labelFps') }}</label>
                <input type="number" v-model.number="createForm.display.fps" class="form-input" />
              </div>
              <div class="form-item">
                <label class="form-label">{{ $t('orchestrator.labelDpi') }}</label>
                <input type="number" v-model.number="createForm.display.dpi" class="form-input" />
              </div>
            </div>

            <div class="form-item" style="margin-bottom: 12px;">
              <label class="form-label">{{ $t('orchestrator.labelGpuMode') || 'GPU 渲染模式' }}</label>
              <select v-model="createForm.display.gpu_mode" class="form-select">
                <option value="host">宿主 GPU 硬件加速 (默认 /dev/dri/renderD128 · Intel/AMD/NVIDIA)</option>
                <option value="guest">Guest 纯软件渲染 (CPU SwiftShader)</option>
              </select>
            </div>

            <div class="form-item extra-boot-item">
              <label class="form-label">{{ $t('orchestrator.labelExtraBoot') }}</label>
              <input
                type="text"
                v-model="createForm.display.extra_boot_args"
                :placeholder="$t('orchestrator.placeholderExtraBoot')"
                class="form-input font-mono"
              />
            </div>
          </div>

          <!-- 4. 网络线路与 IP 分配 -->
          <div class="form-section">
            <h4 class="section-subheading">{{ $t('orchestrator.stepNetwork') }}</h4>
            <div class="form-grid">
              <div class="form-item">
                <label class="form-label">{{ $t('orchestrator.labelNetworkOutlet') }}</label>
                <select v-model="createForm.outlet_id" class="form-select">
                  <option v-for="outlet in outlets" :key="outlet.id" :value="outlet.id">
                    {{ outlet.name }} ({{ outlet.bridge }} · 网关: {{ outlet.gateway }})
                  </option>
                </select>
              </div>
              <div class="form-item">
                <label class="form-label">{{ $t('orchestrator.labelCustomIp') }}</label>
                <input
                  type="text"
                  v-model="createForm.custom_ip"
                  :placeholder="$t('orchestrator.placeholderCustomIp')"
                  class="form-input font-mono"
                />
              </div>
            </div>
          </div>

          <!-- 5. WebRTC 信令与中继连接 (默认写入 cloudphone.conf) -->
          <div class="form-section">
            <h4 class="section-subheading">WebRTC 信令与中继连接 (cloudphone.conf)</h4>
            <div class="form-grid">
              <div class="form-item">
                <label class="form-label">信令服务器地址 (Signaling URL) <span class="required" style="color:var(--accent-gold, #f39c12);">*</span></label>
                <input
                  type="text"
                  v-model="createForm.signalingServer"
                  placeholder="例如: ws://192.168.100.2:8443 或 wss://domain.com:8443"
                  class="form-input font-mono"
                />
                <span class="field-hint" style="font-size:12px;color:#888;margin-top:4px;display:block;">
                  默认自动获取当前控制台地址，将写入容器 cloudphone.conf，开通即刻连通
                </span>
              </div>
              <div class="form-item">
                <label class="form-label">TURN / ICE 中继服务器 (选填)</label>
                <input
                  type="text"
                  v-model="createForm.turnServer"
                  placeholder="例如: turn:user:pass@turn.domain.com:3478?transport=udp"
                  class="form-input font-mono"
                />
                <span class="field-hint" style="font-size:12px;color:#888;margin-top:4px;display:block;">
                  留空默认使用公共 STUN；跨公网/对称 NAT 场景建议配置 TURN 中继
                </span>
              </div>
            </div>
            <div class="form-item" style="margin-top:12px;">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;padding:8px 12px;background:rgba(46,204,113,0.06);border:1px solid rgba(46,204,113,0.2);border-radius:6px;user-select:none;">
                <input type="checkbox" v-model="createForm.unprivileged" />
                <span>运行于<b>非特权安全隔离模式 (unprivileged: 1，默认开启)</b> · 享受多租户宿主零污染与安全防护</span>
              </label>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" @click="showCreateModal = false">
            {{ $t('orchestrator.btnCancel') }}
          </button>
          <button class="btn-primary" @click="submitCreateInstance" :disabled="creating">
            <span v-if="creating" class="spinner-small"></span>
            <span>{{ creating ? $t('orchestrator.creatingProgress') : $t('orchestrator.btnConfirmCreate') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 固化为母本模态窗 (Convert Modal) - 防误触：禁止点击空白遮罩退出 -->
    <div class="modal-overlay" v-if="showConvertModal">
      <div class="modal-box convert-modal">
        <div class="modal-header">
          <h3>{{ $t('orchestrator.convertModalTitle') }}</h3>
          <button class="modal-close-btn" @click="showConvertModal = false">✕</button>
        </div>

        <div class="modal-body">
          <p class="modal-tip">{{ $t('orchestrator.convertDesc') }}</p>

          <div class="form-item">
            <label class="form-label">{{ $t('orchestrator.labelNewTemplateName') }}</label>
            <input
              type="text"
              v-model="convertForm.template_name"
              :placeholder="$t('orchestrator.placeholderNewTemplateName')"
              class="form-input"
            />
          </div>

          <div class="form-item">
            <label class="form-label">{{ $t('orchestrator.labelTemplateDesc') }}</label>
            <textarea
              v-model="convertForm.desc"
              :placeholder="$t('orchestrator.placeholderTemplateDesc')"
              class="form-textarea"
              rows="3"
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" @click="showConvertModal = false" :disabled="converting">
            {{ $t('orchestrator.btnCancel') }}
          </button>
          <button class="btn-primary" @click="submitConvertTemplate" :disabled="converting">
            <span v-if="converting" class="spinner-small"></span>
            <span>{{ converting ? $t('orchestrator.convertingProgress') : $t('orchestrator.btnConfirmConvert') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- PVE 集群管理与连接配置模态窗 (Modal) - 防误触：禁止点击空白遮罩退出 -->
    <div class="modal-overlay" v-if="showConfigModal">
      <div class="modal-box config-modal cluster-mgmt-modal">
        <div class="modal-header">
          <div class="header-title-box">
            <h3>{{ $t('orchestrator.clustersModalTitle') }}</h3>
            <span class="cluster-count-badge">{{ clusters.length }} {{ $t('orchestrator.unitClusters') }}</span>
          </div>
          <button class="modal-close-btn" @click="showConfigModal = false">✕</button>
        </div>

        <div class="modal-body">
          <!-- 模式 1: 集群卡片列表管理 -->
          <div v-if="!showClusterEditForm" class="clusters-list-view">
            <div class="list-view-header">
              <p class="modal-tip">{{ $t('orchestrator.clustersListDesc') }}</p>
              <button class="btn-primary btn-sm" @click="openAddClusterForm">
                <span>+ {{ $t('orchestrator.btnAddCluster') }}</span>
              </button>
            </div>

            <div class="clusters-table-wrapper">
              <table class="clusters-table">
                <thead>
                  <tr>
                    <th>{{ $t('orchestrator.colClusterName') }}</th>
                    <th>{{ $t('orchestrator.colEndpoint') }}</th>
                    <th>{{ $t('orchestrator.colNode') }}</th>
                    <th>{{ $t('orchestrator.colSshTarget') }}</th>
                    <th>{{ $t('orchestrator.colStatus') }}</th>
                    <th class="text-right">{{ $t('orchestrator.colActions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="cl in clusters" :key="cl.id">
                    <td>
                      <div class="cluster-name-cell">
                        <span class="name-text">{{ cl.name || cl.id }}</span>
                        <span class="badge-default-tag" v-if="cl.is_default">{{ $t('orchestrator.badgeDefaultCluster') }}</span>
                      </div>
                    </td>
                    <td class="font-mono">{{ cl.endpoint }}</td>
                    <td><span class="node-badge">{{ cl.node }}</span></td>
                    <td class="font-mono text-muted">{{ cl.ssh_target || '-' }}</td>
                    <td>
                      <span class="status-indicator-tag" :class="getClusterHostStatus(cl)?.status === 'online' ? 'online' : 'normal'">
                        {{ getClusterHostStatus(cl)?.status === 'online' ? $t('orchestrator.hostOnline') : (getClusterHostStatus(cl)?.status || $t('orchestrator.cardStatusUnknown')) }}
                      </span>
                    </td>
                    <td class="text-right actions-cell">
                      <button
                        v-if="!cl.is_default"
                        class="btn-table-action"
                        @click="handleSetDefaultCluster(cl.id)"
                        :title="$t('orchestrator.setDefaultTip')"
                      >
                        {{ $t('orchestrator.btnSetDefault') }}
                      </button>
                      <button class="btn-table-action" @click="openClusterTerminal(cl)">
                        {{ $t('orchestrator.btnClusterTerminal') }}
                      </button>
                      <button class="btn-table-action" @click="editCluster(cl)">
                        {{ $t('orchestrator.btnEdit') }}
                      </button>
                      <button
                        v-if="!cl.is_default && clusters.length > 1"
                        class="btn-table-action text-danger"
                        @click="handleDeleteCluster(cl.id)"
                      >
                        {{ $t('orchestrator.btnDelete') }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 模式 2: 集群添加/编辑表单 -->
          <div v-else class="cluster-edit-view">
            <div class="edit-view-header">
              <button class="btn-back" @click="showClusterEditForm = false">
                ← {{ $t('orchestrator.btnBackToList') }}
              </button>
              <h4 class="edit-title">{{ isEditingExistingCluster ? $t('orchestrator.editClusterTitle') : $t('orchestrator.addClusterTitle') }}</h4>
            </div>

            <div class="form-grid">
              <div class="form-item">
                <label class="form-label">{{ $t('orchestrator.labelClusterName') }} <span class="required">*</span></label>
                <input
                  type="text"
                  v-model="clusterForm.name"
                  :placeholder="$t('orchestrator.placeholderClusterName')"
                  class="form-input"
                />
              </div>

              <div class="form-item">
                <label class="form-label">{{ $t('orchestrator.labelClusterId') }} <span class="required">*</span></label>
                <input
                  type="text"
                  v-model="clusterForm.id"
                  :disabled="isEditingExistingCluster"
                  :placeholder="$t('orchestrator.placeholderClusterId')"
                  class="form-input font-mono"
                />
              </div>
            </div>

            <div class="form-grid">
              <div class="form-item">
                <label class="form-label">{{ $t('orchestrator.labelEndpoint') }} <span class="required">*</span></label>
                <input
                  type="text"
                  v-model="clusterForm.endpoint"
                  :placeholder="$t('orchestrator.placeholderEndpoint')"
                  class="form-input font-mono"
                />
              </div>

              <div class="form-item">
                <label class="form-label">{{ $t('orchestrator.labelNode') }} <span class="required">*</span></label>
                <input
                  type="text"
                  v-model="clusterForm.node"
                  :placeholder="$t('orchestrator.placeholderNode')"
                  class="form-input"
                />
              </div>
            </div>

            <div class="form-grid">
              <div class="form-item">
                <label class="form-label">{{ $t('orchestrator.labelTokenId') }} <span class="required">*</span></label>
                <input
                  type="text"
                  v-model="clusterForm.token_id"
                  :placeholder="$t('orchestrator.placeholderTokenId')"
                  class="form-input font-mono"
                />
              </div>

              <div class="form-item">
                <label class="form-label">{{ $t('orchestrator.labelTokenSecret') }} <span class="required">*</span></label>
                <div class="secret-input-wrapper">
                  <input
                    :type="showSecret ? 'text' : 'password'"
                    v-model="clusterForm.token_secret"
                    :placeholder="$t('orchestrator.placeholderTokenSecret')"
                    class="form-input font-mono"
                  />
                  <button type="button" class="secret-toggle-btn" @click="showSecret = !showSecret">
                    {{ showSecret ? '👁' : '🙈' }}
                  </button>
                </div>
              </div>
            </div>

            <div class="form-grid">
              <div class="form-item">
                <label class="form-label">{{ $t('orchestrator.labelSshTarget') }}</label>
                <input
                  type="text"
                  v-model="clusterForm.ssh_target"
                  :placeholder="$t('orchestrator.placeholderSshTarget')"
                  class="form-input font-mono"
                />
              </div>

              <div class="form-item checkbox-item">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="clusterForm.is_default" :disabled="clusters.length === 0" />
                  <span>{{ $t('orchestrator.labelSetAsDefaultCluster') }}</span>
                </label>
              </div>
            </div>

            <!-- 测试结果反馈 -->
            <div v-if="testResult" class="test-feedback" :class="testResult.success ? 'feedback-success' : 'feedback-error'">
              <span class="feedback-icon">{{ testResult.success ? '✓' : '✗' }}</span>
              <span>{{ testResult.message }}</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <template v-if="!showClusterEditForm">
            <button class="btn-secondary" @click="showConfigModal = false">
              {{ $t('orchestrator.btnClose') }}
            </button>
          </template>
          <template v-else>
            <button class="btn-secondary" @click="handleTestClusterForm" :disabled="testingConfig || savingConfig">
              <span v-if="testingConfig" class="spinner-small"></span>
              <span>{{ testingConfig ? $t('orchestrator.testingConnection') : $t('orchestrator.btnTestConnection') }}</span>
            </button>
            <div class="footer-right-actions">
              <button class="btn-secondary" @click="showClusterEditForm = false" :disabled="testingConfig || savingConfig">
                {{ $t('orchestrator.btnCancel') }}
              </button>
              <button class="btn-primary" @click="handleSaveClusterForm" :disabled="testingConfig || savingConfig">
                <span v-if="savingConfig" class="spinner-small"></span>
                <span>{{ savingConfig ? $t('orchestrator.savingConfig') : $t('orchestrator.btnSaveConfig') }}</span>
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 运维控制台终端模态窗 (Terminal Modal) - 防误触：禁止点击空白遮罩退出 -->
    <div class="modal-overlay terminal-overlay" v-if="showTerminalModal">
      <div class="modal-box terminal-modal" :class="{ 'is-fullscreen': isTermFullscreen }">
        <div class="modal-header terminal-header">
          <div class="terminal-header-title">
            <svg class="term-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="4 17 10 11 4 5"></polyline>
              <line x1="12" y1="19" x2="20" y2="19"></line>
            </svg>
            <span class="term-title-text" v-if="termTargetType === 'cluster'">
              {{ $t('orchestrator.clusterTermModalTitle', { name: activeTermCluster?.name || activeTermCluster?.id, node: activeTermCluster?.node }) }}
            </span>
            <span class="term-title-text" v-else>
              {{ $t('orchestrator.termModalTitle', { vmid: activeTermInst?.vmid, name: activeTermInst?.name }) }}
            </span>
            <span class="term-status-pill" :class="termConnState">
              <span class="status-dot"></span>
              {{ termStatusText }}
            </span>
          </div>

          <!-- 快捷操作栏 -->
          <div class="terminal-quick-actions">
            <!-- 集群宿主机快捷操作 -->
            <template v-if="termTargetType === 'cluster'">
              <button class="quick-btn" @click="sendTermCommand('pct list\n')" :title="$t('orchestrator.quickPctListTip')">
                pct list
              </button>
              <button class="quick-btn" @click="sendTermCommand('intel_gpu_top -s 1000\n')" :title="$t('orchestrator.quickGpuTopTip')">
                intel_gpu_top
              </button>
              <button class="quick-btn" @click="sendTermCommand('top\n')" :title="$t('orchestrator.quickTopTip')">
                top
              </button>
              <button class="quick-btn" @click="sendTermCommand('dmesg -T | tail -n 30\n')" :title="$t('orchestrator.quickDmesgTip')">
                dmesg
              </button>
              <button class="quick-btn" @click="sendTermCommand('df -h\n')" :title="$t('orchestrator.quickDfTip')">
                df -h
              </button>
            </template>
            <!-- 实例快捷操作 -->
            <template v-else>
              <button class="quick-btn" @click="sendTermCommand('logcat -v time\n')" :title="$t('orchestrator.quickLogcatTip')">
                logcat
              </button>
              <button class="quick-btn" @click="sendTermCommand('getprop | grep -i redroid\n')" :title="$t('orchestrator.quickGetpropTip')">
                getprop
              </button>
              <button class="quick-btn" @click="sendTermCommand('top -m 10\n')" :title="$t('orchestrator.quickTopTip')">
                top
              </button>
            </template>
            <button class="quick-btn ctrl-c-btn" @click="sendTermCommand('\x03')" :title="$t('orchestrator.quickCtrlCTip')">
              Ctrl+C
            </button>
            <button class="quick-btn" @click="clearTerminal" :title="$t('orchestrator.quickClearTip')">
              {{ $t('orchestrator.quickClear') }}
            </button>
            <button class="quick-btn" @click="reconnectTerminal" :title="$t('orchestrator.quickReconnectTip')">
              {{ $t('orchestrator.quickReconnect') }}
            </button>
            <button class="quick-icon-btn" @click="toggleTermFullscreen" :title="isTermFullscreen ? $t('orchestrator.termRestore') : $t('orchestrator.termFullscreen')">
              <svg v-if="!isTermFullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="4 14 10 14 10 20"></polyline>
                <polyline points="20 10 14 10 14 4"></polyline>
                <line x1="14" y1="10" x2="21" y2="3"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
            </button>
            <button class="modal-close-btn" @click="closeTerminal">✕</button>
          </div>
        </div>

        <div class="terminal-body-container" ref="termContainerRef">
          <!-- xterm DOM 挂载节点 -->
        </div>

        <div class="terminal-footer-hint">
          <span class="hint-text">💡 {{ $t('orchestrator.termHint') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { authHeaders, readError } from '@/utils/api'

const { t } = useI18n()

// 核心响应式状态
const loading = ref(false)
const instances = ref([])
const templates = ref([])
const outlets = ref([])
const searchQuery = ref('')
const statusFilter = ref('all') // 'all' | 'running' | 'stopped'
const actionPending = ref({})

// PVE 物理宿主机资源监控状态
const hosts = ref([])
const loadingHosts = ref(false)

// 多 PVE 集群管理状态
const clusters = ref([])
const showConfigModal = ref(false)
const showClusterEditForm = ref(false)
const isEditingExistingCluster = ref(false)
const showSecret = ref(false)
const clusterForm = ref({
  id: '',
  name: '',
  endpoint: '',
  node: '',
  token_id: '',
  token_secret: '',
  ssh_target: '',
  is_default: false
})
const testingConfig = ref(false)
const savingConfig = ref(false)
const testResult = ref(null) // { success: boolean, message: string }

// 格式化与计算辅助
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const gb = bytes / 1024 / 1024 / 1024
  if (gb >= 1) {
    return gb.toFixed(1) + ' GB'
  }
  const mb = bytes / 1024 / 1024
  return mb.toFixed(0) + ' MB'
}

function getPercent(used, total) {
  if (!total || total <= 0) return 0
  return Math.min(100, Math.round(((used || 0) / total) * 100))
}

function getCpuColorClass(ratio) {
  const r = ratio || 0
  if (r < 0.7) return 'fill-green'
  if (r < 0.85) return 'fill-yellow'
  return 'fill-red'
}

function formatUptimeDays(seconds) {
  if (!seconds) return ''
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  if (days > 0) return `${days}天 ${hours}小时`
  return `${hours}小时`
}

function getClusterName(clusterID) {
  if (!clusterID) return t('orchestrator.defaultClusterName')
  const cl = clusters.value.find(c => c.id === clusterID)
  return cl ? (cl.name || cl.id) : clusterID
}

function getClusterHostStatus(cl) {
  return hosts.value.find(h => h.cluster_id === cl.id && h.node === cl.node) || hosts.value.find(h => h.cluster_id === cl.id)
}

async function fetchHosts() {
  loadingHosts.value = true
  try {
    const res = await fetch('/api/pve/hosts', { headers: authHeaders() })
    if (res.ok) {
      const d = await res.json()
      hosts.value = d.data || d || []
    }
  } catch (err) {
    console.error('Fetch PVE hosts failed:', err)
  } finally {
    loadingHosts.value = false
  }
}

async function fetchClusters() {
  try {
    const res = await fetch('/api/pve/clusters', { headers: authHeaders() })
    if (res.ok) {
      const d = await res.json()
      clusters.value = d.data || d || []
    }
  } catch (err) {
    console.error('Fetch PVE clusters failed:', err)
  }
}

// PVE 运维终端弹窗状态
const showTerminalModal = ref(false)
const activeTermInst = ref(null)
const activeTermCluster = ref(null)
const termTargetType = ref('instance') // 'instance' | 'cluster'
const isTermFullscreen = ref(false)
const termConnState = ref('connecting') // 'connected' | 'connecting' | 'disconnected'
const termContainerRef = ref(null)
let termInstance = null
let fitAddonInstance = null
let termWs = null
let termResizeObserver = null

const termStatusText = computed(() => {
  switch (termConnState.value) {
    case 'connected': return t('orchestrator.termConnected')
    case 'connecting': return t('orchestrator.termConnecting')
    default: return t('orchestrator.termDisconnected')
  }
})

// 统计计算属性
const runningCount = computed(() => instances.value.filter(i => i.status === 'running').length)
const stoppedCount = computed(() => instances.value.filter(i => i.status === 'stopped').length)

// 过滤搜索并严格按 VMID 升序稳定排序（避免轮询刷新时卡片位置随机跳动）
const filteredInstances = computed(() => {
  return instances.value
    .filter(inst => {
      // 状态匹配
      if (statusFilter.value === 'running' && inst.status !== 'running') return false
      if (statusFilter.value === 'stopped' && inst.status !== 'stopped') return false

      // 关键词匹配
      if (!searchQuery.value) return true
      const q = searchQuery.value.trim().toLowerCase()
      const nameMatch = inst.name && inst.name.toLowerCase().includes(q)
      const ipMatch = inst.ip && inst.ip.toLowerCase().includes(q)
      const vmidMatch = String(inst.vmid).includes(q)
      return nameMatch || ipMatch || vmidMatch
    })
    .sort((a, b) => a.vmid - b.vmid)
})

// 数据加载接口
async function fetchData() {
  loading.value = true
  try {
    const [instRes, tmplRes, outRes] = await Promise.all([
      fetch('/api/pve/instances', { headers: authHeaders() }),
      fetch('/api/pve/templates', { headers: authHeaders() }),
      fetch('/api/pve/outlets', { headers: authHeaders() })
    ])

    if (instRes.ok) {
      const d = await instRes.json()
      instances.value = Array.isArray(d) ? d : (d.data || [])
    }
    if (tmplRes.ok) {
      const d = await tmplRes.json()
      templates.value = Array.isArray(d) ? d : (d.data || [])
    }
    if (outRes.ok) {
      const d = await outRes.json()
      outlets.value = Array.isArray(d) ? d : (d.data || [])
    }
  } catch (err) {
    console.error('Fetch PVE data failed:', err)
  } finally {
    loading.value = false
  }
}

// 复制连接串
function copyText(str) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(str).then(() => {
      alert(t('orchestrator.copySuccess'))
    })
  } else {
    alert(str)
  }
}

// 电源管理控制 (Start / Stop / Restart)
async function handlePowerAction(inst, action) {
  if (action === 'stop' && !confirm(t('orchestrator.confirmPowerStop', { name: inst.name, vmid: inst.vmid }))) {
    return
  }
  if (action === 'restart' && !confirm(t('orchestrator.confirmPowerRestart', { name: inst.name, vmid: inst.vmid }))) {
    return
  }

  const id = inst.id || String(inst.vmid)
  actionPending.value[inst.vmid] = true
  try {
    const res = await fetch(`/api/pve/instances/${id}/power`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ action })
    })
    if (!res.ok) {
      const msg = await readError(res, 'Power operation failed')
      throw new Error(msg)
    }
    await fetchData()
    fetchHosts()
  } catch (err) {
    alert(t('orchestrator.actionFailed', { error: err.message }))
  } finally {
    actionPending.value[inst.vmid] = false
  }
}

// 快速重置 (Ephemeral Recreation)
async function handleReset(inst) {
  if (!confirm(t('orchestrator.confirmReset', { name: inst.name, vmid: inst.vmid }))) {
    return
  }

  const id = inst.id || String(inst.vmid)
  actionPending.value[inst.vmid] = true
  try {
    const res = await fetch(`/api/pve/instances/${id}/reset`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' })
    })
    if (!res.ok) {
      const msg = await readError(res, 'Reset failed')
      throw new Error(msg)
    }
    await fetchData()
    fetchHosts()
    alert(t('orchestrator.actionSuccess'))
  } catch (err) {
    alert(t('orchestrator.actionFailed', { error: err.message }))
  } finally {
    actionPending.value[inst.vmid] = false
  }
}

// 永久销毁
async function handleDestroy(inst) {
  if (!confirm(t('orchestrator.confirmDestroy', { name: inst.name, vmid: inst.vmid }))) {
    return
  }

  const id = inst.id || String(inst.vmid)
  actionPending.value[inst.vmid] = true
  try {
    const res = await fetch(`/api/pve/instances/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    })
    if (!res.ok) {
      const msg = await readError(res, 'Destroy failed')
      throw new Error(msg)
    }
    await fetchData()
    fetchHosts()
  } catch (err) {
    alert(t('orchestrator.actionFailed', { error: err.message }))
  } finally {
    actionPending.value[inst.vmid] = false
  }
}

// 开通模态窗状态
const showCreateModal = ref(false)
const creating = ref(false)
const specPreset = ref('standard')
const displayPreset = ref('portrait720')

const createForm = ref({
  name: '',
  cluster_id: '',
  template_id: 'tpl-9000',
  outlet_id: 'direct',
  spec: {
    cores: 4,
    memory_mb: 4096,
    disk_gb: 32
  },
  display: {
    width: 720,
    height: 1280,
    dpi: 320,
    fps: 60,
    gpu_mode: 'host',
    output_mode: 'headless',
    extra_boot_args: ''
  },
  custom_ip: '',
  signalingServer: '',
  turnServer: '',
  unprivileged: true
})

function applySpecPreset(preset) {
  specPreset.value = preset
  if (preset === 'entry') {
    createForm.value.spec = { cores: 2, memory_mb: 4096, disk_gb: 16 }
  } else if (preset === 'standard') {
    createForm.value.spec = { cores: 4, memory_mb: 8192, disk_gb: 24 }
  } else if (preset === 'premium') {
    createForm.value.spec = { cores: 8, memory_mb: 16384, disk_gb: 32 }
  }
}

function applyDisplayPreset(preset) {
  displayPreset.value = preset
  if (preset === 'portrait720') {
    createForm.value.display.width = 720
    createForm.value.display.height = 1280
    createForm.value.display.dpi = 320
    createForm.value.display.fps = 60
  } else if (preset === 'portrait1080') {
    createForm.value.display.width = 1080
    createForm.value.display.height = 1920
    createForm.value.display.dpi = 440
    createForm.value.display.fps = 60
  } else if (preset === 'landscape720') {
    createForm.value.display.width = 1280
    createForm.value.display.height = 720
    createForm.value.display.dpi = 320
    createForm.value.display.fps = 60
  } else if (preset === 'landscape1080') {
    createForm.value.display.width = 1920
    createForm.value.display.height = 1080
    createForm.value.display.dpi = 440
    createForm.value.display.fps = 60
  }
}

async function loadTemplatesForCluster(clusterId) {
  try {
    const res = await fetch(`/api/pve/templates?cluster_id=${encodeURIComponent(clusterId || '')}`, {
      headers: authHeaders()
    })
    if (res.ok) {
      const d = await res.json()
      templates.value = Array.isArray(d) ? d : (d.data || [])
      if (templates.value.length > 0) {
        const hasCurrent = templates.value.some(t => t.id === createForm.value.template_id)
        if (!hasCurrent) {
          const def = templates.value.find(t => t.is_default) || templates.value[0]
          createForm.value.template_id = def.id
        }
      }
    }
  } catch (err) {
    console.error('Load templates for cluster failed:', err)
  }
}

watch(() => createForm.value.cluster_id, (newCId) => {
  if (newCId) {
    loadTemplatesForCluster(newCId)
  }
})

function openCreateModal() {
  if (clusters.value.length > 0) {
    const def = clusters.value.find(c => c.is_default) || clusters.value[0]
    createForm.value.cluster_id = def.id
    loadTemplatesForCluster(def.id)
  } else {
    loadTemplatesForCluster('')
  }
  if (outlets.value.length > 0 && !outlets.value.some(o => o.id === createForm.value.outlet_id)) {
    createForm.value.outlet_id = outlets.value[0].id
  }
  createForm.value.unprivileged = true
  if (!createForm.value.display.gpu_mode) {
    createForm.value.display.gpu_mode = 'host'
  }
  // 默认自动将当前浏览器的 host 注入作为 WebRTC 信令地址
  if (!createForm.value.signalingServer) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    createForm.value.signalingServer = `${proto}//${window.location.host}`
  }
  showCreateModal.value = true
}

async function submitCreateInstance() {
  creating.value = true
  try {
    const res = await fetch('/api/pve/instances', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(createForm.value)
    })
    if (!res.ok) {
      const msg = await readError(res, 'Create instance failed')
      throw new Error(msg)
    }
    showCreateModal.value = false
    await fetchData()
    fetchHosts()
    alert(t('orchestrator.actionSuccess'))
  } catch (err) {
    alert(t('orchestrator.actionFailed', { error: err.message }))
  } finally {
    creating.value = false
  }
}

// 固化为母本模态窗
const showConvertModal = ref(false)
const converting = ref(false)
const convertTarget = ref(null)
const convertForm = ref({
  template_name: '',
  desc: ''
})

function openConvertModal(inst) {
  convertTarget.value = inst
  convertForm.value = {
    template_name: `${inst.name}-tmpl`,
    desc: ''
  }
  showConvertModal.value = true
}

async function submitConvertTemplate() {
  if (!convertTarget.value) return
  converting.value = true
  const id = convertTarget.value.id || String(convertTarget.value.vmid)
  try {
    const res = await fetch(`/api/pve/instances/${id}/to-template`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        name: convertForm.value.template_name,
        description: convertForm.value.desc,
        preinstalled_apps: []
      })
    })
    if (!res.ok) {
      const msg = await readError(res, 'Convert template failed')
      throw new Error(msg)
    }
    showConvertModal.value = false
    await fetchData()
    alert(t('orchestrator.actionSuccess'))
  } catch (err) {
    alert(t('orchestrator.actionFailed', { error: err.message }))
  } finally {
    converting.value = false
  }
}

// --- 多 PVE 集群管理逻辑 ---
async function openConfigModal() {
  testResult.value = null
  showClusterEditForm.value = false
  await fetchClusters()
  showConfigModal.value = true
}

function openAddClusterForm() {
  isEditingExistingCluster.value = false
  clusterForm.value = {
    id: `cluster-${Date.now().toString().slice(-4)}`,
    name: '',
    endpoint: 'https://',
    node: 'pve',
    token_id: 'root@pam!cloudphone',
    token_secret: '',
    ssh_target: '',
    is_default: clusters.value.length === 0
  }
  showSecret.value = false
  testResult.value = null
  showClusterEditForm.value = true
}

function editCluster(cl) {
  isEditingExistingCluster.value = true
  clusterForm.value = {
    id: cl.id,
    name: cl.name || '',
    endpoint: cl.endpoint || '',
    node: cl.node || 'pve',
    token_id: cl.token_id || '',
    token_secret: cl.token_secret || '',
    ssh_target: cl.ssh_target || '',
    is_default: cl.is_default || false
  }
  showSecret.value = false
  testResult.value = null
  showClusterEditForm.value = true
}

async function handleSetDefaultCluster(clusterID) {
  try {
    const res = await fetch(`/api/pve/clusters/${clusterID}/default`, {
      method: 'POST',
      headers: authHeaders()
    })
    if (!res.ok) {
      const msg = await readError(res, 'Set default cluster failed')
      throw new Error(msg)
    }
    await fetchClusters()
    fetchHosts()
  } catch (err) {
    alert(t('orchestrator.actionFailed', { error: err.message }))
  }
}

async function handleDeleteCluster(clusterID) {
  if (!confirm(t('orchestrator.confirmDeleteCluster'))) return
  try {
    const res = await fetch(`/api/pve/clusters/${clusterID}`, {
      method: 'DELETE',
      headers: authHeaders()
    })
    if (!res.ok) {
      const msg = await readError(res, 'Delete cluster failed')
      throw new Error(msg)
    }
    await fetchClusters()
    fetchHosts()
  } catch (err) {
    alert(t('orchestrator.actionFailed', { error: err.message }))
  }
}

async function handleTestClusterForm() {
  if (!clusterForm.value.endpoint || !clusterForm.value.token_id || !clusterForm.value.token_secret) {
    testResult.value = {
      success: false,
      message: t('orchestrator.testFailed', { error: '请完整填写 Endpoint, Token ID 和 Token Secret' })
    }
    return
  }

  testingConfig.value = true
  testResult.value = null
  try {
    const res = await fetch('/api/pve/config/test', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(clusterForm.value)
    })
    const data = await res.json()
    if (!res.ok || data.code !== 0) {
      throw new Error(data.message || data.error || 'Connection failed')
    }
    if (data.detected_node) {
      clusterForm.value.node = data.detected_node
    }
    testResult.value = {
      success: true,
      message: data.message || t('orchestrator.testSuccess')
    }
  } catch (err) {
    testResult.value = {
      success: false,
      message: t('orchestrator.testFailed', { error: err.message })
    }
  } finally {
    testingConfig.value = false
  }
}

async function handleSaveClusterForm() {
  if (!clusterForm.value.endpoint || !clusterForm.value.node || !clusterForm.value.token_id || !clusterForm.value.token_secret) {
    alert('请完整填写必填配置项')
    return
  }

  savingConfig.value = true
  try {
    const res = await fetch('/api/pve/clusters', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(clusterForm.value)
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to save cluster')
    }
    showClusterEditForm.value = false
    await fetchClusters()
    fetchHosts()
    alert(t('orchestrator.saveSuccess'))
  } catch (err) {
    alert(t('orchestrator.actionFailed', { error: err.message }))
  } finally {
    savingConfig.value = false
  }
}

// --- PVE 运维终端控制逻辑 ---
function openTerminal(inst) {
  if (inst.status !== 'running') {
    alert(t('orchestrator.terminalStoppedTip'))
    return
  }
  termTargetType.value = 'instance'
  activeTermInst.value = inst
  activeTermCluster.value = null
  showTerminalModal.value = true
  isTermFullscreen.value = false
  termConnState.value = 'connecting'

  nextTick(() => {
    initTerminal()
  })
}

function openClusterTerminal(target) {
  let cl = null
  if (target && target.cluster_id) {
    cl = clusters.value.find(c => c.id === target.cluster_id)
  }
  if (!cl && target) {
    cl = target
  }
  if (!cl) {
    cl = clusters.value.find(c => c.is_default) || clusters.value[0]
  }
  if (!cl) {
    alert(t('orchestrator.hostErrorNotice'))
    return
  }

  termTargetType.value = 'cluster'
  activeTermCluster.value = cl
  activeTermInst.value = null
  showTerminalModal.value = true
  isTermFullscreen.value = false
  termConnState.value = 'connecting'

  nextTick(() => {
    initTerminal()
  })
}

function initTerminal() {
  if (!termContainerRef.value) return

  // 清理已有实例
  destroyTerminal()

  const isMobile = window.innerWidth <= 768
  termInstance = new Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    fontSize: isMobile ? 12 : 13,
    lineHeight: 1.25,
    fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace',
    theme: {
      background: '#0d1117',
      foreground: '#c9d1d9',
      cursor: '#58a6ff',
      black: '#484f58',
      red: '#ff7b72',
      green: '#3fb950',
      yellow: '#d29922',
      blue: '#58a6ff',
      magenta: '#bc8cff',
      cyan: '#39c5cf',
      white: '#b1bac4',
      brightBlack: '#6e7681',
      brightRed: '#ffa198',
      brightGreen: '#56d364',
      brightYellow: '#e3b341',
      brightBlue: '#79c0ff',
      brightMagenta: '#d2a8ff',
      brightCyan: '#56d4dd',
      brightWhite: '#f0f6fc'
    },
    scrollback: 10000,
    convertEol: true,
    scrollOnUserInput: true
  })

  fitAddonInstance = new FitAddon()
  termInstance.loadAddon(fitAddonInstance)
  termInstance.open(termContainerRef.value)

  // 监听尺寸自适应
  if (typeof ResizeObserver !== 'undefined') {
    termResizeObserver = new ResizeObserver(() => {
      if (fitAddonInstance && termInstance) {
        try {
          fitAddonInstance.fit()
          termInstance.scrollToBottom()
        } catch (e) {}
      }
    })
    termResizeObserver.observe(termContainerRef.value)
  }

  try {
    fitAddonInstance.fit()
    termInstance.focus()
  } catch (e) {}

  // 建立 WebSocket 连接
  initTerminalWs()
}

function initTerminalWs() {
  termConnState.value = 'connecting'
  const token = localStorage.getItem('auth_token') || ''
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  let wsUrl = ''

  if (termTargetType.value === 'cluster') {
    if (!activeTermCluster.value) return
    const clusterId = activeTermCluster.value.id || activeTermCluster.value.cluster_id
    wsUrl = `${proto}//${location.host}/api/pve/clusters/${clusterId}/term-ws?token=${encodeURIComponent(token)}`
  } else {
    if (!activeTermInst.value) return
    const instId = activeTermInst.value.id || String(activeTermInst.value.vmid)
    wsUrl = `${proto}//${location.host}/api/pve/instances/${instId}/term-ws?token=${encodeURIComponent(token)}`
  }

  try {
    termWs = new WebSocket(wsUrl)
    termWs.onopen = () => {
      termConnState.value = 'connected'
      if (fitAddonInstance) {
        try {
          fitAddonInstance.fit()
        } catch (e) {}
      }
      if (termInstance) {
        termInstance.focus()
      }
    }

    termWs.onmessage = (event) => {
      if (termInstance) {
        termInstance.write(event.data)
      }
    }

    termWs.onclose = () => {
      termConnState.value = 'disconnected'
      if (termInstance) {
        termInstance.writeln('\r\n\x1b[90m[终端连接已关闭]\x1b[0m\r\n')
      }
    }

    termWs.onerror = () => {
      termConnState.value = 'disconnected'
    }

    // 键盘按键发送
    termInstance.onData((data) => {
      if (termWs && termWs.readyState === WebSocket.OPEN) {
        termWs.send(data)
      }
    })
  } catch (err) {
    termConnState.value = 'disconnected'
    if (termInstance) {
      termInstance.writeln(`\r\n\x1b[31m[WebSocket 初始化失败]: ${err.message}\x1b[0m\r\n`)
    }
  }
}

function sendTermCommand(cmd) {
  if (termWs && termWs.readyState === WebSocket.OPEN) {
    termWs.send(cmd)
    if (termInstance) {
      termInstance.focus()
    }
  }
}

function clearTerminal() {
  if (termInstance) {
    termInstance.clear()
    termInstance.focus()
  }
}

function reconnectTerminal() {
  if (termWs) {
    try {
      termWs.close()
    } catch (e) {}
  }
  if (termInstance) {
    termInstance.clear()
  }
  initTerminalWs()
}

function toggleTermFullscreen() {
  isTermFullscreen.value = !isTermFullscreen.value
  setTimeout(() => {
    if (fitAddonInstance) {
      try {
        fitAddonInstance.fit()
        if (termInstance) termInstance.scrollToBottom()
      } catch (e) {}
    }
  }, 100)
}

function destroyTerminal() {
  if (termResizeObserver && termContainerRef.value) {
    termResizeObserver.disconnect()
    termResizeObserver = null
  }
  if (termWs) {
    try {
      termWs.close()
    } catch (e) {}
    termWs = null
  }
  if (termInstance) {
    try {
      termInstance.dispose()
    } catch (e) {}
    termInstance = null
  }
  fitAddonInstance = null
}

function closeTerminal() {
  destroyTerminal()
  showTerminalModal.value = false
  activeTermInst.value = null
  activeTermCluster.value = null
}

let pollTimer = null

onMounted(() => {
  fetchData()
  fetchHosts()
  fetchClusters()
  // 每 8 秒自动增量轮询刷新一次实例实时状态与宿主机物理状态
  pollTimer = setInterval(() => {
    fetchData()
    fetchHosts()
  }, 8000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  destroyTerminal()
})
</script>

<style scoped>
.orchestrator-page {
  padding: 18px 24px 24px;
  max-width: 1400px;
  margin: 0 auto;
  color: #e2e8f0;
}

/* 顶部标题栏 */
.orchestrator-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header-title {
  font-size: 22px;
  font-weight: 700;
  color: #f8fafc;
  margin: 0 0 4px 0;
  letter-spacing: -0.5px;
}

.header-subtitle {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.btn-primary, .btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
  transform: translateY(-1px);
}

.btn-secondary {
  background: #1e293b;
  color: #cbd5e1;
  border: 1px solid #334155;
}

.btn-secondary:hover:not(:disabled) {
  background: #334155;
  color: #f8fafc;
}

.action-icon {
  width: 16px;
  height: 16px;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 统计卡片概览 */
.stats-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px 20px;
  backdrop-filter: blur(8px);
}

.stat-icon-wrapper {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon-wrapper svg {
  width: 22px;
  height: 22px;
}

.stat-icon-wrapper.total { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
.stat-icon-wrapper.running { background: rgba(34, 197, 94, 0.15); color: #4ade80; }
.stat-icon-wrapper.stopped { background: rgba(148, 163, 184, 0.15); color: #94a3b8; }
.stat-icon-wrapper.templates { background: rgba(168, 85, 247, 0.15); color: #c084fc; }

.stat-label {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #f1f5f9;
}

.text-green { color: #4ade80; }
.text-gray { color: #94a3b8; }
.text-purple { color: #c084fc; }

/* 筛选与搜索工具条 */
.filter-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  gap: 16px;
  flex-wrap: wrap;
}

.search-input-wrapper {
  position: relative;
  width: 320px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: #64748b;
}

.search-input {
  width: 100%;
  padding: 8px 12px 8px 36px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #f8fafc;
  font-size: 13px;
  box-sizing: border-box;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.filter-chips {
  display: flex;
  gap: 8px;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 20px;
  color: #94a3b8;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-chip.active {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border-color: #3b82f6;
}

.chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot-green { background: #22c55e; }
.dot-gray { background: #64748b; }

/* 实例卡片网络 */
.instance-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.instance-card {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  backdrop-filter: blur(10px);
  transition: transform 0.2s, border-color 0.2s;
}

.instance-card:hover {
  transform: translateY(-2px);
  border-color: rgba(59, 130, 246, 0.4);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.instance-main-title {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-indicator.running {
  background: #22c55e;
  box-shadow: 0 0 8px #22c55e;
}

.status-indicator.stopped {
  background: #64748b;
}

.instance-name {
  font-size: 15px;
  font-weight: 600;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vmid-badge {
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-family: monospace;
  color: #94a3b8;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* 端点信息 */
.endpoint-box {
  background: rgba(15, 23, 42, 0.7);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.endpoint-row {
  display: flex;
  align-items: center;
  font-size: 12px;
}

.endpoint-label {
  color: #64748b;
  width: 65px;
  flex-shrink: 0;
}

.endpoint-value {
  color: #cbd5e1;
  word-break: break-all;
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.copy-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
}

.copy-btn:hover {
  color: #60a5fa;
}

.copy-btn svg {
  width: 14px;
  height: 14px;
}

/* 规格指标面板 */
.specs-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.spec-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.spec-name {
  color: #94a3b8;
}

.spec-badge {
  background: rgba(51, 65, 85, 0.5);
  padding: 2px 8px;
  border-radius: 4px;
  color: #e2e8f0;
  font-size: 11px;
}

.outlet-badge {
  background: rgba(14, 165, 233, 0.15);
  color: #38bdf8;
}

.template-badge {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
}

/* 卡片底栏操作按钮 - 层次化两行网格布局 */
.card-footer-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.footer-power-row,
.footer-ops-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  min-width: 0;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  background: #1e293b;
  color: #cbd5e1;
  user-select: none;
}

.btn-action.full-width {
  flex: 1;
  width: 100%;
}

.footer-power-row .stop-btn,
.footer-power-row .restart-btn {
  flex: 1;
}

.footer-ops-row .reset-btn,
.footer-ops-row .convert-btn {
  flex: 1;
}

.btn-action svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.btn-action span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-action.start-btn {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  border-color: rgba(34, 197, 94, 0.3);
}

.btn-action.start-btn:hover {
  background: rgba(34, 197, 94, 0.3);
  color: #86efac;
}

.btn-action.stop-btn {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.3);
}

.btn-action.stop-btn:hover {
  background: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.btn-action.restart-btn {
  background: #334155;
  color: #f8fafc;
}

.btn-action.restart-btn:hover {
  background: #475569;
}

.btn-action.reset-btn {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border-color: rgba(245, 158, 11, 0.3);
}

.btn-action.reset-btn:hover {
  background: rgba(245, 158, 11, 0.3);
  color: #fde68a;
}

.btn-action.convert-btn {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
  border-color: rgba(168, 85, 247, 0.3);
}

.btn-action.convert-btn:hover {
  background: rgba(168, 85, 247, 0.28);
  color: #e9d5ff;
}

.btn-action.danger-btn {
  width: 32px;
  min-width: 32px;
  padding: 0;
  color: #94a3b8;
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.15);
}

.btn-action.danger-btn:hover {
  background: rgba(239, 68, 68, 0.25);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.4);
}

/* 模态窗体系 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-box {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 14px;
  width: 100%;
  max-width: 680px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #334155;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #f8fafc;
}

.modal-close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 18px;
  cursor: pointer;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #334155;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-subheading {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #60a5fa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.form-grid.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
.form-grid.cols-4 { grid-template-columns: 1fr 1fr 1fr 1fr; }

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12px;
  color: #94a3b8;
}

.form-input, .form-select, .form-textarea {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 8px 12px;
  color: #f8fafc;
  font-size: 13px;
  box-sizing: border-box;
}

.form-input:focus, .form-select:focus, .form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
}

.preset-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.preset-btn {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #cbd5e1;
  font-size: 12px;
  padding: 6px 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-btn.active {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border-color: #3b82f6;
}

.modal-tip {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
  line-height: 1.5;
}

/* 空状态与加载状态 */
.empty-state, .loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #64748b;
  gap: 12px;
}

.empty-state svg {
  width: 48px;
  height: 48px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(59, 130, 246, 0.2);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-small {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* 密钥掩码切换与测试反馈提示 */
.secret-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.secret-input-wrapper .form-input {
  padding-right: 42px;
}

.secret-toggle-btn {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.7;
  padding: 4px;
  transition: opacity 0.2s;
}

.secret-toggle-btn:hover {
  opacity: 1;
}

.test-feedback {
  margin-top: 14px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 1.4;
}

.feedback-success {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.feedback-error {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.feedback-icon {
  font-weight: bold;
  font-size: 14px;
}

.footer-right-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

/* 卡片头部右侧按钮与徽章组 */
.header-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.terminal-icon-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 500;
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #64748b;
  cursor: not-allowed;
  transition: all 0.2s ease;
}

.terminal-icon-btn.is-active {
  background: rgba(14, 165, 233, 0.15);
  border-color: rgba(14, 165, 233, 0.35);
  color: #38bdf8;
  cursor: pointer;
}

.terminal-icon-btn.is-active:hover {
  background: rgba(14, 165, 233, 0.28);
  color: #7dd3fc;
  border-color: rgba(14, 165, 233, 0.6);
  transform: translateY(-1px);
}

.terminal-icon-btn svg {
  width: 12px;
  height: 12px;
}

/* 实时资源占用监控条面板 */
.metrics-panel {
  background: rgba(15, 23, 42, 0.6);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
}

.metric-title {
  color: #94a3b8;
  font-weight: 500;
}

.metric-val {
  color: #e2e8f0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.progress-bar {
  height: 6px;
  background: rgba(51, 65, 85, 0.5);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.progress-fill.fill-green {
  background: linear-gradient(90deg, #10b981 0%, #34d399 100%);
}

.progress-fill.fill-yellow {
  background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%);
}

.progress-fill.fill-red {
  background: linear-gradient(90deg, #ef4444 0%, #f87171 100%);
}

.progress-fill.fill-blue {
  background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
}

.progress-fill.fill-purple {
  background: linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%);
}

/* 运维控制台终端模态弹窗 */
.terminal-modal {
  max-width: 960px;
  height: 680px;
  background: #0d1117;
  border: 1px solid #30363d;
  display: flex;
  flex-direction: column;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.terminal-modal.is-fullscreen {
  max-width: 98vw;
  width: 98vw;
  height: 96vh;
  border-radius: 8px;
}

.terminal-header {
  background: #161b22;
  border-bottom: 1px solid #30363d;
  padding: 10px 16px;
}

.terminal-header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.term-title-icon {
  width: 16px;
  height: 16px;
  color: #38bdf8;
}

.term-title-text {
  font-size: 13px;
  font-weight: 600;
  color: #f0f6fc;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.term-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 500;
}

.term-status-pill.connected {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.term-status-pill.connected .status-dot {
  background: #22c55e;
  box-shadow: 0 0 6px #22c55e;
}

.term-status-pill.connecting {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.term-status-pill.connecting .status-dot {
  background: #f59e0b;
}

.term-status-pill.disconnected {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.term-status-pill.disconnected .status-dot {
  background: #ef4444;
}

.terminal-quick-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.quick-btn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  transition: all 0.15s ease;
}

.quick-btn:hover {
  background: #30363d;
  color: #f0f6fc;
  border-color: #8b949e;
}

.quick-btn.ctrl-c-btn {
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.3);
}

.quick-btn.ctrl-c-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ff7b72;
}

.quick-icon-btn {
  background: none;
  border: none;
  color: #8b949e;
  cursor: pointer;
  padding: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: color 0.15s ease;
}

.quick-icon-btn:hover {
  color: #f0f6fc;
  background: #21262d;
}

.quick-icon-btn svg {
  width: 15px;
  height: 15px;
}

.terminal-body-container {
  flex: 1;
  padding: 8px 12px;
  background: #0d1117;
  overflow: hidden;
  position: relative;
  min-height: 0;
}

.terminal-body-container :deep(.xterm) {
  height: 100%;
}

.terminal-footer-hint {
  padding: 6px 14px;
  background: #161b22;
  border-top: 1px solid #21262d;
  font-size: 11px;
  color: #8b949e;
  display: flex;
  align-items: center;
}

/* ==========================================================================
   PVE 物理主机集群硬件资源大盘样式 (紧凑横向排版)
   ========================================================================== */
.host-resources-section {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 16px;
}

.host-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.host-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.host-icon {
  width: 16px;
  height: 16px;
  color: #58a6ff;
}

.host-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #f0f6fc;
}

.host-count-badge {
  background: rgba(56, 139, 253, 0.15);
  color: #58a6ff;
  font-size: 11px;
  font-weight: 500;
  padding: 1px 7px;
  border-radius: 10px;
  border: 1px solid rgba(56, 139, 253, 0.3);
}

.btn-text-sm {
  background: transparent;
  border: none;
  color: #8b949e;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.btn-text-sm:hover {
  color: #58a6ff;
  background: #21262d;
}

.action-icon-sm {
  width: 13px;
  height: 13px;
}

.hosts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 10px;
}

.host-card {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.2s ease;
}

.host-card:hover {
  border-color: #58a6ff;
}

.host-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.host-name-box {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}

.host-name {
  font-size: 13px;
  font-weight: 600;
  color: #f0f6fc;
  white-space: nowrap;
}

.host-node-tag {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  background: #21262d;
  color: #8b949e;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid #30363d;
  white-space: nowrap;
}

.badge-default-cluster {
  background: rgba(35, 134, 54, 0.2);
  color: #3fb950;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid rgba(46, 160, 67, 0.3);
  white-space: nowrap;
}

.host-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.btn-host-term {
  background: #21262d;
  border: 1px solid #30363d;
  color: #58a6ff;
  font-size: 11px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.btn-host-term:hover {
  background: rgba(88, 166, 255, 0.15);
  border-color: #58a6ff;
  color: #79c0ff;
}

.btn-host-term svg {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.host-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 10px;
  white-space: nowrap;
}

.host-status-badge.online {
  background: rgba(35, 134, 54, 0.15);
  color: #3fb950;
  border: 1px solid rgba(46, 160, 67, 0.3);
}

.host-status-badge.online .status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #3fb950;
}

.host-status-badge.error {
  background: rgba(248, 81, 73, 0.15);
  color: #f85149;
  border: 1px solid rgba(248, 81, 73, 0.3);
}

.host-status-badge.error .status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #f85149;
}

.host-metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  background: rgba(22, 27, 34, 0.6);
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #21262d;
}

@media (max-width: 600px) {
  .host-metrics-grid {
    grid-template-columns: 1fr;
    gap: 6px;
  }
}

.host-metric-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.metric-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
}

.metric-name {
  color: #8b949e;
}

.metric-val {
  font-weight: 600;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.metric-subtext {
  font-size: 10px;
  color: #8b949e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.host-progress-bar {
  height: 4px;
  background: #21262d;
  border-radius: 2px;
  overflow: hidden;
}

.host-progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.host-card-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid #21262d;
  font-size: 10px;
  color: #8b949e;
  flex-wrap: wrap;
}

.footer-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}

.footer-tag b {
  color: #f0f6fc;
}

.host-error-box {
  background: rgba(248, 81, 73, 0.1);
  border: 1px solid rgba(248, 81, 73, 0.3);
  color: #f85149;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 11px;
}

/* ==========================================================================
   集群管理与列表样式 (Cluster Management)
   ========================================================================== */
.cluster-mgmt-modal {
  max-width: 860px;
}

.header-title-box {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cluster-count-badge {
  background: #21262d;
  color: #8b949e;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid #30363d;
}

.clusters-list-view {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.list-view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-sm {
  padding: 5px 12px;
  font-size: 12px;
}

.clusters-table-wrapper {
  overflow-x: auto;
  border: 1px solid #30363d;
  border-radius: 6px;
  background: #0d1117;
}

.clusters-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  text-align: left;
}

.clusters-table th {
  background: #161b22;
  color: #8b949e;
  padding: 10px 12px;
  font-weight: 600;
  border-bottom: 1px solid #30363d;
}

.clusters-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #21262d;
  color: #c9d1d9;
}

.clusters-table tbody tr:hover {
  background: rgba(110, 118, 129, 0.08);
}

.cluster-name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.name-text {
  font-weight: 600;
  color: #f0f6fc;
}

.badge-default-tag {
  background: rgba(35, 134, 54, 0.15);
  color: #3fb950;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid rgba(46, 160, 67, 0.3);
}

.node-badge {
  background: #21262d;
  color: #8b949e;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.status-indicator-tag {
  display: inline-block;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
}

.status-indicator-tag.online {
  color: #3fb950;
  background: rgba(35, 134, 54, 0.15);
}

.status-indicator-tag.normal {
  color: #8b949e;
  background: #21262d;
}

.actions-cell {
  white-space: nowrap;
}

.btn-table-action {
  background: transparent;
  border: none;
  color: #58a6ff;
  font-size: 12px;
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 4px;
  margin-left: 4px;
  transition: all 0.15s ease;
}

.btn-table-action:hover {
  background: #21262d;
  color: #79c0ff;
}

.btn-table-action.text-danger {
  color: #f85149;
}

.btn-table-action.text-danger:hover {
  background: rgba(248, 81, 73, 0.15);
  color: #ff7b72;
}

.cluster-edit-view {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.edit-view-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #30363d;
}

.btn-back {
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-back:hover {
  background: #30363d;
  color: #f0f6fc;
}

.edit-title {
  font-size: 15px;
  font-weight: 600;
  color: #f0f6fc;
  margin: 0;
}
</style>
