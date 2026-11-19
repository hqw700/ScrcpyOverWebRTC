<template>
  <div
    ref="editorRef"
    class="keymap-editor"
    :class="{ 'is-editing': isEditing }"
    :tabindex="isEditing ? -1 : undefined"
    @keydown.esc="onEscape"
  >
    <div
      ref="overlayRef"
      class="keymap-overlay"
      :class="{ 'is-placing': placement }"
      @pointerdown="onStagePointerDown"
    >
      <div v-if="isEditing && videoRect" class="video-area-indicator" :style="videoAreaStyle"></div>
      <svg v-if="videoRect && overlayRect" class="swipe-lines" aria-hidden="true">
        <defs>
          <marker :id="arrowId" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0 0L7 3.5L0 7Z" fill="context-stroke" />
          </marker>
        </defs>
        <line
          v-for="map in swipeMappings"
          :key="map.id"
          :x1="getPosPixel(map.startPos).x"
          :y1="getPosPixel(map.startPos).y"
          :x2="getPosPixel(map.endPos).x"
          :y2="getPosPixel(map.endPos).y"
          :class="{ 'is-selected': isEditing && selectedId === map.id }"
          :marker-end="`url(#${arrowId})`"
        />
      </svg>

      <template v-if="videoRect && overlayRect">
        <div
          v-if="placement?.start"
          class="key-node placement-start"
          :style="getPositionStyle(placement.start)"
          aria-hidden="true"
        ></div>
        <template v-for="map in screenMappings" :key="map.id">
          <button
            type="button"
            class="key-node"
            :class="[
              `node-${map.type}`,
              { 'is-selected': isEditing && selectedId === map.id, 'is-hint': !isEditing }
            ]"
            :style="getPositionStyle(getMappingPosition(map))"
            :tabindex="isEditing ? 0 : -1"
            :aria-hidden="!isEditing"
            :aria-pressed="isEditing ? selectedId === map.id : undefined"
            :title="`${$t(toolLabels[map.type])} · ${mappingLabel(map)}`"
            @pointerdown.stop="startDrag($event, map)"
            @pointermove="moveDrag"
            @lostpointercapture="endDrag"
            @click.stop="selectNode(map)"
          >
            <span v-if="map.type === 'joystick'" class="joystick-radius" :style="getJoystickRadiusStyle(map)"></span>
            <span class="node-label">{{ mappingLabel(map) }}</span>
          </button>
          <button
            v-if="map.type === 'swipe' && isEditing"
            type="button"
            class="key-node swipe-end"
            :class="{ 'is-selected': selectedId === map.id }"
            :style="getPositionStyle(map.endPos)"
            :title="$t('keymap.swipeEnd')"
            @pointerdown.stop="startDrag($event, map, 'endPos')"
            @pointermove="moveDrag"
            @lostpointercapture="endDrag"
            @click.stop="selectNode(map)"
          ><span>{{ $t('keymap.swipeEnd') }}</span></button>
        </template>
      </template>
    </div>

    <div v-if="isEditing" class="editor-chrome">
      <section class="editor-panel" :aria-label="$t('keymap.title')">
        <header class="editor-header">
          <h2>{{ $t('keymap.title') }}</h2>
          <div class="button-row">
            <button type="button" class="editor-button quiet" @click="cancelEdit">{{ $t('common.cancel') }}</button>
            <button type="button" class="editor-button primary" :disabled="!!placement" @click="saveEdit">{{ $t('common.save') }}</button>
          </div>
        </header>
        <div class="profile-row">
          <label class="profile-field">
            <span>{{ $t('keymap.profile') }}</span>
            <select :value="keymapStore.activeProfile?.id" @change="onProfileChange">
              <option v-for="profile in keymapStore.config.profiles" :key="profile.id" :value="profile.id">{{ profile.name }}</option>
            </select>
          </label>
          <button type="button" class="editor-button quiet" :aria-expanded="showProfileActions" @click="showProfileActions = !showProfileActions">
            {{ $t('keymap.manageProfiles') }}
          </button>
        </div>
        <div v-if="showProfileActions" class="profile-actions button-row">
          <button type="button" class="editor-button" @click="createNewProfile">{{ $t('keymap.newProfile') }}</button>
          <button type="button" class="editor-button" @click="renameCurrentProfile">{{ $t('keymap.renameProfile') }}</button>
          <button type="button" class="editor-button" @click="importProfile">{{ $t('keymap.importProfile') }}</button>
          <button type="button" class="editor-button" @click="exportProfile">{{ $t('keymap.exportProfile') }}</button>
          <button v-if="keymapStore.config.profiles.length > 1" type="button" class="editor-button danger" @click="deleteCurrentProfile">{{ $t('keymap.deleteProfile') }}</button>
          <label class="hint-toggle"><input v-model="keymapStore.showKeyHints" type="checkbox" /> {{ $t('keymap.showKeyHints') }}</label>
        </div>
        <div class="tool-row">
          <button
            v-for="(label, type) in toolLabels"
            :key="type"
            type="button"
            class="editor-button tool-button"
            :aria-pressed="placement?.type === type"
            :disabled="!videoRect || (type === 'joystick' && hasJoystick)"
            :title="!videoRect ? $t('keymap.unplacedTool') : undefined"
            @click="startPlacement(type)"
          >
            <svg class="tool-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path v-if="type === 'tap'" d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0-5a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z" />
              <path v-else-if="type === 'swipe'" d="M4 12h15m-5-5 5 5-5 5" />
              <path v-else-if="type === 'joystick'" d="M5 12h14m-7-7v14M5 12l2-2m-2 2 2 2m12-2-2-2m2 2-2 2m-5-9-2 2m2-2 2 2m-2 12-2-2m2 2 2-2" />
              <path v-else d="M8 3h8a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm4 4v4" />
            </svg>
            {{ $t(label) }}
          </button>
        </div>
      </section>

      <section v-if="placement" class="editor-panel editor-footer placement-panel">
        <p role="status">{{ $t(placementMessage) }}</p>
        <button type="button" class="editor-button quiet" @click="cancelPlacement">{{ $t('common.cancel') }}</button>
      </section>
      <section v-else-if="selectedNode" class="editor-panel editor-footer node-settings" :aria-label="$t(toolLabels[selectedNode.type])">
        <header class="settings-header">
          <h3>{{ $t(toolLabels[selectedNode.type]) }}</h3>
          <button type="button" class="editor-button quiet danger" @click="deleteSelected">{{ $t('common.delete') }}</button>
        </header>
        <div class="setting-fields">
          <button
            v-if="isKeyBinding(selectedNode)"
            ref="bindButton"
            type="button"
            class="editor-button bind-button"
            :class="{ 'is-capturing': isCapturing }"
            @click="beginKeyCapture"
            @keydown="onKeyBind"
            @blur="isCapturing = false"
          >
            <span v-if="isCapturing" role="status">{{ $t('keymap.waitingForKey') }}</span>
            <template v-else>
              {{ $t('keymap.chooseKey') }}
              <kbd v-if="selectedNode.key">{{ formatKey(selectedNode.key) }}</kbd>
            </template>
          </button>
          <label v-if="selectedNode.type === 'swipe'" class="setting-field">
            <span>{{ $t('keymap.swipeDuration') }}</span>
            <input v-model.number="selectedNode.duration" type="number" min="50" max="2000" step="50" />
            <span>ms</span>
          </label>
          <label v-if="selectedNode.type === 'joystick'" class="setting-field radius-field">
            <span>{{ $t('keymap.joystickSize') }}</span>
            <input v-model.number="selectedNode.radius" type="range" min="0.05" max="0.3" step="0.01" />
          </label>
          <label v-if="selectedNode.type === 'wheel'" class="setting-field wheel-field">
            <span>{{ $t('keymap.wheelAction') }}</span>
            <select v-model="selectedNode.action">
              <option value="scroll">{{ $t('keymap.wheelScroll') }}</option>
              <option value="zoom">{{ $t('keymap.wheelZoom') }}</option>
            </select>
          </label>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isValidProfile, useKeymapStore } from '@/stores/keymap'
import { getRenderedVideoRect } from '@/utils/renderedVideo'

const props = defineProps({
  isEditing: Boolean,
  mediaElement: Object,
  videoSize: { type: Object, required: true },
  rotated: Boolean
})
const emit = defineEmits(['close'])

const { t } = useI18n()
const keymapStore = useKeymapStore()
const arrowId = `keymap-arrow-${useId()}`
const editorRef = ref(null)
const overlayRef = ref(null)
const bindButton = ref(null)
const editableMappings = ref([])
const selectedId = ref(null)
const placement = ref(null)
const isCapturing = ref(false)
const showProfileActions = ref(false)
const videoRect = ref(null)
const overlayRect = ref(null)
let drag = null
let resizeObserver
let nextMappingId = 0

const toolLabels = {
  tap: 'keymap.addTap',
  swipe: 'keymap.addSwipe',
  joystick: 'keymap.addJoystick',
  wheel: 'keymap.addWheel'
}

const displayMappings = computed(() => props.isEditing
  ? editableMappings.value
  : keymapStore.activeProfile?.mappings ?? [])
const screenMappings = computed(() => displayMappings.value.filter(map => Object.hasOwn(toolLabels, map.type)))
const swipeMappings = computed(() => screenMappings.value.filter(map => map.type === 'swipe'))
const selectedNode = computed(() => editableMappings.value.find(map => map.id === selectedId.value))
const hasJoystick = computed(() => editableMappings.value.some(map => map.type === 'joystick'))
const hasChanges = computed(() => JSON.stringify(editableMappings.value) !== JSON.stringify(keymapStore.activeProfile?.mappings))
const placementMessage = computed(() => {
  if (placement.value?.type !== 'swipe') return 'keymap.placeOnScreen'
  return placement.value.start ? 'keymap.placeSwipeEnd' : 'keymap.placeSwipeStart'
})

watch([() => props.isEditing, () => keymapStore.activeProfile?.id], async ([isEditing]) => {
  endDrag()
  isCapturing.value = false
  placement.value = null
  selectedId.value = null
  showProfileActions.value = false
  if (!isEditing) return
  editableMappings.value = JSON.parse(JSON.stringify(keymapStore.activeProfile?.mappings ?? []))
  await nextTick()
  if (props.isEditing) editorRef.value?.focus({ preventScroll: true })
}, { immediate: true })

watch([overlayRef, () => props.mediaElement], () => {
  resizeObserver?.disconnect()
  if (!resizeObserver) resizeObserver = new ResizeObserver(updateRects)
  if (overlayRef.value) resizeObserver.observe(overlayRef.value)
  if (props.mediaElement) resizeObserver.observe(props.mediaElement)
  updateRects()
}, { flush: 'post' })

watch([() => props.videoSize, () => props.rotated], updateRects, { flush: 'post' })

onUnmounted(() => {
  resizeObserver?.disconnect()
  endDrag()
})

function updateRects() {
  const { width, height } = props.videoSize
  videoRect.value = getRenderedVideoRect(props.mediaElement, width, height, props.rotated)
  overlayRect.value = overlayRef.value?.getBoundingClientRect() ?? null
}

const videoAreaStyle = computed(() => {
  if (!videoRect.value || !overlayRect.value) return {}
  const video = videoRect.value
  const overlay = overlayRect.value
  return {
    left: `${video.left - overlay.left}px`,
    top: `${video.top - overlay.top}px`,
    width: `${video.width}px`,
    height: `${video.height}px`
  }
})

function clientToNormalized(clientX, clientY, clamp = false) {
  const video = videoRect.value
  if (!video) return null
  let x = (clientX - video.left) / video.width
  let y = (clientY - video.top) / video.height
  if (clamp) {
    x = Math.max(0, Math.min(1, x))
    y = Math.max(0, Math.min(1, y))
  } else if (x < 0 || x > 1 || y < 0 || y > 1) {
    return null
  }
  return props.rotated ? { x: y, y: 1 - x } : { x, y }
}

function getPosPixel(pos) {
  const video = videoRect.value
  const overlay = overlayRect.value
  const x = props.rotated ? 1 - pos.y : pos.x
  const y = props.rotated ? pos.x : pos.y
  return {
    x: video.left + x * video.width - overlay.left,
    y: video.top + y * video.height - overlay.top
  }
}

function getPositionStyle(pos) {
  const { x, y } = getPosPixel(pos)
  return { left: `${x}px`, top: `${y}px` }
}

function getMappingPosition(map) {
  return map.type === 'joystick' ? map.center : map.type === 'swipe' ? map.startPos : map.pos
}

function getJoystickRadiusStyle(map) {
  const video = videoRect.value
  const diameter = 2 * map.radius * (props.rotated ? video.height : video.width)
  return { width: `${diameter}px`, height: `${diameter}px` }
}

function isKeyBinding(map) {
  return map.type === 'tap' || map.type === 'swipe'
}

function formatKey(key) {
  return key === ' ' ? t('keymap.spaceKey') : key.toUpperCase()
}

function mappingLabel(map) {
  if (isKeyBinding(map)) return map.key ? formatKey(map.key) : '?'
  if (map.type === 'joystick') return ['up', 'left', 'down', 'right'].map(dir => formatKey(map.keys[dir])).join(' ')
  return t(map.action === 'zoom' ? 'keymap.wheelZoom' : 'keymap.addWheel')
}

function confirmDiscard() {
  return (!hasChanges.value && !placement.value?.start) || confirm(t('keymap.discardDraft'))
}

function onProfileChange(event) {
  const select = event.target
  if (!confirmDiscard()) {
    select.value = keymapStore.activeProfile.id
    return
  }
  keymapStore.setActiveProfile(select.value)
}

function createNewProfile() {
  const name = prompt(t('keymap.newProfilePrompt'), t('keymap.newProfile'))?.trim()
  if (name && confirmDiscard()) keymapStore.addProfile(name)
}

function renameCurrentProfile() {
  const profile = keymapStore.activeProfile
  const name = prompt(t('keymap.renameProfilePrompt'), profile.name)?.trim()
  if (name && name !== profile.name) keymapStore.renameProfile(profile.id, name)
}

function deleteCurrentProfile() {
  if (confirm(t('keymap.confirmDelete'))) keymapStore.deleteProfile(keymapStore.activeProfile.id)
}

function exportProfile() {
  const profile = { ...keymapStore.activeProfile, mappings: editableMappings.value }
  const link = document.createElement('a')
  link.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(profile, null, 2))
  link.download = `cloudphone_keymap_${profile.name}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function importProfile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = async () => {
    const file = input.files[0]
    if (!file) return
    let profile
    try {
      profile = JSON.parse(await file.text())
    } catch {
      if (editorRef.value && props.isEditing) alert(t('keymap.readFileFailed'))
      return
    }
    if (!editorRef.value || !props.isEditing) return

    const imported = { ...profile, id: 'p_' + Date.now() }
    if (!isValidProfile(imported)) {
      alert(t('keymap.invalidFormat'))
      return
    }
    if (confirmDiscard()) keymapStore.importProfile(imported)
  }
  input.click()
}

function startPlacement(type) {
  showProfileActions.value = false
  if (placement.value?.type === type) {
    cancelPlacement()
    return
  }
  placement.value = { type, start: null }
  editorRef.value?.focus({ preventScroll: true })
}

function cancelPlacement() {
  placement.value = null
  editorRef.value?.focus({ preventScroll: true })
}

async function onStagePointerDown(event) {
  if (!props.isEditing || event.button !== 0 || !event.isPrimary) return
  event.preventDefault()
  editorRef.value?.focus({ preventScroll: true })
  if (!placement.value) {
    selectedId.value = null
    showProfileActions.value = false
    return
  }

  updateRects()
  const pos = clientToNormalized(event.clientX, event.clientY)
  if (!pos) return

  const { type, start } = placement.value
  if (type === 'swipe' && !start) {
    placement.value.start = pos
    return
  }
  if (type === 'swipe' && start.x === pos.x && start.y === pos.y) return

  const id = `m_${Date.now()}_${++nextMappingId}`
  const map = { id, type }
  switch (type) {
    case 'tap':
      Object.assign(map, { key: '', pos })
      break
    case 'swipe':
      Object.assign(map, { key: '', startPos: start, endPos: pos, duration: 150 })
      break
    case 'joystick':
      Object.assign(map, { center: pos, keys: { up: 'w', down: 's', left: 'a', right: 'd' }, radius: 0.1 })
      break
    case 'wheel':
      Object.assign(map, { pos, action: 'scroll' })
      break
  }
  editableMappings.value.push(map)
  placement.value = null
  selectNode(map)
  if (isKeyBinding(map)) {
    await nextTick()
    if (props.isEditing && selectedId.value === id) beginKeyCapture()
  }
}

function selectNode(map) {
  if (!props.isEditing || placement.value || selectedId.value === map.id) return
  isCapturing.value = false
  selectedId.value = map.id
}

function deleteSelected() {
  editableMappings.value = editableMappings.value.filter(map => map.id !== selectedId.value)
  selectedId.value = null
  isCapturing.value = false
  editorRef.value?.focus({ preventScroll: true })
}

function beginKeyCapture() {
  isCapturing.value = true
  bindButton.value?.focus({ preventScroll: true })
}

function onKeyBind(event) {
  if (!isCapturing.value || event.isComposing || event.key === 'Tab' || event.key === 'Escape') return
  if (event.ctrlKey || event.metaKey || event.altKey) return
  event.preventDefault()
  event.stopPropagation()
  if (event.repeat || ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Dead', 'Unidentified'].includes(event.key)) return
  selectedNode.value.key = event.key.toLowerCase()
  isCapturing.value = false
  // Suppress the synthesized click from a captured Space keyup.
  editorRef.value?.focus({ preventScroll: true })
}

function startDrag(event, map, positionField) {
  if (!props.isEditing || event.button !== 0 || !event.isPrimary) return
  if (placement.value) {
    onStagePointerDown(event)
    return
  }

  selectNode(map)
  const element = event.currentTarget
  const bounds = element.getBoundingClientRect()
  drag = {
    map,
    field: positionField ?? (map.type === 'joystick' ? 'center' : map.type === 'swipe' ? 'startPos' : 'pos'),
    pointerId: event.pointerId,
    element,
    offsetX: event.clientX - (bounds.left + bounds.width / 2),
    offsetY: event.clientY - (bounds.top + bounds.height / 2)
  }
  element.setPointerCapture(event.pointerId)
}

function moveDrag(event) {
  if (!drag || event.pointerId !== drag.pointerId) return
  updateRects()
  const pos = clientToNormalized(event.clientX - drag.offsetX, event.clientY - drag.offsetY, true)
  if (pos) drag.map[drag.field] = pos
}

function endDrag(event) {
  if (!drag || (event && event.pointerId !== drag.pointerId)) return
  const { element, pointerId } = drag
  drag = null
  if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId)
}

function onEscape(event) {
  if (event.isComposing) return
  event.preventDefault()
  event.stopPropagation()
  if (event.repeat) return
  if (isCapturing.value) {
    isCapturing.value = false
  } else if (placement.value) {
    cancelPlacement()
  } else if (showProfileActions.value) {
    showProfileActions.value = false
  } else if (selectedId.value !== null) {
    selectedId.value = null
    editorRef.value?.focus({ preventScroll: true })
  } else {
    cancelEdit()
  }
}

function cancelEdit() {
  if (confirmDiscard()) emit('close')
}

function saveEdit() {
  if (placement.value) return
  const mappings = editableMappings.value
  for (const map of mappings) {
    if (map.type === 'swipe') {
      map.duration = Math.max(50, Math.min(2000, Number(map.duration) || 150))
    }
  }
  keymapStore.updateProfile({ ...keymapStore.activeProfile, mappings })
  emit('close')
}
</script>

<style scoped>
.keymap-editor {
  --editor-surface: #151a23;
  --editor-control: #222a37;
  --editor-border: #384255;
  --editor-ink: #f0f3fa;
  --editor-muted: #b3bed0;
  --editor-focus: #9cb9ff;
  position: absolute;
  inset: 0;
  z-index: 2500;
  overflow: hidden;
  pointer-events: none;
  color: var(--editor-ink);
  color-scheme: dark;
  font-size: 13px;
  line-height: 1.35;
}

.keymap-editor.is-editing {
  background: rgb(10 14 22 / 18%);
  pointer-events: auto;
  outline: none;
}

.keymap-overlay {
  position: absolute;
  inset: 0;
  touch-action: none;
}

.keymap-overlay.is-placing,
.keymap-overlay.is-placing .key-node {
  cursor: crosshair;
}

.video-area-indicator {
  position: absolute;
  box-sizing: border-box;
  border: 1px dashed rgb(184 207 255 / 52%);
  pointer-events: none;
}

.swipe-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  stroke: #b4c9f1;
  stroke-width: 2;
  stroke-dasharray: 5 4;
  opacity: 0.65;
  pointer-events: none;
}

.swipe-lines .is-selected {
  stroke: var(--editor-focus);
  stroke-dasharray: none;
}

.key-node {
  position: absolute;
  box-sizing: border-box;
  transform: translate(-50%, -50%);
  min-width: 34px;
  min-height: 34px;
  max-width: 100%;
  padding: 4px 8px;
  border: 1px solid #7386a4;
  border-radius: 9px;
  background: rgb(19 28 44 / 90%);
  color: #f5f7ff;
  font: inherit;
  font-weight: 650;
  white-space: nowrap;
  box-shadow: 0 2px 8px #080e1d80;
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.key-node.is-selected,
.placement-start {
  z-index: 1;
  border-color: var(--editor-focus);
  background: #2b4170;
  box-shadow: 0 0 0 3px rgb(156 185 255 / 24%);
}

.key-node.is-hint {
  opacity: 0.58;
  pointer-events: none;
}

.node-joystick,
.node-wheel {
  border-color: #62b6b2;
}

.swipe-end {
  min-height: 27px;
  border-style: dashed;
  font-size: 11px;
}

.node-label {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.placement-start {
  min-width: 14px;
  min-height: 14px;
  width: 14px;
  height: 14px;
  padding: 0;
  border-radius: 50%;
  pointer-events: none;
}

.joystick-radius {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
  border: 1px dashed #62b6b2;
  border-radius: 50%;
  opacity: 0.8;
  pointer-events: none;
}

.editor-chrome {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px;
  pointer-events: none;
  container-type: inline-size;
}

.editor-panel {
  box-sizing: border-box;
  width: min(100%, 510px);
  min-height: 0;
  max-height: 50%;
  padding: 10px;
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--editor-border);
  border-radius: 12px;
  background: var(--editor-surface);
  box-shadow: 0 8px 22px rgb(0 0 0 / 36%);
  pointer-events: auto;
}

.editor-header,
.profile-row,
.settings-header,
.placement-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px 10px;
}

.editor-header h2,
.settings-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 650;
}

.profile-row,
.profile-actions,
.tool-row,
.setting-fields {
  margin-top: 8px;
}

.button-row,
.tool-row,
.setting-fields {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.profile-field,
.hint-toggle,
.setting-field {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--editor-muted);
}

.profile-field {
  flex: 1 1 120px;
}

.profile-field select,
.wheel-field select {
  flex: 1;
  min-width: 0;
}

.editor-panel select,
.editor-panel input[type='number'],
.editor-button {
  box-sizing: border-box;
  min-height: 32px;
  border: 1px solid var(--editor-border);
  border-radius: 6px;
  background: var(--editor-control);
  color: var(--editor-ink);
  font: inherit;
}

.editor-panel select,
.editor-panel input[type='number'] {
  padding: 3px 6px;
}

.editor-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  flex-shrink: 0;
  padding: 3px 9px;
  cursor: pointer;
  white-space: nowrap;
}

.editor-button:hover:not(:disabled) {
  border-color: #6e82a6;
  background: #303e55;
}

.editor-button:disabled {
  opacity: 0.47;
  cursor: default;
}

.editor-button.quiet {
  border-color: transparent;
  background: transparent;
  color: var(--editor-muted);
}

.editor-button.primary {
  border-color: #a8bfff;
  background: #a8bfff;
  color: #101b34;
  font-weight: 700;
}

.editor-button.primary:hover:not(:disabled) {
  border-color: #c4d2ff;
  background: #c4d2ff;
}

.editor-button.danger {
  color: #ffacb1;
}

.editor-button[aria-pressed='true'],
.bind-button.is-capturing {
  border-color: var(--editor-focus);
  background: #293d68;
  color: #eef3ff;
}

.editor-button:focus-visible,
.key-node:focus-visible,
.editor-panel input:focus-visible,
.editor-panel select:focus-visible {
  outline: 2px solid var(--editor-focus);
  outline-offset: 2px;
}

.tool-button {
  flex: 1 0 auto;
}

.tool-icon {
  flex: 0 0 15px;
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.editor-footer {
  max-height: 38%;
  margin-top: auto;
}

.placement-panel p {
  margin: 0;
}

.setting-field {
  flex-wrap: wrap;
}

.setting-field input[type='number'] {
  width: 70px;
}

.radius-field,
.wheel-field {
  flex: 1 1 auto;
}

.radius-field input {
  flex: 1;
  min-width: 56px;
  margin: 0;
  accent-color: var(--editor-focus);
}

.bind-button {
  max-width: 100%;
  white-space: normal;
}

kbd {
  padding: 1px 5px;
  border: 1px solid #526282;
  border-radius: 4px;
  font-family: inherit;
  font-weight: 650;
}

@container (max-width: 330px) {
  .tool-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(max-content, 1fr));
  }
}
</style>
