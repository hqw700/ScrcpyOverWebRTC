<template>
  <div v-if="visible" class="modal-overlay animate-fade-in" @click.self="$emit('close')">
    <div class="modal-card batch-text-modal" @click.stop>
      <!-- 弹窗头部 -->
      <header class="modal-header">
        <div class="header-left">
          <span class="header-icon">💬</span>
          <h3 class="modal-title">群控批量文本下发</h3>
        </div>
        <button class="close-btn" @click="$emit('close')" title="关闭">✕</button>
      </header>

      <!-- 弹窗主体 -->
      <div class="modal-body custom-scrollbar">
        <!-- 1. 目标设备展示条 -->
        <div class="target-strip">
          <div class="strip-title-row">
            <span class="strip-label">
              下发目标设备 (共 <b>{{ currentTargets.length }}</b> 台):
            </span>
            <button 
              v-if="currentTargets.length > 1" 
              class="strip-clear-btn" 
              @click="currentTargets = []"
              title="清空当前目标"
            >
              清空
            </button>
          </div>
          <div class="strip-chips-wrap custom-scrollbar">
            <span 
              v-for="id in currentTargets" 
              :key="id" 
              class="device-chip"
            >
              <span class="chip-dot"></span>
              <span class="chip-name">{{ id }}</span>
              <button 
                class="chip-remove-btn" 
                @click.stop="removeTarget(id)" 
                title="剔除此设备"
              >×</button>
            </span>
            <div v-if="currentTargets.length === 0" class="strip-empty-warning">
              ⚠️ 未勾选任何下发目标，请先选择设备
            </div>
          </div>
        </div>

        <!-- 2. 常用快速短语选填区 -->
        <div class="quick-texts-section">
          <div class="qt-header-row">
            <span class="qt-section-label">⚡ 常用快速短语 (点击填入):</span>
            <button 
              v-if="inputContent.trim() && !isSavingNew" 
              class="save-as-qt-btn" 
              @click="openSaveAsQt"
              title="将当前输入的文本保存为新的常用短语"
            >
              + 存为新短语
            </button>
          </div>

          <div class="qt-pills-list custom-scrollbar">
            <button 
              v-for="qt in quickTextStore.quickTexts" 
              :key="qt.id" 
              class="qt-pill"
              :title="qt.content"
              @click="applyQuickText(qt)"
            >
              <span class="qt-pill-title">{{ qt.title }}</span>
              <span class="qt-pill-badge" v-if="qt.autoEnter" title="追加回车">↵</span>
            </button>
            <div v-if="quickTextStore.quickTexts.length === 0" class="qt-empty-hint">
              暂无预设短语，可在下方输入并保存
            </div>
          </div>

          <!-- 保存为新短语小表单 -->
          <div v-if="isSavingNew" class="save-qt-box animate-fade-in">
            <input 
              v-model="newQtTitle" 
              placeholder="短语标题（如：登录欢迎语、测试密码）" 
              class="save-qt-input"
              @keyup.enter="saveAsQuickText"
              ref="newTitleInputRef"
            />
            <div class="save-qt-actions">
              <button class="save-qt-cancel" @click="isSavingNew = false">取消</button>
              <button 
                class="save-qt-confirm" 
                @click="saveAsQuickText" 
                :disabled="!newQtTitle.trim()"
              >
                保存到短语库
              </button>
            </div>
          </div>
        </div>

        <!-- 3. 文本输入主工作区 -->
        <div class="text-editor-section">
          <textarea 
            v-model="inputContent" 
            ref="textareaRef"
            placeholder="在此输入要下发到已选设备的文本内容（100% 汉字支持、换行、测试文案、账号密码、Emoji 等）..." 
            class="batch-textarea custom-scrollbar" 
            rows="4"
          ></textarea>

          <div class="editor-tools-row">
            <div class="tools-left">
              <label class="auto-enter-label" title="文本落屏后自动敲击一次回车键 (KEYCODE_ENTER)">
                <input type="checkbox" v-model="autoEnter" class="checkbox-input" />
                <span class="checkbox-text">追加 Enter 回车</span>
              </label>
              <span class="char-count">{{ inputContent.length }} 字符</span>
            </div>
            <div class="tools-right">
              <button 
                class="clear-text-btn" 
                @click="inputContent = ''" 
                :disabled="!inputContent"
              >
                清空输入
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 弹窗底部操作栏 -->
      <footer class="modal-footer">
        <button class="btn-cancel" @click="$emit('close')">取消</button>
        <button 
          class="btn-send" 
          :disabled="!inputContent.trim() || currentTargets.length === 0 || isSending"
          @click="handleSend"
        >
          {{ isSending ? '正在批量下发...' : `🚀 一键下发至已选 (${currentTargets.length} 台设备)` }}
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useQuickTextStore } from '@/stores/quickTexts'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  targetDeviceIds: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'sent'])

const quickTextStore = useQuickTextStore()

const currentTargets = ref([])
const inputContent = ref('')
const autoEnter = ref(false)
const isSending = ref(false)
const textareaRef = ref(null)

// 保存新短语状态
const isSavingNew = ref(false)
const newQtTitle = ref('')
const newTitleInputRef = ref(null)

watch(() => props.visible, (val) => {
  if (val) {
    currentTargets.value = [...props.targetDeviceIds]
    inputContent.value = ''
    autoEnter.value = false
    isSending.value = false
    isSavingNew.value = false
    newQtTitle.value = ''
    quickTextStore.fetchQuickTexts()
    nextTick(() => {
      if (textareaRef.value) {
        textareaRef.value.focus()
      }
    })
  }
}, { immediate: true })

function removeTarget(id) {
  currentTargets.value = currentTargets.value.filter(item => item !== id)
}

function applyQuickText(qt) {
  if (!qt) return
  inputContent.value = qt.content
  if (qt.autoEnter !== undefined) {
    autoEnter.value = qt.autoEnter
  }
}

function openSaveAsQt() {
  isSavingNew.value = true
  newQtTitle.value = ''
  nextTick(() => {
    if (newTitleInputRef.value) {
      newTitleInputRef.value.focus()
    }
  })
}

function saveAsQuickText() {
  const title = newQtTitle.value.trim()
  const content = inputContent.value
  if (!title || !content) return

  quickTextStore.addQuickText({
    title,
    content,
    autoEnter: autoEnter.value
  })

  isSavingNew.value = false
  newQtTitle.value = ''
}

async function handleSend() {
  const text = inputContent.value
  const targets = [...currentTargets.value]
  if (!text.trim() || targets.length === 0 || isSending.value) return

  isSending.value = true
  try {
    quickTextStore.batchInject(targets, text, { autoEnter: autoEnter.value })
    emit('sent', {
      count: targets.length,
      targets,
      text,
      autoEnter: autoEnter.value
    })
    emit('close')
  } finally {
    isSending.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.batch-text-modal {
  width: 580px;
  max-width: 92vw;
  max-height: 88vh;
  background: #12141c;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(168, 85, 247, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalScaleIn 0.18s ease-out;
}

@keyframes modalScaleIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 头部 Header */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  font-size: 18px;
}

.modal-title {
  font-size: 15px;
  font-weight: 600;
  color: #f0f6fc;
  margin: 0;
}

.close-btn {
  background: transparent;
  border: none;
  color: #8b949e;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.15s;
}

.close-btn:hover {
  color: #f0f6fc;
  background: rgba(255, 255, 255, 0.1);
}

/* 主体 Body */
.modal-body {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  max-height: calc(88vh - 120px);
}

/* 1. 下发目标设备条 */
.target-strip {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 10px 12px;
}

.strip-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.strip-label {
  font-size: 12px;
  color: #8b949e;
}

.strip-label b {
  color: #c084fc;
}

.strip-clear-btn {
  background: transparent;
  border: none;
  color: #8b949e;
  font-size: 11px;
  cursor: pointer;
  padding: 2px 6px;
}

.strip-clear-btn:hover {
  color: #f85149;
}

.strip-chips-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 80px;
  overflow-y: auto;
}

.device-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  background: rgba(168, 85, 247, 0.12);
  border: 1px solid rgba(168, 85, 247, 0.3);
  border-radius: 4px;
  font-size: 12px;
  color: #e9d5ff;
}

.chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
}

.chip-remove-btn {
  background: transparent;
  border: none;
  color: #8b949e;
  cursor: pointer;
  padding: 0;
  font-size: 12px;
  line-height: 1;
}

.chip-remove-btn:hover {
  color: #f85149;
}

.strip-empty-warning {
  font-size: 12px;
  color: #f85149;
  padding: 4px 0;
}

/* 2. 常用快速短语 */
.quick-texts-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.qt-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.qt-section-label {
  font-size: 12px;
  color: #8b949e;
  font-weight: 500;
}

.save-as-qt-btn {
  background: rgba(168, 85, 247, 0.15);
  border: 1px solid rgba(168, 85, 247, 0.35);
  color: #c084fc;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.save-as-qt-btn:hover {
  background: rgba(168, 85, 247, 0.3);
  color: #e9d5ff;
}

.qt-pills-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 72px;
  overflow-y: auto;
}

.qt-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  background: #1c1c2e;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  color: #7dd3fc;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.qt-pill:hover {
  border-color: #38bdf8;
  background: rgba(56, 189, 248, 0.15);
  transform: translateY(-1px);
}

.qt-pill-badge {
  font-size: 10px;
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  padding: 0 3px;
  border-radius: 3px;
  font-weight: 700;
}

.qt-empty-hint {
  font-size: 11px;
  color: #6e7681;
}

/* 保存短语小表单 */
.save-qt-box {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  background: #161b22;
  border: 1px solid rgba(168, 85, 247, 0.3);
  border-radius: 6px;
}

.save-qt-input {
  flex: 1;
  background: #0d1117;
  border: 1px solid #30363d;
  color: #f0f6fc;
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 4px;
  outline: none;
}

.save-qt-input:focus {
  border-color: #a855f7;
}

.save-qt-actions {
  display: flex;
  gap: 6px;
}

.save-qt-cancel, .save-qt-confirm {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.save-qt-cancel {
  background: transparent;
  border: 1px solid #30363d;
  color: #8b949e;
}

.save-qt-confirm {
  background: #8957e5;
  border: 1px solid #a855f7;
  color: #fff;
}

.save-qt-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 3. 文本输入主工作区 */
.text-editor-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.batch-textarea {
  width: 100%;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 10px 12px;
  color: #f0f6fc;
  font-size: 13px;
  resize: vertical;
  min-height: 80px;
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.batch-textarea:focus {
  border-color: #a855f7;
  box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.15);
}

.editor-tools-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tools-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.auto-enter-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #c9d1d9;
  cursor: pointer;
  user-select: none;
}

.auto-enter-label input[type="checkbox"] {
  accent-color: #a855f7;
  cursor: pointer;
}

.char-count {
  font-size: 11px;
  color: #8b949e;
}

.clear-text-btn {
  background: transparent;
  border: none;
  color: #8b949e;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
}

.clear-text-btn:hover:not(:disabled) {
  color: #f85149;
}

.clear-text-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 底部 Footer */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  background: rgba(255, 255, 255, 0.03);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.btn-cancel {
  background: transparent;
  border: 1px solid #30363d;
  color: #c9d1d9;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel:hover {
  background: rgba(255, 255, 255, 0.05);
}

.btn-send {
  background: linear-gradient(135deg, #8957e5 0%, #7c3aed 100%);
  border: 1px solid #a855f7;
  color: #ffffff;
  padding: 6px 18px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.35);
  transition: all 0.15s;
}

.btn-send:hover:not(:disabled) {
  background: linear-gradient(135deg, #9333ea 0%, #6d28d9 100%);
  box-shadow: 0 4px 14px rgba(124, 58, 237, 0.5);
  transform: translateY(-1px);
}

.btn-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 移动端响应式适配 */
@media (max-width: 768px) {
  .batch-text-modal {
    width: 95vw;
    max-width: 95vw;
    max-height: 90vh;
    border-radius: 12px;
  }

  .modal-header {
    padding: 10px 14px;
  }

  .header-icon {
    font-size: 16px;
  }

  .modal-title {
    font-size: 14px;
  }

  .close-btn {
    padding: 4px 6px;
    font-size: 14px;
  }

  .modal-body {
    padding: 12px 14px;
    gap: 10px;
    max-height: calc(90vh - 105px);
  }

  /* 目标设备展示条 */
  .target-strip {
    padding: 8px 10px;
    border-radius: 6px;
  }

  .strip-title-row {
    margin-bottom: 6px;
  }

  .strip-label {
    font-size: 11px;
  }

  .strip-clear-btn {
    font-size: 10.5px;
  }

  .strip-chips-wrap {
    max-height: 56px;
    gap: 4px;
  }

  .device-chip {
    padding: 1px 6px;
    font-size: 11px;
    border-radius: 4px;
  }

  /* 常用快速短语：移动端单行横滑胶囊 */
  .quick-texts-section {
    gap: 6px;
  }

  .qt-section-label {
    font-size: 11px;
  }

  .save-as-qt-btn {
    font-size: 10.5px;
    padding: 2px 6px;
  }

  .qt-pills-list {
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    max-height: none;
    padding: 2px 0;
    gap: 5px;
  }

  .qt-pills-list::-webkit-scrollbar {
    display: none;
  }

  .qt-pill {
    padding: 2px 8px;
    font-size: 11px;
    flex-shrink: 0;
    border-radius: 10px;
  }

  .save-qt-box {
    padding: 5px 6px;
    gap: 6px;
  }

  .save-qt-input {
    font-size: 11.5px;
    padding: 3px 6px;
  }

  .save-qt-cancel,
  .save-qt-confirm {
    font-size: 10.5px;
    padding: 3px 6px;
  }

  /* 文本编辑区 */
  .batch-textarea {
    min-height: 56px;
    font-size: 13.5px;
    padding: 8px 10px;
  }

  .editor-tools-row {
    font-size: 11px;
  }

  .auto-enter-label {
    font-size: 11px;
    gap: 4px;
  }

  .char-count {
    font-size: 10px;
  }

  .clear-text-btn {
    font-size: 11px;
  }

  /* 底部操作栏 */
  .modal-footer {
    padding: 10px 14px;
    gap: 8px;
  }

  .btn-cancel {
    padding: 6px 12px;
    font-size: 12px;
  }

  .btn-send {
    padding: 6px 12px;
    font-size: 12px;
    flex: 1;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
