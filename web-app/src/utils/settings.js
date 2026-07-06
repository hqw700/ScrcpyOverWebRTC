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
  previewBitrate: 1
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
