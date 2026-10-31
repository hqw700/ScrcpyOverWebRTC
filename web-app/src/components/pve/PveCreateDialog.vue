<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="create-dialog"
      aria-labelledby="pve-create-title"
      @cancel="cancelDialog"
      @close="$emit('close')"
    >
      <form @submit.prevent="$emit('submit')">
        <header class="dialog-header">
          <div>
            <h2 id="pve-create-title">
              {{
                t(
                  editing
                    ? 'orchestrator.editInstanceConfig'
                    : 'orchestrator.createModalTitle',
                )
              }}
            </h2>
            <p>
              {{
                t(
                  editing
                    ? 'orchestrator.editConfigHint'
                    : 'orchestrator.createDescription',
                )
              }}
            </p>
          </div>
          <button
            type="button"
            class="close-button"
            :disabled="creating"
            :aria-label="t('orchestrator.btnClose')"
            @click="$emit('close')"
          >
            ×
          </button>
        </header>
        <div class="create-layout">
          <div class="configuration">
            <fieldset :disabled="creating">
              <section class="config-section">
                <h3><span>01</span>{{ t('orchestrator.createBasics') }}</h3>
                <div class="config-row">
                  <label for="pve-cluster">{{
                    t('orchestrator.cardCluster')
                  }}</label>
                  <div class="field-content">
                    <select
                      id="pve-cluster"
                      :disabled="editing"
                      v-model="form.cluster_id"
                    >
                      <option v-if="!clusters.length" value="">
                        {{ t('orchestrator.defaultClusterName') }}
                      </option>
                      <option
                        v-for="cl in clusters"
                        :key="cl.id"
                        :value="cl.id"
                      >
                        {{ cl.name || cl.id }} · {{ cl.node }}
                      </option>
                    </select>
                  </div>
                </div>
                <div
                  v-if="!editing || environment"
                  class="environment-check"
                  :class="{ ready: environment?.ready }"
                  role="status"
                  :aria-busy="checkingEnvironment || preparingEnvironment"
                >
                  <p>
                    {{
                      checkingEnvironment
                        ? t('orchestrator.environment.checking')
                        : environmentMessage
                    }}
                  </p>
                  <small
                    v-if="environment?.ready && environment.runtime_version"
                    >v{{ environment.runtime_version }}</small
                  >
                  <div
                    v-if="!environment?.ready && !checkingEnvironment"
                    class="environment-actions"
                  >
                    <button
                      v-if="repairableEnvironment"
                      type="button"
                      :disabled="preparingEnvironment || creating"
                      @click="$emit('repair-environment')"
                    >
                      {{
                        t(
                          preparingEnvironment
                            ? 'orchestrator.environment.repairing'
                            : 'orchestrator.environment.repair',
                        )
                      }}
                    </button>
                    <button
                      type="button"
                      :disabled="preparingEnvironment || creating"
                      @click="$emit('check-environment')"
                    >
                      {{ t('orchestrator.environment.recheck') }}
                    </button>
                  </div>
                  <details
                    v-if="
                      environment &&
                      !environment.ready &&
                      (environment.details || environment.missing?.length)
                    "
                  >
                    <summary>
                      {{ t('orchestrator.environment.details') }}
                    </summary>
                    <pre v-if="environment.missing?.length"
                      >{{ t('orchestrator.environment.missing') }}:
{{ environment.missing.join('\n') }}</pre>
                    <pre v-if="environment.details">{{
                      environment.details
                    }}</pre>
                  </details>
                </div>
                <div
                  v-if="placementMissing"
                  class="environment-check placement-warning"
                  role="status"
                >
                  <p>{{ t('orchestrator.placement.placementMissing') }}</p>
                  <div class="environment-actions">
                    <button
                      type="button"
                      :disabled="creating"
                      @click="$emit('configure-placement')"
                    >
                      {{ t('orchestrator.placement.configureForCluster') }}
                    </button>
                  </div>
                </div>
                <div class="config-row">
                  <label for="pve-image">{{
                    t('orchestrator.labelTemplate')
                  }}</label>
                  <div class="field-content">
                    <select
                      id="pve-image"
                      v-model="form.template_id"
                      :disabled="loadingTemplates || editing"
                      required
                    >
                      <option v-if="!templates.length" value="">
                        {{
                          loadingTemplates
                            ? t('orchestrator.loadingTemplates')
                            : t('orchestrator.noTemplates')
                        }}
                      </option>
                      <option
                        v-for="tpl in templates"
                        :key="tpl.id"
                        :value="tpl.id"
                      >
                        {{ tpl.name }}
                      </option></select
                    ><span class="hint" v-if="selectedTemplate"
                      >{{ selectedTemplate.base_disk_gb }} GiB ·
                      {{
                        selectedTemplate.volid || `CT ${selectedTemplate.vmid}`
                      }}</span
                    >
                  </div>
                </div>
                <div class="config-row">
                  <label for="pve-storage">{{
                    t('orchestrator.placement.storage')
                  }}</label>
                  <div class="field-content">
                    <select
                      id="pve-storage"
                      v-model="form.storage"
                      :disabled="editing || loadingPlacement"
                      required
                    >
                      <option value="">
                        {{
                          t(
                            loadingPlacement
                              ? 'orchestrator.placement.loadingResources'
                              : storages.length
                                ? 'orchestrator.placement.selectStorage'
                                : 'orchestrator.placement.noStorage',
                          )
                        }}
                      </option>
                      <option
                        v-for="storage in storages"
                        :key="storage.storage"
                        :value="storage.storage"
                      >
                        {{ storage.storage
                        }}<template v-if="storage.type">
                          · {{ storage.type }}</template
                        >
                      </option>
                    </select>
                  </div>
                </div>
                <div class="config-row">
                  <label for="pve-name">{{
                    t('orchestrator.labelInstanceName')
                  }}</label>
                  <div class="field-content">
                    <input
                      id="pve-name"
                      v-model="form.name"
                      :placeholder="t('orchestrator.placeholderInstanceName')"
                      maxlength="128"
                    />
                  </div>
                </div>
              </section>
              <section class="config-section">
                <h3><span>02</span>{{ t('orchestrator.createCompute') }}</h3>
                <div class="config-row">
                  <label for="pve-spec">{{
                    t('orchestrator.presetSpec')
                  }}</label>
                  <div class="field-content">
                    <select
                      id="pve-spec"
                      :value="specPreset"
                      @change="$emit('spec', $event.target.value)"
                    >
                      <option
                        v-for="preset in specOptions"
                        :key="preset[0]"
                        :value="preset[0]"
                      >
                        {{ t('orchestrator.' + preset[1]) }}
                      </option>
                    </select>
                  </div>
                </div>
                <div class="config-row" v-if="specPreset === 'custom'">
                  <span class="row-label">{{
                    t('orchestrator.cardSpec')
                  }}</span>
                  <div class="inline-fields">
                    <label
                      >{{ t('orchestrator.labelCores')
                      }}<input
                        type="number"
                        v-model.number="form.spec.cores"
                        min="1"
                        max="16"
                        required /></label
                    ><label
                      >{{ t('orchestrator.labelMemory')
                      }}<input
                        type="number"
                        v-model.number="form.spec.memory_mb"
                        min="1024"
                        max="32768"
                        step="1024"
                        required /></label
                    ><label
                      >{{ t('orchestrator.labelDisk')
                      }}<input
                        type="number"
                        v-model.number="form.spec.disk_gb"
                        :min="selectedTemplate?.base_disk_gb || 16"
                        max="128"
                        required
                    /></label>
                  </div>
                </div>
                <div class="config-row">
                  <label for="pve-resolution">{{
                    t('orchestrator.presetResolution')
                  }}</label>
                  <div class="field-content">
                    <select
                      id="pve-resolution"
                      :value="displayPreset"
                      @change="$emit('display', $event.target.value)"
                    >
                      <option
                        v-for="preset in displayOptions"
                        :key="preset[0]"
                        :value="preset[0]"
                      >
                        {{ t('orchestrator.' + preset[1]) }}
                      </option>
                    </select>
                  </div>
                </div>
                <div class="config-row" v-if="displayPreset === 'custom'">
                  <span class="row-label">{{
                    t('orchestrator.cardDisplay')
                  }}</span>
                  <div class="inline-fields four-fields">
                    <label v-for="field in displayFields" :key="field[0]"
                      >{{ t('orchestrator.' + field[1])
                      }}<input
                        type="number"
                        v-model.number="form.display[field[0]]"
                        min="1"
                        required
                    /></label>
                  </div>
                </div>
              </section>
              <section class="config-section">
                <h3><span>03</span>{{ t('orchestrator.createNetwork') }}</h3>
                <div class="config-row">
                  <label for="pve-outlet">{{
                    t('orchestrator.labelNetworkOutlet')
                  }}</label>
                  <div class="field-content">
                    <select
                      id="pve-outlet"
                      :disabled="editing || loadingPlacement"
                      v-model="form.outlet_id"
                      required
                    >
                      <option v-if="!outlets.length" value="">
                        {{
                          t(
                            loadingPlacement
                              ? 'orchestrator.placement.loadingResources'
                              : 'orchestrator.placement.noOutlet',
                          )
                        }}
                      </option>
                      <option
                        v-for="outlet in outlets"
                        :key="outlet.id"
                        :value="outlet.id"
                      >
                        {{ outlet.name }} · {{ outlet.bridge }}
                      </option></select
                    ><span
                      class="hint"
                      v-if="selectedOutlet && form.network_mode !== 'dhcp'"
                      >{{ selectedOutlet.subnet }} ·
                      {{ selectedOutlet.gateway }}</span
                    >
                  </div>
                </div>
                <div class="config-row">
                  <label for="pve-network-mode">{{
                    t('orchestrator.network.addressMode')
                  }}</label>
                  <div class="field-content">
                    <select
                      id="pve-network-mode"
                      v-model="form.network_mode"
                      :disabled="editing"
                      required
                    >
                      <option value="dhcp">
                        {{ t('orchestrator.network.dhcp') }}
                      </option>
                      <option value="static">
                        {{ t('orchestrator.network.static') }}
                      </option>
                    </select>
                    <span class="hint">{{
                      t(
                        form.network_mode === 'dhcp'
                          ? 'orchestrator.network.dhcpHint'
                          : 'orchestrator.network.staticHint',
                      )
                    }}</span>
                    <span
                      v-if="staticNetworkProblem"
                      class="hint network-warning"
                      >{{ staticNetworkProblem }}</span
                    >
                  </div>
                </div>
                <div class="config-row" v-if="form.network_mode !== 'dhcp'">
                  <label for="pve-ip">{{
                    t('orchestrator.labelCustomIp')
                  }}</label>
                  <div class="field-content">
                    <input
                      id="pve-ip"
                      :disabled="editing"
                      v-model="form.custom_ip"
                      :placeholder="t('orchestrator.placeholderCustomIp')"
                      class="mono"
                    />
                  </div>
                </div>
                <p class="hint connection-hint">
                  {{ t('orchestrator.signalingHint') }}
                </p>
              </section>
              <details class="advanced-section">
                <summary>
                  {{ t('orchestrator.advancedSettings')
                  }}<span>{{ t('orchestrator.advancedHint') }}</span>
                </summary>
                <div class="advanced-fields">
                  <div class="config-row">
                    <label for="pve-signaling">{{
                      t('orchestrator.labelSignaling')
                    }}</label>
                    <div class="field-content">
                      <input
                        id="pve-signaling"
                        v-model="form.signalingServer"
                        :placeholder="t('orchestrator.placeholderSignaling')"
                        class="mono"
                      />
                    </div>
                  </div>
                  <div class="config-row">
                    <label for="pve-turn">{{
                      t('orchestrator.labelTurn')
                    }}</label>
                    <div class="field-content">
                      <input
                        id="pve-turn"
                        v-model="form.turnServer"
                        :placeholder="t('orchestrator.placeholderTurn')"
                        class="mono"
                      />
                    </div>
                  </div>
                  <div class="config-row">
                    <label for="pve-gpu">{{
                      t('orchestrator.labelGpuMode')
                    }}</label>
                    <div class="field-content">
                      <select id="pve-gpu" v-model="form.display.gpu_mode">
                        <option value="host">
                          {{ t('orchestrator.gpuHost') }}
                        </option>
                        <option value="guest">
                          {{ t('orchestrator.gpuGuest') }}
                        </option>
                      </select>
                    </div>
                  </div>
                  <div class="config-row">
                    <label for="pve-boot">{{
                      t('orchestrator.labelExtraBoot')
                    }}</label>
                    <div class="field-content">
                      <input
                        id="pve-boot"
                        v-model="form.display.extra_boot_args"
                        :placeholder="t('orchestrator.placeholderExtraBoot')"
                        class="mono"
                      />
                    </div>
                  </div>
                  <div class="config-row">
                    <span class="row-label">{{
                      t('orchestrator.labelIsolation')
                    }}</span
                    ><label class="checkbox-label"
                      ><input
                        type="checkbox"
                        v-model="form.unprivileged"
                        :disabled="editing"
                      />{{ t('orchestrator.isolationHint') }}</label
                    >
                  </div>
                </div>
              </details>
            </fieldset>
          </div>
          <aside class="summary-panel" aria-live="polite">
            <h3>{{ t('orchestrator.configurationSummary') }}</h3>
            <div class="summary-highlight">
              <strong
                >{{ form.spec.cores }} <small>vCPU</small> /
                {{ (form.spec.memory_mb / 1024).toLocaleString() }}
                <small>GiB</small></strong
              ><span
                >{{ form.spec.disk_gb }} GiB ·
                {{ t('orchestrator.metricDisk') }}</span
              >
            </div>
            <dl>
              <template v-for="item in summaryItems" :key="item[0]"
                ><dt>{{ t('orchestrator.' + item[0]) }}</dt>
                <dd>{{ item[1] }}</dd></template
              >
            </dl>
            <p class="summary-hint">{{ t('orchestrator.summaryHint') }}</p>
          </aside>
        </div>
        <footer class="dialog-footer">
          <span class="progress" role="status">{{
            creating ? t('orchestrator.creatingProgress') : ''
          }}</span
          ><button
            type="button"
            class="button secondary"
            :disabled="creating"
            @click="$emit('close')"
          >
            {{ t('orchestrator.btnCancel') }}</button
          ><button
            class="button primary"
            type="submit"
            :disabled="
              creating ||
              environmentBlocked ||
              !!staticNetworkProblem ||
              (!editing &&
                (loadingTemplates ||
                  loadingPlacement ||
                  !form.storage ||
                  !selectedTemplate ||
                  !selectedOutlet))
            "
          >
            {{
              creating
                ? t('orchestrator.termConnecting')
                : t(
                    editing
                      ? 'orchestrator.saveInstanceConfig'
                      : 'orchestrator.btnConfirmCreate',
                  )
            }}
          </button>
        </footer>
      </form>
    </dialog>
  </Teleport>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const form = defineModel({ type: Object, required: true })
const props = defineProps({
  clusters: { type: Array, default: () => [] },
  templates: { type: Array, default: () => [] },
  storages: { type: Array, default: () => [] },
  outlets: { type: Array, default: () => [] },
  creating: Boolean,
  editing: Boolean,
  environment: { type: Object, default: null },
  checkingEnvironment: Boolean,
  preparingEnvironment: Boolean,
  loadingTemplates: Boolean,
  loadingPlacement: Boolean,
  specPreset: String,
  displayPreset: String,
})
const emit = defineEmits([
  'close',
  'submit',
  'spec',
  'display',
  'repair-environment',
  'check-environment',
  'configure-placement',
])
const placementMissing = computed(
  () =>
    !props.editing &&
    !props.loadingPlacement &&
    (!props.storages.length || !props.outlets.length),
)
const environmentBlocked = computed(
  () =>
    props.checkingEnvironment ||
    props.preparingEnvironment ||
    ((!props.editing || props.environment) && !props.environment?.ready),
)
const environmentMessage = computed(() => {
  if (props.environment?.ready)
    return t(
      form.value.network_mode === 'dhcp'
        ? 'orchestrator.network.dhcpReady'
        : 'orchestrator.environment.ready',
    )
  const code = props.environment?.code
  const networkCodes = {
    runtime_upgrade_required: 'runtimeUpgradeRequired',
    select_template: 'selectTemplate',
    template_unavailable: 'templateUnavailable',
    dhcp_archive_required: 'archiveRequired',
    image_check_failed: 'imageCheckFailed',
    static_config_required: 'staticConfigRequired',
    static_pool_required: 'staticPoolRequired',
  }
  if (networkCodes[code]) return t('orchestrator.network.' + networkCodes[code])
  return t(
    'orchestrator.environment.' +
      ([
        'needs_deployment',
        'host_not_ready',
        'unreachable',
        'runtime_incompatible',
        'deployment_failed',
        'check_failed',
      ].includes(code)
        ? code
        : 'unknown'),
  )
})
const repairableEnvironment = computed(() =>
  [
    'needs_deployment',
    'host_not_ready',
    'runtime_upgrade_required',
    'deployment_failed',
  ].includes(props.environment?.code),
)
const staticNetworkProblem = computed(() => {
  if (
    props.editing ||
    form.value.network_mode === 'dhcp' ||
    !selectedOutlet.value
  )
    return ''
  const out = selectedOutlet.value
  if (!out.subnet || !out.gateway || !out.ip_start || !out.ip_end)
    return t('orchestrator.network.staticConfigRequired')
  if (!form.value.custom_ip && !out.dedicated_pool)
    return t('orchestrator.network.staticPoolRequired')
  return ''
})
const specOptions = [
  ['entry', 'presetEntry'],
  ['standard', 'presetStandard'],
  ['premium', 'presetPremium'],
  ['custom', 'presetCustom'],
]
const displayOptions = [
  ['portrait720', 'resPortrait720'],
  ['portrait1080', 'resPortrait1080'],
  ['landscape720', 'resLandscape720'],
  ['landscape1080', 'resLandscape1080'],
  ['custom', 'resCustom'],
]
const displayFields = [
  ['width', 'labelWidth'],
  ['height', 'labelHeight'],
  ['fps', 'labelFps'],
  ['dpi', 'labelDpi'],
]
const dialog = ref(null)
const selectedCluster = computed(() =>
  props.clusters.find((cl) => cl.id === form.value.cluster_id),
)
const selectedTemplate = computed(() =>
  props.templates.find((tpl) => tpl.id === form.value.template_id),
)
const selectedOutlet = computed(() =>
  props.outlets.find((outlet) => outlet.id === form.value.outlet_id),
)
const summaryItems = computed(() => [
  ['labelInstanceName', form.value.name || t('orchestrator.automaticName')],
  [
    'cardCluster',
    selectedCluster.value?.name ||
      selectedCluster.value?.id ||
      t('orchestrator.defaultClusterName'),
  ],
  ['labelTemplate', selectedTemplate.value?.name || '—'],
  ['placement.storage', form.value.storage || '—'],
  [
    'cardDisplay',
    `${form.value.display.width} × ${form.value.display.height} · ${form.value.display.fps} FPS`,
  ],
  [
    'labelGpuMode',
    t(
      form.value.display.gpu_mode === 'host'
        ? 'orchestrator.gpuHost'
        : 'orchestrator.gpuGuest',
    ),
  ],
  [
    'cardIp',
    form.value.network_mode === 'dhcp'
      ? t('orchestrator.network.dhcp')
      : form.value.custom_ip || t('orchestrator.automaticIp'),
  ],
  ['cardOutlet', selectedOutlet.value?.name || '—'],
  ['labelSignaling', form.value.signalingServer || '—'],
  [
    'labelIsolation',
    t(
      form.value.unprivileged
        ? 'orchestrator.enabled'
        : 'orchestrator.disabled',
    ),
  ],
])
watch(
  () => selectedTemplate.value?.base_disk_gb,
  (minimumDisk) => {
    if (minimumDisk && form.value.spec.disk_gb < minimumDisk) {
      form.value.spec.disk_gb = minimumDisk
      emit('spec', 'custom')
    }
  },
  { immediate: true },
)
onMounted(() => dialog.value.showModal())
onBeforeUnmount(() => {
  if (dialog.value?.open) dialog.value.close()
})
function cancelDialog(event) {
  event.preventDefault()
  if (!props.creating) emit('close')
}
</script>
<style scoped>
.create-dialog {
  padding: 0;
  position: fixed;
  inset: 0 0 0 auto;
  margin: 0;
  box-sizing: border-box;
  width: min(1080px, 100vw);
  height: 100dvh;
  max-width: 100vw;
  max-height: 100dvh;
  border: 1px solid #344158;
  border-radius: 0;
  border-block: 0;
  border-right: 0;
  background: #131f31;
  color: #dce5f3;
  box-shadow: -20px 0 80px #0006;
  font:
    13px/1.5 -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  color-scheme: dark;
  animation: drawer-enter 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.create-dialog::backdrop {
  background: #02081799;
}
.create-dialog form {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 22px 24px;
  background: linear-gradient(110deg, #1d3454, #152337 70%);
  border-top: 3px solid #4f91f6;
  border-bottom: 1px solid #2b384d;
  flex-shrink: 0;
}
.dialog-header h2 {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
  color: #f1f5f9;
}
.dialog-header p {
  margin: 4px 0 0;
  color: #91a0b7;
  font-size: 12px;
}
.close-button {
  background: none;
  border: 0;
  font-size: 24px;
  line-height: 1;
  color: #91a0b7;
  cursor: pointer;
  padding: 2px 0 2px 14px;
}
.create-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  overflow: auto;
  flex: 1;
  min-height: 0;
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
}
.configuration {
  padding: 0 24px 18px;
  min-width: 0;
}
fieldset {
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.config-section {
  padding: 16px 0 8px;
  border-bottom: 1px solid #29364a;
}
.config-section h3 {
  margin: 0 0 14px;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}
.config-section h3 span {
  font:
    10px ui-monospace,
    monospace;
  color: #7e9dc8;
  padding: 2px 5px;
  border: 1px solid #355780;
  background: #1b3555;
  border-radius: 2px;
}
.config-row {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  margin-bottom: 12px;
}
.config-row > label:first-child,
.row-label {
  color: #a2b1c7;
  padding-top: 7px;
  font-size: 12px;
  line-height: 1.5;
}
.field-content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
input:not([type='checkbox']),
select {
  display: block;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  height: 33px;
  background: #0d1727;
  border: 1px solid #35435b;
  border-radius: 3px;
  color: #e2e8f0;
  font-family: inherit;
  padding: 5px 9px;
  font-size: 12px;
}
input::placeholder {
  color: #687b95;
}
input:focus,
select:focus {
  outline: 0;
  border-color: #599af4;
  box-shadow: 0 0 0 2px #3b82f622;
}
.hint {
  color: #8595ad;
  font-size: 11px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.connection-hint {
  margin: 0 0 6px 136px;
}
.inline-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.inline-fields label {
  font-size: 10px;
  color: #93a4bc;
}
.inline-fields input {
  margin-top: 4px;
}
.four-fields {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.advanced-section {
  padding-top: 14px;
}
.advanced-section summary {
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #b8c9e0;
}
.advanced-section summary span {
  font-size: 11px;
  font-weight: 400;
  color: #8595ad;
  margin-left: 12px;
}
.advanced-fields {
  padding-top: 16px;
}
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 7px;
  padding-top: 5px;
  color: #a2b1c7;
  font-size: 12px;
  cursor: pointer;
}
.checkbox-label input {
  accent-color: #3b82f6;
}
.summary-panel {
  background: linear-gradient(180deg, #16263d, #101a2b 450px);
  border-left: 1px solid #2b384d;
  padding: 20px;
  min-width: 0;
}
.summary-panel h3 {
  margin: 0 0 14px;
  font-size: 13px;
  font-weight: 600;
}
.summary-highlight {
  padding: 14px;
  border: 1px solid #355a84;
  border-radius: 5px;
  background: linear-gradient(120deg, #1b3b60, #172b45);
}
.summary-highlight strong {
  display: block;
  font-size: 22px;
  letter-spacing: -0.5px;
  font-weight: 600;
  color: #bfdbfe;
  font-variant-numeric: tabular-nums;
}
.summary-highlight small {
  font-size: 11px;
  color: #8ea2bf;
  font-weight: 400;
  letter-spacing: 0;
}
.summary-highlight > span {
  display: block;
  font-size: 11px;
  color: #91a0b7;
  margin-top: 4px;
}
.summary-panel dl {
  margin: 16px 0;
  display: grid;
  grid-template-columns: 85px minmax(0, 1fr);
  gap: 12px 10px;
  font-size: 11px;
}
.summary-panel dt {
  color: #8595ad;
}
.summary-panel dd {
  margin: 0;
  color: #c9d6e9;
  overflow-wrap: anywhere;
}
.summary-hint {
  font-size: 11px;
  color: #788ba6;
  border-top: 1px solid #29364a;
  padding-top: 14px;
  line-height: 1.7;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, monospace;
}
.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 24px;
  border-top: 1px solid #2b384d;
  flex-shrink: 0;
  background: #152236;
}
.progress {
  margin-right: auto;
  color: #91a0b7;
  font-size: 12px;
}
.button {
  flex-shrink: 0;
  padding: 7px 18px;
  border-radius: 4px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid #3a4c66;
  white-space: nowrap;
}
.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: white;
}
.primary:hover {
  background: #3476ef;
}
.secondary {
  background: transparent;
  color: #cbd5e1;
}
button:disabled,
fieldset:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
button:focus-visible,
summary:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 3px;
}
fieldset:disabled {
  pointer-events: none;
}
@media (min-width: 1000px) {
  .summary-panel {
    position: sticky;
    top: 0;
    align-self: start;
    min-height: 100%;
    box-sizing: border-box;
  }
}
@media (max-width: 850px) {
  .create-layout {
    grid-template-columns: minmax(0, 1fr) 235px;
  }
  .configuration {
    padding-inline: 16px;
  }
  .config-row {
    grid-template-columns: 100px minmax(0, 1fr);
    gap: 10px;
  }
  .connection-hint {
    margin-left: 110px;
  }
  .summary-panel {
    padding: 16px;
  }
  .summary-panel dl {
    grid-template-columns: 1fr;
    gap: 3px;
  }
  .summary-panel dd {
    margin-bottom: 7px;
  }
  .four-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .create-dialog {
    width: 100vw;
    border: 0;
  }
  .create-layout {
    grid-template-columns: 1fr;
  }
  .summary-panel {
    border-left: 0;
    border-top: 1px solid #2b384d;
  }
  .summary-panel dl {
    grid-template-columns: 100px minmax(0, 1fr);
    gap: 8px;
  }
  .summary-panel dd {
    margin: 0;
  }
  .dialog-header,
  .dialog-footer {
    padding: 14px 16px;
  }
  .config-row {
    grid-template-columns: 1fr;
    gap: 4px;
    margin-bottom: 10px;
  }
  .config-row > label:first-child,
  .row-label {
    padding-top: 0;
  }
  .connection-hint {
    margin-left: 0;
  }
  .advanced-section summary span {
    display: block;
    margin: 5px 0 0 14px;
  }
  .progress {
    max-width: 45%;
    font-size: 11px;
  }
  .summary-highlight {
    padding: 10px 0;
  }
}
@keyframes drawer-enter {
  from {
    transform: translateX(40px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .create-dialog {
    animation: none;
  }
}
.network-warning {
  color: #fbbf24;
}
</style>

<style scoped>
.environment-check {
  margin: 10px 0 16px;
  padding: 12px 14px;
  border: 1px solid #715426;
  border-radius: 5px;
  background: #2d281e;
  color: #fcd998;
  font-size: 12px;
  line-height: 1.6;
}
.environment-check.ready {
  border-color: #275346;
  background: #152e2b;
  color: #91dfc2;
}
.environment-check p {
  margin: 0;
}
.environment-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.environment-actions button {
  padding: 6px 10px;
  border: 1px solid #5a6578;
  border-radius: 4px;
  background: #142235;
  color: #e2e8f0;
  font: inherit;
  cursor: pointer;
}
.environment-actions button:disabled {
  opacity: 0.55;
  cursor: wait;
}
.environment-check details {
  margin-top: 8px;
}
.environment-check pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 11px;
  margin: 6px 0;
}
.network-warning {
  color: #fbbf24;
}
</style>
