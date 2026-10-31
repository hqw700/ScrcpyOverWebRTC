<template>
  <section class="placement-fields">
    <header>
      <h4>{{ t('orchestrator.placement.configurePlacement') }}</h4>
      <button
        type="button"
        class="btn-table-action"
        :disabled="loading"
        @click="$emit('load')"
      >
        {{ t('orchestrator.placement.loadResources') }}
      </button>
    </header>
    <p class="hint">{{ t('orchestrator.placement.resourcesHint') }}</p>
    <label class="storage-field"
      >{{ t('orchestrator.placement.storage') }}
      <select v-model="form.default_storage">
        <option value="">{{ t('orchestrator.placement.noStorage') }}</option>
        <option
          v-if="
            form.default_storage &&
            !resources.storages.some((s) => s.storage === form.default_storage)
          "
          :value="form.default_storage"
        >
          {{ form.default_storage }}
        </option>
        <option
          v-for="s in resources.storages"
          :key="s.storage"
          :value="s.storage"
        >
          {{ s.storage }} · {{ s.type }} ·
          {{
            t('orchestrator.placement.freeSpace', {
              value: (s.avail / 1073741824).toFixed(1),
            })
          }}
        </option>
      </select>
    </label>
    <header>
      <strong>{{ t('orchestrator.placement.outlets') }}</strong
      ><button type="button" class="btn-table-action" @click="addOutlet">
        {{ t('orchestrator.placement.addOutlet') }}
      </button>
    </header>
    <fieldset v-for="(out, index) in form.network_outlets" :key="index">
      <div class="outlet-grid">
        <label
          >{{ t('orchestrator.placement.outletId')
          }}<input v-model="out.id" maxlength="64" required
        /></label>
        <label
          >{{ t('orchestrator.placement.outletName')
          }}<input v-model="out.name" required
        /></label>
        <label
          >{{ t('orchestrator.placement.bridge')
          }}<select v-model="out.bridge" required>
            <option
              v-if="
                out.bridge &&
                !resources.bridges.some((b) => b.iface === out.bridge)
              "
              :value="out.bridge"
            >
              {{ out.bridge }}
            </option>
            <option
              v-for="b in resources.bridges"
              :key="b.iface"
              :value="b.iface"
            >
              {{ b.iface }}
            </option>
          </select></label
        >
        <label
          >{{ t('orchestrator.network.defaultMode') }}
          <select v-model="out.network_mode">
            <option value="dhcp">{{ t('orchestrator.network.dhcp') }}</option>
            <option value="static">
              {{ t('orchestrator.network.static') }}
            </option>
          </select>
        </label>
        <label v-if="out.network_mode !== 'dhcp'"
          >{{ t('orchestrator.placement.subnet')
          }}<input v-model="out.subnet" placeholder="192.168.100.0/24" required
        /></label>
        <label v-if="out.network_mode !== 'dhcp'"
          >{{ t('orchestrator.placement.gateway')
          }}<input v-model="out.gateway" required
        /></label>
        <label v-if="out.network_mode !== 'dhcp'"
          >{{ t('orchestrator.placement.poolStart')
          }}<input v-model="out.ip_start" required
        /></label>
        <label v-if="out.network_mode !== 'dhcp'"
          >{{ t('orchestrator.placement.poolEnd')
          }}<input v-model="out.ip_end" required
        /></label>
        <label v-if="out.network_mode !== 'dhcp'"
          >{{ t('orchestrator.placement.reservedIPs')
          }}<input
            :value="(out.reserved_ips || []).join(', ')"
            @input="
              out.reserved_ips = $event.target.value
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean)
            "
        /></label>
      </div>
      <div class="outlet-actions">
        <label
          ><input
            type="radio"
            name="default-pve-outlet"
            :checked="out.is_default"
            @change="setDefault(index)"
          />
          {{ t('orchestrator.placement.defaultOutlet') }}</label
        ><button
          type="button"
          class="btn-table-action"
          @click="removeOutlet(index)"
        >
          {{ t('orchestrator.placement.removeOutlet') }}
        </button>
      </div>
      <p v-if="out.network_mode === 'dhcp'" class="hint">
        {{ t('orchestrator.network.dhcpHint') }}
      </p>
      <label v-else class="pool-confirm"
        ><input type="checkbox" v-model="out.dedicated_pool" />
        {{ t('orchestrator.placement.dedicatedPool') }}</label
      >
    </fieldset>
    <p
      v-if="form.network_outlets?.some((out) => out.network_mode !== 'dhcp')"
      class="hint"
    >
      {{ t('orchestrator.placement.poolHint') }}
    </p>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const form = defineModel({ type: Object, required: true })
const props = defineProps({
  resources: { type: Object, default: () => ({ storages: [], bridges: [] }) },
  loading: Boolean,
})
defineEmits(['load'])
function addOutlet() {
  form.value.network_outlets ||= []
  form.value.network_outlets.push({
    id: '',
    name: '',
    bridge: props.resources.bridges[0]?.iface || '',
    network_mode: 'dhcp',
    subnet: '',
    gateway: '',
    ip_start: '',
    ip_end: '',
    reserved_ips: [],
    dedicated_pool: false,
    is_default: form.value.network_outlets.length === 0,
  })
}
function setDefault(index) {
  form.value.network_outlets.forEach((out, i) => {
    out.is_default = i === index
  })
}
function removeOutlet(index) {
  form.value.network_outlets.splice(index, 1)
  if (
    form.value.network_outlets.length &&
    !form.value.network_outlets.some((out) => out.is_default)
  )
    setDefault(0)
}
</script>

<style scoped>
.placement-fields {
  margin-top: 20px;
  border-top: 1px solid var(--border-color, #334155);
  padding-top: 12px;
  min-width: 0;
}
header,
.outlet-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
h4 {
  margin: 0;
}
button {
  background: var(--bg-secondary, #0f172a);
  color: var(--text-primary, #e2e8f0);
  border: 1px solid var(--border-color, #334155);
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
button:hover {
  border-color: #60a5fa;
  color: #93c5fd;
}
button:disabled {
  cursor: wait;
  opacity: 0.5;
}
fieldset {
  margin: 12px 0;
  padding: 12px;
  border: 1px solid var(--border-color, #334155);
  border-radius: 6px;
  min-width: 0;
}
.outlet-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
}
select,
input:not([type='checkbox'], [type='radio']) {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  background: var(--bg-secondary, #0f172a);
  color: var(--text-primary, #e2e8f0);
  border: 1px solid var(--border-color, #334155);
  border-radius: 4px;
  padding: 8px;
}
.storage-field {
  margin: 12px 0;
}
.outlet-actions {
  margin-top: 12px;
}
.outlet-actions label,
.pool-confirm {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 8px;
}
.pool-confirm {
  margin-top: 12px;
  line-height: 1.5;
}
.hint {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary, #94a3b8);
}
@media (max-width: 640px) {
  .outlet-grid {
    grid-template-columns: 1fr;
  }
}
</style>
