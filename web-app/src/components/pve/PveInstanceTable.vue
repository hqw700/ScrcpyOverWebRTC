<template>
  <div
    class="table-scroll"
    tabindex="0"
    :aria-label="t('orchestrator.instancesLabel')"
  >
    <table class="instance-table" :aria-busy="loading">
      <thead>
        <tr>
          <th>{{ t('orchestrator.colInstance') }}</th>
          <th>{{ t('orchestrator.colStatus') }}</th>
          <th>{{ t('orchestrator.colPlacement') }}</th>
          <th>{{ t('orchestrator.cardSpec') }}</th>
          <th>{{ t('orchestrator.colNetwork') }}</th>
          <th>{{ t('orchestrator.cardDisplay') }}</th>
          <th>{{ t('orchestrator.colResources') }}</th>
          <th class="actions-heading">{{ t('orchestrator.colActions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="inst in instances"
          :key="`${inst.cluster_id || ''}:${inst.id || inst.vmid}`"
        >
          <td>
            <strong class="truncate name" :title="inst.name">{{
              inst.name
            }}</strong
            ><span class="secondary mono">{{
              inst.agent_id || inst.id || `CT ${inst.vmid}`
            }}</span>
          </td>
          <td>
            <span class="status" :class="inst.status"
              ><i></i>{{ statusText(inst.status) }}</span
            >
            <span
              v-if="!isStale(inst) && inst.agent_status"
              class="secondary agent-state"
              :class="inst.agent_status"
              >{{
                t(
                  inst.agent_status === 'registered'
                    ? 'orchestrator.agentRegistered'
                    : 'orchestrator.agentUnconfirmed',
                )
              }}</span
            >
            <span
              v-if="
                !isStale(inst) && (!inst.ownership_id || inst.claim_pending)
              "
              class="secondary instance-error"
              >{{ t('orchestrator.placement.ownershipUnverified') }}</span
            >
            <span v-if="inst.reset_phase" class="secondary instance-error">{{
              t('orchestrator.placement.resetRecovery')
            }}</span>
            <span v-if="isStale(inst)" class="secondary">{{
              t(
                inst.status === 'foreign'
                  ? 'orchestrator.inventory.foreignHint'
                  : 'orchestrator.inventory.missingHint',
              )
            }}</span>
            <span v-else class="secondary" :title="inst.snapshot_error">{{
              t(
                inst.snapshot_status === 'ready'
                  ? 'orchestrator.placement.baselineReady'
                  : 'orchestrator.placement.baselineUnavailable',
              )
            }}</span>
            <span
              v-if="inst.sync_error"
              class="secondary instance-error"
              :title="inst.sync_error"
              >{{ t('orchestrator.inventory.unavailable') }}</span
            >
            <span
              v-if="inst.last_error"
              class="secondary instance-error truncate"
              :title="inst.last_error"
              >{{ inst.last_error }}</span
            >
          </td>
          <td>
            <span class="truncate" :title="clusterName(inst)">{{
              clusterName(inst)
            }}</span
            ><span
              class="secondary truncate"
              :title="`${inst.node || '—'} · ${inst.template_name || inst.template_id || '—'}`"
              >{{ inst.node || '—' }} ·
              {{ inst.template_name || inst.template_id || '—' }}</span
            >
          </td>
          <td>
            <span
              >{{ inst.spec?.cores || '—' }} vCPU ·
              {{ ((inst.spec?.memory_mb || 0) / 1024).toLocaleString() }}
              GiB</span
            ><span class="secondary"
              >{{ inst.spec?.disk_gb || '—' }} GiB ·
              {{ t('orchestrator.metricDisk') }}</span
            >
          </td>
          <td>
            <button
              class="ip-button mono"
              :disabled="!inst.ip"
              @click="$emit('copy', inst.ip)"
              :title="inst.network_error || t('orchestrator.cardIp')"
            >
              {{ inst.ip || networkPlaceholder(inst) }}
              <span v-if="inst.ip" aria-hidden="true">⧉</span></button
            ><span
              class="secondary truncate"
              :title="inst.outlet_name || inst.outlet_id"
              >{{ inst.outlet_name || inst.outlet_id || '—' }} ·
              {{
                t(
                  inst.network_mode === 'dhcp'
                    ? 'orchestrator.network.dhcpBadge'
                    : 'orchestrator.network.staticBadge',
                )
              }}</span
            >
          </td>
          <td>
            <span class="mono"
              >{{ inst.display?.width || '—' }} ×
              {{ inst.display?.height || '—' }}</span
            ><span class="secondary"
              >{{ inst.display?.fps || '—' }} FPS ·
              {{ inst.display?.gpu_mode === 'host' ? 'GPU' : 'CPU' }}</span
            >
          </td>
          <td class="resource-cell">
            <div v-if="inst.status === 'running'" class="resource-grid">
              <span>CPU</span
              ><meter
                class="metric-cpu"
                min="0"
                max="1"
                :value="inst.cpu_usage || 0"
                :aria-label="`CPU ${Math.round((inst.cpu_usage || 0) * 100)}%`"
              ></meter
              ><b>{{ Math.round((inst.cpu_usage || 0) * 100) }}%</b>
              <span>{{ t('orchestrator.metricMem') }}</span
              ><meter
                class="metric-memory"
                min="0"
                :max="inst.spec?.memory_mb || 1"
                :value="inst.mem_used_mb || 0"
                :aria-label="t('orchestrator.metricMem')"
                :title="`${inst.mem_used_mb || 0} / ${inst.spec?.memory_mb || 0} MB`"
              ></meter
              ><b>{{ percent(inst.mem_used_mb, inst.spec?.memory_mb) }}%</b>
              <span>{{ t('orchestrator.metricDisk') }}</span
              ><meter
                class="metric-disk"
                min="0"
                :max="inst.spec?.disk_gb || 1"
                :value="inst.disk_used_gb || 0"
                :aria-label="t('orchestrator.metricDisk')"
                :title="`${(inst.disk_used_gb || 0).toFixed(1)} / ${inst.spec?.disk_gb || 0} GB`"
              ></meter
              ><b>{{ percent(inst.disk_used_gb, inst.spec?.disk_gb) }}%</b>
            </div>
            <span
              v-else
              class="secondary"
              :title="t('orchestrator.unavailableMetric')"
              >—</span
            >
          </td>
          <td>
            <div class="row-actions" :aria-busy="!!pending[inst.vmid]">
              <button
                v-if="isStale(inst)"
                :disabled="
                  pending[inst.vmid] ||
                  !!inst.pending_task ||
                  !!inst.reset_phase
                "
                @click="$emit('forget', inst)"
              >
                {{ t('orchestrator.inventory.cleanupRecord') }}
              </button>
              <template v-else>
                <button
                  :disabled="
                    inst.status !== 'running' ||
                    pending[inst.vmid] ||
                    !inst.ownership_id ||
                    inst.claim_pending ||
                    !!inst.reset_phase
                  "
                  @click="$emit('terminal', inst)"
                >
                  {{ t('orchestrator.btnTerminal') }}
                </button>
                <button
                  v-if="inst.status === 'stopped'"
                  :disabled="
                    pending[inst.vmid] ||
                    !inst.ownership_id ||
                    inst.claim_pending ||
                    !!inst.reset_phase
                  "
                  @click="$emit('power', inst, 'start')"
                >
                  {{ t('orchestrator.btnPowerStart') }}
                </button>
                <button
                  v-else
                  :disabled="
                    inst.status !== 'running' ||
                    pending[inst.vmid] ||
                    !inst.ownership_id ||
                    inst.claim_pending ||
                    !!inst.reset_phase
                  "
                  @click="$emit('power', inst, 'stop')"
                >
                  {{ t('orchestrator.btnPowerStop') }}
                </button>
                <select
                  :aria-label="`${t('orchestrator.moreActions')} · ${inst.name}`"
                  :disabled="pending[inst.vmid]"
                  @change="moreAction($event, inst)"
                >
                  <option value="">{{ t('orchestrator.moreActions') }}</option>
                  <option
                    v-if="inst.pending_task && !inst.pending_task.upid"
                    value="resolve-task"
                  >
                    {{ t('orchestrator.placement.resolveTask') }}
                  </option>
                  <option
                    v-if="!inst.ownership_id || inst.claim_pending"
                    value="claim"
                  >
                    {{ t('orchestrator.placement.claim') }}
                  </option>
                  <option
                    value="baseline"
                    :disabled="
                      !inst.ownership_id ||
                      inst.status !== 'stopped' ||
                      !!inst.reset_phase
                    "
                  >
                    {{ t('orchestrator.placement.baseline') }}
                  </option>
                  <option v-if="inst.status === 'error'" value="forget">
                    {{ t('orchestrator.placement.forget') }}
                  </option>
                  <option
                    value="edit"
                    :disabled="
                      !inst.ownership_id ||
                      inst.claim_pending ||
                      !!inst.reset_phase
                    "
                  >
                    {{ t('orchestrator.editInstanceConfig') }}
                  </option>
                  <option
                    value="restart"
                    :disabled="
                      inst.status !== 'running' ||
                      !inst.ownership_id ||
                      inst.claim_pending ||
                      !!inst.reset_phase
                    "
                  >
                    {{ t('orchestrator.btnPowerRestart') }}
                  </option>
                  <option value="adb" :disabled="!inst.ip">
                    {{ t('orchestrator.cardAdb') }}
                  </option>
                  <option
                    value="reset"
                    :disabled="
                      !inst.ownership_id ||
                      inst.claim_pending ||
                      inst.snapshot_status !== 'ready'
                    "
                  >
                    {{ t('orchestrator.btnReset') }}
                  </option>
                  <option value="convert">
                    {{ t('orchestrator.btnConvertToTemplate') }}
                  </option>
                  <option
                    value="destroy"
                    :disabled="!inst.ownership_id || inst.claim_pending"
                  >
                    {{ t('orchestrator.btnDestroy') }}
                  </option>
                </select>
              </template>
            </div>
          </td>
        </tr>
        <tr v-if="!instances.length">
          <td colspan="8" class="empty-cell">
            {{ loading ? t('orchestrator.btnRefresh') + '…' : emptyText }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const props = defineProps({
  instances: { type: Array, default: () => [] },
  clusters: { type: Array, default: () => [] },
  pending: { type: Object, default: () => ({}) },
  loading: Boolean,
  emptyText: String,
})
const emit = defineEmits([
  'power',
  'terminal',
  'reset',
  'convert',
  'destroy',
  'copy',
  'edit',
  'claim',
  'baseline',
  'forget',
  'resolve-task',
])
const percent = (used, total) =>
  total ? Math.round(((used || 0) / total) * 100) : 0
function clusterName(inst) {
  return (
    props.clusters.find((c) => c.id === inst.cluster_id)?.name ||
    inst.cluster_id ||
    t('orchestrator.defaultClusterName')
  )
}
const isStale = (inst) => ['missing', 'foreign'].includes(inst.status)
function statusText(status) {
  return t(
    {
      running: 'orchestrator.cardStatusRunning',
      stopped: 'orchestrator.cardStatusStopped',
      resetting: 'orchestrator.statusResetting',
      creating: 'orchestrator.statusCreating',
      error: 'orchestrator.statusError',
      missing: 'orchestrator.inventory.statusMissing',
      foreign: 'orchestrator.inventory.statusForeign',
    }[status] || 'orchestrator.cardStatusUnknown',
  )
}
function networkPlaceholder(inst) {
  if (inst.network_mode !== 'dhcp') return '—'
  const code =
    inst.status === 'stopped' ? 'stopped' : inst.network_status || 'obtaining'
  return t(
    'orchestrator.network.' +
      ({
        stopped: 'stopped',
        check_failed: 'checkFailed',
        unavailable: 'unavailable',
        obtaining: 'obtaining',
      }[code] || 'unavailable'),
  )
}
function moreAction(event, inst) {
  const action = event.target.value
  event.target.value = ''
  if (action === 'restart') emit('power', inst, 'restart')
  else if (action === 'adb') emit('copy', `${inst.ip}:5555`)
  else if (
    [
      'reset',
      'convert',
      'destroy',
      'edit',
      'claim',
      'baseline',
      'forget',
      'resolve-task',
    ].includes(action)
  )
    emit(action, inst)
}
</script>

<style scoped>
.table-scroll {
  overflow: auto;
  max-width: 100%;
  border-radius: 0 0 5px 5px;
}
.instance-table {
  width: 100%;
  min-width: 1160px;
  border-collapse: collapse;
  table-layout: fixed;
  text-align: left;
  font-size: 12px;
  color: #cbd5e1;
}
.instance-table th {
  background: #192538;
  color: #94a3b8;
  font-weight: 500;
  padding: 11px 14px;
  white-space: nowrap;
  border-block: 1px solid #293648;
}
.instance-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #253144;
  vertical-align: middle;
  line-height: 1.5;
}
.instance-table tbody tr:last-child td {
  border-bottom: 0;
}
.instance-table tbody tr:hover {
  background: #172337;
}
.instance-table th:nth-child(1) {
  width: 14%;
}
.instance-table th:nth-child(2) {
  width: 9%;
}
.instance-table th:nth-child(3) {
  width: 14%;
}
.instance-table th:nth-child(4) {
  width: 12%;
}
.instance-table th:nth-child(5) {
  width: 13%;
}
.instance-table th:nth-child(6) {
  width: 11%;
}
.instance-table th:nth-child(7) {
  width: 13%;
}
.instance-table th:nth-child(8) {
  width: 210px;
}
.truncate {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.name {
  color: #e2e8f0;
  font-weight: 600;
}
.secondary {
  display: block;
  font-size: 11px;
  color: #8d9db4;
  margin-top: 3px;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-variant-numeric: tabular-nums;
}
.status {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: #fbbf24;
  white-space: nowrap;
}
.status i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}
.status.running {
  color: #4ade80;
}
.status.stopped {
  color: #94a3b8;
}
.ip-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: none;
  color: #cbd5e1;
  font-size: 12px;
  cursor: pointer;
}
.ip-button span {
  color: #64748b;
}
.ip-button:hover {
  color: #60a5fa;
}
.resource-grid {
  display: grid;
  grid-template-columns: auto minmax(25px, 1fr) 34px;
  gap: 3px 7px;
  align-items: center;
  font-size: 10px;
  color: #94a3b8;
  line-height: 1.2;
}
.resource-grid b {
  text-align: right;
  font-weight: 400;
  color: #cbd5e1;
  font-variant-numeric: tabular-nums;
}
meter {
  width: 100%;
  height: 4px;
  accent-color: #3b82f6;
}
meter::-webkit-meter-bar {
  background: #2a374a;
  border: 0;
}
meter::-webkit-meter-optimum-value {
  background: #568ee8;
}
.row-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
}
.row-actions button {
  background: none;
  border: 0;
  padding: 4px 0;
  color: #60a5fa;
  font: inherit;
  cursor: pointer;
}
.row-actions select {
  background: #142033;
  border: 1px solid #334155;
  border-radius: 3px;
  padding: 4px;
  color: #aabbd1;
  font: inherit;
  min-width: 0;
  max-width: 135px;
  cursor: pointer;
}
.row-actions button:disabled,
.row-actions select:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.empty-cell {
  text-align: center;
  height: 180px;
  color: #94a3b8;
}
button:focus-visible,
select:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 3px;
}

.instance-table thead th {
  background: #1c2d45;
  color: #adc1dc;
}
.instance-table tbody tr:nth-child(even) {
  background: #152237;
}
.instance-table tbody tr:hover {
  background: #1b304b;
}
.name {
  color: #bad9ff;
}
.status {
  padding: 2px 7px;
  border: 1px solid #a7793233;
  border-radius: 4px;
  background: #a7793210;
}
.status.running {
  border-color: #2bbd9e30;
  background: #2bbd9e12;
  color: #63dcbc;
}
.status.stopped {
  border-color: #8195b52b;
  background: #8195b510;
}
.status.error {
  color: #fda4af;
  border-color: #fb718530;
  background: #fb718512;
}
meter.metric-memory {
  accent-color: #2bbd9e;
}
meter.metric-memory::-webkit-meter-optimum-value {
  background: #2bbd9e;
}
meter.metric-disk {
  accent-color: #9b86ef;
}
meter.metric-disk::-webkit-meter-optimum-value {
  background: #9b86ef;
}
.agent-state {
  max-width: 100%;
  overflow-wrap: anywhere;
  white-space: normal;
  font-size: 10px;
}
.agent-state.registered {
  color: #63dcbc;
}
.instance-error {
  color: #fda4af;
}
</style>
