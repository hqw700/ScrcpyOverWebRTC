<template>
  <div class="package-builder" :aria-busy="isGenerating">
    <h3>{{ t('deploy.magiskBuilder.heading') }}</h3>
    <p>{{ t('deploy.magiskBuilder.description') }}</p>
    <div class="builder-fields">
      <label for="magisk-signaling">{{ t('deploy.form.signalingUrl') }} <span class="required">*</span></label>
      <input id="magisk-signaling" v-model="signalingUrl" type="text" :disabled="isGenerating"
             :placeholder="t('deploy.form.signalingPlaceholder')" autocomplete="off" spellcheck="false">
      <p class="field-hint">{{ t('deploy.magiskBuilder.serverHint') }}</p>
      <label for="magisk-ice">{{ t('deploy.form.iceServers') }}</label>
      <textarea id="magisk-ice" v-model="iceServers" rows="2" :disabled="isGenerating"
                :placeholder="t('deploy.form.iceServersPlaceholder')" autocomplete="off" spellcheck="false"></textarea>
      <p class="field-hint">{{ t('deploy.magiskBuilder.iceHint') }}</p>
      <label for="magisk-device-id">{{ t('deploy.form.deviceId') }}</label>
      <input id="magisk-device-id" v-model="deviceId" type="text" :disabled="isGenerating"
             :placeholder="t('deploy.form.deviceIdPlaceholder')" autocomplete="off">
    </div>
    <p class="batch-hint">{{ t('deploy.magiskBuilder.batchHint') }}</p>
    <details class="advanced-settings">
      <summary>{{ t('deploy.magiskBuilder.advancedSettings') }}</summary>
      <div class="builder-fields">
        <label for="magisk-codec">{{ t('deploy.form.videoCodecOptions') }}</label>
        <input id="magisk-codec" v-model="videoCodecOptions" type="text" :disabled="isGenerating"
               :placeholder="t('deploy.form.videoCodecOptionsPlaceholder')">
        <label for="magisk-max-fps">{{ t('deploy.magiskBuilder.maxFps') }}</label>
        <input id="magisk-max-fps" v-model.number="maxFps" type="number" min="0" step="1" :disabled="isGenerating">
        <label for="magisk-external">{{ t('deploy.form.externalAddr') }}</label>
        <input id="magisk-external" v-model="externalAddr" type="text" :disabled="isGenerating"
               :placeholder="t('deploy.form.externalAddrPlaceholder')">
        <p class="field-hint">{{ t('deploy.form.externalAddrHint') }}</p>
        <label for="magisk-port">{{ t('deploy.form.webrtcPort') }}</label>
        <input id="magisk-port" v-model="webrtcPort" type="text" inputmode="numeric" :disabled="isGenerating"
               :placeholder="t('deploy.form.webrtcPortPlaceholder')">
      </div>
    </details>
    <label class="autostart-option">
      <input v-model="autoStart" type="checkbox" :disabled="isGenerating">
      <span>{{ t('deploy.magiskBuilder.autoStart') }}</span>
    </label>
    <label class="apply-config-option">
      <input v-model="applyConfig" type="checkbox" :disabled="isGenerating">
      <span>{{ t('deploy.magiskBuilder.applyConfig') }}</span>
    </label>
    <p class="field-hint">{{ t('deploy.magiskBuilder.applyConfigHint') }}</p>
    <button type="button" class="generate-button" :disabled="isGenerating || !signalingUrl?.trim()" @click="generate">
      {{ isGenerating ? generationStatus : t('deploy.magiskBuilder.generate') }}
    </button>
    <progress v-if="phase === 'generating'" :value="progress" max="100" :aria-label="generationStatus"></progress>
    <p v-if="errorCode" class="result error" role="alert">{{ t(`deploy.magiskBuilder.errors.${errorCode}`) }}</p>
    <p v-if="generatedFilename" class="result success" role="status">{{ t('deploy.magiskBuilder.success', { filename: generatedFilename }) }}</p>
    <p v-if="generatedSettings" class="result success">{{ t('deploy.magiskBuilder.generatedSettings', {
      autoStart: t(generatedSettings.enabled ? 'common.enabled' : 'common.disabled'),
      configPolicy: t(generatedSettings.applyConfig ? 'deploy.magiskBuilder.replaceConfig' : 'deploy.magiskBuilder.preserveConfig'),
    }) }}</p>
    <p class="upgrade-hint">{{ t('deploy.magiskBuilder.upgradeHint') }}</p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({ options: { type: Object, required: true } })
const emit = defineEmits(['update:options'])
const { t, te } = useI18n()
const field = key => computed({
  get: () => props.options[key],
  set: value => emit('update:options', { ...props.options, [key]: value }),
})
const signalingUrl = field('signalingUrl')
const iceServers = field('iceServers')
const deviceId = field('deviceId')
const videoCodecOptions = field('videoCodecOptions')
const maxFps = field('maxFps')
const externalAddr = field('externalAddr')
const webrtcPort = field('webrtcPort')
const autoStart = ref(true)
const applyConfig = ref(false)
const phase = ref('')
const progress = ref(0)
const errorCode = ref('')
const generatedFilename = ref('')
const generatedSettings = ref(null)
const isGenerating = computed(() => !!phase.value)
const generationStatus = computed(() => phase.value === 'loading'
  ? t('deploy.magiskBuilder.loadingBase')
  : t('deploy.magiskBuilder.generating', { percent: progress.value }))
let controller
onBeforeUnmount(() => controller?.abort())

async function generate() {
  if (isGenerating.value) return
  const options = { ...props.options, enabled: autoStart.value, applyConfig: applyConfig.value }
  const abort = new AbortController()
  controller = abort
  phase.value = 'loading'
  progress.value = 0
  errorCode.value = ''
  generatedFilename.value = ''
  generatedSettings.value = null
  try {
    // Load ZIP support only when needed by this deployment path.
    const { createConfiguredMagiskPackage, createMagiskConfigUpdates, MagiskPackageError,
      MAX_MAGISK_PACKAGE_BYTES } = await import('@/utils/magiskPackage')
    createMagiskConfigUpdates(options, window.location.protocol)
    let response
    try {
      response = await fetch('/agent/cloudphone-agent-magisk.pkg', { cache: 'no-store', signal: abort.signal })
    } catch {
      throw new MagiskPackageError('baseUnavailable')
    }
    if (!response.ok || response.headers.get('content-type')?.includes('text/html')) {
      throw new MagiskPackageError('baseUnavailable')
    }
    if (Number(response.headers.get('content-length')) > MAX_MAGISK_PACKAGE_BYTES) {
      throw new MagiskPackageError('packageTooLarge')
    }
    const data = await response.arrayBuffer()
    if (abort.signal.aborted) return
    phase.value = 'generating'
    const result = await createConfiguredMagiskPackage(data, options, {
      pageProtocol: window.location.protocol,
      onProgress: value => { progress.value = value },
    })
    if (abort.signal.aborted) return
    const url = URL.createObjectURL(new Blob([result.data], { type: 'application/zip' }))
    const link = document.createElement('a')
    link.href = url
    link.download = result.filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30000)
    generatedFilename.value = result.filename
    generatedSettings.value = { enabled: result.enabled, applyConfig: result.applyConfig }
  } catch (error) {
    if (!abort.signal.aborted) {
      errorCode.value = typeof error.code === 'string' && te(`deploy.magiskBuilder.errors.${error.code}`)
        ? error.code : 'generationFailed'
    }
  } finally {
    phase.value = ''
  }
}
</script>

<style scoped>
.package-builder { padding: 20px; border: 1px solid rgba(168, 85, 247, .35); border-radius: 12px; background: rgba(168, 85, 247, .06); min-width: 0; }
h3 { margin: 0 0 10px; font-size: 15px; color: var(--text-primary); }
p { margin: 8px 0; font-size: 13px; line-height: 1.65; color: var(--text-secondary); overflow-wrap: anywhere; }
.batch-hint { color: var(--text-secondary); }
.builder-fields { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
.builder-fields label { margin-top: 4px; font-size: 13px; color: var(--text-primary); }
.builder-fields input, .builder-fields textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--border); border-radius: 7px; padding: 10px 12px; background: var(--bg-primary); color: var(--text-primary); font: inherit; font-size: 13px; min-width: 0; }
.builder-fields input:focus, .builder-fields textarea:focus { outline: 2px solid rgba(168, 85, 247, .45); outline-offset: 1px; }
.builder-fields textarea { resize: vertical; }
.builder-fields .field-hint { margin: 0 0 4px; font-size: 12px; }
.required { color: #f87171; }
.autostart-option, .apply-config-option { display: flex; gap: 8px; align-items: center; margin: 16px 0; font-size: 13px; color: var(--text-primary); }
.autostart-option input, .apply-config-option input { accent-color: #a855f7; }
.apply-config-option { margin-bottom: 4px; }
.generate-button { padding: 12px 20px; border: 0; border-radius: 8px; background: #9333ea; color: white; font-weight: 600; font-size: 13px; cursor: pointer; max-width: 100%; white-space: normal; }
.generate-button:hover:not(:disabled) { background: #a855f7; }
button:disabled { cursor: not-allowed; opacity: .6; }
progress { display: block; width: 100%; margin-top: 12px; accent-color: #a855f7; }
.upgrade-hint { margin-top: 14px; font-size: 12px; }
.result { margin-top: 12px; }
.error { color: #f87171; }
.success { color: #4ade80; }
.advanced-settings { margin-top: 14px; border-top: 1px solid var(--border); padding-top: 12px; }
summary { cursor: pointer; color: var(--text-secondary); font-size: 12px; line-height: 1.6; }
@media (max-width: 600px) { .package-builder { padding: 14px; } .generate-button { width: 100%; } }
</style>
