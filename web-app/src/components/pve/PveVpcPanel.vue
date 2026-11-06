<template>
  <!-- 侧边栏 Drawer (参照开通实例 PveCreateDialog 完全一致的结构与样式) -->
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="create-dialog"
      aria-labelledby="pve-vpc-title"
      @cancel="close"
      @close="editing = null"
    >
      >
        <form @submit.prevent="submit">
          <header class="dialog-header">
            <div>
              <h2 id="pve-vpc-title">{{ t(editing ? 'vpc.edit' : 'vpc.create') }}</h2>
              <p>{{ t(editing ? 'vpc.editHint' : 'vpc.templateHint') }}</p>
            </div>
            <button
              type="button"
              class="close-button"
              :disabled="busy || deployingRuntime"
              @click="close"
              aria-label="Close"
            >
              ×
            </button>
          </header>

          <div class="create-layout">
            <div class="configuration">
              <fieldset :disabled="busy || deployingRuntime">
                <!-- 错误横幅 -->
                <p v-if="formError" role="alert" class="error-banner">{{ formError }}</p>

                <!-- 节点运行时就绪检测与一键部署通道 -->
                <template v-if="!editing">
                  <div v-if="optionsLoading" class="environment-check">
                    <p>{{ t('vpc.loadingOptions') }}</p>
                  </div>
                  <p v-if="optionsError" role="alert" class="error-banner">{{ optionsError }}</p>

                  <div v-if="optionsLoaded && !options.runtime_ready" class="environment-check" role="status">
                    <p>{{ t('vpc.runtimeMissing') }}</p>
                    <div class="environment-actions">
                      <button
                        type="button"
                        class="primary"
                        @click="deployClusterRuntime"
                        :disabled="busy || deployingRuntime"
                      >
                        {{ deployingRuntime ? t('vpc.deployingRuntime') : t('vpc.deployRuntime') }}
                      </button>
                      <button
                        type="button"
                        @click="loadOptions"
                        :disabled="busy || optionsLoading || deployingRuntime"
                      >
                        {{ t('vpc.refreshOptions') }}
                      </button>
                    </div>
                  </div>

                  <div v-if="optionsLoaded && !options.images.length" class="environment-check hint-box">
                    <p>{{ t('vpc.noImages') }}</p>
                    <div class="environment-actions">
                      <button
                        type="button"
                        class="primary"
                        @click="deployClusterRuntime"
                        :disabled="busy || deployingRuntime"
                      >
                        {{ deployingRuntime ? t('vpc.deployingRuntime') : t('vpc.deployRuntime') }}
                      </button>
                      <button
                        type="button"
                        @click="loadOptions"
                        :disabled="busy || optionsLoading || deployingRuntime"
                      >
                        {{ t('vpc.refreshOptions') }}
                      </button>
                    </div>
                  </div>
                </template>

                <!-- 01 基础与节点 -->
                <section v-if="!editing" class="config-section">
                  <h3><span>01</span>{{ t('vpc.sectionBasics') }}</h3>

                  <div class="config-row">
                    <label for="vpc-name">{{ t('vpc.name') }}</label>
                    <div class="field-content">
                      <input id="vpc-name" v-model="form.name" required maxlength="80" placeholder="e.g. VPC-Business-01" />
                    </div>
                  </div>

                  <div class="config-row">
                    <label for="vpc-cluster">{{ t('vpc.cluster') }}</label>
                    <div class="field-content">
                      <select id="vpc-cluster" v-model="form.cluster_id" required>
                        <option v-for="c in clusters" :key="c.id" :value="c.id">
                          {{ c.name || c.id }} · {{ c.node }}
                        </option>
                      </select>
                    </div>
                  </div>

                  <div class="config-row">
                    <label for="vpc-template">{{ t('vpc.template') }}</label>
                    <div class="field-content">
                      <select id="vpc-template" v-model="form.image_volid" required :disabled="optionsLoading">
                        <option value="">{{ t('vpc.select') }}</option>
                        <option v-for="image in options.images" :key="image" :value="image">{{ image }}</option>
                      </select>
                    </div>
                  </div>

                  <div class="config-row">
                    <label for="vpc-storage">{{ t('vpc.storage') }}</label>
                    <div class="field-content">
                      <select id="vpc-storage" v-model="form.storage" required :disabled="optionsLoading">
                        <option value="">{{ t('vpc.select') }}</option>
                        <option v-for="storage in options.storages" :key="storage.storage" :value="storage.storage">
                          {{ storage.storage }}
                        </option>
                      </select>
                    </div>
                  </div>

                  <div class="config-row">
                    <label for="vpc-uplink-bridge">{{ t('vpc.uplinkBridge') }}</label>
                    <div class="field-content">
                      <select id="vpc-uplink-bridge" v-model="form.uplink_bridge" required :disabled="optionsLoading">
                        <option value="">{{ t('vpc.select') }}</option>
                        <option v-for="bridge in options.bridges" :key="bridge.iface" :value="bridge.iface">
                          {{ bridge.iface }}
                        </option>
                      </select>
                    </div>
                  </div>

                  <div class="config-row">
                    <label for="vpc-uplink-mode">{{ t('vpc.uplinkMode') }}</label>
                    <div class="field-content">
                      <select id="vpc-uplink-mode" v-model="form.uplink_mode">
                        <option value="dhcp">{{ t('vpc.dhcp') }}</option>
                        <option value="static">{{ t('vpc.static') }}</option>
                      </select>
                    </div>
                  </div>

                  <template v-if="form.uplink_mode === 'static'">
                    <div class="config-row">
                      <label for="vpc-uplink-cidr">{{ t('vpc.uplinkCIDR') }}</label>
                      <div class="field-content">
                        <input id="vpc-uplink-cidr" v-model="form.uplink_cidr" required placeholder="192.168.100.12/24" />
                      </div>
                    </div>
                    <div class="config-row">
                      <label for="vpc-uplink-gateway">{{ t('vpc.uplinkGateway') }}</label>
                      <div class="field-content">
                        <input id="vpc-uplink-gateway" v-model="form.uplink_gateway" required placeholder="192.168.100.1" />
                      </div>
                    </div>
                  </template>
                </section>

                <!-- 02 隔离子网与网关 (支持智能联动与自动推荐) -->
                <section v-if="!editing" class="config-section">
                  <div class="section-title-row">
                    <h3><span>02</span>{{ t('vpc.sectionSubnet') }}</h3>
                    <button type="button" class="btn-text-action" @click="assignNextFreeSubnet">
                      ⚡ {{ t('vpc.regenerateSubnet') }}
                    </button>
                  </div>

                  <div class="config-row">
                    <label for="vpc-subnet">{{ t('vpc.subnet') }}</label>
                    <div class="field-content">
                      <input
                        id="vpc-subnet"
                        v-model="form.subnet"
                        required
                        placeholder="10.20.0.0/24"
                        @input="onSubnetInput"
                      />
                      <span v-if="derivedPlan" class="hint text-success">
                        💡 {{ t('vpc.subnetDerivedHint', { gateway: derivedPlan.gateway, start: derivedPlan.ipStart, end: derivedPlan.ipEnd }) }}
                      </span>
                    </div>
                  </div>

                  <!-- 可折叠的自定义网关与地址池面板 (默认无需手动配置) -->
                  <details class="advanced-section" :open="customizingSubnet">
                    <summary @click.prevent="customizingSubnet = !customizingSubnet">
                      ⚙️ {{ t('vpc.customSubnetDetails') }}
                      <span>{{ customizingSubnet ? '▲ 收起' : '▼ 展开微调网关与地址池' }}</span>
                    </summary>
                    <div class="advanced-fields">
                      <div class="config-row">
                        <label for="vpc-gateway">{{ t('vpc.gateway') }}</label>
                        <div class="field-content">
                          <input id="vpc-gateway" v-model="form.gateway" required placeholder="10.20.0.1" />
                        </div>
                      </div>

                      <div class="config-row">
                        <label>{{ t('vpc.ipStart') }} / {{ t('vpc.ipEnd') }}</label>
                        <div class="field-content inline-fields">
                          <input v-model="form.ip_start" required placeholder="10.20.0.10" />
                          <input v-model="form.ip_end" required placeholder="10.20.0.250" />
                        </div>
                      </div>

                      <div class="config-row">
                        <label for="vpc-dns">{{ t('vpc.dns') }}</label>
                        <div class="field-content">
                          <input id="vpc-dns" v-model="form.dns" required placeholder="223.5.5.5" />
                        </div>
                      </div>
                    </div>
                  </details>
                </section>

                <!-- 03 业务出口协议 (支持一键解析导入各类配置/链接) -->
                <section class="config-section">
                  <div class="section-title-row">
                    <h3><span>{{ editing ? '01' : '03' }}</span>{{ t('vpc.sectionProxy') }}</h3>
                    <button type="button" class="btn-text-action" @click="showImportCard = !showImportCard">
                      📋 {{ t('vpc.quickImport') }}
                    </button>
                  </div>

                  <!-- 快速导入卡片 (支持 Trojan JSON / trojan:// / vmess:// / socks5:// / http://) -->
                  <div v-if="showImportCard" class="quick-import-card">
                    <div class="import-card-header">
                      <strong>{{ t('vpc.quickImport') }}</strong>
                      <small>{{ t('vpc.quickImportHint') }}</small>
                    </div>
                    <textarea
                      v-model="importText"
                      rows="4"
                      :placeholder="`支持直接粘贴：\n1. Trojan 客户端 JSON 配置 (如 {\x22run_type\x22:\x22client\x22, \x22remote_addr\x22: ...})\n2. trojan://password@remote_addr:port?sni=...\n3. vmess://Base64\n4. socks5:// 或 http:// 代理链接`"
                    ></textarea>
                    <div v-if="importNotice" class="import-notice-banner" :class="{ error: importNoticeError }">
                      {{ importNotice }}
                    </div>
                    <div class="import-actions">
                      <button
                        type="button"
                        class="button primary"
                        @click="parseAndApplyProxyConfig"
                        :disabled="!importText.trim() || parsingImport"
                      >
                        {{ parsingImport ? t('vpc.resolvingDomain') : t('vpc.importBtn') }}
                      </button>
                      <button
                        type="button"
                        class="button secondary"
                        @click="showImportCard = false; importNotice = ''"
                        :disabled="parsingImport"
                      >
                        {{ t('vpc.cancel') }}
                      </button>
                    </div>
                  </div>

                  <div class="config-row">
                    <label for="vpc-proxy-type">{{ t('vpc.protocol') }}</label>
                    <div class="field-content">
                      <select id="vpc-proxy-type" v-model="form.proxy.type">
                        <option value="direct">{{ t('vpc.direct') }}</option>
                        <option value="http">HTTP / HTTPS CONNECT</option>
                        <option value="socks">SOCKS5</option>
                        <option value="vmess">VMess</option>
                        <option value="trojan">Trojan</option>
                      </select>
                      <span v-if="['http', 'socks'].includes(form.proxy.type)" class="hint text-info">
                        💡 HTTP / SOCKS5 支持免密，若代理服务端无密码验证，留空用户名与密码即可。
                      </span>
                    </div>
                  </div>

                  <template v-if="form.proxy.type !== 'direct'">
                    <div class="config-row">
                      <label>{{ t('vpc.server') }} / {{ t('vpc.port') }}</label>
                      <div class="field-content inline-server-fields">
                        <input v-model="form.proxy.server" required placeholder="IPv4 (e.g. 203.0.113.10)" />
                        <input v-model.number="form.proxy.port" type="number" min="1" max="65535" required placeholder="443" />
                      </div>
                    </div>

                    <div v-if="['http', 'socks'].includes(form.proxy.type)" class="config-row">
                      <label for="vpc-proxy-user">
                        {{ t('vpc.username') }} <span class="optional-tag">({{ t('vpc.optional') }})</span>
                      </label>
                      <div class="field-content">
                        <input id="vpc-proxy-user" v-model="form.proxy.username" autocomplete="off" :placeholder="t('vpc.noAuthHint')" />
                      </div>
                    </div>

                    <div v-if="form.proxy.type !== 'vmess'" class="config-row">
                      <label for="vpc-proxy-password">
                        {{ t('vpc.password') }}
                        <span v-if="form.proxy.type !== 'trojan'" class="optional-tag">({{ t('vpc.optional') }})</span>
                      </label>
                      <div class="field-content">
                        <input
                          id="vpc-proxy-password"
                          v-model="form.proxy.password"
                          type="password"
                          autocomplete="new-password"
                          :required="form.proxy.type === 'trojan'"
                          :placeholder="form.proxy.type === 'trojan' ? 'Password' : t('vpc.noAuthHint')"
                        />
                      </div>
                    </div>

                    <div v-if="form.proxy.type === 'vmess'" class="config-row">
                      <label for="vpc-proxy-uuid">{{ t('vpc.uuid') }}</label>
                      <div class="field-content">
                        <input
                          id="vpc-proxy-uuid"
                          v-model="form.proxy.uuid"
                          type="password"
                          autocomplete="new-password"
                          required
                          placeholder="UUID (e.g. 00000000-0000-0000-0000-000000000000)"
                        />
                      </div>
                    </div>

                    <div v-if="form.proxy.type !== 'socks'" class="config-row">
                      <span class="row-label">{{ t('vpc.tls') }}</span>
                      <div class="field-content">
                        <label class="checkbox-label">
                          <input
                            :checked="form.proxy.tls || form.proxy.type === 'trojan'"
                            @change="form.proxy.tls = $event.target.checked"
                            type="checkbox"
                            :disabled="form.proxy.type === 'trojan'"
                          />
                          <span>{{ t('vpc.tls') }}</span>
                        </label>
                      </div>
                    </div>

                    <div v-if="form.proxy.tls || form.proxy.type === 'trojan'" class="config-row">
                      <label for="vpc-proxy-sni">{{ t('vpc.serverName') }}</label>
                      <div class="field-content">
                        <input id="vpc-proxy-sni" v-model="form.proxy.server_name" placeholder="Domain for TLS SNI (e.g. proxy.example.com)" />
                      </div>
                    </div>

                    <div v-if="['vmess', 'trojan'].includes(form.proxy.type)" class="config-row">
                      <label for="vpc-proxy-transport">{{ t('vpc.transport') }}</label>
                      <div class="field-content">
                        <select id="vpc-proxy-transport" v-model="form.proxy.transport">
                          <option value="tcp">TCP</option>
                          <option value="ws">WebSocket</option>
                        </select>
                      </div>
                    </div>

                    <template v-if="form.proxy.transport === 'ws' && ['vmess', 'trojan'].includes(form.proxy.type)">
                      <div class="config-row">
                        <label for="vpc-proxy-path">{{ t('vpc.path') }}</label>
                        <div class="field-content">
                          <input id="vpc-proxy-path" v-model="form.proxy.path" placeholder="/ws" />
                        </div>
                      </div>
                      <div class="config-row">
                        <label for="vpc-proxy-host">{{ t('vpc.host') }}</label>
                        <div class="field-content">
                          <input id="vpc-proxy-host" v-model="form.proxy.host" placeholder="Host header" />
                        </div>
                      </div>
                    </template>
                  </template>
                  <p class="hint">{{ t('vpc.proxyHint') }}</p>
                </section>

                <!-- 04 管理服务直连规则 -->
                <section class="config-section">
                  <h3><span>04</span>{{ t('vpc.sectionManagement') }}</h3>
                  <div class="config-row">
                    <label for="vpc-management">{{ t('vpc.management') }}</label>
                    <div class="field-content">
                      <textarea
                        id="vpc-management"
                        v-model="management"
                        rows="3"
                        placeholder="192.168.100.0/24&#10;192.168.100.241:8443/tcp&#10;192.168.100.241:3478/udp"
                      ></textarea>
                      <span class="hint">{{ t('vpc.managementHint') }}</span>
                    </div>
                  </div>
                </section>
              </fieldset>
            </div>

            <!-- 右侧实时摘要面板 (完全对齐 PveCreateDialog 的 summary-panel) -->
            <aside class="summary-panel" aria-live="polite">
              <h3>{{ t('vpc.summaryTitle') }}</h3>
              <div class="summary-highlight">
                <strong>{{ form.name || 'VPC' }}</strong>
                <span>{{ form.proxy.type.toUpperCase() }} · {{ form.subnet || '—' }}</span>
              </div>
              <dl>
                <dt>{{ t('vpc.cluster') }}</dt>
                <dd>{{ selectedClusterName }}</dd>
                <dt>{{ t('vpc.summaryOutlet') }}</dt>
                <dd>{{ form.proxy.type.toUpperCase() }}</dd>
                <dt>{{ t('vpc.gateway') }}</dt>
                <dd>{{ form.gateway || '—' }}</dd>
                <dt>{{ t('vpc.uplinkMode') }}</dt>
                <dd>{{ form.uplink_mode === 'dhcp' ? t('vpc.dhcp') : (form.uplink_cidr || '—') }}</dd>
                <dt>{{ t('vpc.server') }}</dt>
                <dd>{{ form.proxy.type === 'direct' ? t('vpc.direct') : (form.proxy.server ? `${form.proxy.server}:${form.proxy.port}` : '—') }}</dd>
                <dt>{{ t('vpc.management') }}</dt>
                <dd>{{ t('vpc.summaryRulesCount', { count: managementRulesCount }) }}</dd>
              </dl>
              <p class="summary-hint">{{ t('vpc.hint') }}</p>
            </aside>
          </div>

          <footer class="dialog-footer">
            <span class="progress" role="status">
              {{ deployingRuntime ? t('vpc.deployingRuntime') : (busy ? t('vpc.provisioning') : '') }}
            </span>
            <button
              type="button"
              class="button secondary"
              @click="close"
              :disabled="busy || deployingRuntime"
            >
              {{ t('vpc.cancel') }}
            </button>
            <button
              type="submit"
              class="button primary"
              :disabled="busy || deployingRuntime || (!editing && (optionsLoading || !optionsLoaded || !options.runtime_ready || !!optionsError))"
            >
              {{ t('vpc.save') }}
            </button>
          </footer>
        </form>
      </dialog>
    </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { authHeaders, readError } from '@/utils/api'

const props = defineProps({ clusters: { type: Array, default: () => [] } })
const emit = defineEmits(['changed'])
const { t } = useI18n()

const items = ref([])
const error = ref('')
const notice = ref('')
const busy = ref(false)
const dialog = ref(null)
const editing = ref(null)
const formError = ref('')
const management = ref('')
const customizingSubnet = ref(false)

// 快速导入状态
const showImportCard = ref(false)
const importText = ref('')
const parsingImport = ref(false)
const importNotice = ref('')
const importNoticeError = ref(false)

// 子网计算工具
function deriveFromSubnet(cidr) {
  if (!cidr || typeof cidr !== 'string') return null
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec(cidr.trim())
  if (!m) return null
  const [, o1, o2, o3, o4, prefixStr] = m
  const octets = [+o1, +o2, +o3, +o4]
  if (octets.some(o => o > 255)) return null
  const prefix = parseInt(prefixStr, 10)
  if (prefix < 16 || prefix > 28) return null
  const ipNum = ((octets[0] << 24) >>> 0) + ((octets[1] << 16) >>> 0) + ((octets[2] << 8) >>> 0) + (octets[3] >>> 0)
  const mask = prefix === 0 ? 0 : (((0xFFFFFFFF << (32 - prefix)) >>> 0))
  const netNum = (ipNum & mask) >>> 0
  const bcastNum = (netNum | (~mask >>> 0)) >>> 0
  const toIp = num => `${(num >>> 24) & 255}.${(num >>> 16) & 255}.${(num >>> 8) & 255}.${num & 255}`

  const gateway = toIp(netNum + 1)
  const ipStart = toIp(netNum + 10 <= bcastNum - 4 ? netNum + 10 : netNum + 2)
  const ipEnd = toIp(bcastNum - 2) // 保留 bcast-1 给 VPC 探针
  return { gateway, ipStart, ipEnd, dns: '223.5.5.5' }
}

const derivedPlan = computed(() => deriveFromSubnet(form.value.subnet))

function onSubnetInput() {
  const plan = deriveFromSubnet(form.value.subnet)
  if (plan && !customizingSubnet.value) {
    form.value.gateway = plan.gateway
    form.value.ip_start = plan.ipStart
    form.value.ip_end = plan.ipEnd
    if (!form.value.dns) form.value.dns = plan.dns
  }
}

function assignNextFreeSubnet() {
  const usedSubnets = new Set(items.value.map(i => i.spec?.subnet).filter(Boolean))
  let candidate = '10.20.0.0/24'
  for (let i = 0; i < 255; i++) {
    const c = `10.20.${i}.0/24`
    if (!usedSubnets.has(c)) {
      candidate = c
      break
    }
  }
  form.value.subnet = candidate
  const plan = deriveFromSubnet(candidate)
  if (plan) {
    form.value.gateway = plan.gateway
    form.value.ip_start = plan.ipStart
    form.value.ip_end = plan.ipEnd
    form.value.dns = plan.dns
  }
}

const fresh = () => ({
  name: '',
  cluster_id: props.clusters[0]?.id || '',
  image_volid: '',
  uplink_mode: 'dhcp',
  storage: '',
  uplink_bridge: '',
  uplink_cidr: '',
  uplink_gateway: '',
  subnet: '10.20.0.0/24',
  gateway: '10.20.0.1',
  ip_start: '10.20.0.10',
  ip_end: '10.20.0.250',
  dns: '223.5.5.5',
  proxy: {
    type: 'direct',
    server: '',
    port: 443,
    username: '',
    password: '',
    uuid: '',
    tls: false,
    server_name: '',
    transport: 'tcp',
    path: '/',
    host: ''
  },
  management: []
})

const form = ref(fresh())
const options = ref({ images: [], bridges: [], storages: [], runtime_ready: false })
const optionsLoading = ref(false)
const optionsLoaded = ref(false)
const optionsError = ref('')
const deployingRuntime = ref(false)
let optionsGeneration = 0

const selectedCluster = computed(() => props.clusters.find(c => c.id === form.value.cluster_id))
const selectedClusterName = computed(() => selectedCluster.value?.name || selectedCluster.value?.node || form.value.cluster_id || '—')
const managementRulesCount = computed(() => management.value.split('\n').map(s => s.trim()).filter(Boolean).length)

// 域名解析助手
async function resolveHostToIPv4(host) {
  if (!host) return ''
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return host
  const res = await request(`/resolve?host=${encodeURIComponent(host)}`)
  return res.data?.ip || (res.data?.ips && res.data.ips[0]) || ''
}

// 快速解析并应用导入配置
async function parseAndApplyProxyConfig() {
  const raw = importText.value.trim()
  if (!raw) return
  parsingImport.value = true
  importNotice.value = ''
  importNoticeError.value = false

  try {
    let target = {
      type: 'trojan',
      server: '',
      port: 443,
      username: '',
      password: '',
      uuid: '',
      tls: false,
      server_name: '',
      transport: 'tcp',
      path: '/',
      host: ''
    }
    let remoteHost = ''

    if (raw.startsWith('{')) {
      // JSON 格式 (如 Trojan 客户端配置、V2Ray/Xray/Sing-box 配置)
      const obj = JSON.parse(raw)
      if (obj.run_type === 'client' || obj.remote_addr || (Array.isArray(obj.password) && obj.ssl)) {
        // Trojan 客户端配置
        target.type = 'trojan'
        remoteHost = obj.remote_addr || obj.server || ''
        target.port = Number(obj.remote_port || obj.server_port || 443)
        if (Array.isArray(obj.password)) target.password = String(obj.password[0] || '')
        else if (obj.password) target.password = String(obj.password)
        target.tls = true
        target.server_name = obj.ssl?.sni || remoteHost || ''
        if (obj.websocket?.enabled) {
          target.transport = 'ws'
          target.path = obj.websocket.path || '/'
          target.host = obj.websocket.host || target.server_name
        }
      } else if (obj.protocol === 'vmess' || obj.type === 'vmess') {
        // VMess 格式
        target.type = 'vmess'
        remoteHost = obj.server || obj.add || ''
        target.port = Number(obj.server_port || obj.port || 443)
        target.uuid = obj.uuid || obj.id || ''
        target.tls = !!(obj.tls || obj.security === 'tls')
        target.server_name = obj.server_name || obj.sni || remoteHost || ''
        target.transport = obj.transport?.type === 'ws' || obj.net === 'ws' ? 'ws' : 'tcp'
        target.path = obj.transport?.path || obj.path || '/'
        target.host = obj.transport?.headers?.Host || obj.host || ''
      } else if (obj.type === 'socks' || obj.protocol === 'socks') {
        target.type = 'socks'
        remoteHost = obj.server || ''
        target.port = Number(obj.server_port || obj.port || 1080)
        target.username = obj.username || ''
        target.password = obj.password || ''
      } else if (obj.type === 'http' || obj.protocol === 'http') {
        target.type = 'http'
        remoteHost = obj.server || ''
        target.port = Number(obj.server_port || obj.port || 80)
        target.username = obj.username || ''
        target.password = obj.password || ''
        target.tls = !!obj.tls
      } else if (obj.server) {
        // 泛用代理 JSON
        target.type = obj.type || 'trojan'
        remoteHost = obj.server
        target.port = Number(obj.port || obj.server_port || 443)
        target.username = obj.username || ''
        target.password = obj.password || ''
        target.uuid = obj.uuid || ''
        target.tls = !!obj.tls
        target.server_name = obj.server_name || obj.sni || remoteHost
      } else {
        throw new Error('未识别到支持的代理服务端点信息 (remote_addr / server)')
      }
    } else if (raw.startsWith('trojan://')) {
      // trojan://password@remote_addr:port?sni=...#name
      const u = new URL(raw)
      target.type = 'trojan'
      target.password = decodeURIComponent(u.username || u.password || '')
      remoteHost = u.hostname
      target.port = Number(u.port || 443)
      target.tls = true
      target.server_name = u.searchParams.get('sni') || u.searchParams.get('peer') || remoteHost
      if (u.searchParams.get('type') === 'ws') {
        target.transport = 'ws'
        target.path = u.searchParams.get('path') || '/'
        target.host = u.searchParams.get('host') || target.server_name
      }
    } else if (raw.startsWith('vmess://')) {
      // vmess://Base64
      const b64 = raw.slice(8).trim()
      const jsonStr = decodeURIComponent(escape(atob(b64)))
      const v = JSON.parse(jsonStr)
      target.type = 'vmess'
      remoteHost = v.add || v.server || ''
      target.port = Number(v.port || 443)
      target.uuid = v.id || v.uuid || ''
      target.tls = v.tls === 'tls' || v.tls === true
      target.server_name = v.sni || v.host || remoteHost || ''
      target.transport = v.net === 'ws' ? 'ws' : 'tcp'
      target.path = v.path || '/'
      target.host = v.host || target.server_name
    } else if (raw.startsWith('socks5://') || raw.startsWith('socks://') || raw.startsWith('http://') || raw.startsWith('https://')) {
      // URI 格式
      const u = new URL(raw)
      target.type = u.protocol.startsWith('socks') ? 'socks' : 'http'
      remoteHost = u.hostname
      target.port = Number(u.port || (u.protocol === 'https:' ? 443 : (u.protocol.startsWith('socks') ? 1080 : 80)))
      target.username = decodeURIComponent(u.username || '')
      target.password = decodeURIComponent(u.password || '')
      target.tls = u.protocol === 'https:'
    } else {
      throw new Error('未识别到支持的配置格式 (请粘贴 JSON 或 trojan://, vmess://, socks5://, http:// 链接)')
    }

    // 处理远端主机地址 (如果是域名则自动解析为 IPv4)
    if (remoteHost) {
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(remoteHost)) {
        target.server = remoteHost
      } else {
        // 自动解析域名为 IPv4
        target.server_name = target.server_name || remoteHost
        try {
          const resolvedIp = await resolveHostToIPv4(remoteHost)
          if (resolvedIp) {
            target.server = resolvedIp
            notice.value = `已自动解析域名 ${remoteHost} → ${resolvedIp}，TLS SNI 保留为 ${target.server_name}`
          } else {
            target.server = remoteHost
          }
        } catch (e) {
          target.server = ''
          throw new Error(`域名 [${remoteHost}] 解析失败: ${e.message}。请在服务器端点手动填入对应 IPv4 地址。`)
        }
      }
    }

    form.value.proxy = target
    importNotice.value = t('vpc.importSuccess')
    setTimeout(() => {
      showImportCard.value = false
      importNotice.value = ''
    }, 1200)
  } catch (e) {
    importNoticeError.value = true
    importNotice.value = t('vpc.importError', { error: e.message })
  } finally {
    parsingImport.value = false
  }
}

async function deployClusterRuntime() {
  if (!form.value.cluster_id || deployingRuntime.value) return
  deployingRuntime.value = true
  formError.value = ''
  try {
    const res = await fetch(`/api/pve/clusters/${encodeURIComponent(form.value.cluster_id)}/deploy-agent`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' })
    })
    if (!res.ok) throw new Error(await readError(res, t('vpc.failed')))
    notice.value = t('vpc.deployRuntimeSuccess')
    await loadOptions()
  } catch (e) {
    formError.value = t('vpc.error', { error: e.message })
  } finally {
    deployingRuntime.value = false
  }
}

async function loadOptions() {
  const generation = ++optionsGeneration
  const cluster = form.value.cluster_id
  optionsLoading.value = true
  optionsLoaded.value = false
  optionsError.value = ''
  options.value = { images: [], bridges: [], storages: [], runtime_ready: false }
  form.value.image_volid = ''
  form.value.storage = ''
  form.value.uplink_bridge = ''
  try {
    const result = await request(`/options?cluster_id=${encodeURIComponent(cluster)}`)
    if (generation !== optionsGeneration) return
    options.value = result.data
    optionsLoaded.value = true
  } catch (e) {
    if (generation === optionsGeneration) optionsError.value = t('vpc.error', { error: e.message })
  } finally {
    if (generation === optionsGeneration) optionsLoading.value = false
  }
}

watch(
  () => form.value.cluster_id,
  () => {
    if (dialog.value?.open && !editing.value) loadOptions()
  }
)

let timer, loading = false, requestKey = ''
const active = v => ['provisioning', 'checking', 'deleting'].includes(v.status)
const status = value => t(`vpc.${value === 'error' ? 'failed' : value}`)

async function request(path, options = {}) {
  const res = await fetch(`/api/pve/vpcs${path}`, {
    ...options,
    headers: authHeaders({ 'Content-Type': 'application/json', ...(options.headers || {}) })
  })
  if (!res.ok) throw new Error(await readError(res, t('vpc.failed')))
  return res.json()
}

async function load() {
  if (loading) return
  loading = true
  try {
    const previous = items.value || []
    const result = await request('')
    items.value = result.data || []
    error.value = ''
    if (previous.length > 0) {
      const newlyReady = items.value.some(
        v => v.status === 'ready' && previous.some(p => p.id === v.id && p.status !== 'ready')
      )
      if (newlyReady) {
        emit('changed')
      }
    }
  } catch (e) {
    error.value = t('vpc.error', { error: e.message })
  } finally {
    loading = false
  }
}

function open(v = null, defaultClusterId = null) {
  editing.value = v
  form.value = v
    ? {
        ...fresh(),
        ...JSON.parse(JSON.stringify(v.spec)),
        proxy: { ...fresh().proxy, ...v.spec.proxy, password: '', uuid: '' }
      }
    : fresh()
  if (!v && defaultClusterId) {
    form.value.cluster_id = defaultClusterId
  }
  customizingSubnet.value = false
  showImportCard.value = false
  importText.value = ''
  importNotice.value = ''
  management.value = (v?.spec?.management || [])
    .map(m => {
      let s = m.address
      if (m.port > 0) s += `:${m.port}`
      if (m.network && m.network !== 'all') s += `/${m.network}`
      return s
    })
    .join('\n')
  formError.value = ''
  requestKey = 'vpc-' + [...crypto.getRandomValues(new Uint8Array(8))].map(n => n.toString(16).padStart(2, '0')).join('')
  dialog.value.showModal()
  if (!v) {
    assignNextFreeSubnet()
    loadOptions()
  }
}

function close() {
  if (!busy.value && !deployingRuntime.value) dialog.value.close()
}

async function submit() {
  if (editing.value && !confirm(t('vpc.confirmEdit'))) return
  busy.value = true
  formError.value = ''
  try {
    const payload = JSON.parse(JSON.stringify(form.value))
    if (payload.uplink_mode === 'dhcp') {
      payload.uplink_cidr = ''
      payload.uplink_gateway = ''
    }
    if (!['vmess', 'trojan'].includes(payload.proxy.type)) payload.proxy.transport = 'tcp'
    if (payload.proxy.type === 'socks') payload.proxy.tls = false
    payload.management = management.value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(line => {
        const m = /^([0-9.]+(:?\/[0-9]+)?)(?::(\d+))?(?:\/(tcp|udp|all))?$/i.exec(line)
        if (!m) throw new Error(t('vpc.invalidRules') + ': ' + line)
        const address = m[1]
        const port = m[3] ? Number(m[3]) : 0
        const network = (m[4] || 'all').toLowerCase()
        if (port < 0 || port > 65535) throw new Error(t('vpc.invalidRules') + ': ' + line)
        return { address, port, network }
      })
    const updatePayload = {
      ...payload.proxy,
      management: payload.management
    }
    await request(editing.value ? `/${editing.value.id}` : '', {
      method: editing.value ? 'PUT' : 'POST',
      headers: { 'Idempotency-Key': requestKey },
      body: JSON.stringify(editing.value ? updatePayload : payload)
    })
    notice.value = t('vpc.created')
    dialog.value.close()
    await load()
    emit('changed')
  } catch (e) {
    formError.value = t('vpc.error', { error: e.message })
  } finally {
    busy.value = false
  }
}

async function action(v, action) {
  if (action === 'delete' && !confirm(t('vpc.confirmDelete', { name: v.spec.name }))) return
  busy.value = true
  try {
    await request(`/${v.id}${action === 'delete' ? '' : '/' + action}`, {
      method: action === 'delete' ? 'DELETE' : 'POST'
    })
    await load()
    emit('changed')
  } catch (e) {
    error.value = t('vpc.error', { error: e.message })
    alert(t('vpc.error', { error: e.message }))
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  load()
  timer = setInterval(load, 5000)
})

onBeforeUnmount(() => {
  clearInterval(timer)
  optionsGeneration++
})

defineExpose({
  open,
  close,
  action,
  load,
  items,
  busy,
  active
})
</script>

<style scoped>
/* 抽屉样式 (Drawer - 严格对齐 PveCreateDialog) */
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
  box-shadow: -20px 0 80px rgba(0, 0, 0, 0.4);
  font: 13px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
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

.close-button:hover {
  color: #ffffff;
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

fieldset:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  pointer-events: none;
}

.config-section {
  padding: 16px 0 8px;
  border-bottom: 1px solid #29364a;
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.section-title-row h3 {
  margin: 0;
}

.config-section h3 {
  margin: 0 0 14px;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #f1f5f9;
}

.config-section h3 span {
  font: 10px ui-monospace, monospace;
  color: #7e9dc8;
  padding: 2px 5px;
  border: 1px solid #355780;
  background: #1b3555;
  border-radius: 2px;
}

.btn-text-action {
  background: transparent;
  border: 1px solid #3b82f6;
  color: #60a5fa;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
}

.btn-text-action:hover {
  background: rgba(59, 130, 246, 0.15);
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
select,
textarea {
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

textarea {
  height: auto;
  min-height: 72px;
  resize: vertical;
}

input::placeholder,
textarea::placeholder {
  color: #687b95;
}

input:focus,
select:focus,
textarea:focus {
  outline: 0;
  border-color: #599af4;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.inline-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.inline-server-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 90px;
  gap: 10px;
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

.hint {
  color: #8595ad;
  font-size: 11px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.text-success {
  color: #34d399 !important;
}

.text-info {
  color: #38bdf8 !important;
}

.optional-tag {
  color: #64748b;
  font-weight: 400;
  font-size: 11px;
}

.error-banner {
  margin: 10px 0 16px;
  padding: 10px 14px;
  border: 1px solid #ef4444;
  border-radius: 5px;
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
  font-size: 12px;
}

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

.environment-check.hint-box {
  border-color: #355780;
  background: #152538;
  color: #bfdbfe;
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
  font-size: 12px;
  cursor: pointer;
}

.environment-actions button.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.environment-actions button:disabled {
  opacity: 0.55;
  cursor: wait;
}

/* 高级折叠面板 */
.advanced-section {
  margin-top: 8px;
  padding-top: 8px;
}

.advanced-section summary {
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #93c5fd;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.advanced-section summary span {
  font-size: 11px;
  color: #64748b;
}

.advanced-fields {
  margin-top: 12px;
  padding: 12px 14px;
  background: #0d1727;
  border: 1px dashed #24354c;
  border-radius: 4px;
}

/* 快速导入卡片 */
.quick-import-card {
  margin-bottom: 16px;
  padding: 14px;
  border: 1px solid #3b82f6;
  border-radius: 6px;
  background: #111e31;
}

.import-card-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 8px;
}

.import-card-header strong {
  color: #93c5fd;
  font-size: 12px;
}

.import-card-header small {
  color: #94a3b8;
  font-size: 11px;
}

.quick-import-card textarea {
  min-height: 85px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 11px;
  line-height: 1.4;
}

.import-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.import-notice-banner {
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 11px;
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
}

.import-notice-banner.error {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
}

/* 右侧配置摘要面板 (严格对齐 PveCreateDialog) */
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
  color: #f1f5f9;
}

.summary-highlight {
  padding: 14px;
  border: 1px solid #355a84;
  border-radius: 5px;
  background: linear-gradient(120deg, #1b3b60, #172b45);
}

.summary-highlight strong {
  display: block;
  font-size: 20px;
  letter-spacing: -0.5px;
  font-weight: 600;
  color: #bfdbfe;
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

/* 底部操作条 (严格对齐 PveCreateDialog) */
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

.dialog-footer .progress {
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

.button.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: white;
}

.button.primary:hover:not(:disabled) {
  background: #3476ef;
}

.button.secondary {
  background: transparent;
  color: #cbd5e1;
}

.button.secondary:hover:not(:disabled) {
  background: #1e293b;
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
}
</style>
