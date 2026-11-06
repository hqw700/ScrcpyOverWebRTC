import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import JSZip from 'jszip'
import { createConfiguredMagiskPackage, createMagiskConfigUpdates } from '../src/utils/magiskPackage.js'

async function moduleFixture() {
  const zip = new JSZip()
  zip.comment = 'module archive comment'
  const files = {
    'module.prop': 'id=cloudphone-agent\nversion=v0.4.4\n',
    'customize.sh': '#!/sbin/sh\nSKIPUNZIP=1\n',
    'service.sh': '#!/system/bin/sh\n',
    'uninstall.sh': '#!/system/bin/sh\n',
    'action.sh': '#!/system/bin/sh\n',
    'cloudphone-ctl': '#!/system/bin/sh\n',
    'libsys_core.so': new Uint8Array([0, 1, 255, 128]),
    'binaries/cloudphone-agent-arm64': new Uint8Array([127, 69, 76, 70]),
    'binaries/cloudphone-agent-armeabi-v7a': new Uint8Array([1, 2, 3]),
    'binaries/cloudphone-agent-amd64': new Uint8Array([4, 5, 6]),
    'META-INF/com/google/android/update-binary': '#!/sbin/sh\n',
    'META-INF/com/google/android/updater-script': '#MAGISK\n',
    'config.conf': '# preserve this comment\r\nENABLED=false\r\nCP_AGENT_ID="old"\r\nexport CP_AGENT_ID="duplicate"\r\nCP_AGENT_SNAPSHOT_INTERVAL="5"\r\nCUSTOM_OPTION="keep"\r\n',
  }
  for (const [name, data] of Object.entries(files)) {
    zip.file(name, data, { unixPermissions: name.endsWith('.sh') || name.includes('binaries/') ? 0o100755 : 0o100644,
      date: new Date('2026-10-01T00:00:00Z'), comment: `comment: ${name}` })
  }
  return zip.generateAsync({ type: 'uint8array', platform: 'UNIX', compression: 'DEFLATE' })
}

const options = { signalingUrl: 'https://example.invalid:8443/path?tenant=one', iceServers: 'turn:user:pass@example.invalid:3478',
  deviceId: 'phone-01', maxFps: 60, webrtcPort: 50001, videoCodecOptions: 'i-frame-interval=2', externalAddr: '192.0.2.1' }

test('only config.conf changes; payloads, paths, permissions, dates and comments survive', async () => {
  const original = await moduleFixture()
  let progress = 0
  const result = await createConfiguredMagiskPackage(original, options, { onProgress: p => { progress = p } })
  assert.equal(result.filename, 'cloudphone-agent-magisk-v0.4.4-phone-01.zip')
  assert.equal(progress, 100)
  const before = await JSZip.loadAsync(original, { checkCRC32: true })
  const after = await JSZip.loadAsync(result.data, { checkCRC32: true })
  assert.deepEqual(Object.keys(after.files), Object.keys(before.files))
  assert.equal(after.comment, before.comment)
  for (const [name, entry] of Object.entries(before.files)) {
    assert.equal(after.files[name].unixPermissions, entry.unixPermissions, name)
    assert.equal(after.files[name].date.getTime(), entry.date.getTime(), name)
    assert.equal(after.files[name].comment, entry.comment, name)
    if (name !== 'config.conf') assert.deepEqual(await after.files[name].async('uint8array'), await entry.async('uint8array'), name)
  }
  const config = await after.file('config.conf').async('string')
  assert(config.includes('# preserve this comment\n'))
  assert(config.includes('CP_AGENT_SNAPSHOT_INTERVAL="5"'))
  assert(config.includes('CUSTOM_OPTION="keep"'))
  assert(!config.includes('\r'))
  assert(!config.includes('old') && !config.includes('duplicate'))
})

test('shell metacharacters, quotes and JSON are literal when root sources the generated config', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'magisk-config-test-'))
  try {
    const marker = join(directory, 'must-not-exist')
    const values = { ...options, deviceId: `phone'"$HOME\\$(touch ${marker})\`touch ${marker}\``,
      iceServers: '[{"urls":"turn:example.invalid:3478","credential":"a\'$word`code`\\password"}]' }
    const { data } = await createConfiguredMagiskPackage(await moduleFixture(), values)
    const config = await (await JSZip.loadAsync(data)).file('config.conf').async('string')
    const file = join(directory, 'config.conf')
    await writeFile(file, config)
    const result = spawnSync('/bin/sh', ['-c', '. "$1"; printf "%s\\000%s\\000%s" "$CP_AGENT_ID" "$CP_AGENT_ICE_SERVERS" "$ENABLED"', 'test', file], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(result.stdout.split('\0'), [values.deviceId, values.iceServers, 'true'])
    await assert.rejects(readFile(marker), { code: 'ENOENT' })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('blank device ID supports fleet installs, and disabled watchdog is explicit', async () => {
  const { data, filename } = await createConfiguredMagiskPackage(await moduleFixture(), { ...options, deviceId: '', enabled: false, iceServers: '' })
  const config = await (await JSZip.loadAsync(data)).file('config.conf').async('string')
  assert.equal(filename, 'cloudphone-agent-magisk-v0.4.4-configured.zip')
  assert(config.includes('ENABLED=false\n'))
  assert(config.includes("CP_AGENT_ID=''"))
  assert(config.includes("CP_AGENT_ICE_SERVERS=''"))
})

test('normalizes signaling protocols and validates numeric fields', () => {
  for (const [input, page, expected] of [
    ['example.invalid:8443', 'http:', 'ws://example.invalid:8443'],
    ['https://example.invalid', 'http:', 'wss://example.invalid'],
    ['http://[::1]:8443/path', 'https:', 'ws://[::1]:8443/path'],
    ['wss://example.invalid/path?token=a&mode=b', 'https:', 'wss://example.invalid/path?token=a&mode=b'],
  ]) assert.equal(createMagiskConfigUpdates({ ...options, signalingUrl: input }, page).CP_AGENT_SIGNALING, expected)
  for (const input of ['', 'ftp://example.invalid', 'wss://user:pass@example.invalid', 'wss://example.invalid/#fragment', 'bad host']) {
    assert.throws(() => createMagiskConfigUpdates({ ...options, signalingUrl: input }), { code: 'invalidSignaling' })
  }
  for (const value of ['0', '65536', '50000-50100', '-1', '1e3']) {
    assert.throws(() => createMagiskConfigUpdates({ ...options, webrtcPort: value }), { code: 'invalidPort' })
  }
  assert.throws(() => createMagiskConfigUpdates({ ...options, maxFps: -1 }), { code: 'invalidMaxFps' })
  assert.throws(() => createMagiskConfigUpdates({ ...options, deviceId: 'one\ntwo' }), { code: 'invalidValue' })
})

test('rejects HTML fallback responses, incomplete modules and the wrong module ID', async () => {
  await assert.rejects(createConfiguredMagiskPackage(new TextEncoder().encode('<html>not found</html>'), options), { code: 'invalidArchive' })
  const incomplete = new JSZip().file('config.conf', 'ENABLED=true\n')
  await assert.rejects(createConfiguredMagiskPackage(await incomplete.generateAsync({ type: 'uint8array' }), options), { code: 'invalidPackage' })
  const wrongModule = await JSZip.loadAsync(await moduleFixture())
  wrongModule.file('module.prop', 'id=another-module\nversion=v1\n')
  await assert.rejects(createConfiguredMagiskPackage(await wrongModule.generateAsync({ type: 'uint8array' }), options), { code: 'invalidPackage' })
})

test('preset installer hooks are opt-in and do not accumulate when reconfiguring', async () => {
  const original = await moduleFixture()
  const preset = await createConfiguredMagiskPackage(original, { ...options, enabled: true, applyConfig: true })
  assert.equal(preset.enabled, true)
  assert.equal(preset.applyConfig, true)
  assert.equal(preset.filename, 'cloudphone-agent-magisk-v0.4.4-phone-01-apply-config.zip')
  const repeated = await createConfiguredMagiskPackage(preset.data, { ...options, applyConfig: true })
  const installer = await (await JSZip.loadAsync(repeated.data)).file('customize.sh').async('string')
  assert.equal(installer.match(/# CLOUDPHONE_PRESET_PREFLIGHT_BEGIN/g).length, 1)
  assert.equal(installer.match(/# CLOUDPHONE_PRESET_APPLY_BEGIN/g).length, 1)
  assert(installer.startsWith('#!/sbin/sh\n'))
  const cleared = await createConfiguredMagiskPackage(repeated.data, { ...options, applyConfig: false })
  const plain = await (await JSZip.loadAsync(cleared.data)).file('customize.sh').async('string')
  assert(!plain.includes('CLOUDPHONE_PRESET_'))
  assert(plain.includes('SKIPUNZIP=1'))
})

test('real installer preserves old config by default, applies explicit presets with backup, and handles fresh installs', async () => {
  const actualInstaller = await readFile(new URL('../../../scripts/magisk/customize.sh', import.meta.url), 'utf8')
  const sourceZip = await JSZip.loadAsync(await moduleFixture())
  sourceZip.file('customize.sh', actualInstaller, { unixPermissions: 0o100755 })
  const base = await sourceZip.generateAsync({ type: 'uint8array', platform: 'UNIX' })
  for (const { applyConfig, hasOldConfig } of [
    { applyConfig: false, hasOldConfig: true },
    { applyConfig: true, hasOldConfig: true },
    { applyConfig: true, hasOldConfig: false },
  ]) {
    const directory = await mkdtemp(join(tmpdir(), 'magisk-installer-test-'))
    try {
      const active = join(directory, 'active')
      const oldConfig = join(active, 'config.conf')
      await mkdir(active)
      const oldContent = 'ENABLED=false\nCP_AGENT_SIGNALING="wss://old.example.invalid:8443"\n'
      if (hasOldConfig) await writeFile(oldConfig, oldContent, { mode: 0o600 })
      const result = await createConfiguredMagiskPackage(base, { ...options, enabled: true, applyConfig })
      const zipFile = join(directory, 'module.zip')
      await writeFile(zipFile, result.data)
      const zip = await JSZip.loadAsync(result.data)
      const expectedConfig = await zip.file('config.conf').async('string')
      // Isolate Android absolute paths; execute the real installer with its
      // normal extraction/architecture/restore behavior and manager helpers.
      const installer = (await zip.file('customize.sh').async('string'))
        .replaceAll('/data/adb/modules/cloudphone-agent/config.conf', oldConfig)
        .replaceAll('/data/local/tmp/cloudphone-agent-config.conf.bak', join(directory, 'upgrade.bak'))
      const scriptFile = join(directory, 'customize.sh')
      await writeFile(scriptFile, installer)
      const destination = join(directory, 'staged')
      const command = 'ui_print() { :; }; abort() { printf "%s\\n" "$1" >&2; exit 1; }; set_perm() { chmod "$4" "$1"; }; . "$1"'
      const execution = spawnSync('/bin/sh', ['-c', command, 'test', scriptFile], {
        encoding: 'utf8', env: { ...process.env, ZIPFILE: zipFile, MODPATH: destination, ARCH: 'arm64' },
      })
      assert.equal(execution.status, 0, execution.stderr)
      assert.equal(await readFile(join(destination, 'config.conf'), 'utf8'),
        hasOldConfig && !applyConfig ? oldContent : expectedConfig)
      assert.equal((await stat(join(destination, 'config.conf'))).mode & 0o777, 0o600)
      const backup = join(destination, 'config.before-preset.conf')
      if (applyConfig && hasOldConfig) {
        assert.equal(await readFile(backup, 'utf8'), oldContent)
        assert.equal((await stat(backup)).mode & 0o777, 0o600)
      } else {
        await assert.rejects(readFile(backup), { code: 'ENOENT' })
      }
      assert.deepEqual(await readFile(join(destination, 'system/bin/cloudphone-agent')),
        Buffer.from(await zip.file('binaries/cloudphone-agent-arm64').async('uint8array')))
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }
})
