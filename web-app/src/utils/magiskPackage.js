import JSZip from 'jszip'

export const MAX_MAGISK_PACKAGE_BYTES = 128 * 1024 * 1024

export class MagiskPackageError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

function configValue(value) {
  const text = String(value ?? '')
  if (/[\x00-\x1f\x7f]/.test(text)) throw new MagiskPackageError('invalidValue')
  return text.trim()
}

function signalingUrl(value, pageProtocol) {
  let address = configValue(value)
  if (!address || /\s/.test(address)) throw new MagiskPackageError('invalidSignaling')
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(address)) {
    address = `${pageProtocol === 'http:' ? 'ws' : 'wss'}://${address}`
  }
  try {
    const url = new URL(address)
    if (url.protocol === 'https:') url.protocol = 'wss:'
    if (url.protocol === 'http:') url.protocol = 'ws:'
    if (!['ws:', 'wss:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.hash) {
      throw new Error('invalidSignaling')
    }
    return url.pathname === '/' && !url.search ? url.href.replace(/\/$/, '') : url.href
  } catch {
    throw new MagiskPackageError('invalidSignaling')
  }
}

function integerValue(value, minimum, maximum, errorCode) {
  const text = configValue(value)
  if (!text) return ''
  const number = Number(text)
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(number) || number < minimum || number > maximum) {
    throw new MagiskPackageError(errorCode)
  }
  return String(number)
}

export function createMagiskConfigUpdates(options, pageProtocol = 'https:') {
  return {
    ENABLED: options.enabled === false ? 'false' : 'true',
    CP_AGENT_SIGNALING: signalingUrl(options.signalingUrl, pageProtocol),
    CP_AGENT_ICE_SERVERS: configValue(options.iceServers),
    CP_AGENT_ID: configValue(options.deviceId),
    CP_AGENT_MAX_FPS: integerValue(options.maxFps, 0, Number.MAX_SAFE_INTEGER, 'invalidMaxFps'),
    CP_AGENT_VIDEO_CODEC_OPTIONS: configValue(options.videoCodecOptions),
    CP_AGENT_EXTERNAL_ADDR: configValue(options.externalAddr),
    CP_AGENT_WEBRTC_PORT: integerValue(options.webrtcPort, 1, 65535, 'invalidPort'),
  }
}

function updateConfig(original, updates) {
  const seen = new Set()
  // Single quotes keep passwords, JSON, $, backticks, and backslashes literal
  // when the root watchdog sources config.conf. Escape embedded single quotes.
  // Keep the boolean unquoted for existing cpctl status/menu parsers.
  const assignment = (key, value) => key === 'ENABLED'
    ? `${key}=${value}` : `${key}='${value.replace(/'/g, "'\\''")}'`
  const lines = original.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  const output = lines.map(line => {
    const match = line.match(/^(\s*)(export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=.*$/)
    if (!match || !Object.prototype.hasOwnProperty.call(updates, match[3])) return line
    seen.add(match[3])
    return `${match[1]}${match[2] || ''}${assignment(match[3], updates[match[3]])}`
  })
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) output.push(assignment(key, value))
  }
  return `${output.join('\n')}\n`
}

function presetInstaller(original, applyConfig) {
  // An explicit opt-in hook works with existing v0.4.4 base modules. The normal
  // installer still handles architecture, permissions and configuration backup.
  const clean = original.replace(/\n?# CLOUDPHONE_PRESET_(PREFLIGHT|APPLY)_BEGIN\n[\s\S]*?# CLOUDPHONE_PRESET_\1_END\n?/g, '\n')
  if (!applyConfig) return clean
  const preflight = `# CLOUDPHONE_PRESET_PREFLIGHT_BEGIN
CP_PRESET_OLD_CONFIG="/data/adb/modules/cloudphone-agent/config.conf"
CP_PRESET_HAS_OLD_CONFIG=false
[ ! -f "$CP_PRESET_OLD_CONFIG" ] || CP_PRESET_HAS_OLD_CONFIG=true
# CLOUDPHONE_PRESET_PREFLIGHT_END
`
  const firstNewline = clean.indexOf('\n')
  const installer = clean.startsWith('#!') && firstNewline !== -1
    ? `${clean.slice(0, firstNewline + 1)}${preflight}${clean.slice(firstNewline + 1)}`
    : `${preflight}${clean}`
  return `${installer.replace(/\n*$/, '\n')}
# CLOUDPHONE_PRESET_APPLY_BEGIN
ui_print "- Applying package configuration..."
if [ "$CP_PRESET_HAS_OLD_CONFIG" = "true" ]; then
    cp -af "$CP_PRESET_OLD_CONFIG" "$MODPATH/config.before-preset.conf" || abort "! Failed to back up existing configuration."
    set_perm "$MODPATH/config.before-preset.conf" 0 0 0600
fi
unzip -p "$ZIPFILE" config.conf > "$MODPATH/config.conf.preset" || abort "! Failed to extract package configuration."
set_perm "$MODPATH/config.conf.preset" 0 0 0600
mv -f "$MODPATH/config.conf.preset" "$MODPATH/config.conf" || abort "! Failed to apply package configuration."
# CLOUDPHONE_PRESET_APPLY_END
`
}

function replaceTextEntry(zip, entry, content) {
  zip.file(entry.name, content, {
    date: entry.date,
    comment: entry.comment,
    unixPermissions: entry.unixPermissions,
    dosPermissions: entry.dosPermissions,
    createFolders: false,
  })
}

export async function createConfiguredMagiskPackage(data, options, { pageProtocol = 'https:', onProgress } = {}) {
  const updates = createMagiskConfigUpdates(options, pageProtocol)
  if (data.byteLength > MAX_MAGISK_PACKAGE_BYTES) throw new MagiskPackageError('packageTooLarge')
  let zip
  try {
    zip = await JSZip.loadAsync(data, { checkCRC32: true, createFolders: false })
  } catch {
    throw new MagiskPackageError('invalidArchive')
  }

  const required = ['module.prop', 'customize.sh', 'service.sh', 'uninstall.sh', 'action.sh',
    'config.conf', 'cloudphone-ctl', 'libsys_core.so']
  const binaries = ['arm64', 'armeabi-v7a', 'amd64'].map(arch => `binaries/cloudphone-agent-${arch}`)
  if (required.some(name => !zip.file(name)) || !binaries.some(name => zip.file(name))) {
    throw new MagiskPackageError('invalidPackage')
  }
  for (const entry of Object.values(zip.files)) {
    if ((entry.unsafeOriginalName && entry.unsafeOriginalName !== entry.name) ||
        entry.name.startsWith('/') || entry.name.includes('\\')) {
      throw new MagiskPackageError('invalidPackage')
    }
  }
  const properties = await zip.file('module.prop').async('string')
  if (!/^id=cloudphone-agent\s*$/m.test(properties)) throw new MagiskPackageError('invalidPackage')
  const version = properties.match(/^version=(.+)$/m)?.[1].trim() || ''
  const configEntry = zip.file('config.conf')
  const original = await configEntry.async('string')
  if (original.length > 65536) throw new MagiskPackageError('invalidPackage')
  replaceTextEntry(zip, configEntry, updateConfig(original, updates))
  const installerEntry = zip.file('customize.sh')
  const installer = await installerEntry.async('string')
  const applyConfig = options.applyConfig === true
  const configuredInstaller = presetInstaller(installer, applyConfig)
  if (configuredInstaller !== installer) replaceTextEntry(zip, installerEntry, configuredInstaller)

  const result = await zip.generateAsync({
    type: 'uint8array', platform: 'UNIX', compression: 'DEFLATE', compressionOptions: { level: 6 },
  }, metadata => onProgress?.(Math.round(metadata.percent)))
  const safePart = value => value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64)
  const suffix = safePart(updates.CP_AGENT_ID) || 'configured'
  const versionPart = safePart(version)
  return {
    data: result,
    filename: `cloudphone-agent-magisk${versionPart ? `-${versionPart}` : ''}-${suffix}${applyConfig ? '-apply-config' : ''}.zip`,
    version,
    enabled: updates.ENABLED === 'true',
    applyConfig,
  }
}
