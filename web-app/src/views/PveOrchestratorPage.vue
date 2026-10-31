<template>
  <div class="orchestrator-page">
    <!-- 顶部大盘与概览统计 -->
    <header class="orchestrator-header">
      <div class="header-info">
        <div class="console-mark" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <rect x="3" y="3" width="18" height="7" rx="2" />
            <rect x="3" y="14" width="18" height="7" rx="2" />
            <path d="M7 6.5h.01M7 17.5h.01M12 6.5h5M12 17.5h5" />
          </svg>
        </div>
        <div>
          <h1 class="header-title">{{ $t('orchestrator.consoleTitle') }}</h1>
          <p class="header-subtitle">
            {{ $t('orchestrator.consoleSubtitle') }}
          </p>
        </div>
      </div>
      <div class="header-actions">
        <button
          class="btn-secondary"
          @click="openConfigModal"
          :title="$t('orchestrator.btnPveConfig')"
        >
          <svg
            class="action-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="3"></circle>
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
            ></path>
          </svg>
          <span>{{ $t('orchestrator.btnPveConfig') }}</span>
        </button>
        <button class="btn-secondary" @click="refreshAll" :disabled="loading">
          <svg
            class="action-icon"
            :class="{ spinning: loading }"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path
              d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
            ></path>
          </svg>
          <span>{{ $t('orchestrator.btnRefresh') }}</span>
        </button>
        <button class="btn-primary" @click="openCreateModal">
          <svg
            class="action-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>{{ $t('orchestrator.btnCreateInstance') }}</span>
        </button>
      </div>
    </header>

    <div class="overview-strip">
      <span class="overview-total"
        >{{ $t('orchestrator.totalInstances') }}
        <strong>{{
          instances.length - missingCount - foreignCount
        }}</strong></span
      >
      <span class="overview-running"
        ><i class="status-dot running"></i
        >{{ $t('orchestrator.runningInstances') }}
        <strong>{{ runningCount }}</strong></span
      >
      <span class="overview-stopped"
        ><i class="status-dot stopped"></i
        >{{ $t('orchestrator.stoppedInstances') }}
        <strong>{{ stoppedCount }}</strong></span
      >
      <span class="overview-templates"
        >{{ $t('orchestrator.templateCount') }}
        <strong>{{ templates.length }}</strong></span
      >
    </div>

    <details class="node-panel" open v-if="hosts.length">
      <summary>
        {{ $t('orchestrator.showHosts') }}
        <span class="muted"
          >{{ hosts.length }} {{ $t('orchestrator.unitNodes') }}</span
        >
      </summary>
      <div class="node-list">
        <div
          class="node-row"
          v-for="h in hosts"
          :key="hostKey(h)"
          :class="{ 'node-offline': h.status !== 'online' }"
        >
          <div class="node-identity">
            <svg
              class="node-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="7" rx="2" />
              <rect x="3" y="14" width="18" height="7" rx="2" />
              <path d="M7 6.5h.01M7 17.5h.01M12 6.5h5M12 17.5h5" />
            </svg>
            <i
              class="status-dot"
              :class="h.status === 'online' ? 'running' : 'stopped'"
            ></i
            ><strong :title="h.cluster_name || h.node">{{
              h.cluster_name || h.node
            }}</strong
            ><span class="muted">{{ h.node }}</span>
          </div>
          <template v-if="h.status === 'online'">
            <span class="node-metric metric-cpu"
              >CPU <b>{{ Math.round(h.cpu_usage * 100) }}%</b
              ><meter :value="h.cpu_usage" min="0" max="1"></meter
            ></span>
            <span class="node-metric metric-memory"
              >{{ $t('orchestrator.metricMem') }}
              <b
                >{{ formatBytes(h.mem_used_bytes) }} /
                {{ formatBytes(h.mem_total_bytes) }}</b
              ><meter
                :value="h.mem_used_bytes"
                min="0"
                :max="h.mem_total_bytes || 1"
              ></meter
            ></span>
            <span class="node-metric metric-disk"
              >{{ $t('orchestrator.hostMetricDisk') }}
              <b>{{ getPercent(h.disk_used_bytes, h.disk_total_bytes) }}%</b
              ><meter
                :value="h.disk_used_bytes"
                min="0"
                :max="h.disk_total_bytes || 1"
              ></meter
            ></span>
          </template>
          <span class="node-error" v-else>{{
            h.error_msg || $t('orchestrator.hostErrorNotice')
          }}</span>
          <button class="table-link" @click="openClusterTerminal(h)">
            {{ $t('orchestrator.btnHostTerminal') }}
          </button>
        </div>
      </div>
    </details>

    <section class="instances-panel">
      <div class="list-heading">
        <h2>{{ $t('orchestrator.instancesLabel') }}</h2>
        <span class="muted">{{
          $t('orchestrator.matchedCount', { count: filteredInstances.length })
        }}</span>
      </div>
      <div class="filter-toolbar">
        <input
          type="search"
          v-model="searchQuery"
          :placeholder="$t('orchestrator.searchPlaceholder')"
          :aria-label="$t('orchestrator.searchPlaceholder')"
          class="search-input"
        />
        <select
          class="form-select"
          v-model="statusFilter"
          :aria-label="$t('orchestrator.filterAll')"
        >
          <option value="all">{{ $t('orchestrator.filterAll') }}</option>
          <option value="running">
            {{ $t('orchestrator.filterRunning') }} ({{ runningCount }})
          </option>
          <option value="stopped">
            {{ $t('orchestrator.filterStopped') }} ({{ stoppedCount }})
          </option>
          <option value="foreign">
            {{ $t('orchestrator.inventory.statusForeign') }} ({{
              foreignCount
            }})
          </option>
          <option value="missing">
            {{ $t('orchestrator.inventory.statusMissing') }} ({{
              missingCount
            }})
          </option>
        </select>
        <select
          class="form-select"
          v-model="clusterFilter"
          :aria-label="$t('orchestrator.allClusters')"
        >
          <option value="">{{ $t('orchestrator.allClusters') }}</option>
          <option v-for="cl in clusters" :key="cl.id" :value="cl.id">
            {{ cl.name || cl.id }}
          </option>
        </select>
        <button
          v-if="staleInstances.length"
          class="btn-secondary"
          :disabled="clearingMissing || loading"
          @click="handleForgetMissing"
        >
          {{
            $t('orchestrator.inventory.cleanupMissing', {
              count: staleInstances.length,
            })
          }}
        </button>
        <span class="refresh-status muted"
          ><i class="status-dot running"></i
          >{{
            $t('orchestrator.refreshStatus', { time: lastUpdatedText })
          }}</span
        >
      </div>
      <PveInstanceTable
        :instances="filteredInstances"
        :clusters="clusters"
        :pending="actionPending"
        :loading="loading"
        :empty-text="
          instances.length
            ? $t('orchestrator.noMatchingInstances')
            : $t('orchestrator.noInstances')
        "
        @edit="openEditInstance"
        @power="handlePowerAction"
        @terminal="openTerminal"
        @reset="handleReset"
        @claim="(inst) => handleSafetyAction(inst, 'claim')"
        @baseline="(inst) => handleSafetyAction(inst, 'baseline')"
        @forget="(inst) => handleSafetyAction(inst, 'forget')"
        @resolve-task="(inst) => handleSafetyAction(inst, 'resolve-task')"
        @convert="openConvertModal"
        @destroy="handleDestroy"
        @copy="copyText"
      />
    </section>

    <PveCreateDialog
      v-if="showCreateModal"
      v-model="createForm"
      :clusters="clusters"
      :templates="createTemplates"
      :outlets="editingInstance ? outletsForEditing : createOutlets"
      :creating="creating"
      :editing="!!editingInstance"
      :loading-templates="loadingTemplates"
      :storages="createStorages"
      :loading-placement="loadingPlacement"
      :environment="createEnvironment"
      :checking-environment="checkingEnvironment"
      :preparing-environment="preparingEnvironment"
      @repair-environment="prepareCreateEnvironment"
      @configure-placement="configureCreatePlacement"
      @check-environment="checkCreateEnvironment(createForm.cluster_id, false)"
      :spec-preset="specPreset"
      :display-preset="displayPreset"
      @spec="applySpecPreset"
      @display="applyDisplayPreset"
      @close="showCreateModal = false"
      @submit="submitCreateInstance"
    />

    <!-- 固化为母本模态窗 (Convert Modal) - 防误触：禁止点击空白遮罩退出 -->
    <div class="modal-overlay" v-if="showConvertModal">
      <div class="modal-box convert-modal">
        <div class="modal-header">
          <h3>{{ $t('orchestrator.convertModalTitle') }}</h3>
          <button class="modal-close-btn" @click="showConvertModal = false">
            ✕
          </button>
        </div>

        <div class="modal-body">
          <p class="modal-tip">{{ $t('orchestrator.convertDesc') }}</p>

          <div class="form-item">
            <label class="form-label">{{
              $t('orchestrator.labelNewTemplateName')
            }}</label>
            <input
              type="text"
              v-model="convertForm.template_name"
              :placeholder="$t('orchestrator.placeholderNewTemplateName')"
              class="form-input"
            />
          </div>

          <div class="form-item">
            <label class="form-label">{{
              $t('orchestrator.labelTemplateDesc')
            }}</label>
            <textarea
              v-model="convertForm.desc"
              :placeholder="$t('orchestrator.placeholderTemplateDesc')"
              class="form-textarea"
              rows="3"
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button
            class="btn-secondary"
            @click="showConvertModal = false"
            :disabled="converting"
          >
            {{ $t('orchestrator.btnCancel') }}
          </button>
          <button
            class="btn-primary"
            @click="submitConvertTemplate"
            :disabled="converting"
          >
            <span v-if="converting" class="spinner-small"></span>
            <span>{{
              converting
                ? $t('orchestrator.convertingProgress')
                : $t('orchestrator.btnConfirmConvert')
            }}</span>
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
            <span class="cluster-count-badge"
              >{{ clusters.length }} {{ $t('orchestrator.unitClusters') }}</span
            >
          </div>
          <button class="modal-close-btn" @click="showConfigModal = false">
            ✕
          </button>
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
                    <th>{{ $t('orchestrator.clusterEnvironment') }}</th>
                    <th class="text-right">
                      {{ $t('orchestrator.colActions') }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="cl in clusters" :key="cl.id">
                    <td>
                      <div class="cluster-name-cell">
                        <span class="name-text">{{ cl.name || cl.id }}</span>
                        <span class="badge-default-tag" v-if="cl.is_default">{{
                          $t('orchestrator.badgeDefaultCluster')
                        }}</span>
                      </div>
                    </td>
                    <td class="font-mono">{{ cl.endpoint }}</td>
                    <td>
                      <span class="node-badge">{{ cl.node }}</span>
                    </td>
                    <td class="font-mono text-muted">
                      {{ cl.ssh_target || '-' }}
                    </td>
                    <td>
                      <span
                        class="status-indicator-tag"
                        :class="
                          getClusterHostStatus(cl)?.status === 'online'
                            ? 'online'
                            : 'normal'
                        "
                      >
                        {{
                          getClusterHostStatus(cl)?.status === 'online'
                            ? $t('orchestrator.hostOnline')
                            : getClusterHostStatus(cl)?.status ||
                              $t('orchestrator.cardStatusUnknown')
                        }}
                      </span>
                    </td>
                    <td>
                      <span
                        class="deployment-state"
                        :class="cl.deploy_status"
                        :title="cl.deploy_error || cl.runtime_version"
                        >{{ deploymentText(cl) }}</span
                      >
                      <small v-if="cl.runtime_version" class="muted"
                        >v{{ cl.runtime_version }}</small
                      >
                      <p v-if="cl.deploy_error" class="deployment-error">
                        {{ cl.deploy_error }}
                      </p>
                    </td>
                    <td class="text-right actions-cell">
                      <button
                        class="btn-table-action"
                        :disabled="
                          cl.deploy_status === 'deploying' ||
                          deployingClusters[cl.id]
                        "
                        @click="deployCluster(cl)"
                      >
                        {{ $t('orchestrator.deployRuntime') }}
                      </button>
                      <button
                        v-if="!cl.is_default"
                        class="btn-table-action"
                        @click="handleSetDefaultCluster(cl.id)"
                        :title="$t('orchestrator.setDefaultTip')"
                      >
                        {{ $t('orchestrator.btnSetDefault') }}
                      </button>
                      <button
                        class="btn-table-action"
                        @click="openClusterTerminal(cl)"
                      >
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
              <h4 class="edit-title">
                {{
                  isEditingExistingCluster
                    ? $t('orchestrator.editClusterTitle')
                    : $t('orchestrator.addClusterTitle')
                }}
              </h4>
            </div>

            <div class="form-grid">
              <div class="form-item">
                <label class="form-label"
                  >{{ $t('orchestrator.labelClusterName') }}
                  <span class="required">*</span></label
                >
                <input
                  type="text"
                  v-model="clusterForm.name"
                  :placeholder="$t('orchestrator.placeholderClusterName')"
                  class="form-input"
                />
              </div>

              <div class="form-item">
                <label class="form-label"
                  >{{ $t('orchestrator.labelClusterId') }}
                  <span class="required">*</span></label
                >
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
                <label class="form-label"
                  >{{ $t('orchestrator.labelEndpoint') }}
                  <span class="required">*</span></label
                >
                <input
                  type="text"
                  v-model="clusterForm.endpoint"
                  :disabled="clusterHostLocked"
                  :placeholder="$t('orchestrator.placeholderEndpoint')"
                  class="form-input font-mono"
                />
              </div>

              <div class="form-item">
                <label class="form-label"
                  >{{ $t('orchestrator.labelNode') }}
                  <span class="required">*</span></label
                >
                <input
                  type="text"
                  v-model="clusterForm.node"
                  :disabled="clusterHostLocked"
                  :placeholder="$t('orchestrator.placeholderNode')"
                  class="form-input"
                />
              </div>
            </div>

            <div class="form-grid">
              <div class="form-item">
                <label class="form-label"
                  >{{ $t('orchestrator.labelTokenId') }}
                  <span class="required">*</span></label
                >
                <input
                  type="text"
                  v-model="clusterForm.token_id"
                  :placeholder="$t('orchestrator.placeholderTokenId')"
                  class="form-input font-mono"
                />
              </div>

              <div class="form-item">
                <label class="form-label"
                  >{{ $t('orchestrator.labelTokenSecret') }}
                  <span class="required">*</span></label
                >
                <div class="secret-input-wrapper">
                  <input
                    :type="showSecret ? 'text' : 'password'"
                    v-model="clusterForm.token_secret"
                    :placeholder="$t('orchestrator.placeholderTokenSecret')"
                    class="form-input font-mono"
                  />
                  <button
                    type="button"
                    class="secret-toggle-btn"
                    @click="showSecret = !showSecret"
                  >
                    {{ showSecret ? '👁' : '🙈' }}
                  </button>
                </div>
              </div>
            </div>

            <div class="form-grid">
              <div class="form-item">
                <label class="form-label">{{
                  $t('orchestrator.labelSshTarget')
                }}</label>
                <input
                  type="text"
                  v-model="clusterForm.ssh_target"
                  :disabled="clusterHostLocked"
                  :placeholder="$t('orchestrator.placeholderSshTarget')"
                  class="form-input font-mono"
                />
              </div>

              <div class="form-item checkbox-item">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    v-model="clusterForm.is_default"
                    :disabled="clusters.length === 0"
                  />
                  <span>{{ $t('orchestrator.labelSetAsDefaultCluster') }}</span>
                </label>
              </div>
            </div>

            <div class="form-item">
              <label class="checkbox-label"
                ><input
                  type="checkbox"
                  v-model="clusterForm.auto_deploy_agent"
                />{{ $t('orchestrator.autoDeployRuntime') }}</label
              >
              <p class="modal-tip">
                {{ $t('orchestrator.deployRuntimeHint') }}
                {{ $t('orchestrator.environment.manualHint') }}
              </p>
            </div>
            <p v-if="clusterHostLocked" class="modal-tip">
              {{ t('orchestrator.placement.hostLocked') }}
            </p>
            <PvePlacementFields
              v-model="clusterForm"
              :resources="clusterResources"
              :loading="loadingResources"
              @load="loadClusterResources"
            />
            <!-- 测试结果反馈 -->
            <div
              v-if="testResult"
              class="test-feedback"
              :class="
                testResult.success ? 'feedback-success' : 'feedback-error'
              "
            >
              <span class="feedback-icon">{{
                testResult.success ? '✓' : '✗'
              }}</span>
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
            <button
              class="btn-secondary"
              @click="handleTestClusterForm"
              :disabled="testingConfig || savingConfig"
            >
              <span v-if="testingConfig" class="spinner-small"></span>
              <span>{{
                testingConfig
                  ? $t('orchestrator.testingConnection')
                  : $t('orchestrator.btnTestConnection')
              }}</span>
            </button>
            <div class="footer-right-actions">
              <button
                class="btn-secondary"
                @click="showClusterEditForm = false"
                :disabled="testingConfig || savingConfig"
              >
                {{ $t('orchestrator.btnCancel') }}
              </button>
              <button
                class="btn-primary"
                @click="handleSaveClusterForm"
                :disabled="testingConfig || savingConfig"
              >
                <span v-if="savingConfig" class="spinner-small"></span>
                <span>{{
                  savingConfig
                    ? $t('orchestrator.savingConfig')
                    : $t('orchestrator.btnSaveConfig')
                }}</span>
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 运维控制台终端模态窗 (Terminal Modal) - 防误触：禁止点击空白遮罩退出 -->
    <div class="modal-overlay terminal-overlay" v-if="showTerminalModal">
      <div
        class="modal-box terminal-modal"
        :class="{ 'is-fullscreen': isTermFullscreen }"
      >
        <div class="modal-header terminal-header">
          <div class="terminal-header-title">
            <svg
              class="term-title-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="4 17 10 11 4 5"></polyline>
              <line x1="12" y1="19" x2="20" y2="19"></line>
            </svg>
            <span class="term-title-text" v-if="termTargetType === 'cluster'">
              {{
                $t('orchestrator.clusterTermModalTitle', {
                  name: activeTermCluster?.name || activeTermCluster?.id,
                  node: activeTermCluster?.node,
                })
              }}
            </span>
            <span class="term-title-text" v-else>
              {{
                $t('orchestrator.termModalTitle', {
                  vmid: activeTermInst?.vmid,
                  name: activeTermInst?.name,
                })
              }}
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
              <button
                class="quick-btn"
                @click="sendTermCommand('pct list\n')"
                :title="$t('orchestrator.quickPctListTip')"
              >
                pct list
              </button>
              <button
                class="quick-btn"
                @click="sendTermCommand('intel_gpu_top -s 1000\n')"
                :title="$t('orchestrator.quickGpuTopTip')"
              >
                intel_gpu_top
              </button>
              <button
                class="quick-btn"
                @click="sendTermCommand('top\n')"
                :title="$t('orchestrator.quickTopTip')"
              >
                top
              </button>
              <button
                class="quick-btn"
                @click="sendTermCommand('dmesg -T | tail -n 30\n')"
                :title="$t('orchestrator.quickDmesgTip')"
              >
                dmesg
              </button>
              <button
                class="quick-btn"
                @click="sendTermCommand('df -h\n')"
                :title="$t('orchestrator.quickDfTip')"
              >
                df -h
              </button>
            </template>
            <!-- 实例快捷操作 -->
            <template v-else>
              <button
                class="quick-btn"
                @click="sendTermCommand('logcat -v time\n')"
                :title="$t('orchestrator.quickLogcatTip')"
              >
                logcat
              </button>
              <button
                class="quick-btn"
                @click="sendTermCommand('getprop | grep -i redroid\n')"
                :title="$t('orchestrator.quickGetpropTip')"
              >
                getprop
              </button>
              <button
                class="quick-btn"
                @click="sendTermCommand('top -m 10\n')"
                :title="$t('orchestrator.quickTopTip')"
              >
                top
              </button>
            </template>
            <button
              class="quick-btn ctrl-c-btn"
              @click="sendTermCommand('\x03')"
              :title="$t('orchestrator.quickCtrlCTip')"
            >
              Ctrl+C
            </button>
            <button
              class="quick-btn"
              @click="clearTerminal"
              :title="$t('orchestrator.quickClearTip')"
            >
              {{ $t('orchestrator.quickClear') }}
            </button>
            <button
              class="quick-btn"
              @click="reconnectTerminal"
              :title="$t('orchestrator.quickReconnectTip')"
            >
              {{ $t('orchestrator.quickReconnect') }}
            </button>
            <button
              class="quick-icon-btn"
              @click="toggleTermFullscreen"
              :title="
                isTermFullscreen
                  ? $t('orchestrator.termRestore')
                  : $t('orchestrator.termFullscreen')
              "
            >
              <svg
                v-if="!isTermFullscreen"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
              <svg
                v-else
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
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
import PveInstanceTable from '@/components/pve/PveInstanceTable.vue'
import PveCreateDialog from '@/components/pve/PveCreateDialog.vue'
import PvePlacementFields from '@/components/pve/PvePlacementFields.vue'

const { t, locale } = useI18n()

// 核心响应式状态
const loading = ref(false)
const instances = ref([])
const templates = ref([])
const createTemplates = ref([])
const createStorages = ref([])
const loadingPlacement = ref(false)
const createEnvironment = ref(null)
const checkingEnvironment = ref(false)
const preparingEnvironment = ref(false)
const createOutlets = ref([])
const clusterResources = ref({ storages: [], bridges: [] })
const loadingResources = ref(false)
const clusterHostLocked = computed(
  () =>
    isEditingExistingCluster.value &&
    instances.value.some((i) => i.cluster_id === clusterForm.value.id),
)
const outlets = ref([])
const searchQuery = ref('')
const clusterFilter = ref('')
const statusFilter = ref('all') // 'all' | 'running' | 'stopped'
const actionPending = ref({})

// PVE 物理宿主机资源监控状态
const hosts = ref([])
let hostsRequest = null
let dataRequest = null
const inventoryAbort = new AbortController()
const lastUpdated = ref(null)
const lastUpdatedText = computed(() =>
  lastUpdated.value
    ? new Intl.DateTimeFormat(locale.value, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(lastUpdated.value)
    : '—',
)
const recordOrder = new Intl.Collator('en', { numeric: true })
const hostKey = (host) => `${host.cluster_id || ''}:${host.node || ''}`
const instanceKey = (inst) => `${inst.cluster_id || ''}:${inst.id || inst.vmid}`
const asList = (response) =>
  Array.isArray(response)
    ? response
    : Array.isArray(response?.data)
      ? response.data
      : []

// Retain row objects, focus and DOM nodes when a refresh only changes metrics.
function updateRecords(target, records, key) {
  const existing = new Map(target.value.map((record) => [key(record), record]))
  const next = records.map((record) => {
    const previous = existing.get(key(record))
    if (!previous) return record
    for (const field of Object.keys(previous)) {
      if (!(field in record)) delete previous[field]
    }
    Object.assign(previous, record)
    return previous
  })
  if (
    next.length !== target.value.length ||
    next.some((record, index) => record !== target.value[index])
  ) {
    target.value = next
  }
}

// 多 PVE 集群管理状态
const clusters = ref([])
const showConfigModal = ref(false)
const resumeCreateClusterId = ref('')
watch(showConfigModal, (visible) => {
  if (!visible) resumeCreateClusterId.value = ''
})
const showClusterEditForm = ref(false)
const isEditingExistingCluster = ref(false)
const showSecret = ref(false)
const deployingClusters = ref({})
const clusterForm = ref({
  id: '',
  name: '',
  endpoint: '',
  node: '',
  token_id: '',
  token_secret: '',
  ssh_target: '',
  is_default: false,
  auto_deploy_agent: true,
  default_storage: '',
  network_outlets: [],
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

function getClusterHostStatus(cl) {
  return (
    hosts.value.find((h) => h.cluster_id === cl.id && h.node === cl.node) ||
    hosts.value.find((h) => h.cluster_id === cl.id)
  )
}

async function fetchHosts() {
  if (hostsRequest) return hostsRequest
  hostsRequest = (async () => {
    try {
      const res = await fetch('/api/pve/hosts', {
        headers: authHeaders(),
        signal: inventoryAbort.signal,
      })
      if (res.ok) {
        const list = asList(await res.json()).sort((a, b) =>
          recordOrder.compare(hostKey(a), hostKey(b)),
        )
        updateRecords(hosts, list, hostKey)
      }
    } catch (err) {
      if (err.name !== 'AbortError')
        console.error('Fetch PVE hosts failed:', err)
    }
  })()
  try {
    await hostsRequest
  } finally {
    hostsRequest = null
  }
}

async function fetchClusters() {
  try {
    const res = await fetch('/api/pve/clusters', {
      headers: authHeaders(),
      signal: inventoryAbort.signal,
    })
    if (res.ok) {
      const d = await res.json()
      clusters.value = asList(d).sort((a, b) => recordOrder.compare(a.id, b.id))
    }
  } catch (err) {
    if (err.name !== 'AbortError')
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
    case 'connected':
      return t('orchestrator.termConnected')
    case 'connecting':
      return t('orchestrator.termConnecting')
    default:
      return t('orchestrator.termDisconnected')
  }
})

// 统计计算属性
const runningCount = computed(
  () => instances.value.filter((i) => i.status === 'running').length,
)
const stoppedCount = computed(
  () => instances.value.filter((i) => i.status === 'stopped').length,
)
const missingCount = computed(
  () => instances.value.filter((i) => i.status === 'missing').length,
)
const foreignCount = computed(
  () => instances.value.filter((i) => i.status === 'foreign').length,
)
const clearingMissing = ref(false)

// 过滤搜索并严格按 VMID 升序稳定排序（避免轮询刷新时卡片位置随机跳动）
const filteredInstances = computed(() => {
  return instances.value
    .filter((inst) => {
      if (clusterFilter.value && inst.cluster_id !== clusterFilter.value)
        return false
      // 状态匹配
      if (statusFilter.value !== 'all' && inst.status !== statusFilter.value)
        return false

      // 关键词匹配
      if (!searchQuery.value) return true
      const q = searchQuery.value.trim().toLowerCase()
      const nameMatch = inst.name && inst.name.toLowerCase().includes(q)
      const ipMatch = inst.ip && inst.ip.toLowerCase().includes(q)
      const vmidMatch = String(inst.vmid).includes(q)
      return nameMatch || ipMatch || vmidMatch
    })
    .sort(
      (a, b) =>
        a.vmid - b.vmid || recordOrder.compare(instanceKey(a), instanceKey(b)),
    )
})
const staleInstances = computed(() =>
  filteredInstances.value.filter(
    (inst) =>
      ['missing', 'foreign'].includes(inst.status) &&
      !inst.pending_task &&
      !inst.reset_phase,
  ),
)

// Background polling keeps existing content visible and never overlaps a slow request.
async function fetchData({ silent = false, catalog = true } = {}) {
  if (silent && dataRequest) return dataRequest
  // An explicit refresh after a mutation must run after any older request finishes.
  while (dataRequest) await dataRequest
  if (inventoryAbort.signal.aborted) return
  if (!silent) loading.value = true
  dataRequest = (async () => {
    const paths = [
      '/api/pve/instances',
      ...(catalog ? ['/api/pve/templates', '/api/pve/outlets'] : []),
    ]
    const targets = [instances, templates, outlets]
    await Promise.all(
      paths.map(async (path, index) => {
        try {
          const res = await fetch(path, {
            headers: authHeaders(),
            signal: inventoryAbort.signal,
          })
          if (!res.ok) return
          const list = asList(await res.json())
          if (index === 0) {
            list.sort(
              (a, b) =>
                a.vmid - b.vmid ||
                recordOrder.compare(instanceKey(a), instanceKey(b)),
            )
            updateRecords(instances, list, instanceKey)
            lastUpdated.value = new Date()
          } else {
            targets[index].value = list
          }
        } catch (err) {
          if (err.name !== 'AbortError')
            console.error('Fetch PVE data failed:', err)
        }
      }),
    )
  })()
  try {
    await dataRequest
  } finally {
    dataRequest = null
    if (!silent) loading.value = false
  }
}

async function refreshAll() {
  await Promise.all([fetchData(), fetchHosts(), fetchClusters()])
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
  if (
    action === 'stop' &&
    !confirm(
      t('orchestrator.confirmPowerStop', { name: inst.name, vmid: inst.vmid }),
    )
  ) {
    return
  }
  if (
    action === 'restart' &&
    !confirm(
      t('orchestrator.confirmPowerRestart', {
        name: inst.name,
        vmid: inst.vmid,
      }),
    )
  ) {
    return
  }

  const id = inst.id || String(inst.vmid)
  actionPending.value[inst.vmid] = true
  try {
    const res = await fetch(`/api/pve/instances/${id}/power`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ action }),
    })
    if (!res.ok) {
      const payload = await res.json().catch(() => null)
      if (payload?.error_code === 'PVE_ENVIRONMENT_NOT_READY') {
        openConfigModal()
        const cluster = clusters.value.find(
          (item) => item.id === inst.cluster_id,
        )
        if (cluster) editCluster(cluster)
        alert(
          t(
            payload.environment?.code === 'runtime_upgrade_required'
              ? 'orchestrator.network.runtimeUpgradeRequired'
              : 'orchestrator.environment.notReady',
          ),
        )
        return
      }
      throw new Error(payload?.message || 'Power operation failed')
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
async function handleSafetyAction(inst, action) {
  const id = inst.id || inst.vmid
  actionPending.value[inst.vmid] = true
  try {
    let body = {}
    if (action === 'resolve-task') {
      const upid = prompt(t('orchestrator.placement.taskPrompt'))
      if (!upid) return
      body = { upid: upid.trim() }
    } else if (action === 'claim') {
      const response = await fetch(`/api/pve/instances/${id}/ownership`, {
        headers: authHeaders(),
      })
      if (!response.ok)
        throw new Error(await readError(response, 'Cannot review ownership'))
      const actual = (await response.json()).data
      if (
        !confirm(
          t('orchestrator.placement.claimConfirm', {
            ...actual,
            name: actual.hostname || '—',
            network: actual.network || '—',
          }),
        )
      )
        return
      body = { digest: actual.digest }
    } else if (
      !confirm(
        t(
          `orchestrator.placement.${action === 'baseline' ? 'baselineConfirm' : 'forgetConfirm'}`,
          { name: inst.name },
        ),
      )
    )
      return
    const response = await fetch(`/api/pve/instances/${id}/${action}`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    })
    if (!response.ok)
      throw new Error(await readError(response, 'Operation failed'))
    await fetchData()
  } catch (err) {
    alert(t('orchestrator.actionFailed', { error: err.message }))
  } finally {
    actionPending.value[inst.vmid] = false
  }
}

async function handleForgetMissing() {
  const records = staleInstances.value.filter(
    (inst) => !actionPending.value[inst.vmid],
  )
  if (!records.length || clearingMissing.value) return
  if (
    !confirm(
      t('orchestrator.inventory.cleanupConfirm', {
        count: records.length,
        instances: records
          .map((inst) => `${inst.name} · CT ${inst.vmid}`)
          .join('\n'),
      }),
    )
  )
    return
  clearingMissing.value = true
  for (const inst of records) actionPending.value[inst.vmid] = true
  const failures = []
  try {
    for (const inst of records) {
      try {
        const response = await fetch(
          `/api/pve/instances/${inst.id || inst.vmid}/forget`,
          {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: '{}',
          },
        )
        if (!response.ok)
          throw new Error(await readError(response, 'Operation failed'))
      } catch (err) {
        failures.push(`CT ${inst.vmid}: ${err.message}`)
      }
    }
  } finally {
    await fetchData({ silent: true })
    for (const inst of records) actionPending.value[inst.vmid] = false
    clearingMissing.value = false
  }
  if (failures.length)
    alert(t('orchestrator.actionFailed', { error: failures.join('\n') }))
}

async function handleReset(inst) {
  if (
    !confirm(
      t('orchestrator.confirmReset', { name: inst.name, vmid: inst.vmid }),
    )
  ) {
    return
  }

  const id = inst.id || String(inst.vmid)
  actionPending.value[inst.vmid] = true
  try {
    const res = await fetch(`/api/pve/instances/${id}/reset`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
    })
    if (!res.ok) {
      const text = await res.text()
      let payload
      try {
        payload = JSON.parse(text)
      } catch {
        payload = null
      }
      if (payload?.error_code === 'PVE_ENVIRONMENT_NOT_READY') {
        await fetchClusters()
        openConfigModal()
        alert(t('orchestrator.environment.notReady'))
        return
      }
      throw new Error(payload?.message || text || 'Reset failed')
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
  if (
    !confirm(
      t('orchestrator.confirmDestroy', { name: inst.name, vmid: inst.vmid }),
    )
  ) {
    return
  }

  const id = inst.id || String(inst.vmid)
  actionPending.value[inst.vmid] = true
  try {
    const res = await fetch(`/api/pve/instances/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
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
const editingInstance = ref(null)
const creating = ref(false)
const specPreset = ref('standard')
const displayPreset = ref('portrait720')

const createForm = ref({
  name: '',
  cluster_id: '',
  template_id: '',
  storage: '',
  outlet_id: 'direct',
  network_mode: 'dhcp',
  spec: {
    cores: 4,
    memory_mb: 8192,
    disk_gb: 24,
  },
  display: {
    width: 720,
    height: 1280,
    dpi: 320,
    fps: 60,
    gpu_mode: 'host',
    output_mode: 'headless',
    extra_boot_args: '',
  },
  custom_ip: '',
  signalingServer: '',
  turnServer: '',
  unprivileged: false,
})

function applySpecPreset(preset) {
  const swap = createForm.value.spec.swap_mb
  specPreset.value = preset
  if (preset === 'entry') {
    createForm.value.spec = { cores: 2, memory_mb: 4096, disk_gb: 16 }
  } else if (preset === 'standard') {
    createForm.value.spec = { cores: 4, memory_mb: 8192, disk_gb: 24 }
  } else if (preset === 'premium') {
    createForm.value.spec = { cores: 8, memory_mb: 16384, disk_gb: 32 }
  }
  if (editingInstance.value && swap !== undefined)
    createForm.value.spec.swap_mb = swap
  const minimumDisk =
    createTemplates.value.find((tpl) => tpl.id === createForm.value.template_id)
      ?.base_disk_gb || 16
  if (createForm.value.spec.disk_gb < minimumDisk) {
    createForm.value.spec.disk_gb = minimumDisk
    specPreset.value = 'custom'
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

const outletsForEditing = computed(() => {
  const inst = editingInstance.value
  return inst
    ? [
        {
          id: inst.outlet_id,
          name: inst.outlet_name || inst.outlet_id,
          subnet: inst.ip,
          gateway: inst.gateway,
        },
      ]
    : []
})
let environmentRequest = 0
let environmentTimer = null
function queueEnvironmentCheck() {
  if (
    !showCreateModal.value ||
    editingInstance.value ||
    !createForm.value.cluster_id
  )
    return
  environmentRequest++
  createEnvironment.value = null
  checkingEnvironment.value = true
  clearTimeout(environmentTimer)
  environmentTimer = setTimeout(
    () => checkCreateEnvironment(createForm.value.cluster_id),
    180,
  )
}
async function checkCreateEnvironment(clusterId, autoRepair = true) {
  clearTimeout(environmentTimer)
  const request = ++environmentRequest
  const mode = createForm.value.network_mode || 'static'
  const templateId = createForm.value.template_id
  checkingEnvironment.value = true
  createEnvironment.value = null
  try {
    const response = await fetch(
      `/api/pve/clusters/${encodeURIComponent(clusterId)}/preflight`,
      {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          auto_repair: autoRepair,
          network_mode: mode,
          template_id: templateId,
          instance_id: editingInstance.value?.id || '',
        }),
      },
    )
    if (!response.ok)
      throw new Error(await readError(response, 'Environment check failed'))
    const result = (await response.json()).data
    if (
      request === environmentRequest &&
      createForm.value.cluster_id === clusterId &&
      createForm.value.network_mode === mode &&
      createForm.value.template_id === templateId
    )
      createEnvironment.value = result
    if (request === environmentRequest) void fetchClusters()
  } catch (err) {
    if (request === environmentRequest)
      createEnvironment.value = {
        ready: false,
        code: 'check_failed',
        details: err.message,
      }
  } finally {
    if (request === environmentRequest) checkingEnvironment.value = false
  }
}
async function prepareCreateEnvironment() {
  const clusterId = createForm.value.cluster_id
  preparingEnvironment.value = true
  try {
    const response = await fetch(
      `/api/pve/clusters/${encodeURIComponent(clusterId)}/deploy-agent`,
      { method: 'POST', headers: authHeaders() },
    )
    if (!response.ok)
      throw new Error(
        await readError(response, 'Environment deployment failed'),
      )
    if (createForm.value.cluster_id === clusterId)
      await checkCreateEnvironment(clusterId, false)
    await fetchClusters()
  } catch (err) {
    if (createForm.value.cluster_id === clusterId)
      createEnvironment.value = {
        ready: false,
        code: 'deployment_failed',
        details: err.message,
      }
  } finally {
    preparingEnvironment.value = false
  }
}

let placementRequest = 0
async function loadCreatePlacement(clusterId) {
  const request = ++placementRequest
  const requestId = clusterId
  loadingPlacement.value = true
  try {
    const [resourcesResponse, outletsResponse] = await Promise.all([
      fetch(`/api/pve/clusters/${encodeURIComponent(clusterId)}/resources`, {
        headers: authHeaders(),
      }),
      fetch(`/api/pve/outlets?cluster_id=${encodeURIComponent(clusterId)}`, {
        headers: authHeaders(),
      }),
    ])
    if (!resourcesResponse.ok)
      throw new Error(
        await readError(resourcesResponse, 'Failed to load storage'),
      )
    if (!outletsResponse.ok)
      throw new Error(
        await readError(outletsResponse, 'Failed to load outlets'),
      )
    const resources = (await resourcesResponse.json()).data
    const networkOutlets = (await outletsResponse.json()).data || []
    if (
      request !== placementRequest ||
      createForm.value.cluster_id !== requestId ||
      editingInstance.value
    )
      return
    createStorages.value = resources.storages || []
    createOutlets.value = networkOutlets
    const cluster = clusters.value.find((c) => c.id === clusterId)
    createForm.value.storage = createStorages.value.some(
      (s) => s.storage === cluster?.default_storage,
    )
      ? cluster.default_storage
      : createStorages.value.length === 1
        ? createStorages.value[0].storage
        : ''
    const selected =
      networkOutlets.find((o) => o.is_default) || networkOutlets[0]
    createForm.value.outlet_id = selected?.id || ''
    createForm.value.network_mode = selected?.network_mode || 'dhcp'
  } catch (err) {
    if (request !== placementRequest) return
    createStorages.value = []
    createOutlets.value = []
    alert(t('orchestrator.actionFailed', { error: err.message }))
  } finally {
    if (request === placementRequest) loadingPlacement.value = false
  }
}
async function configureCreatePlacement() {
  const clusterId = createForm.value.cluster_id
  showCreateModal.value = false
  await openConfigModal()
  const cluster = clusters.value.find((item) => item.id === clusterId)
  if (!cluster) return
  resumeCreateClusterId.value = clusterId
  editCluster(cluster)
}
let clusterResourcesRequest = 0
const clusterResourcesKey = (form) =>
  JSON.stringify([
    form.id,
    form.endpoint,
    form.node,
    form.token_id,
    form.token_secret,
  ])
async function loadClusterResources() {
  const request = ++clusterResourcesRequest
  const key = clusterResourcesKey(clusterForm.value)
  loadingResources.value = true
  try {
    const response = await fetch('/api/pve/config/resources', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(clusterForm.value),
    })
    if (!response.ok)
      throw new Error(
        await readError(response, 'Failed to load node resources'),
      )
    const resources = (await response.json()).data
    if (
      request !== clusterResourcesRequest ||
      key !== clusterResourcesKey(clusterForm.value) ||
      !showClusterEditForm.value
    )
      return
    clusterResources.value = resources
    if (!clusterForm.value.default_storage && resources.storages?.length === 1)
      clusterForm.value.default_storage = resources.storages[0].storage
  } catch (err) {
    if (
      request === clusterResourcesRequest &&
      key === clusterResourcesKey(clusterForm.value) &&
      showClusterEditForm.value
    )
      alert(t('orchestrator.actionFailed', { error: err.message }))
  } finally {
    if (request === clusterResourcesRequest) loadingResources.value = false
  }
}

let templateRequest = 0
const loadingTemplates = ref(false)
async function loadTemplatesForCluster(clusterId) {
  const request = ++templateRequest
  loadingTemplates.value = true
  createTemplates.value = []
  try {
    const res = await fetch(
      `/api/pve/templates?cluster_id=${encodeURIComponent(clusterId || '')}`,
      {
        headers: authHeaders(),
      },
    )
    if (res.ok) {
      const d = await res.json()
      if (request !== templateRequest) return
      createTemplates.value = Array.isArray(d) ? d : d.data || []
      if (createTemplates.value.length > 0) {
        const hasCurrent = createTemplates.value.some(
          (t) => t.id === createForm.value.template_id,
        )
        if (!hasCurrent) {
          const def =
            createTemplates.value.find((t) => t.is_default) ||
            createTemplates.value[0]
          createForm.value.template_id = def.id
        }
      }
    }
  } catch (err) {
    console.error('Load templates for cluster failed:', err)
  } finally {
    if (request === templateRequest) loadingTemplates.value = false
  }
}

watch(
  () => createForm.value.cluster_id,
  (newCId) => {
    if (showCreateModal.value && newCId && !editingInstance.value) {
      loadCreatePlacement(newCId)
      checkCreateEnvironment(newCId)
      loadTemplatesForCluster(newCId)
    }
  },
  { flush: 'sync' },
)

watch(
  () => [createForm.value.network_mode, createForm.value.template_id],
  () => {
    if (createForm.value.network_mode === 'dhcp')
      createForm.value.custom_ip = ''
    queueEnvironmentCheck()
  },
)
watch(
  () => createForm.value.outlet_id,
  () => {
    if (editingInstance.value || !showCreateModal.value) return
    const out = createOutlets.value.find(
      (item) => item.id === createForm.value.outlet_id,
    )
    if (out?.network_mode) createForm.value.network_mode = out.network_mode
  },
)

function openCreateModal() {
  if (!clusters.value.length) {
    openConfigModal()
    openAddClusterForm()
    return
  }
  if (editingInstance.value) {
    createForm.value.name = ''
    createForm.value.custom_ip = ''
    createForm.value.template_id = ''
    createForm.value.network_mode = 'dhcp'
  }
  editingInstance.value = null
  if (clusters.value.length > 0) {
    const def = clusters.value.find((c) => c.is_default) || clusters.value[0]
    createForm.value.cluster_id = def.id
    loadTemplatesForCluster(def.id)
    loadCreatePlacement(def.id)
    checkCreateEnvironment(def.id)
  } else {
    loadTemplatesForCluster('')
  }
  if (
    outlets.value.length > 0 &&
    !outlets.value.some((o) => o.id === createForm.value.outlet_id)
  ) {
    createForm.value.outlet_id = outlets.value[0].id
  }
  createForm.value.unprivileged = false
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

function openEditInstance(inst) {
  environmentRequest++
  createEnvironment.value = null
  checkingEnvironment.value = false
  editingInstance.value = inst
  createForm.value = {
    name: inst.name,
    cluster_id: inst.cluster_id,
    template_id: inst.template_id,
    outlet_id: inst.outlet_id,
    storage: inst.storage || '',
    network_mode: inst.network_mode || 'static',
    custom_ip: inst.network_mode === 'dhcp' ? '' : inst.ip,
    unprivileged: inst.unprivileged,
    spec: { ...inst.spec },
    display: { ...inst.display },
    signalingServer: inst.signalingServer || '',
    turnServer: inst.turnServer || '',
  }
  createTemplates.value = [
    {
      id: inst.template_id,
      name: inst.template_name || inst.template_id,
      base_disk_gb: inst.spec.disk_gb,
      vmid: inst.vmid,
    },
  ]
  createStorages.value = [{ storage: inst.storage || '' }]
  specPreset.value = 'custom'
  displayPreset.value = 'custom'
  showCreateModal.value = true
}

async function submitCreateInstance() {
  if (
    !editingInstance.value &&
    (!createEnvironment.value?.ready ||
      checkingEnvironment.value ||
      preparingEnvironment.value)
  )
    return
  if (
    !editingInstance.value &&
    (!createForm.value.storage || !createForm.value.outlet_id)
  ) {
    alert(t('orchestrator.placement.placementMissing'))
    return
  }
  creating.value = true
  try {
    const url = editingInstance.value
      ? `/api/pve/instances/${editingInstance.value.id || editingInstance.value.vmid}`
      : '/api/pve/instances'
    const res = await fetch(url, {
      method: editingInstance.value ? 'PUT' : 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(createForm.value),
    })
    if (!res.ok) {
      const text = await res.text()
      let payload
      try {
        payload = JSON.parse(text)
      } catch {
        payload = null
      }
      if (payload?.error_code === 'PVE_ENVIRONMENT_NOT_READY') {
        createEnvironment.value = payload.environment || {
          ready: false,
          code: 'needs_deployment',
        }
        return
      }
      throw new Error(payload?.message || text || 'Create instance failed')
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
  desc: '',
})

function openConvertModal(inst) {
  convertTarget.value = inst
  convertForm.value = {
    template_name: `${inst.name}-tmpl`,
    desc: '',
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
        preinstalled_apps: [],
      }),
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
    is_default: clusters.value.length === 0,
    auto_deploy_agent: true,
    default_storage: '',
    network_outlets: [],
  }
  clusterResources.value = { storages: [], bridges: [] }
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
    is_default: cl.is_default || false,
    auto_deploy_agent: cl.auto_deploy_agent !== false,
    default_storage: cl.default_storage || '',
    network_outlets: JSON.parse(JSON.stringify(cl.network_outlets || [])).map(
      (out) => ({ ...out, network_mode: out.network_mode || 'static' }),
    ),
  }
  clusterResources.value = { storages: [], bridges: [] }
  showSecret.value = false
  testResult.value = null
  showClusterEditForm.value = true
  loadClusterResources()
}

function deploymentText(cl) {
  return t(
    {
      deploying: 'orchestrator.deployPending',
      ready: 'orchestrator.deployReady',
      error: 'orchestrator.deployError',
      not_ready: 'orchestrator.environment.needsSetup',
    }[cl.deploy_status] ||
      (cl.agent_deployed
        ? 'orchestrator.deployReady'
        : 'orchestrator.deployUnknown'),
  )
}
async function deployCluster(cl) {
  deployingClusters.value[cl.id] = true
  try {
    const res = await fetch(
      `/api/pve/clusters/${encodeURIComponent(cl.id)}/deploy-agent`,
      { method: 'POST', headers: authHeaders() },
    )
    if (!res.ok)
      throw new Error(await readError(res, 'Runtime deployment failed'))
  } catch (err) {
    alert(t('orchestrator.actionFailed', { error: err.message }))
  } finally {
    deployingClusters.value[cl.id] = false
    await fetchClusters()
  }
}

async function handleSetDefaultCluster(clusterID) {
  try {
    const res = await fetch(`/api/pve/clusters/${clusterID}/default`, {
      method: 'POST',
      headers: authHeaders(),
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
      headers: authHeaders(),
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
  if (
    !clusterForm.value.endpoint ||
    !clusterForm.value.token_id ||
    !clusterForm.value.token_secret
  ) {
    testResult.value = {
      success: false,
      message: t('orchestrator.testFailed', {
        error: t('orchestrator.requiredCredentials'),
      }),
    }
    return
  }

  testingConfig.value = true
  testResult.value = null
  try {
    const res = await fetch('/api/pve/config/test', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(clusterForm.value),
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
      message: data.message || t('orchestrator.testSuccess'),
    }
  } catch (err) {
    testResult.value = {
      success: false,
      message: t('orchestrator.testFailed', { error: err.message }),
    }
  } finally {
    testingConfig.value = false
  }
}

async function handleSaveClusterForm() {
  if (
    !clusterForm.value.endpoint ||
    !clusterForm.value.node ||
    !clusterForm.value.token_id ||
    !clusterForm.value.token_secret
  ) {
    alert(t('orchestrator.requiredConfig'))
    return
  }

  savingConfig.value = true
  try {
    const res = await fetch(
      isEditingExistingCluster.value
        ? `/api/pve/clusters/${encodeURIComponent(clusterForm.value.id)}`
        : '/api/pve/clusters',
      {
        method: isEditingExistingCluster.value ? 'PUT' : 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(clusterForm.value),
      },
    )
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to save cluster')
    }
    showClusterEditForm.value = false
    await fetchClusters()
    fetchHosts()
    if (resumeCreateClusterId.value === clusterForm.value.id) {
      const clusterId = resumeCreateClusterId.value
      resumeCreateClusterId.value = ''
      showConfigModal.value = false
      await loadCreatePlacement(clusterId)
      showCreateModal.value = true
      checkCreateEnvironment(clusterId, false)
    }
    alert(
      t(
        clusterForm.value.auto_deploy_agent
          ? 'orchestrator.deploymentAccepted'
          : 'orchestrator.saveSuccess',
      ),
    )
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
    cl = clusters.value.find((c) => c.id === target.cluster_id)
  }
  if (!cl && target) {
    cl = target
  }
  if (!cl) {
    cl = clusters.value.find((c) => c.is_default) || clusters.value[0]
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
    fontFamily:
      'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace',
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
      brightWhite: '#f0f6fc',
    },
    scrollback: 10000,
    convertEol: true,
    scrollOnUserInput: true,
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
    const clusterId =
      activeTermCluster.value.id || activeTermCluster.value.cluster_id
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
      termInstance.writeln(
        `\r\n\x1b[31m[WebSocket 初始化失败]: ${err.message}\x1b[0m\r\n`,
      )
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
  // Background updates do not toggle the foreground loading UI.
  pollTimer = setInterval(() => {
    if (document.hidden) return
    if (showConfigModal.value && !showClusterEditForm.value) fetchClusters()
    fetchData({ silent: true, catalog: false })
    fetchHosts()
  }, 8000)
})

onUnmounted(() => {
  clearTimeout(environmentTimer)
  environmentRequest++
  if (pollTimer) clearInterval(pollTimer)
  inventoryAbort.abort()
  destroyTerminal()
})
</script>

<style scoped>
.orchestrator-page {
  padding: 18px 24px 24px;
  max-width: 1800px;
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

.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #fff;
  box-shadow: none;
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
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
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

.form-grid.cols-3 {
  grid-template-columns: 1fr 1fr 1fr;
}
.form-grid.cols-4 {
  grid-template-columns: 1fr 1fr 1fr 1fr;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12px;
  color: #94a3b8;
}

.form-input,
.form-select,
.form-textarea {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 8px 12px;
  color: #f8fafc;
  font-size: 13px;
  box-sizing: border-box;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
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
.empty-state,
.loading-state {
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

/* Dense console layout */
.orchestrator-page {
  min-width: 0;
}
.overview-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 1px;
  padding: 0;
  margin: 0 0 18px;
  overflow: hidden;
  border: 1px solid #2d405b;
  border-radius: 6px;
  background: #26364d;
  font-size: 12px;
  color: #94a3b8;
}
.overview-strip > span {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex: 1 1 160px;
  padding: 13px 18px;
  background: linear-gradient(105deg, #182a43, #142136);
  border-top: 2px solid #518ee2;
}
.overview-strip strong {
  color: #e2e8f0;
  font-size: 21px;
  font-variant-numeric: tabular-nums;
  margin-left: auto;
}
.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #f59e0b;
}
.status-dot.running {
  background: #22c55e;
}
.status-dot.stopped {
  background: #64748b;
}
.muted {
  color: #94a3b8;
  font-size: 12px;
}
.node-panel {
  border: 1px solid #293648;
  border-radius: 5px;
  margin-bottom: 20px;
  background: #121d2e;
}
.node-panel summary {
  padding: 10px 14px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}
.node-panel summary .muted {
  margin-left: 10px;
  font-weight: 400;
}
.node-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px 24px;
  padding: 10px 14px;
  border-top: 1px solid #263244;
  font-size: 12px;
}
.node-identity {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 200px;
  min-width: 0;
}
.node-identity strong {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.node-metric {
  display: grid;
  grid-template-columns: auto auto;
  gap: 4px 12px;
  min-width: 125px;
  color: #94a3b8;
}
.node-metric b {
  font-weight: 500;
  color: #e2e8f0;
  font-variant-numeric: tabular-nums;
}
.node-metric meter {
  width: 100%;
  height: 4px;
  grid-column: 1/-1;
  accent-color: #3b82f6;
}
.node-metric meter::-webkit-meter-bar {
  background: #2a374a;
  border: 0;
}
.node-metric meter::-webkit-meter-optimum-value {
  background: #568ee8;
}
.node-error {
  flex: 2;
  color: #f59e0b;
}
.table-link {
  border: 0;
  padding: 4px 0;
  background: none;
  color: #60a5fa;
  cursor: pointer;
  font: inherit;
  white-space: nowrap;
}
.instances-panel {
  border: 1px solid #293648;
  border-radius: 5px;
  background: #121d2e;
}
.list-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 16px 0;
}
.list-heading h2 {
  font-size: 14px;
  margin: 0;
  font-weight: 600;
}
.filter-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
}
.search-input {
  box-sizing: border-box;
  flex: 0 1 300px;
  min-width: 180px;
  height: 32px;
  padding: 0 10px;
  color: #e2e8f0;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 4px;
  font-size: 12px;
}
.filter-toolbar .form-select {
  width: auto;
  min-width: 140px;
  max-width: 240px;
  height: 32px;
  padding: 0 28px 0 10px;
  max-width: 100%;
}
.refresh-status {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 20px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.header-actions {
  flex-wrap: wrap;
  gap: 8px;
}
.btn-primary,
.btn-secondary {
  flex-shrink: 0;
}
.form-input,
.form-select,
.form-textarea {
  min-width: 0;
  width: 100%;
}
button:focus-visible,
summary:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 2px;
}
button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
@media (max-width: 760px) {
  .orchestrator-page {
    padding: 14px 12px;
  }
  .orchestrator-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }
  .header-title {
    font-size: 19px;
  }
  .header-subtitle {
    line-height: 1.5;
  }
  .overview-strip {
    gap: 1px;
  }
  .filter-toolbar {
    align-items: stretch;
  }
  .search-input {
    flex-basis: 100%;
  }
  .filter-toolbar .form-select {
    width: auto;
    flex: 1;
  }
  .node-row {
    gap: 12px;
  }
  .node-identity {
    flex-basis: 100%;
  }
  .node-metric {
    flex: 1;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
}

.header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.console-mark {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border: 1px solid #355a84;
  border-radius: 9px;
  background: linear-gradient(145deg, #254c79, #172f4d);
  color: #8dc5ff;
  box-shadow: inset 0 1px #ffffff12;
}
.console-mark svg {
  width: 25px;
  height: 25px;
}
.overview-strip > .overview-running {
  border-top-color: #2bbd9e;
}
.overview-running strong {
  color: #5ce0bd;
}
.overview-strip > .overview-stopped {
  border-top-color: #7086a5;
}
.overview-strip > .overview-templates {
  border-top-color: #9b86ef;
}
.overview-templates strong {
  color: #c4b5fd;
}
.node-panel {
  border-color: #2d4059;
  background: #142035;
}
.node-panel > summary {
  background: linear-gradient(90deg, #1a2b43, #142035);
  color: #c7d9f0;
}
.node-row {
  border-left: 2px solid #3d84c9;
}
.node-row.node-offline {
  border-left-color: #b88647;
}
.node-icon {
  width: 21px;
  height: 21px;
  flex-shrink: 0;
  color: #7caee7;
}
.node-metric.metric-memory meter {
  accent-color: #2bbd9e;
}
.node-metric.metric-memory meter::-webkit-meter-optimum-value {
  background: #2bbd9e;
}
.node-metric.metric-disk meter {
  accent-color: #9b86ef;
}
.node-metric.metric-disk meter::-webkit-meter-optimum-value {
  background: #9b86ef;
}
.instances-panel {
  border-color: #2d405b;
  box-shadow: 0 4px 20px #00000012;
}
.list-heading h2 {
  display: flex;
  align-items: center;
  gap: 9px;
}
.list-heading h2::before {
  content: '';
  width: 3px;
  height: 14px;
  border-radius: 1px;
  background: #60a5fa;
}
.btn-primary {
  box-shadow:
    0 2px 8px #2563eb30,
    inset 0 1px #ffffff20;
}
@media (max-width: 760px) {
  .overview-strip > span {
    flex-basis: calc(50% - 1px);
    padding: 10px 14px;
    min-width: 0;
    box-sizing: border-box;
  }
  .refresh-status {
    margin-left: 0;
    flex-basis: 100%;
  }
}
.deployment-state {
  display: block;
  font-size: 12px;
}
.deployment-state.ready {
  color: #63dcbc;
}
.deployment-state.error,
.deployment-error {
  color: #fda4af;
}
.deployment-state.deploying {
  color: #93c5fd;
}
.deployment-error {
  max-width: 220px;
  white-space: normal;
  overflow-wrap: anywhere;
  font-size: 11px;
  margin-top: 5px;
}
</style>
