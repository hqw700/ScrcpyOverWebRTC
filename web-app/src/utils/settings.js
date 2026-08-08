export const defaultSettings = {
  fps: 0,
  size: 0,
  bitrate: 4,
  bwe: true,
  minBitrate: 8,
  maxBitrate: 20,
  audio: false,
  audioGain: 1,
  audioSource: 'output',
  audioDup: true,
  audioLowLatency: false,
  pageAudioMuted: false,
  debug: false,
  snapshotInterval: 10,
  powerOff: false,
  connectionPath: 'auto',
  ipPreference: 'auto',
  showStats: true,
  videoCodecOptions: '',
  camera: false,
  previewFps: 10,
  previewSize: 360,
  previewDecoder: 'wasm',
  previewBitrate: 1,
  stayAwake: false
}

function parseSettings(parsed) {
  const hasAudioDup = Object.prototype.hasOwnProperty.call(parsed, 'audioDup')
  if (parsed.bitrate > 1000) {
    parsed.bitrate = Math.max(1, Math.round(parsed.bitrate / 1000000))
    if (parsed.minBitrate > 1000) parsed.minBitrate = Math.max(1, Math.round(parsed.minBitrate / 1000000))
    if (parsed.maxBitrate > 1000) parsed.maxBitrate = Math.max(1, Math.round(parsed.maxBitrate / 1000000))
  }
  if (parsed.previewBitrate > 1000) {
    parsed.previewBitrate = Math.max(1, Math.round(parsed.previewBitrate / 1000000))
  }
  if (parsed.audioGain === undefined) parsed.audioGain = defaultSettings.audioGain
  if (parsed.audioSource === undefined) parsed.audioSource = defaultSettings.audioSource
  if (!hasAudioDup && parsed.audioSource === 'output') parsed.audioSource = defaultSettings.audioSource
  if (parsed.audioDup === undefined) parsed.audioDup = defaultSettings.audioDup
  if (parsed.pageAudioMuted === undefined) parsed.pageAudioMuted = defaultSettings.pageAudioMuted
  if (parsed.debug === undefined) parsed.debug = defaultSettings.debug
  if (parsed.snapshotInterval === undefined) parsed.snapshotInterval = defaultSettings.snapshotInterval
  if (parsed.powerOff === undefined) parsed.powerOff = defaultSettings.powerOff
  if (parsed.connectionPath === undefined) parsed.connectionPath = defaultSettings.connectionPath
  if (parsed.ipPreference === undefined) parsed.ipPreference = defaultSettings.ipPreference
  if (parsed.showStats === undefined) parsed.showStats = defaultSettings.showStats
  if (parsed.videoCodecOptions === undefined) parsed.videoCodecOptions = defaultSettings.videoCodecOptions
  if (parsed.camera === undefined) parsed.camera = defaultSettings.camera
  if (parsed.previewFps === undefined) parsed.previewFps = defaultSettings.previewFps
  if (parsed.previewSize === undefined) parsed.previewSize = defaultSettings.previewSize
  if (parsed.previewDecoder === undefined) parsed.previewDecoder = defaultSettings.previewDecoder
  if (parsed.previewBitrate === undefined) parsed.previewBitrate = defaultSettings.previewBitrate
  if (parsed.stayAwake === undefined) parsed.stayAwake = defaultSettings.stayAwake
  return parsed
}

export function getDeviceSettings(deviceId) {
  let globalSettings = { ...defaultSettings }
  try {
    const storedGlobal = localStorage.getItem('cloudphone_settings')
    if (storedGlobal) {
      globalSettings = { ...globalSettings, ...parseSettings(JSON.parse(storedGlobal)) }
      localStorage.setItem('cloudphone_settings', JSON.stringify(globalSettings))
    }
  } catch(e) {}

  if (!deviceId) return globalSettings

  try {
    const storedDev = localStorage.getItem(`cloudphone_settings_${deviceId}`)
    if (storedDev) {
      const devSettings = { ...globalSettings, ...parseSettings(JSON.parse(storedDev)) }
      localStorage.setItem(`cloudphone_settings_${deviceId}`, JSON.stringify(devSettings))
      return devSettings
    }
  } catch(e) {}
  
  return globalSettings
}

export function saveDeviceSettings(deviceId, newSettings) {
  if (!deviceId) {
    localStorage.setItem('cloudphone_settings', JSON.stringify(newSettings))
    fetch('/api/default_settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings)
    }).catch(err => console.warn('Failed to sync global settings to server:', err))
  } else {
    localStorage.setItem(`cloudphone_settings_${deviceId}`, JSON.stringify(newSettings))
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cloudphone-settings-updated', { detail: { deviceId } }))
  }
}

export function hasCustomSettings(deviceId) {
  if (!deviceId) return false
  return localStorage.getItem(`cloudphone_settings_${deviceId}`) !== null
}

export function deleteDeviceSettings(deviceId) {
  if (deviceId) {
    localStorage.removeItem(`cloudphone_settings_${deviceId}`)
  }
}

// --- 用户级设置管控策略（管理员在用户管理中配置，服务端信令层同步强制） ---

// 设置维度 -> settings 键
export const POLICY_DIM_KEYS = {
  bitrate: ['bitrate', 'minBitrate', 'maxBitrate', 'bwe'],
  fps: ['fps'],
  resolution: ['size'],
  audio: ['audio', 'audioGain', 'audioSource', 'audioDup', 'audioLowLatency']
}

// policy(authStore.userPolicy) -> SettingsModal 的 lockedSections 数组
export function policyLockedSections(policy) {
  if (!policy) return []
  const arr = []
  if (policy.forbid_bitrate) arr.push('bitrate')
  if (policy.forbid_fps) arr.push('fps')
  if (policy.forbid_resolution) arr.push('size')
  if (policy.forbid_audio) arr.push('audio')
  return arr
}

// 将管控策略叠加到本地设置上：被禁维度使用管理员配置值
// （无配置值时保留本地显示值，服务端仍会剥离并回落设备默认）
export function applyPolicyToSettings(settings, policy) {
  if (!policy) return settings
  const enforced = policy.settings || {}
  const merged = { ...settings }
  const applyDim = (forbidden, keys) => {
    if (!forbidden) return
    for (const k of keys) {
      if (enforced[k] !== undefined) merged[k] = enforced[k]
    }
  }
  applyDim(policy.forbid_bitrate, POLICY_DIM_KEYS.bitrate)
  applyDim(policy.forbid_fps, POLICY_DIM_KEYS.fps)
  applyDim(policy.forbid_resolution, POLICY_DIM_KEYS.resolution)
  applyDim(policy.forbid_audio, POLICY_DIM_KEYS.audio)
  return merged
}
