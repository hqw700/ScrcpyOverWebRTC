<template>
  <div ref="consoleMainRef" class="device-console" :class="{ 'is-maximized': isMaximized }" :style="{ height: isMaximized ? '100vh' : height }">
    <!-- 顶部拖拽拉伸手柄 -->
    <div class="console-resizer" v-if="!isMaximized" @mousedown="startResizingConsole" title="拖动调整控制台高度"></div>

    <!-- 轻量 Toast 提示 -->
    <transition name="console-fade">
      <div v-if="consoleToastMessage" :class="['console-toast', consoleToastType]">
        {{ consoleToastMessage }}
      </div>
    </transition>

    <!-- 控制台顶部 Tab 导航 -->
    <header class="console-tabs-bar">
      <div class="tabs-group">
        <button
          v-if="!forbidTerminal"
          :class="{ active: activeTab === 'shell' }"
          @click="activeTab = 'shell'"
          title="ADB Shell 命令行模式"
        >
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
          终端 (Shell)
        </button>
        <button
          v-if="!forbidTerminal"
          :class="{ active: activeTab === 'adb' }"
          @click="activeTab = 'adb'"
          title="ADB 交互式终端 (xterm.js)"
        >
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><path d="M12 18h.01"></path></svg>
          ADB 调试
        </button>
        <button
          v-if="!forbidTerminal"
          :class="{ active: activeTab === 'ai' }"
          @click="activeTab = 'ai'"
          title="AI 智能排障与助手"
        >
          <svg class="tab-icon ai-spin-hover" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg>
          AI 助手
          <span class="beta-badge">Agent</span>
        </button>
        <button 
          :class="{ active: activeTab === 'text' }" 
          @click="activeTab = 'text'"
          title="批量文本下发与快速短语管理"
        >
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          文本下发
        </button>
        <button
          v-if="authStore.isAdmin"
          :class="{ active: activeTab === 'files' }"
          @click="activeTab = 'files'"
          title="批量安装 APK 与文件分发传输"
        >
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="18" x2="12" y2="15"></line></svg>
          批量安装/传输
        </button>
      </div>
      
      <!-- 设备状态指示器与隐藏控制台按钮 -->
      <div class="console-right-tools">
        <div class="console-device-badge" v-if="deviceId">
          <span class="status-indicator" :class="statusClass" :title="statusText"></span>
          <select 
            :value="deviceId" 
            @change="onDeviceSelectChange"
            class="device-selector-dropdown"
          >
            <option v-if="deviceId === 'default'" value="default" disabled>-- 请选择设备 --</option>
            <option 
              v-for="d in deviceStore.devices" 
              :key="d.id" 
              :value="d.id"
            >
              {{ d.id }}{{ d.status === 'online' ? '' : ' (离线)' }}
            </option>
          </select>
          <!-- 终端连接/断开控制按键（forbid_terminal 用户隐藏：P2P 终端/AI 通道一并禁用） -->
          <template v-if="!forbidTerminal">
          <button
            v-if="webrtcStatus === 'connected'"
            class="console-link-btn disconnect"
            @click="handleManualDisconnect"
            title="断开终端直连"
          >
            断开
          </button>
          <button
            v-else-if="webrtcStatus === 'connecting'"
            class="console-link-btn connecting"
            disabled
          >
            连接中...
          </button>
          <button
            v-else
            class="console-link-btn connect"
            @click="handleManualConnect"
            title="建立 WebRTC 终端直连"
          >
            ⚡ 连接终端
          </button>
          </template>
        </div>
        
        <!-- 全屏最大化切换按钮 -->
        <button 
          class="console-tool-btn" 
          @click="toggleMaximize" 
          :title="isMaximized ? '还原窗口' : '全屏显示'"
        >
          <svg v-if="!isMaximized" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 14h6v6m10-6h-6v6M4 10h6V4m10 6h-6V4"></path>
          </svg>
        </button>

        <!-- 最小化隐藏按钮 (保持连接) -->
        <button class="console-tool-btn" @click="deviceStore.closeGlobalConsole()" title="收起隐藏控制台 (终端继续后台运行)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>

        <!-- 彻底关闭断开按钮 -->
        <button class="console-close-btn" @click="deviceStore.destroyGlobalConsole()" title="关闭控制台 (断开所有终端连接)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </header>

    <!-- 选项卡内容区 -->
    <div class="console-tab-content">
      <!-- 1. Shell 视图 -->
      <div v-show="activeTab === 'shell'" class="shell-tab-panel">
        <div class="console-history" ref="consoleRef">
          <div v-for="(log, idx) in consoleLogs" :key="idx" :class="['log-item', log.type]">
            <template v-if="log.type === 'batch_result'">
              <span class="log-cmd">$ [批量] {{ log.cmd }} (发送至 {{ Object.keys(log.results).length }} 台设备)</span>
              <div class="batch-outputs-list">
                <div 
                  v-for="(res, devId) in log.results" 
                  :key="devId" 
                  class="batch-output-row"
                  :class="res.status"
                >
                  <div class="row-header">
                    <span class="dev-tag">[{{ devId }}]</span>
                    <span class="status-tag" :class="res.status">
                      {{ res.status === 'running' ? '⏳ 执行中' : (res.status === 'success' ? '✅ 成功' : '❌ 失败') }}
                    </span>
                  </div>
                  <pre class="dev-output">{{ res.output }}</pre>
                </div>
              </div>
            </template>
            <template v-else>
              <span class="log-cmd" v-if="log.cmd">$ {{ log.cmd }}</span>
              <pre class="log-out">{{ log.text }}</pre>
            </template>
          </div>
          <div v-if="consoleLogs.length === 0" class="console-empty">
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            等待命令下发...
          </div>
        </div>
        <div class="console-shortcuts">
          <button 
            v-for="(item, idx) in consoleShortcuts" 
            :key="idx" 
            @click="quickCmd(item.cmd)"
          >
            {{ item.name }}
          </button>
          <button @click="consoleLogs = []" class="system-btn">清屏</button>
          <button @click="showShortcutModal = true" class="system-btn edit-btn">⚙️ 自定义</button>
        </div>

        <!-- 并发下发目标设备选择（多设备批量走 /api/tasks，后端 admin-only，普通用户隐藏） -->
        <div class="shell-targets-bar" v-if="authStore.isAdmin">
          <div class="targets-control-row">
            <span class="label">并发目标：</span>
            <label class="select-all-check" v-if="deviceStore.devices.filter(dev => dev.status === 'online' && dev.id !== deviceId).length > 0">
              <input type="checkbox" v-model="isAllDevicesSelected" />
              <span class="checkbox-custom"></span>
              <span class="name">全选</span>
            </label>
            <div class="tag-filters" v-if="tagStore.tags.length > 0">
              <span class="tag-filter-label">按标签选择：</span>
              <button 
                v-for="tag in tagStore.tags" 
                :key="tag.id" 
                class="tag-filter-btn"
                :style="{ 
                  borderColor: tag.color,
                  backgroundColor: isTagAllSelected(tag.id) ? tag.color : 'transparent',
                  color: isTagAllSelected(tag.id) ? '#fff' : tag.color 
                }"
                @click="toggleTagDevices(tag.id)"
              >
                {{ tag.name }}
              </button>
            </div>
          </div>
          <div class="targets-list">
            <label class="target-check current" v-if="deviceId && deviceId !== 'default'">
              <input type="checkbox" checked disabled />
              <span class="checkbox-custom"></span>
              <span class="name">{{ deviceId }} (当前)</span>
            </label>
            <label 
              v-for="d in deviceStore.devices.filter(dev => dev.status === 'online' && dev.id !== deviceId)" 
              :key="d.id" 
              class="target-check"
            >
              <input type="checkbox" :value="d.id" v-model="batchShellSelectedIds" />
              <span class="checkbox-custom"></span>
              <span class="name">{{ d.id }}</span>
            </label>
          </div>
        </div>

        <div class="console-input-group">
          <input 
            v-model="inputCmd" 
            @keyup.enter="execCmd"
            @keydown.up.prevent="navigateHistory('up')"
            @keydown.down.prevent="navigateHistory('down')"
            placeholder="输入 Android Shell 命令分发执行以获取回复..."
            class="cmd-input"
          />
          <button @click="execCmd" class="send-btn" :disabled="!inputCmd.trim()">{{ sendBtnText }}</button>
        </div>
      </div>

      <!-- 2. ADB 交互终端 (xterm.js) -->
      <div v-show="activeTab === 'adb'" class="adb-tab-panel">
        <!-- 终端会话 Tab 栏 -->
        <div class="adb-sessions-bar" v-if="adbSessions.length > 0">
          <div class="adb-tabs-group">
            <button 
              v-for="sess in adbSessions" 
              :key="sess.id"
              :class="{ active: activeSessionId === sess.id, disconnected: !sess.isConnected }"
              @click="switchAdbSession(sess.id)"
              class="adb-session-tab"
            >
              <span class="tab-status-dot" :class="{ connected: sess.isConnected, disconnected: !sess.isConnected }"></span>
              <span class="sess-name">{{ sess.name }}</span>
              <span class="close-sess-btn" @click.stop="closeAdbSession(sess.id)" title="关闭会话">×</span>
            </button>
            <button 
              class="add-sess-btn" 
              @click="addAdbSession" 
              title="新建终端会话" 
              :disabled="adbSessions.length >= 5 || webrtcStatus !== 'connected'"
            >
              +
            </button>
          </div>
          <span class="max-sess-tip">最多支持开启 5 个终端页</span>
        </div>

        <!-- 断连醒目警示条 (若存在已有会话且连接断开) -->
        <div v-if="adbSessions.length > 0 && webrtcStatus !== 'connected'" class="adb-disconnect-notice">
          <svg class="notice-warn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <span class="notice-text">远程设备连接已断开，当前 ADB 调试会话已终止。</span>
          <button class="notice-reconnect-btn" @click="handleManualConnect">⚡ 重新连接设备</button>
        </div>

        <div v-if="adbSessions.length === 0" class="adb-placeholder">
          <svg class="adb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><polyline points="9 9 9 15 12 12 15 15 15 9"></polyline></svg>
          <h3>开启交互式 ADB Web 终端</h3>
          <p v-if="webrtcStatus === 'connected'">基于 WebRTC P2P 数据加密通道直连，支持 Tab 补全、多会话独立并发调试</p>
          <p v-else class="adb-hint-warn">⚠️ 当前设备未建立终端直连。点击下方按钮即可建立连接并启动 ADB 终端。</p>
          <button class="adb-connect-btn" @click="handleInitAdb">
            {{ webrtcStatus === 'connected' ? '初始化 ADB 终端' : '⚡ 连接设备并启动 ADB' }}
          </button>
        </div>

        <!-- 渲染各会话的多容器 -->
        <div 
          v-for="sess in adbSessions" 
          :key="sess.id"
          :ref="el => { if (el) sessionContainers[sess.id] = el }"
          class="xterm-view-container" 
          v-show="activeSessionId === sess.id"
        ></div>
      </div>

      <!-- 3. AI 助手 (AI Agent) -->
      <div v-show="activeTab === 'ai'" class="ai-tab-panel">
        <!-- 侧边快捷模板/技能栏 (PC上侧边栏，移动端折叠或滚动) -->
        <aside class="ai-skills-sidebar">
          <div class="sidebar-header">
            <h4>🤖 快捷技能模板</h4>
            <button class="add-skill-btn" @click="addNewSkillPrompt" title="新建自定义技能">+</button>
          </div>
          <div class="skills-list">
            <button 
              v-for="(skill, idx) in allSkills" 
              :key="idx" 
              class="skill-item"
              @click="runSkill(skill)"
              :title="skill.desc"
              :disabled="aiLoading"
            >
              <span class="skill-name">{{ skill.name }}</span>
              <span class="skill-desc">{{ skill.desc }}</span>
              <span class="skill-delete" @click.stop="deleteSkill(idx)" v-if="skill.isCustom">×</span>
            </button>
          </div>
        </aside>

        <!-- AI 聊天及日志区域 -->
        <div class="ai-main-chat">
          <!-- 顶部设置和配置 -->
          <div class="ai-config-header">
            <button class="ai-settings-toggle" @click="showAiSettings = !showAiSettings">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              AI 连接参数设置 {{ showAiSettings ? '▲' : '▼' }}
            </button>
            <span class="ai-model-badge">{{ aiModel }}</span>
          </div>

          <transition name="slide">
            <div class="ai-settings-panel" v-if="showAiSettings">
              <div class="form-row">
                <label>API Base URL:</label>
                <input v-model="aiUrl" placeholder="例如 https://api.openai.com/v1" />
              </div>
              <div class="form-row">
                <label>API Key / Token:</label>
                <div class="password-input-wrapper">
                  <input v-model="aiKey" :type="showAiKey ? 'text' : 'password'" placeholder="填写您的 API Key (Token)" />
                  <button type="button" class="eye-toggle-btn" @click="showAiKey = !showAiKey" :title="showAiKey ? '隐藏' : '显示'">
                    <svg v-if="showAiKey" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="form-row">
                <label>模型 (Model):</label>
                <input v-model="aiModel" placeholder="例如 gpt-4o-mini 或 deepseek-chat" />
              </div>
              <div class="form-row">
                <label>提供商 (Provider):</label>
                <select v-model="aiProvider">
                  <option value="openai">OpenAI</option>
                  <option value="zhipu">智谱 (Zhipu)</option>
                  <option value="claude">Claude</option>
                </select>
              </div>
              <div class="form-actions">
                <button class="save-settings-btn" @click="saveAiSettings">保存配置</button>
              </div>
            </div>
          </transition>

          <!-- AI 执行系统追踪日志 (类似 CLI logs) -->
          <div class="ai-trace-panel" v-if="aiLogs.length > 0">
            <div class="trace-header">
              <span>⚡ AI Agent 思考过程与工具调用日志</span>
              <button class="clear-trace-btn" @click="aiLogs = []">清空</button>
            </div>
            <div class="trace-body">
              <div v-for="(log, idx) in aiLogs" :key="idx" class="trace-log-line">
                <span class="trace-time">{{ formatTime(log.time) }}</span>
                <span :class="['trace-text', log.type]">{{ log.text }}</span>
              </div>
            </div>
          </div>

          <!-- 聊天会话记录 -->
          <div class="ai-chat-history" ref="chatRef">
            <div v-if="aiMessages.length === 0" class="chat-empty">
              <h3>🤖 我是您的云虚机 AI 助手</h3>
              <p>请配置您的 API Key 并在右侧选择诊断技能或直接在下方提问。<br/>我可以直接执行 ADB 命令来帮您诊断网络卡顿、分析应用崩溃并执行各种设备维护任务。</p>
            </div>
            <div 
              v-for="(msg, idx) in visibleMessages" 
              :key="idx" 
              :class="['chat-bubble-wrapper', msg.role]"
            >
              <div class="chat-bubble">
                <div class="bubble-header">
                  <span class="sender-name">{{ msg.role === 'user' ? '用户' : 'AI 助手' }}</span>
                </div>
                <div class="bubble-content">
                  <pre class="formatted-text" v-if="msg.content">{{ msg.content }}</pre>
                  <div class="tool-calls-display" v-if="msg.tool_calls">
                    <div v-for="tc in msg.tool_calls" :key="tc.id" class="tool-badge">
                      🛠️ 触发工具: {{ tc.function.name }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="aiLoading" class="chat-bubble-wrapper assistant loading-state">
              <div class="chat-bubble">
                <div class="loading-dots">
                  <span></span><span></span><span></span>
                </div>
                <div class="loading-tip">AI Agent 正在思考或执行 ADB 命令中...</div>
              </div>
            </div>
          </div>

          <!-- 输入区域 -->
          <div class="ai-input-group">
            <textarea 
              v-model="aiInput" 
              @keydown.enter.exact.prevent="sendAiMessage"
              placeholder="请输入您的问题，例如: '检查磁盘空间并诊断是否有大文件'..."
              class="ai-chat-input"
              rows="2"
              :disabled="aiLoading"
            ></textarea>
            <button 
              class="ai-send-btn" 
              @click="sendAiMessage"
              :disabled="!aiInput.trim() || aiLoading"
            >
              发送
            </button>
          </div>
        </div>
      </div>

      <!-- 4. 批量文本下发面板 -->
      <div v-show="activeTab === 'text'" class="text-tab-panel">
        <!-- 侧边快捷短语栏 (类似于 AI 助手的快捷技能侧边栏 aside.ai-skills-sidebar) -->
        <aside class="quick-text-sidebar">
          <div class="sidebar-header">
            <h4>⚡ 快捷文本库</h4>
            <div class="sidebar-header-actions">
              <button class="add-qt-btn" @click="openCreateQuickTextModal" title="新建快捷短语">+</button>
              <button class="manage-qt-btn" @click="openQuickTextModal" title="短语库管理">⚙️</button>
            </div>
          </div>
          <div class="quick-text-items custom-scrollbar">
            <div 
              v-for="qt in quickTextStore.quickTexts" 
              :key="qt.id" 
              class="quick-text-card"
              @click="applyQuickText(qt)"
              :title="qt.content"
            >
              <div class="qt-card-header">
                <span class="qt-card-title">{{ qt.title }}</span>
                <span class="qt-card-enter-badge" v-if="qt.autoEnter" title="追加回车">↵</span>
              </div>
              <div class="qt-card-snippet">{{ qt.content }}</div>
              <div class="qt-card-actions">
                <button class="qt-card-action send-btn-mini" @click.stop="directSendQuickText(qt)" title="直接下发至当前勾选设备">🚀 下发</button>
                <button class="qt-card-action del-btn-mini" @click.stop="quickTextStore.removeQuickText(qt.id)" title="删除短语">×</button>
              </div>
            </div>
            <div v-if="quickTextStore.quickTexts.length === 0" class="qt-sidebar-empty">
              <span>暂无快捷短语</span>
              <button class="qt-empty-add-btn" @click="openCreateQuickTextModal">+ 新建短语</button>
            </div>
          </div>
        </aside>

        <!-- 文本主操作区域 (右侧) -->
        <div class="text-main-area">
          <!-- 顶部下发历史/状态列表 -->
          <div class="console-history text-history" ref="textHistoryRef">
            <div v-for="(log, idx) in textLogs" :key="idx" class="log-item batch_result">
              <div class="text-log-header">
                <span class="text-log-badge">💬 文本下发</span>
                <span class="text-log-time">{{ log.time }}</span>
                <span class="text-log-targets-summary">发送至 {{ log.targetCount }} 台设备</span>
                <span class="text-log-mode-tag">{{ log.modeText }}</span>
                <span class="text-log-enter-tag" v-if="log.autoEnter">↵ 自动回车</span>
              </div>
              <pre class="text-log-body">{{ log.content }}</pre>
              <div class="text-log-dev-pills">
                <span v-for="devId in log.targets" :key="devId" class="text-dev-pill">
                  {{ devId }}
                </span>
              </div>
            </div>
            <div v-if="textLogs.length === 0" class="console-empty">
              <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              暂无文本下发历史。请在左侧侧边栏点击快捷短语或在下方输入文本，并勾选目标设备进行一键下发。
            </div>
          </div>

          <!-- 并发下发目标设备选择 -->
          <div class="shell-targets-bar">
            <div class="targets-control-row">
              <span class="label">下发目标：</span>
              <label class="select-all-check" v-if="deviceStore.devices.filter(dev => dev.status === 'online' && dev.id !== deviceId).length > 0">
                <input type="checkbox" v-model="isAllTextTargetsSelected" />
                <span class="checkbox-custom"></span>
                <span class="name">全选在线</span>
              </label>
              <div class="tag-filters" v-if="tagStore.tags.length > 0">
                <span class="tag-filter-label">按标签选择：</span>
                <button 
                  v-for="tag in tagStore.tags" 
                  :key="tag.id" 
                  class="tag-filter-btn"
                  :style="{ 
                    borderColor: tag.color,
                    backgroundColor: isTagAllSelectedForText(tag.id) ? tag.color : 'transparent',
                    color: isTagAllSelectedForText(tag.id) ? '#fff' : tag.color 
                  }"
                  @click="toggleTagDevicesForText(tag.id)"
                >
                  {{ tag.name }}
                </button>
              </div>
              <span class="targets-selected-summary">已勾选 {{ effectiveTextTargets.length }} 台设备</span>
            </div>
            <div class="targets-list">
              <label class="target-check current" :class="{ 'is-selected': textTargetCurrent }" v-if="deviceId && deviceId !== 'default'">
                <input type="checkbox" v-model="textTargetCurrent" />
                <span class="checkbox-custom"></span>
                <span class="name">{{ deviceId }} (当前)</span>
              </label>
              <label 
                v-for="d in deviceStore.devices.filter(dev => dev.status === 'online' && dev.id !== deviceId)" 
                :key="d.id" 
                class="target-check"
              >
                <input type="checkbox" :value="d.id" v-model="batchTextSelectedIds" />
                <span class="checkbox-custom"></span>
                <span class="name">{{ d.id }}</span>
              </label>
            </div>
          </div>

          <!-- 文本输入与下发区域 -->
          <div class="text-input-section">
            <textarea 
              v-model="inputBatchText" 
              placeholder="在此输入文本（100% 汉字支持、换行、测试文案、账号密码、Emoji 等）..."
              class="batch-text-textarea"
              rows="3"
            ></textarea>

            <div class="text-input-actions">
              <div class="text-options">
                <label class="checkbox-label" title="输入完成后自动敲击一次回车键 (KEYCODE_ENTER)">
                  <input type="checkbox" v-model="textAutoEnter" />
                  <span>追加 Enter 回车</span>
                </label>
                <span class="text-char-count">{{ inputBatchText.length }} 字</span>
              </div>

              <div class="btn-group">
                <button 
                  class="clear-text-btn" 
                  @click="inputBatchText = ''" 
                  :disabled="!inputBatchText"
                >
                  清空
                </button>
                <button 
                  class="send-btn text-send-btn" 
                  @click="execSendBatchText" 
                  :disabled="!inputBatchText.trim() || effectiveTextTargets.length === 0 || isSendingText"
                >
                  {{ isSendingText ? '下发中...' : `一键下发 (${effectiveTextTargets.length} 台设备)` }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 5. 批量安装与文件传输面板 -->
      <div v-show="activeTab === 'files'" class="files-tab-panel">
        <!-- 下发目标设备选择 -->
        <div class="shell-targets-bar files-targets-bar">
          <div class="targets-control-row">
            <span class="label">下发目标：</span>
            <label class="select-all-check" v-if="deviceStore.devices.filter(dev => dev.status === 'online' && dev.id !== deviceId).length > 0">
              <input type="checkbox" v-model="isAllFilesTargetsSelected" />
              <span class="checkbox-custom"></span>
              <span class="name">全选在线</span>
            </label>
            <div class="tag-filters" v-if="tagStore.tags.length > 0">
              <span class="tag-filter-label">按标签选择：</span>
              <button 
                v-for="tag in tagStore.tags" 
                :key="tag.id" 
                class="tag-filter-btn"
                :style="{ 
                  borderColor: tag.color,
                  backgroundColor: isTagAllSelectedForFiles(tag.id) ? tag.color : 'transparent',
                  color: isTagAllSelectedForFiles(tag.id) ? '#fff' : tag.color 
                }"
                @click="toggleTagDevicesForFiles(tag.id)"
              >
                {{ tag.name }}
              </button>
            </div>
            <span class="targets-selected-summary">已勾选 {{ effectiveFileTargets.length }} 台设备</span>
          </div>
          <div class="targets-list">
            <label class="target-check current" :class="{ 'is-selected': fileTargetCurrent }" v-if="deviceId && deviceId !== 'default'">
              <input type="checkbox" v-model="fileTargetCurrent" />
              <span class="checkbox-custom"></span>
              <span class="name">{{ deviceId }} (当前)</span>
            </label>
            <label 
              v-for="d in deviceStore.devices.filter(dev => dev.status === 'online' && dev.id !== deviceId)" 
              :key="d.id" 
              class="target-check"
            >
              <input type="checkbox" :value="d.id" v-model="batchFilesSelectedIds" />
              <span class="checkbox-custom"></span>
              <span class="name">{{ d.id }}</span>
            </label>
          </div>
        </div>

        <!-- 主内容工作区：左侧表单配置 + 右侧实时任务看板 -->
        <div class="files-main-grid custom-scrollbar">
          <!-- 分发配置卡片 -->
          <div class="files-config-card">
            <div class="card-section-title">
              <span class="icon">📦</span>
              <span>分发配置与上传</span>
            </div>

            <!-- 本地文件上传拖拽区 -->
            <div class="form-item">
              <label class="form-label">1. 上传本地文件 (APK 或 资源文件)</label>
              <div 
                class="upload-dropzone" 
                :class="{ dragging: isDraggingFile }"
                @dragover.prevent="isDraggingFile = true"
                @dragleave="isDraggingFile = false"
                @drop.prevent="handleFileDrop"
              >
                <input type="file" ref="fileInputRef" class="file-input-hidden" @change="handleFileSelect" />
                <svg class="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="18" x2="12" y2="15"></line>
                </svg>
                <div v-if="!uploadedFileName" class="dropzone-text">
                  <span>拖拽文件至此，或 <a href="javascript:void(0)" @click="fileInputRef && fileInputRef.click()">点击上传</a></span>
                  <p class="dropzone-sub">APK 文件上传后自动配置为批量静默安装任务</p>
                </div>
                <div v-else class="uploaded-info">
                  <span class="file-name-badge">📄 {{ uploadedFileName }}</span>
                  <span class="file-size-badge">({{ formatBytes(uploadedFileSize) }})</span>
                  <button class="clear-file-btn" @click="clearUploadedFile">移除</button>
                </div>
                <div class="dropzone-progress" v-if="uploadProgress > 0 && uploadProgress < 100">
                  <div class="progress-bar-fill" :style="{ width: uploadProgress + '%' }"></div>
                  <span class="progress-label">上传中 {{ uploadProgress }}%</span>
                </div>
              </div>
            </div>

            <!-- 云端已有文件选择 -->
            <div class="form-item">
              <label class="form-label">或者：从信令云端选择已有文件</label>
              <select v-model="selectedCloudFileName" @change="handleCloudFileChange" class="form-select custom-scrollbar">
                <option value="">-- 选择云端文件中心已有文件 --</option>
                <option v-for="file in cloudFiles" :key="file.name" :value="file.name">
                  {{ file.name }} ({{ formatBytes(file.size) }})
                </option>
              </select>
            </div>

            <!-- 任务类型与路径配置 -->
            <div class="form-row" v-if="uploadedFileName">
              <div class="form-item half">
                <label class="form-label">任务类型</label>
                <select v-model="fileTaskType" class="form-select">
                  <option value="install">静默安装 APK</option>
                  <option value="push_file">传输文件并存盘</option>
                </select>
              </div>
              <div class="form-item half" v-if="fileTaskType === 'push_file'">
                <label class="form-label">目标存盘绝对路径</label>
                <input type="text" v-model="destPath" placeholder="例如: /sdcard/Download/file.bin" class="form-input" />
              </div>
            </div>

            <!-- 提交按钮 -->
            <div class="form-actions">
              <button 
                class="submit-batch-btn" 
                :disabled="effectiveFileTargets.length === 0 || !uploadedFileName || isSubmittingFileTask"
                @click="submitBatchFileTask"
              >
                {{ isSubmittingFileTask ? '正在创建任务...' : `🚀 下发批量任务 (${effectiveFileTargets.length} 台设备)` }}
              </button>
            </div>
          </div>

          <!-- 批量任务执行看板 -->
          <div class="files-dashboard-card">
            <div class="card-section-title">
              <span class="icon">📊</span>
              <span>任务执行进度看板</span>
              <button 
                v-if="currentTask" 
                class="clear-task-btn" 
                @click="clearCurrentTask" 
                title="关闭/清除当前任务看板"
              >
                ✕ 清除看板
              </button>
            </div>

            <!-- 任务进行中态 -->
            <template v-if="currentTask">
              <div class="task-summary-banner">
                <div class="task-meta-left">
                  <span class="task-id-tag">ID: {{ currentTask.task_id }}</span>
                  <span class="task-type-badge">{{ translateTaskType(currentTask.type) }}</span>
                  <span class="task-time-text">{{ formatTaskTime(currentTask.created_at) }}</span>
                </div>
                <div class="task-stats-group">
                  <div class="stat-pill">完成度: <b>{{ taskFinishedCount }}/{{ taskTotalCount }}</b></div>
                  <div class="stat-pill success">成功: <b>{{ taskSuccessCount }}</b></div>
                  <div class="stat-pill failed" v-if="taskFailedCount > 0">失败: <b>{{ taskFailedCount }}</b></div>
                </div>
              </div>

              <!-- 双色综合进度条 -->
              <div class="dual-progress-bar">
                <div 
                  class="progress-seg success" 
                  :style="{ width: (taskTotalCount ? (taskSuccessCount / taskTotalCount) * 100 : 0) + '%' }"
                ></div>
                <div 
                  class="progress-seg failed" 
                  :style="{ width: (taskTotalCount ? (taskFailedCount / taskTotalCount) * 100 : 0) + '%' }"
                ></div>
              </div>

              <!-- 子任务设备表格 -->
              <div class="subtask-table-wrap custom-scrollbar">
                <table class="subtask-table">
                  <thead>
                    <tr>
                      <th>设备 ID</th>
                      <th>状态</th>
                      <th>进度</th>
                      <th>结果 / 日志</th>
                      <th>更新时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="sub in Object.values(currentTask.devices || {})" :key="sub.device_id">
                      <td class="dev-id-cell">{{ sub.device_id }}</td>
                      <td>
                        <span class="status-pill" :class="sub.status">
                          {{ translateSubtaskStatus(sub.status) }}
                        </span>
                      </td>
                      <td class="progress-col">
                        <div class="sub-progress-track">
                          <div class="sub-progress-fill" :style="{ width: sub.progress + '%' }"></div>
                        </div>
                        <span class="sub-progress-text">{{ sub.progress }}%</span>
                      </td>
                      <td class="log-col">
                        <span v-if="sub.status === 'failed'" class="log-err-text" :title="sub.error_msg">
                          {{ sub.error_msg || '未知错误' }}
                        </span>
                        <button 
                          v-else-if="sub.status === 'success' && sub.error_msg" 
                          class="view-output-btn"
                          @click="showBatchLogModal(sub.device_id, sub.error_msg)"
                        >
                          查看输出
                        </button>
                        <span v-else class="log-empty-dash">-</span>
                      </td>
                      <td class="time-cell">{{ formatTaskTime(sub.updated_at) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>

            <!-- 空态展示 -->
            <div v-else class="dashboard-empty-state">
              <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              <p class="empty-title">暂无正在执行的批量任务</p>
              <p class="empty-desc">在左侧上传或选取文件并指定目标设备下发后，此处将实时展示各台设备的下载拉取与安装进度。</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 隐藏的 dummy video，用来满足 useWebRTC 在没有主视频时的画面要求 -->
    <video ref="dummyVideo" style="display: none;" autoplay playsinline muted></video>

    <!-- 自定义快捷指令弹窗 -->
    <div v-if="showShortcutModal" class="shortcut-modal-overlay" @click.self="showShortcutModal = false">
      <div class="shortcut-modal-card">
        <div class="modal-header">
          <h3>自定义快捷指令</h3>
          <button class="close-btn" @click="showShortcutModal = false">✕</button>
        </div>
        <div class="modal-body custom-scrollbar">
          <div class="shortcut-list">
            <div v-for="(item, idx) in modalShortcuts" :key="idx" class="shortcut-item-row">
              <div class="input-col name-col">
                <label>名称</label>
                <input v-model="item.name" placeholder="请输入指令名称，如 型号" />
              </div>
              <div class="input-col cmd-col">
                <label>Shell 命令</label>
                <input v-model="item.cmd" placeholder="请输入 Shell 命令，如 getprop ro.product.model" />
              </div>
              <button class="delete-btn" @click="deleteModalShortcut(idx)" title="删除指令">✕</button>
            </div>
            <div v-if="modalShortcuts.length === 0" class="no-shortcuts">
              暂无自定义快捷指令
            </div>
          </div>
          <button class="add-row-btn" @click="addModalShortcut">+ 添加快捷指令</button>
        </div>
        <div class="modal-footer">
          <button class="btn btn-reset" @click="resetToDefaultShortcuts">恢复默认</button>
          <div class="footer-actions">
            <button class="btn btn-cancel" @click="showShortcutModal = false">取消</button>
            <button class="btn btn-save" @click="saveShortcuts">保存</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 自定义快捷文本短语库管理弹窗 -->
    <div v-if="showQuickTextModal" class="shortcut-modal-overlay" @click.self="showQuickTextModal = false">
      <div class="shortcut-modal-card quick-text-modal-card">
        <div class="modal-header">
          <h3>自定义快速文本库</h3>
          <button class="close-btn" @click="showQuickTextModal = false">✕</button>
        </div>
        <div class="modal-body custom-scrollbar">
          <p class="modal-intro-tip">定义的短语将同时展示在终端控制台和单机直控窗口下拉菜单中，并自动持久化到云端。</p>
          <div class="quick-text-edit-list">
            <div v-for="(item, idx) in editingQuickTexts" :key="idx" class="quick-text-edit-row">
              <div class="edit-row-header">
                <input v-model="item.title" placeholder="短语名称（如: 登录欢迎语、测试账号）" class="edit-title-input" />
                <label class="auto-enter-check" title="选中此项下发时自动追加 Enter 回车">
                  <input type="checkbox" v-model="item.autoEnter" />
                  <span>追加 Enter</span>
                </label>
                <button class="delete-btn" @click="deleteEditingQuickText(idx)" title="删除此条短语">✕</button>
              </div>
              <textarea v-model="item.content" placeholder="输入要填入的正文文本（支持中文、多行换行）..." class="edit-content-textarea" rows="2"></textarea>
            </div>
            <div v-if="editingQuickTexts.length === 0" class="no-shortcuts">
              暂无自定义快捷短语，点击下方按钮添加
            </div>
          </div>
          <button class="add-row-btn" @click="addEditingQuickText">+ 添加快速文本</button>
        </div>
        <div class="modal-footer">
          <button class="btn btn-reset" @click="resetToDefaultQuickTexts">恢复默认</button>
          <div class="footer-actions">
            <button class="btn btn-cancel" @click="showQuickTextModal = false">取消</button>
            <button class="btn btn-save" @click="saveQuickTextsFromModal">保存修改</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 批量任务单机执行日志弹窗 -->
    <div v-if="activeBatchLogOutput" class="shortcut-modal-overlay" @click.self="activeBatchLogOutput = null">
      <div class="shortcut-modal-card log-modal-card">
        <div class="modal-header">
          <h3>设备 {{ activeBatchLogDevice }} 执行输出</h3>
          <button class="close-btn" @click="activeBatchLogOutput = null">✕</button>
        </div>
        <div class="modal-body custom-scrollbar">
          <pre class="log-output-pre"><code>{{ activeBatchLogOutput }}</code></pre>
        </div>
        <div class="modal-footer">
          <button class="btn btn-save" @click="activeBatchLogOutput = null">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import { useAuthStore } from '@/stores/auth'
import { useTagStore } from '@/stores/tags'
import { useQuickTextStore, DEFAULT_QUICK_TEXTS } from '@/stores/quickTexts'
import { useAdb } from '@/composables/useAdb'
import { useWebRTC } from '@/composables/useWebRTC'
import { getDeviceSettings } from '@/utils/settings'

const props = defineProps({
  deviceId: {
    type: String,
    required: true
  },
  isDrawer: {
    type: Boolean,
    default: false
  },
  height: {
    type: String,
    default: '100%'
  },
  shareToken: {
    type: String,
    default: ''
  },
  sharePassword: {
    type: String,
    default: ''
  },
  accessMode: {
    type: String,
    default: 'full'
  }
})

const emit = defineEmits(['close'])

const deviceStore = useDeviceStore()
const authStore = useAuthStore()
const tagStore = useTagStore()
const quickTextStore = useQuickTextStore()
const dummyVideo = ref(null)
const consoleRef = ref(null)
const chatRef = ref(null)

const showAiKey = ref(false)
const activeTab = ref(deviceStore.consoleInitialTab || 'shell')
const consoleLogs = ref([])

// --- 策略/角色驱动的 Tab 可见性 ---
// forbid_terminal：隐藏终端相关 Tab（shell/adb 经信令 command 通道，AI 助手经 P2P adb-channel，后端只能拦前者，前端统一切掉入口）
// 批量任务（/api/tasks 文件/批量 shell 下发）后端为 admin-only，普通用户隐藏 files Tab 与并发目标选择
const forbidTerminal = computed(() => authStore.forbidTerminal)

function isTabVisible(tab) {
  if (['shell', 'adb', 'ai'].includes(tab)) return !forbidTerminal.value
  if (tab === 'files') return authStore.isAdmin
  return true // text
}

// 当前 Tab 被隐藏时回落到第一个可用 Tab
watch([forbidTerminal, () => authStore.isAdmin], () => {
  if (!isTabVisible(activeTab.value)) {
    activeTab.value = forbidTerminal.value ? 'text' : 'shell'
  }
}, { immediate: true })

watch(() => deviceStore.consoleInitialTab, (tab) => {
  if (tab) {
    activeTab.value = isTabVisible(tab) ? tab : (forbidTerminal.value ? 'text' : 'shell')
  }
})

// --- 控制台轻量 Toast 提示状态 ---
const consoleToastMessage = ref('')
const consoleToastType = ref('info')
let consoleToastTimer = null

function showToastNotice(msg, type = 'info') {
  consoleToastMessage.value = msg
  consoleToastType.value = type
  if (consoleToastTimer) clearTimeout(consoleToastTimer)
  consoleToastTimer = setTimeout(() => {
    consoleToastMessage.value = ''
  }, 4000)
}

// --- 文本下发与快捷短语状态 ---
const textTargetCurrent = ref(true)
const batchTextSelectedIds = ref([])
const inputBatchText = ref('')
const textAutoEnter = ref(false)
const isSendingText = ref(false)
const textLogs = ref([])
const textHistoryRef = ref(null)

const showQuickTextModal = ref(false)
const editingQuickTexts = ref([])

const effectiveTextTargets = computed(() => {
  const list = []
  if (textTargetCurrent.value && props.deviceId) {
    list.push(props.deviceId)
  }
  for (const id of batchTextSelectedIds.value) {
    if (!list.includes(id)) {
      list.push(id)
    }
  }
  return list
})

const isAllTextTargetsSelected = computed({
  get() {
    const otherOnline = deviceStore.devices.filter(d => d.status === 'online' && d.id !== props.deviceId)
    if (otherOnline.length === 0) return false
    return otherOnline.every(d => batchTextSelectedIds.value.includes(d.id))
  },
  set(val) {
    const otherOnline = deviceStore.devices.filter(d => d.status === 'online' && d.id !== props.deviceId)
    if (val) {
      batchTextSelectedIds.value = otherOnline.map(d => d.id)
    } else {
      batchTextSelectedIds.value = []
    }
  }
})

// 标签筛选在线设备公共方法 (排除当前主设备)
function getOnlineDevicesByTag(tagId) {
  return deviceStore.devices.filter(dev => {
    if (dev.status !== 'online' || dev.id === props.deviceId) return false
    const devTags = tagStore.deviceTags[dev.id] || []
    return devTags.includes(tagId)
  })
}

function isTagAllSelectedForText(tagId) {
  const devs = getOnlineDevicesByTag(tagId)
  if (devs.length === 0) return false
  return devs.every(d => batchTextSelectedIds.value.includes(d.id))
}

function toggleTagDevicesForText(tagId) {
  const devs = getOnlineDevicesByTag(tagId)
  if (devs.length === 0) return
  const allIn = devs.every(d => batchTextSelectedIds.value.includes(d.id))
  if (allIn) {
    const devIds = new Set(devs.map(d => d.id))
    batchTextSelectedIds.value = batchTextSelectedIds.value.filter(id => !devIds.has(id))
  } else {
    const set = new Set(batchTextSelectedIds.value)
    devs.forEach(d => set.add(d.id))
    batchTextSelectedIds.value = Array.from(set)
  }
}

function applyQuickText(qt) {
  inputBatchText.value = qt.content
  if (qt.autoEnter !== undefined) {
    textAutoEnter.value = qt.autoEnter
  }
}

function directSendQuickText(qt) {
  if (!qt) return
  applyQuickText(qt)
  if (effectiveTextTargets.value.length > 0) {
    execSendBatchText()
  }
}

function openCreateQuickTextModal() {
  openQuickTextModal()
  addEditingQuickText()
}

async function execSendBatchText() {
  const text = inputBatchText.value
  if (!text || effectiveTextTargets.length === 0 || isSendingText.value) return
  isSendingText.value = true

  const targets = [...effectiveTextTargets.value]
  const autoEnter = textAutoEnter.value

  if (targets.length === 1) {
    quickTextStore.injectToDevice(targets[0], text, autoEnter)
  } else {
    quickTextStore.batchInject(targets, text, { autoEnter })
  }

  const now = new Date()
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

  textLogs.value.unshift({
    time: timeStr,
    content: text,
    targetCount: targets.length,
    targets,
    autoEnter,
    modeText: '光标直接落屏'
  })

  if (textLogs.value.length > 50) {
    textLogs.value.pop()
  }

  isSendingText.value = false
}

function openQuickTextModal() {
  editingQuickTexts.value = quickTextStore.quickTexts.map(item => ({ ...item }))
  showQuickTextModal.value = true
}

function addEditingQuickText() {
  editingQuickTexts.value.push({
    id: `qt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    title: '',
    content: '',
    autoEnter: false
  })
}

function deleteEditingQuickText(idx) {
  editingQuickTexts.value.splice(idx, 1)
}

function resetToDefaultQuickTexts() {
  editingQuickTexts.value = DEFAULT_QUICK_TEXTS.map(item => ({ ...item }))
}

function saveQuickTextsFromModal() {
  const filtered = editingQuickTexts.value
    .map(item => ({
      ...item,
      title: item.title.trim() || '未命名短语',
      content: item.content || ''
    }))
    .filter(item => item.content.trim() !== '')

  quickTextStore.reorderQuickTexts(filtered)
  showQuickTextModal.value = false
}

// --- 批量安装与文件传输状态 ---
const fileTargetCurrent = ref(true)
const batchFilesSelectedIds = ref([])
const fileInputRef = ref(null)
const isDraggingFile = ref(false)
const uploadedFileName = ref('')
const uploadedFileSize = ref(0)
const uploadProgress = ref(0)
const fileTaskType = ref('install')
const destPath = ref('')
const isSubmittingFileTask = ref(false)

const cloudFiles = ref([])
const selectedCloudFileName = ref('')

const effectiveFileTargets = computed(() => {
  const set = new Set()
  if (fileTargetCurrent.value && props.deviceId) {
    set.add(props.deviceId)
  }
  for (const id of batchFilesSelectedIds.value) {
    set.add(id)
  }
  return Array.from(set)
})

const isAllFilesTargetsSelected = computed({
  get() {
    const otherOnline = deviceStore.devices.filter(d => d.status === 'online' && d.id !== props.deviceId)
    if (otherOnline.length === 0) return false
    return otherOnline.every(d => batchFilesSelectedIds.value.includes(d.id))
  },
  set(val) {
    const otherOnline = deviceStore.devices.filter(d => d.status === 'online' && d.id !== props.deviceId)
    if (val) {
      batchFilesSelectedIds.value = otherOnline.map(d => d.id)
    } else {
      batchFilesSelectedIds.value = []
    }
  }
})

function isTagAllSelectedForFiles(tagId) {
  const devs = getOnlineDevicesByTag(tagId)
  if (devs.length === 0) return false
  return devs.every(d => batchFilesSelectedIds.value.includes(d.id))
}

function toggleTagDevicesForFiles(tagId) {
  const devs = getOnlineDevicesByTag(tagId)
  if (devs.length === 0) return
  const allIn = devs.every(d => batchFilesSelectedIds.value.includes(d.id))
  if (allIn) {
    const devIds = new Set(devs.map(d => d.id))
    batchFilesSelectedIds.value = batchFilesSelectedIds.value.filter(id => !devIds.has(id))
  } else {
    const set = new Set(batchFilesSelectedIds.value)
    devs.forEach(d => set.add(d.id))
    batchFilesSelectedIds.value = Array.from(set)
  }
}

async function fetchCloudFiles() {
  try {
    const token = localStorage.getItem('auth_token') || ''
    const res = await fetch('/api/files', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    if (res.ok) {
      cloudFiles.value = await res.json()
    }
  } catch (e) {
    console.warn('Failed to fetch cloud files:', e)
  }
}

function handleCloudFileChange() {
  if (!selectedCloudFileName.value) {
    clearUploadedFile()
    return
  }
  const file = cloudFiles.value.find(f => f.name === selectedCloudFileName.value)
  if (file) {
    uploadedFileName.value = file.name
    uploadedFileSize.value = file.size
    uploadProgress.value = 100
    if (file.name.toLowerCase().endsWith('.apk')) {
      fileTaskType.value = 'install'
    } else {
      fileTaskType.value = 'push_file'
      if (!destPath.value) {
        destPath.value = `/sdcard/Download/${file.name}`
      }
    }
  }
}

function handleFileDrop(e) {
  isDraggingFile.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    uploadFileToServer(files[0])
  }
}

function handleFileSelect(e) {
  const files = e.target?.files
  if (files && files.length > 0) {
    uploadFileToServer(files[0])
  }
}

function uploadFileToServer(file) {
  selectedCloudFileName.value = ''
  uploadedFileName.value = file.name
  uploadedFileSize.value = file.size
  uploadProgress.value = 0

  if (file.name.toLowerCase().endsWith('.apk')) {
    fileTaskType.value = 'install'
  } else {
    fileTaskType.value = 'push_file'
    if (!destPath.value) {
      destPath.value = `/sdcard/Download/${file.name}`
    }
  }

  const token = localStorage.getItem('auth_token') || ''
  const xhr = new XMLHttpRequest()
  xhr.open('POST', `/upload?name=${encodeURIComponent(file.name)}`, true)
  xhr.setRequestHeader('Authorization', 'Bearer ' + token)

  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) {
      uploadProgress.value = Math.round((event.loaded / event.total) * 100)
    }
  }

  xhr.onload = () => {
    if (xhr.status === 200) {
      uploadProgress.value = 100
      fetchCloudFiles()
    } else {
      alert('文件上传至服务器失败: ' + xhr.responseText)
      clearUploadedFile()
    }
  }

  xhr.onerror = () => {
    alert('网络传输错误，文件上传失败')
    clearUploadedFile()
  }

  xhr.send(file)
}

function clearUploadedFile() {
  uploadedFileName.value = ''
  uploadedFileSize.value = 0
  uploadProgress.value = 0
  selectedCloudFileName.value = ''
  if (fileInputRef.value) fileInputRef.value.value = ''
}

// 通过 /api/files/url 获取带签名的临时下载地址（10 分钟有效），
// /downloads/ 直接访问已被后端拒绝（403），/api/files 返回的旧 url 字段不可再用于下载。
async function fetchSignedFileURL(name) {
  const token = localStorage.getItem('auth_token') || ''
  const res = await fetch(`/api/files/url?name=${encodeURIComponent(name)}`, {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  if (!res.ok) {
    const text = (await res.text()).trim()
    throw new Error(text || `获取文件下载签名失败 (${res.status})`)
  }
  const data = await res.json()
  return `${location.protocol}//${location.host}${data.url}`
}

async function submitBatchFileTask() {
  if (effectiveFileTargets.value.length === 0) {
    alert('请勾选至少一台目标设备。')
    return
  }
  if (!uploadedFileName.value) {
    alert('请先上传或选择要分发的文件。')
    return
  }
  if (fileTaskType.value === 'push_file' && !destPath.value.trim()) {
    alert('请输入手机目标存盘绝对路径（例如：/sdcard/Download/filename）。')
    return
  }

  isSubmittingFileTask.value = true
  const token = localStorage.getItem('auth_token') || ''

  try {
    const fileUrl = await fetchSignedFileURL(uploadedFileName.value)
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        type: fileTaskType.value,
        targets: effectiveFileTargets.value,
        payload: fileUrl,
        dest_path: fileTaskType.value === 'push_file' ? destPath.value.trim() : ''
      })
    })

    const data = await res.json()
    if (res.ok && data.status === 'success') {
      deviceStore.startTrackingTask(data.task_id)
      clearUploadedFile()
      fetchCloudFiles()
    } else {
      alert('下发批量拉取任务失败: ' + (data.error || '未知错误'))
    }
  } catch (e) {
    alert('请求创建任务失败: ' + e.message)
  } finally {
    isSubmittingFileTask.value = false
  }
}

// 批量任务看板计算与交互
const currentTask = computed(() => deviceStore.currentTask)

const taskTotalCount = computed(() => {
  return currentTask.value ? Object.keys(currentTask.value.devices || {}).length : 0
})
const taskSuccessCount = computed(() => {
  if (!currentTask.value?.devices) return 0
  return Object.values(currentTask.value.devices).filter(sub => sub.status === 'success').length
})
const taskFailedCount = computed(() => {
  if (!currentTask.value?.devices) return 0
  return Object.values(currentTask.value.devices).filter(sub => sub.status === 'failed').length
})
const taskFinishedCount = computed(() => {
  if (!currentTask.value?.devices) return 0
  return Object.values(currentTask.value.devices).filter(sub => ['success', 'failed'].includes(sub.status)).length
})

const activeBatchLogOutput = ref(null)
const activeBatchLogDevice = ref('')
function showBatchLogModal(devId, output) {
  activeBatchLogDevice.value = devId
  activeBatchLogOutput.value = output
}

function clearCurrentTask() {
  deviceStore.stopTrackingTask()
  deviceStore.currentTask = null
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatTaskTime(timeStr) {
  if (!timeStr) return '-'
  const d = new Date(timeStr)
  return d.toLocaleTimeString('zh-CN', { hour12: false })
}

function translateTaskType(type) {
  const map = {
    'install': '安装 APK',
    'push_file': '传输文件',
    'shell': '执行指令'
  }
  return map[type] || type
}

function translateSubtaskStatus(status) {
  const map = {
    'queued': '排队中',
    'running': '执行中',
    'success': '成功',
    'failed': '失败'
  }
  return map[status] || status
}

const inputCmd = ref('')

// 监听 AI / Files Tab 的激活
watch(activeTab, (newTab) => {
  if (newTab === 'ai') {
    if (webrtc.value && typeof webrtc.value.createAiCommandChannel === 'function') {
      webrtc.value.createAiCommandChannel()
    }
  } else if (newTab === 'files') {
    fetchCloudFiles()
  }
})

// --- 批量 Shell 与单台整合状态 ---
const batchShellSelectedIds = ref([])

const defaultShortcuts = [
  { name: '三方应用', cmd: 'pm list packages -3' },
  { name: '型号', cmd: 'getprop ro.product.model' },
  { name: '当前页面', cmd: 'dumpsys window | grep mCurrentFocus | grep -v null' },
  { name: '存储空间', cmd: 'df -h /data' },
  { name: '开启触控轨迹', cmd: 'settings put system pointer_location 1' },
  { name: '关闭轨迹', cmd: 'settings put system pointer_location 0' }
]

const consoleShortcuts = ref([])
const showShortcutModal = ref(false)
const modalShortcuts = ref([])

async function loadShortcuts() {
  try {
    const token = localStorage.getItem('auth_token') || ''
    const res = await fetch('/api/shortcuts', {
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      }
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        consoleShortcuts.value = data
        try {
          localStorage.setItem('cloudphone_console_shortcuts', JSON.stringify(data))
        } catch (e) {}
        return
      }
    }
  } catch (e) {
    print("[Shortcuts] Failed to load from server, fallback to local:", e)
  }

  const saved = localStorage.getItem('cloudphone_console_shortcuts')
  if (saved) {
    try {
      consoleShortcuts.value = JSON.parse(saved)
    } catch (e) {
      consoleShortcuts.value = [...defaultShortcuts]
    }
  } else {
    consoleShortcuts.value = [...defaultShortcuts]
  }
}

async function saveShortcuts() {
  const filtered = modalShortcuts.value.filter(item => item.name.trim() && item.cmd.trim())
  consoleShortcuts.value = filtered
  
  try {
    localStorage.setItem('cloudphone_console_shortcuts', JSON.stringify(filtered))
  } catch (e) {}

  try {
    const token = localStorage.getItem('auth_token') || ''
    const res = await fetch('/api/shortcuts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify(filtered)
    })
    if (!res.ok) {
      print("[Shortcuts] Failed to sync shortcuts to server")
    }
  } catch (e) {
    print("[Shortcuts] Failed to sync shortcuts to server:", e)
  }

  showShortcutModal.value = false
}

function addModalShortcut() {
  modalShortcuts.value.push({ name: '', cmd: '' })
}

function deleteModalShortcut(idx) {
  modalShortcuts.value.splice(idx, 1)
}

function resetToDefaultShortcuts() {
  modalShortcuts.value = defaultShortcuts.map(item => ({ ...item }))
}

watch(showShortcutModal, (newVal) => {
  if (newVal) {
    modalShortcuts.value = consoleShortcuts.value.map(item => ({ ...item }))
  }
})

const isAllDevicesSelected = computed({
  get() {
    const onlineOthers = deviceStore.devices.filter(dev => dev.status === 'online' && dev.id !== props.deviceId)
    if (onlineOthers.length === 0) return false
    return onlineOthers.every(dev => batchShellSelectedIds.value.includes(dev.id))
  },
  set(val) {
    const onlineOthers = deviceStore.devices.filter(dev => dev.status === 'online' && dev.id !== props.deviceId)
    if (val) {
      batchShellSelectedIds.value = onlineOthers.map(dev => dev.id)
    } else {
      batchShellSelectedIds.value = []
    }
  }
})

function isTagAllSelected(tagId) {
  const devs = getOnlineDevicesByTag(tagId)
  if (devs.length === 0) return false
  return devs.every(dev => batchShellSelectedIds.value.includes(dev.id))
}

function toggleTagDevices(tagId) {
  const devs = getOnlineDevicesByTag(tagId)
  if (devs.length === 0) return
  
  if (isTagAllSelected(tagId)) {
    const devIds = devs.map(d => d.id)
    batchShellSelectedIds.value = batchShellSelectedIds.value.filter(id => !devIds.includes(id))
  } else {
    const newIds = new Set(batchShellSelectedIds.value)
    devs.forEach(d => newIds.add(d.id))
    batchShellSelectedIds.value = Array.from(newIds)
  }
}
const targetDeviceIds = computed(() => [props.deviceId, ...batchShellSelectedIds.value].filter(Boolean))
const sendBtnText = computed(() => targetDeviceIds.value.length > 1 ? `并发发送 (${targetDeviceIds.value.length}台)` : '发送')


// 监听当前主设备变化，若新设备在 batchShellSelectedIds 中，则将其过滤掉以防重复
watch(() => props.deviceId, (newId) => {
  if (newId) {
    batchShellSelectedIds.value = batchShellSelectedIds.value.filter(id => id !== newId)
  }
})

// 监听 Pinia Store 里的当前任务进度更新结果，直接定位并写入 consoleLogs 里的 batch_result 项
watch(() => deviceStore.currentTask, (newTask) => {
  if (newTask && newTask.type === 'shell') {
    const logItem = consoleLogs.value.find(item => item.type === 'batch_result' && item.taskId === newTask.task_id)
    if (logItem) {
      Object.entries(newTask.devices).forEach(([devId, info]) => {
        logItem.results[devId] = {
          status: info.status,
          output: info.result || (info.status === 'running' ? 'Running...' : '无输出回复')
        }
      })
    }
  }
}, { deep: true })

// WebRTC 状态绑定
const webrtc = ref(null)
const isSharedConnection = ref(false)
const webrtcConnecting = ref(false)
const webrtcStatus = ref('disconnected')
const webrtcError = ref(null)

// 多终端 Tab 与全屏支持相关状态
const adbSessions = ref([])
const activeSessionId = ref(null)
const nextSessionId = ref(1)
const sessionContainers = {}
const isMaximized = ref(false)
const consoleMainRef = ref(null)

const isAdbConnected = computed(() => {
  if (activeSessionId.value === null) return false
  const sess = adbSessions.value.find(s => s.id === activeSessionId.value)
  return sess ? sess.isConnected : false
})

function onDeviceSelectChange(e) {
  const newId = e.target.value
  if (newId) {
    deviceStore.openGlobalConsole(newId)
  }
}

let unwatchStatus = null
let unwatchError = null

// 安全访问 localStorage 的帮助函数
const safeStorageGet = (key, fallback = '') => {
  try {
    return localStorage.getItem(key) || fallback
  } catch (e) {
    return fallback
  }
}

const safeStorageSet = (key, val) => {
  try {
    localStorage.setItem(key, val)
  } catch (e) {
    console.warn('[Console] Failed to save to localStorage:', e)
  }
}

// AI 配置与状态
const aiUrl = ref(safeStorageGet('ai_api_url', 'https://api.openai.com/v1'))
const aiKey = ref(safeStorageGet('ai_api_key', ''))
const aiModel = ref(safeStorageGet('ai_model', 'gpt-4o-mini'))
const aiProvider = ref(safeStorageGet('ai_provider', 'openai'))
const showAiSettings = ref(false)
const aiInput = ref('')
const aiMessages = ref([])
const aiLoading = ref(false)
const aiLogs = ref([])

// 预设技能模板
const defaultSkills = [
  { name: '📊 虚机健康检查', desc: '诊断虚机 CPU、可用内存与磁盘空间', prompt: '请对这台设备做一次全面的健康自检，检查系统负载(uptime/top)、可用内存(free)及存储空间(df -h /data)。' },
  { name: '📶 网络链路分析', desc: '诊断 WebRTC 码率与往返时延', prompt: '请获取当前的 WebRTC 传输质量指标(get_webrtc_stats)，分析 FPS、延迟(RTT/JitterBuffer)状况并给出一份中文分析。' },
  { name: '🔍 分析异常崩溃', desc: '抓取 logcat 检索最近报错日志', prompt: '检索最近 100 行 logcat 错误日志，查找是否有进程崩溃或 Exception 报错并总结根源。' },
  { name: '🧹 清理系统空间', desc: '一键检索并清理系统无用缓存', prompt: '检查设备的磁盘存储空间。如果有可以清理的临时垃圾或缓存目录，请执行清理，并对比清理前后的空间容量变化。' },
  { name: '🔧 诊断连接与网络', desc: '一键分析连接、UDS 与网络拥塞', prompt: '请协助诊断连接失败、画面黑屏或无连接问题。请直接读取设备端 /data/local/tmp/cloudphone-agent.log 日志的最后 200 行，并重点诊断以下几点：\n1. 诊断启动参数：检查日志中是否存在 \"No external NAT mappings configured\"。如果有，说明 Agent 未配置外部 NAT 映射地址（启动参数 -external-addr 或环境变量 CP_AGENT_EXTERNAL_ADDR 缺失），导致跨网段/跨机器连接时物理网络阻断。\n2. 诊断网络环境：检查本端与对端上报的 ICE 候选者（Candidates）。分析设备端是否仅上报了 Docker 内置私有 IP (如 172.17.x.x)；检查本端客户端的 Host IP 中是否包含代理软件虚拟网关（如 Clash Tun 模式，常见 IP 为 198.18.x.x）导致连接流量被拦截。\n3. 检查 WebRTC 与 UDS 通道状态：分析 ICEConnectionState 的变化趋势，检查 UDS 三通道（Video/Control/Touch）是否正常 Dial 连通。\n4. 检查画面渲染状态：检查 CoreService 是否异常退出，分析 KeyframeTrace 里是否频繁出现 \"detail=no-control-conn\" 或 \"request-sync-frame skipped: no active codec\" 从而引发黑屏现象。\n最后请用专业明细的中文给出一份诊断报告和具体的修复建议。' }
]

const getCustomSkills = () => {
  try {
    return JSON.parse(safeStorageGet('ai_custom_skills', '[]'))
  } catch (e) {
    return []
  }
}
const customSkills = ref(getCustomSkills())

const allSkills = computed(() => {
  return [
    ...defaultSkills,
    ...customSkills.value.map(s => ({ ...s, isCustom: true }))
  ]
})

const visibleMessages = computed(() => {
  // 只显示 user 和 assistant 类型的文本消息，过滤掉中间的 tool 交互以便阅读，但保留 tool_calls 信息
  return aiMessages.value.filter(m => m.role === 'user' || (m.role === 'assistant' && (m.content || m.tool_calls)))
})

const statusText = computed(() => {
  if (webrtcError.value) return `错误: ${webrtcError.value}`
  if (webrtcStatus.value === 'connected') return '终端已连接 (在线)'
  if (webrtcStatus.value === 'connecting') return '终端连接中...'
  return '终端未连接'
})

const statusClass = computed(() => {
  return {
    connected: webrtcStatus.value === 'connected' && !webrtcError.value,
    connecting: webrtcStatus.value === 'connecting' && !webrtcError.value,
    disconnected: webrtcStatus.value === 'disconnected' || !!webrtcError.value,
    error: !!webrtcError.value
  }
})

// 初始化与连接管理
async function setupDeviceConnection(deviceId, forceConnect = false) {
  if (!deviceId || deviceId === 'default') return
  // 防御：若控制台处于收起/折叠状态，绝不建立后台静默 WebRTC 连接
  if (!deviceStore.showGlobalConsole) return
  
  // 检查是否已有活跃的控制面板 WebRTC 实例
  let activeInstance = deviceStore.getWebRTC(deviceId)
  if (activeInstance) {
    console.log('[Console] Reusing active WebRTC session for device:', deviceId)
    cleanupConnection(false)
    webrtcConnecting.value = false
    webrtcError.value = null
    webrtc.value = activeInstance
    isSharedConnection.value = true
    webrtcStatus.value = webrtc.value.status?.value || 'connected'
    webrtcError.value = webrtc.value.error?.value || null
    
    // 监听 WebRTC 状态变化
    unwatchStatus = watch(() => webrtc.value?.status?.value, (newStatus) => {
      const prevStatus = webrtcStatus.value
      webrtcStatus.value = newStatus || 'connected'
      if (newStatus === 'disconnected' || newStatus === 'failed') {
        webrtcConnecting.value = false
        // 标记所有 ADB 会话为断开
        adbSessions.value.forEach(s => {
          s.isConnected = false
        })
        if (prevStatus === 'connected') {
          showToastNotice('⚠️ 远程设备连接已断开，ADB 调试已断开', 'warning')
          consoleLogs.value.push({ type: 'error', text: '[系统提示] 远程设备连接已断开。' })
          scrollToBottom()
        }
      }
    }, { immediate: true })

    unwatchError = watch(() => webrtc.value?.error?.value, (newErr) => {
      webrtcError.value = newErr || null
    }, { immediate: true })
    
    // 设置命令结果监听 (支持 Shell 终端打印)
    webrtc.value.onCommandResult(onCommandResultHandler)
    return
  }

  // 没有活跃的控制面板 WebRTC 实例
  if (!forceConnect) {
    // 默认不主动发起 headless WebRTC 直连，避免无故占用设备及触发推流
    cleanupConnection(false)
    webrtc.value = null
    isSharedConnection.value = false
    webrtcStatus.value = 'disconnected'
    webrtcConnecting.value = false
    webrtcError.value = null
    return
  }

  // 用户显式触发手动连接（如点击【⚡ 连接终端】或【⚡ 连接设备并启动 ADB】）
  cleanupConnection(false)
  webrtcConnecting.value = true
  webrtcError.value = null
  console.log('[Console] Connecting WebRTC (headless, manual) for device:', deviceId)
  webrtcStatus.value = 'connecting'
  isSharedConnection.value = false
  try {
    const settings = getDeviceSettings(deviceId)
    const scrcpyOptions = {
      max_fps: settings.fps,
      max_size: settings.size,
      bitrate: settings.bitrate * 1000000,
      min_bitrate: settings.minBitrate * 1000000,
      max_bitrate: settings.maxBitrate * 1000000,
      bwe: settings.bwe,
      audio: settings.audio,
      audio_gain: settings.audioGain,
      audio_source: settings.audioSource,
      audio_dup: settings.audioDup,
      audio_low_latency: settings.audioLowLatency,
      debug: settings.debug,
      snapshot_interval: settings.snapshotInterval,
      power_off: settings.powerOff,
      video_source: settings.videoSource,
      camera_facing: settings.cameraFacing,
      camera_id: settings.cameraId,
      camera_size: settings.cameraSize,
      camera_fps: settings.cameraFps,
      camera_high_speed: settings.cameraHighSpeed,
      camera_ar: settings.cameraAr,
      // 只读分享：屏蔽触控/键盘/剪贴板等一切输入注入
      view_only: props.accessMode === 'view_only'
    }

    webrtc.value = useWebRTC(deviceId, scrcpyOptions)
    
    unwatchStatus = watch(() => webrtc.value?.status?.value, (newStatus) => {
      const prevStatus = webrtcStatus.value
      webrtcStatus.value = newStatus || 'disconnected'
      if (newStatus === 'connected') {
        webrtcConnecting.value = false
      } else if (newStatus === 'failed' || newStatus === 'disconnected') {
        webrtcConnecting.value = false
        adbSessions.value.forEach(s => {
          s.isConnected = false
        })
        if (prevStatus === 'connected') {
          showToastNotice('⚠️ 远程设备连接已断开，ADB 调试已断开', 'warning')
          consoleLogs.value.push({ type: 'error', text: '[系统提示] 远程设备连接已断开。' })
          scrollToBottom()
        }
      }
    }, { immediate: true })

    unwatchError = watch(() => webrtc.value?.error?.value, (newErr) => {
      webrtcError.value = newErr || null
    }, { immediate: true })

    setTimeout(() => {
      if (webrtc.value && dummyVideo.value) {
        webrtc.value.setVideoGetter(() => dummyVideo.value)
        webrtc.value.connect(props.shareToken, props.sharePassword)
        webrtc.value.onCommandResult(onCommandResultHandler)
      }
    }, 50)
  } catch (e) {
    console.error('[Console] Failed to connect device:', e)
    webrtcStatus.value = 'disconnected'
    webrtcError.value = e.message || '初始化失败'
    webrtcConnecting.value = false
  }
}

async function handleManualConnect() {
  if (!props.deviceId || props.deviceId === 'default') return
  await setupDeviceConnection(props.deviceId, true)
}

function handleManualDisconnect() {
  cleanupConnection(false)
  showToastNotice('已断开终端直连', 'info')
}

async function handleInitAdb() {
  if (webrtcStatus.value === 'connected' && webrtc.value) {
    addAdbSession()
    return
  }
  await setupDeviceConnection(props.deviceId, true)
  const stopWatch = watch(webrtcStatus, (st) => {
    if (st === 'connected') {
      stopWatch()
      if (adbSessions.value.length === 0) {
        addAdbSession()
      }
    } else if (st === 'disconnected' || st === 'failed') {
      stopWatch()
    }
  })
}

function onCommandResultHandler(res) {
  const output = res.stdout || res.stderr || (res.exit_code === 0 ? '[Success]' : `[Failed] ExitCode: ${res.exit_code}`)
  consoleLogs.value.push({
    type: res.exit_code === 0 ? 'success' : 'error',
    text: output
  })
  scrollToBottom()
}

function cleanupConnection(closeAllSessions = true) {
  if (closeAllSessions) {
    closeAdb()
  }
  
  isAdbConnected.value = false
  webrtcStatus.value = 'disconnected'
  webrtcError.value = null
  
  if (unwatchStatus) { unwatchStatus(); unwatchStatus = null }
  if (unwatchError) { unwatchError(); unwatchError = null }
  
  if (webrtc.value) {
    webrtc.value.onCommandResult(null)
    if (!isSharedConnection.value) {
      console.log('[Console] Disconnecting custom headless connection')
      try { webrtc.value.disconnect() } catch (e) {}
    }
  }
  webrtc.value = null
  isSharedConnection.value = false
  webrtcConnecting.value = false
}

// --- 终端命令历史翻阅记录 ---
const cmdHistory = ref([])
const historyIndex = ref(-1)
let tempInput = ''

try {
  const saved = localStorage.getItem('cloudphone_shell_history')
  if (saved) {
    cmdHistory.value = JSON.parse(saved)
  }
} catch (e) {}

function navigateHistory(direction) {
  if (cmdHistory.value.length === 0) return
  
  if (direction === 'up') {
    if (historyIndex.value === -1) {
      tempInput = inputCmd.value
      historyIndex.value = cmdHistory.value.length - 1
    } else if (historyIndex.value > 0) {
      historyIndex.value--
    }
    inputCmd.value = cmdHistory.value[historyIndex.value]
  } else if (direction === 'down') {
    if (historyIndex.value === -1) return
    if (historyIndex.value === cmdHistory.value.length - 1) {
      historyIndex.value = -1
      inputCmd.value = tempInput
    } else {
      historyIndex.value++
      inputCmd.value = cmdHistory.value[historyIndex.value]
    }
  }
}

// 终端指令 (支持单台 WebRTC 实时指令及多台 HTTP 批量指令下发双通路)
async function execCmd() {
  if (!inputCmd.value.trim()) return
  const cmd = inputCmd.value.trim()
  
  // 将命令存入历史记录
  if (cmd) {
    if (cmdHistory.value.length === 0 || cmdHistory.value[cmdHistory.value.length - 1] !== cmd) {
      cmdHistory.value.push(cmd)
      if (cmdHistory.value.length > 100) {
        cmdHistory.value.shift()
      }
      try {
        localStorage.setItem('cloudphone_shell_history', JSON.stringify(cmdHistory.value))
      } catch (e) {}
    }
  }
  historyIndex.value = -1
  tempInput = ''

  inputCmd.value = ''

  const targets = targetDeviceIds.value

  if (targets.length === 1) {
    // 仅当前一台设备，走原生 WebRTC 极速实时通道
    if (!webrtc.value || webrtcStatus.value !== 'connected') {
      consoleLogs.value.push({ type: 'error', text: '当前设备未连接终端。请在顶部点击【⚡ 连接终端】或在大盘中连接设备。' })
      scrollToBottom()
      return
    }
    consoleLogs.value.push({ type: 'info', cmd: cmd, text: '执行中...' })
    webrtc.value.sendCommand(cmd)
    scrollToBottom()
  } else {
    // 多台目标设备，走批量 HTTP 任务下发通道
    const logItem = ref({
      type: 'batch_result',
      cmd: cmd,
      taskId: '',
      results: {}
    })
    
    // 初始化所有目标设备的状态
    targets.forEach(id => {
      logItem.value.results[id] = { status: 'running', output: 'Pending...' }
    })
    
    consoleLogs.value.push(logItem.value)
    scrollToBottom()

    try {
      const token = localStorage.getItem('auth_token') || ''
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          type: 'shell',
          targets: targets,
          payload: cmd
        })
      })

      const data = await res.json()
      if (res.ok && data.status === 'success') {
        logItem.value.taskId = data.task_id
        deviceStore.startTrackingTask(data.task_id)
      } else {
        targets.forEach(id => {
          logItem.value.results[id] = { status: 'failed', output: data.error || '下发任务失败' }
        })
      }
    } catch (e) {
      targets.forEach(id => {
        logItem.value.results[id] = { status: 'failed', output: e.message }
      })
    }
  }
}

function quickCmd(cmd) {
  inputCmd.value = cmd
  execCmd()
}

function scrollToBottom() {
  nextTick(() => {
    if (consoleRef.value) {
      consoleRef.value.scrollTop = consoleRef.value.scrollHeight
    }
  })
}

// 全屏最大化切换
function toggleMaximize() {
  isMaximized.value = !isMaximized.value
  nextTick(() => {
    const activeSess = adbSessions.value.find(s => s.id === activeSessionId.value)
    if (activeSess && activeSess.isConnected && activeSess.adbInstance) {
      activeSess.adbInstance.resize()
    }
  })
}

// 二级多会话终端管理
function addAdbSession() {
  if (webrtcStatus.value !== 'connected' || !webrtc.value) {
    showToastNotice('当前未连接设备，请先点击【⚡ 连接终端】建立连接', 'warning')
    return
  }
  const id = nextSessionId.value++
  const newSession = {
    id,
    name: `Shell ${id}`,
    isConnected: false,
    adbInstance: null,
    unwatch: null
  }
  adbSessions.value.push(newSession)
  activeSessionId.value = id
  
  nextTick(() => {
    startAdbForSession(newSession)
  })
}

function startAdbForSession(sess) {
  if (webrtc.value) {
    const container = sessionContainers[sess.id]
    if (!container) return

    const { isAdbConnected: adbConnected, initAdb, closeAdb: close, resize: termResize } = useAdb(webrtc.value)
    sess.adbInstance = { initAdb, closeAdb: close, resize: termResize }
    
    sess.unwatch = watch(adbConnected, (val) => {
      sess.isConnected = val
    }, { immediate: true })
    
    sess.adbInstance.initAdb(container)
  }
}

function switchAdbSession(id) {
  activeSessionId.value = id
  nextTick(() => {
    const sess = adbSessions.value.find(s => s.id === id)
    if (sess && sess.adbInstance && sess.isConnected) {
      sess.adbInstance.resize()
    }
  })
}

function closeAdbSession(id) {
  const idx = adbSessions.value.findIndex(s => s.id === id)
  if (idx > -1) {
    const sess = adbSessions.value[idx]
    if (sess.adbInstance) {
      try { sess.adbInstance.closeAdb() } catch (e) {}
    }
    if (sess.unwatch) sess.unwatch()
    
    adbSessions.value.splice(idx, 1)
    delete sessionContainers[id]
    
    if (activeSessionId.value === id) {
      if (adbSessions.value.length > 0) {
        activeSessionId.value = adbSessions.value[adbSessions.value.length - 1].id
        nextTick(() => {
          const activeSess = adbSessions.value.find(s => s.id === activeSessionId.value)
          if (activeSess && activeSess.adbInstance && activeSess.isConnected) {
            activeSess.adbInstance.resize()
          }
        })
      } else {
        activeSessionId.value = null
      }
    }
  }
}

function cleanupAllAdbSessions() {
  adbSessions.value.forEach(sess => {
    if (sess.adbInstance) {
      try { sess.adbInstance.closeAdb() } catch (e) {}
    }
    if (sess.unwatch) sess.unwatch()
  })
  adbSessions.value = []
  activeSessionId.value = null
  nextSessionId.value = 1
  for (const k in sessionContainers) {
    delete sessionContainers[k]
  }
}

function closeAdb() {
  cleanupAllAdbSessions()
}

// AI Agent 设置及技能管理
// AI Agent 设置及技能管理
function loadConfigFromStorage() {
  aiUrl.value = safeStorageGet('ai_api_url', 'https://api.openai.com/v1')
  aiKey.value = safeStorageGet('ai_api_key', '')
  aiModel.value = safeStorageGet('ai_model', 'gpt-4o-mini')
  aiProvider.value = safeStorageGet('ai_provider', 'openai')
}

// 监听控制台显示状态，实现多端配置的热同步与连接生命周期治理
watch(() => deviceStore.showGlobalConsole, (newVal) => {
  if (newVal) {
    loadConfigFromStorage()
    if (props.deviceId && !webrtc.value) {
      setupDeviceConnection(props.deviceId, false)
    }
  } else {
    // 折叠收起时，若存在非共享的 headless 连接，主动断开释放设备占用
    if (!isSharedConnection.value) {
      cleanupConnection(false)
    }
  }
})

function saveAiSettings() {
  safeStorageSet('ai_api_url', aiUrl.value)
  safeStorageSet('ai_api_key', aiKey.value)
  safeStorageSet('ai_model', aiModel.value)
  safeStorageSet('ai_provider', aiProvider.value)

  // 异步同步到服务器跟随账户系统
  authStore.saveAIConfig({
    ai_api_url: aiUrl.value,
    ai_api_key: aiKey.value,
    ai_model: aiModel.value,
    ai_provider: aiProvider.value
  }).then(success => {
    if (success) {
      logTrace('system', `AI 配置信息已同步保存至服务端账户数据中`)
    } else {
      logTrace('system', `AI 配置已在本地生效，但未能成功同步至云端`)
    }
  })

  showAiSettings.value = false
  logTrace('system', `AI 配置已更新，Model: ${aiModel.value}, Provider: ${aiProvider.value}`)
}

function addNewSkillPrompt() {
  const name = prompt('请输入自定义技能名称 (例如: 检测应用占用):')
  if (!name) return
  const desc = prompt('请简要描述技能目的 (例如: 查看当前进程并列出排名前五 of app):')
  if (!desc) return
  const promptText = prompt('请输入详细引导词 (AI 将参考此 prompt 自动执行工具及命令):')
  if (!promptText) return

  customSkills.value.push({ name, desc, prompt: promptText })
  safeStorageSet('ai_custom_skills', JSON.stringify(customSkills.value))
}

function deleteSkill(index) {
  if (confirm('确定要删除此自定义技能模版吗？')) {
    customSkills.value.splice(index, 1)
    safeStorageSet('ai_custom_skills', JSON.stringify(customSkills.value))
  }
}

function runSkill(skill) {
  aiInput.value = skill.prompt
  sendAiMessage()
}

// AI Agent 执行控制流与 Tool 调用
function logTrace(type, text) {
  aiLogs.value.push({
    time: new Date(),
    type,
    text
  })
}

function formatTime(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function scrollToChatBottom() {
  nextTick(() => {
    if (chatRef.value) {
      chatRef.value.scrollTop = chatRef.value.scrollHeight
    }
  })
}

async function sendAiMessage() {
  if (!aiInput.value || !aiInput.value.trim() || aiLoading.value) return
  
  if (!aiKey.value) {
    alert('请先在配置面板中配置您的 AI Token/Key！')
    showAiSettings.value = true
    return
  }

  const query = aiInput.value
  aiInput.value = ''
  
  // 添加用户消息
  aiMessages.value.push({ role: 'user', content: query })
  aiLoading.value = true
  
  logTrace('info', `AI 收到指令: "${query}"`)
  scrollToChatBottom()

  if (aiProvider.value === 'claude') {
    // Claude API request (no function calling)
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': aiKey.value,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: aiModel.value,
          max_tokens: 1024,
          messages: [{ role: 'user', content: query }]
        })
      })
      if (!resp.ok) {
        const err = await resp.text()
        throw new Error(`Claude API error ${resp.status}: ${err}`)
      }
      const data = await resp.json()
      const reply = data.content?.[0]?.text || ''
      aiMessages.value.push({ role: 'assistant', content: reply })
      logTrace('success', `AI 回复: ${reply.substring(0,50)}...`)
    } catch (err) {
      console.error('[AI Agent] Claude error:', err)
      aiMessages.value.push({ role: 'assistant', content: err.message })
      logTrace('error', `Agent Claude 错误: ${err.message}`)
    }
    aiLoading.value = false
    scrollToChatBottom()
    return
  }

  try {
    await runAgentLoop()
  } catch (err) {
    console.error('[AI Agent] Error in loop:', err)
    let errorMsg = err.message || '网络连接或接口异常，请检查 API Base URL 以及 API Key 设置是否支持 CORS 跨域。'
    if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('未经授权') || errorMsg.includes('令牌')) {
      errorMsg = '❌ AI Agent 接口认证失败 (HTTP 401): 您的 API Key (Token) 错误、过期或已失效。请确认您的 API 令牌。我们已为您展开了下方的“AI 连接参数设置”面板。'
      showAiSettings.value = true
    }
    aiMessages.value.push({ 
      role: 'assistant', 
      content: errorMsg
    })
    logTrace('error', `Agent 发生致命错误: ${err.message}`)
  } finally {
    aiLoading.value = false
    scrollToChatBottom()
  }
}

async function runAgentLoop() {
  let iterations = 0
  const maxIterations = 8 // 防止无限调用死循环

  const tools = [
    {
      type: 'function',
      function: {
        name: 'execute_shell_command',
        description: '在云手机上执行 adb shell 命令并获取 stdout/stderr 结果',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: '要执行的 shell 命令，如 pm list packages -3 或 df -h /data' }
          },
          required: ['command']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_device_info',
        description: '获取当前云手机的名称、状态和设备型号及硬件参数',
        parameters: { type: 'object', properties: {} }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_webrtc_stats',
        description: '读取当前的 WebRTC 传输质量指标 (FPS, RTT 延迟, Jitter Buffer 缓冲、丢包率等)，用于卡顿排障',
        parameters: { type: 'object', properties: {} }
      }
    },
    {
      type: 'function',
      function: {
        name: 'simulate_keyevent',
        description: '发送物理按键事件，如 3 (HOME), 4 (BACK), 26 (POWER)',
        parameters: {
          type: 'object',
          properties: {
            keycode: { type: 'integer', description: 'Android KeyEvent 码值' }
          },
          required: ['keycode']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'simulate_touch',
        description: '在屏幕相对坐标上模拟点击操作',
        parameters: {
          type: 'object',
          properties: {
            x: { type: 'integer', description: '横轴 X 坐标点' },
            y: { type: 'integer', description: '纵轴 Y 坐标点' }
          },
          required: ['x', 'y']
        }
      }
    }
  ]

  const systemMessage = {
    role: 'system',
    content: `You are a cloud phone diagnostic and task execution assistant.
You are running on a virtual machine (device ID: ${props.deviceId}) inside the cloudphone operator panel.
You can execute real shell commands and collect details to troubleshoot network quality, memory leaks, system load, or app crashes.

Key requirements:
1. First, call get_device_info to check the device environment if you need basic info.
2. If the user complains about lag or WebRTC frozen, call get_webrtc_stats to diagnose Jitter Buffer (JB), RTT (network lag), and FPS. Explain recommendations to the user in Chinese.
3. Troubleshooting connection failures & blackscreen: If the user complains about connection timeout, failure, or blackscreen, you should directly inspect the Go agent logs located at '/data/local/tmp/cloudphone-agent.log' (e.g. by running 'su -c tail -n 200 /data/local/tmp/cloudphone-agent.log'). Specifically:
   a. Check if "No external NAT mappings configured" is printed. If yes, it indicates the agent is missing the host NAT IP (-external-addr or CP_AGENT_EXTERNAL_ADDR), causing cross-device routing failure.
   b. Inspect the ICE candidate IPs. Check if the device agent only bound local Docker private IPs (like 172.17.x.x) and if the client is using local proxy Tun modes (like Clash Tun 198.18.x.x) which blocks UDP connection checks.
   c. Verify that UDS channels (Video, Control, Touch) are all connected successfully.
   d. Check if CoreService exited unexpectedly, or if keyframe requests were skipped with reason "no-control-conn" or "no active codec" during initiation.
4. Be careful with command execution. Prefer safe, standard queries.
5. Output your responses and summaries exclusively in Chinese (中文).
`
  }

  while (iterations < maxIterations) {
    iterations++
    
    // 构建发送的上下文
    const apiMessages = [
      systemMessage,
      ...aiMessages.value
    ]

    logTrace('info', `发送请求至 LLM (${iterations}/${maxIterations})...`)
    
    const response = await fetch(`${aiUrl.value}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiKey.value}`
      },
      body: JSON.stringify({
        model: aiModel.value,
        messages: apiMessages,
        tools: tools,
        tool_choice: 'auto'
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      if (response.status === 401) {
        throw new Error(`LLM 接口返回 HTTP 401 (未经授权): 您的 API Key (Token) 无效。接口返回: ${errText}`)
      }
      throw new Error(`LLM 接口返回 HTTP ${response.status}: ${errText}`)
    }

    const data = await response.json()
    const choice = data.choices?.[0]
    if (!choice) {
      throw new Error('API 返回的数据结构异常，choices 为空')
    }

    const message = choice.message
    
    // 把 AI 的这一轮返回推入上下文中
    aiMessages.value.push(message)
    scrollToChatBottom()

    if (message.content) {
      logTrace('success', `AI 回复: ${message.content.substring(0, 50)}...`)
    }

    // 检查是否有 tool 触发
    if (message.tool_calls && message.tool_calls.length > 0) {
      logTrace('info', `发现 ${message.tool_calls.length} 个工具调用请求，开始处理...`)
      
      for (const toolCall of message.tool_calls) {
        const { name, arguments: argsStr } = toolCall.function
        let args = {}
        try {
          args = JSON.parse(argsStr)
        } catch (e) {
          console.warn('Failed to parse tool arguments:', argsStr)
        }

        logTrace('tool', `🔧 正在调用: ${name}(${JSON.stringify(args)})`)
        let toolResultStr = ''
        
        try {
          const result = await executeAgentTool(name, args)
          toolResultStr = typeof result === 'object' ? JSON.stringify(result) : String(result)
          logTrace('success', `🔧 [${name}] 执行成功。内容字节: ${toolResultStr.length}`)
        } catch (toolError) {
          toolResultStr = `Error: ${toolError.message}`
          logTrace('error', `🔧 [${name}] 执行失败: ${toolError.message}`)
        }

        // 将工具执行结果推回上下文中
        aiMessages.value.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: name,
          content: toolResultStr
        })
      }
      
      // 继续下一轮迭代，让模型拿到工具执行结果继续思考
      scrollToChatBottom()
      continue
    }

    // 如果没有 tool 调用了，说明这一轮 AI 助手已经给出了最终结论，跳出循环
    break
  }

  if (iterations >= maxIterations) {
    logTrace('warning', 'AI Agent 调用次数达到上限，强制结束思考')
  }
}

async function executeAgentTool(name, args) {
  if (!webrtc.value) {
    throw new Error('设备 WebRTC 实例未连接，无法执行指令')
  }

  switch (name) {
    case 'execute_shell_command':
      if (!args.command) throw new Error('缺少 command 参数')
      logTrace('info', `[ADB Shell] 执行: "${args.command}"`)
      const res = await webrtc.value.executeCommandP2P(args.command)
      return {
        exit_code: res.exit_code,
        stdout: res.stdout || '',
        stderr: res.stderr || ''
      }
      
    case 'get_device_info':
      const targetDev = deviceStore.devices.find(d => d.id === props.deviceId)
      return {
        device_id: props.deviceId,
        model: targetDev?.model || 'Generic Redroid',
        tags: deviceStore.deviceTags[props.deviceId] || [],
        webrtc_status: webrtcStatus.value,
        agent_version: webrtc.value.agentVersion.value
      }

    case 'get_webrtc_stats':
      const stats = await webrtc.value.getVideoStats()
      if (!stats) return { error: '无法获取当前 WebRTC stats, 视频可能未连接' }
      return stats

    case 'simulate_keyevent':
      if (args.keycode === undefined) throw new Error('缺少 keycode 参数')
      webrtc.value.sendInjectKeycode(0, args.keycode)
      await new Promise(r => setTimeout(r, 50))
      webrtc.value.sendInjectKeycode(1, args.keycode)
      return { status: 'success', keycode: args.keycode }

    case 'simulate_touch':
      if (args.x === undefined || args.y === undefined) throw new Error('缺少坐标参数')
      const targetCoord = { x: args.x, y: args.y }
      webrtc.value.sendTouch(0, args.x, args.y, -1, targetCoord)
      await new Promise(r => setTimeout(r, 60))
      webrtc.value.sendTouch(1, args.x, args.y, -1, targetCoord)
      return { status: 'success', clicked: targetCoord }

    default:
      throw new Error(`未知的工具: ${name}`)
  }
}



// 侦听变化
watch(() => props.deviceId, (newId) => {
  if (newId) {
    setupDeviceConnection(newId, false)
  }
})

// 监听活动连接的重建，保持同步
watch(() => deviceStore.activeWebRTCMap, (newMap) => {
  if (props.deviceId && newMap.has(props.deviceId)) {
    console.log('[Console] Active WebRTC changed, updating console connection...')
    setupDeviceConnection(props.deviceId, false)
  }
}, { deep: true })

function startResizingConsole(e) {
  e.preventDefault()
  const startY = e.clientY
  const startHeight = deviceStore.globalConsoleHeight

  const onMouseMove = (ev) => {
    const dy = ev.clientY - startY
    // 向上拉 dy 为负，所以 startHeight - dy 就是变大
    const newHeight = startHeight - dy
    deviceStore.setConsoleHeight(newHeight)
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

let resizeObserver = null

onMounted(() => {
  setupDeviceConnection(props.deviceId, false)
  loadShortcuts()
  quickTextStore.fetchQuickTexts()
  tagStore.load()
  
  if (typeof ResizeObserver !== 'undefined' && consoleMainRef.value) {
    resizeObserver = new ResizeObserver(() => {
      // 当容器高度或宽度变化时，让当前连接活跃的 ADB 终端自适应
      const activeSess = adbSessions.value.find(s => s.id === activeSessionId.value)
      if (activeSess && activeSess.isConnected && activeSess.adbInstance) {
        activeSess.adbInstance.resize()
      }
    })
    resizeObserver.observe(consoleMainRef.value)
  }
})

onUnmounted(() => {
  cleanupConnection()
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<style scoped>
.device-console {
  display: flex;
  flex-direction: column;
  width: 100%;
  flex: 1;
  background: #0f0f1a;
  color: #f0f6fc;
  border-radius: 12px 12px 0 0;
  overflow: hidden;
  box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.02), 0 -8px 32px rgba(0, 0, 0, 0.5);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
}

.console-resizer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 6px;
  cursor: ns-resize;
  z-index: 100;
  background: transparent;
  transition: background 0.2s;
}

.console-resizer:hover {
  background: rgba(88, 166, 255, 0.45);
}

/* 选项卡头部栏 */
.console-tabs-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #161b22;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0 16px;
  flex-shrink: 0;
  user-select: none;
}

.console-right-tools {
  display: flex;
  align-items: center;
  gap: 12px;
}

.console-close-btn {
  background: none;
  border: none;
  color: #8b949e;
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.console-close-btn:hover {
  color: #f85149;
  background: rgba(248, 81, 73, 0.15);
}

.console-close-btn svg {
  width: 16px;
  height: 16px;
}

.tabs-group {
  display: flex;
  gap: 4px;
}

.tabs-group button {
  background: none;
  border: none;
  color: #8b949e;
  padding: 14px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
}

.tabs-group button.active {
  color: #58a6ff;
  border-bottom-color: #58a6ff;
  background: rgba(88, 166, 255, 0.06);
}

.tabs-group button:hover:not(.active) {
  color: #c9d1d9;
  background: rgba(255, 255, 255, 0.03);
}

.tab-icon {
  width: 16px;
  height: 16px;
}

.beta-badge {
  background: rgba(233, 69, 96, 0.2);
  color: #e94560;
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 4px;
  border: 1px solid rgba(233, 69, 96, 0.3);
  margin-left: 2px;
}

.console-device-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.3);
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  font-family: monospace;
  font-size: 12px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8b949e;
}

.status-indicator.connected {
  background: #3fb950;
  box-shadow: 0 0 8px rgba(63, 185, 80, 0.6);
}

.status-indicator.connecting {
  background: #dbb32d;
  animation: pulse 1s infinite alternate;
}

.status-indicator.error {
  background: #f85149;
  box-shadow: 0 0 8px rgba(248, 81, 73, 0.6);
}

.console-link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 4px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.console-link-btn.connect {
  background: rgba(46, 160, 67, 0.15);
  color: #3fb950;
  border-color: rgba(46, 160, 67, 0.3);
}

.console-link-btn.connect:hover {
  background: rgba(46, 160, 67, 0.25);
  border-color: #3fb950;
}

.console-link-btn.disconnect {
  background: rgba(248, 81, 73, 0.12);
  color: #f85149;
  border-color: rgba(248, 81, 73, 0.3);
}

.console-link-btn.disconnect:hover {
  background: rgba(248, 81, 73, 0.22);
  border-color: #f85149;
}

.console-link-btn.connecting {
  background: rgba(210, 153, 34, 0.15);
  color: #d29922;
  border-color: rgba(210, 153, 34, 0.3);
  cursor: not-allowed;
}

.adb-disconnect-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 14px;
  background: rgba(248, 81, 73, 0.12);
  border-bottom: 1px solid rgba(248, 81, 73, 0.25);
  color: #ff7b72;
  font-size: 12px;
}

.adb-disconnect-notice .notice-warn-icon {
  width: 14px;
  height: 14px;
  stroke: #ff7b72;
  flex-shrink: 0;
}

.adb-disconnect-notice .notice-text {
  flex: 1;
}

.adb-disconnect-notice .notice-reconnect-btn {
  padding: 3px 10px;
  font-size: 11px;
  border-radius: 4px;
  background: rgba(248, 81, 73, 0.2);
  border: 1px solid rgba(248, 81, 73, 0.4);
  color: #ff7b72;
  cursor: pointer;
  transition: all 0.2s;
}

.adb-disconnect-notice .notice-reconnect-btn:hover {
  background: rgba(248, 81, 73, 0.35);
  color: #ffffff;
}

.adb-hint-warn {
  color: #d29922 !important;
  font-size: 12px;
  margin-top: 4px;
}

.console-toast {
  position: absolute;
  top: 44px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
  padding: 7px 16px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  pointer-events: none;
}

.console-toast.warning {
  background: rgba(210, 153, 34, 0.95);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.console-toast.info {
  background: rgba(31, 111, 235, 0.95);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.console-fade-enter-active,
.console-fade-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}

.console-fade-enter-from,
.console-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -10px);
}

@keyframes pulse {
  0% { opacity: 0.4; }
  100% { opacity: 1; }
}

/* 选项卡内容区 */
.console-tab-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  position: relative;
  background: #000000;
}

/* 1. Shell 选项卡样式 */
.shell-tab-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  overflow: hidden;
}

.console-history {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 12px;
  background: #06060c;
  line-height: 1.5;
}

.console-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 70%;
  color: #44445c;
  gap: 12px;
}

.empty-icon {
  width: 40px;
  height: 40px;
}

.log-item {
  margin-bottom: 12px;
  animation: fadeIn 0.2s ease-out;
}

.log-cmd {
  color: #58a6ff;
  font-weight: bold;
}

.log-out {
  white-space: pre-wrap;
  word-break: break-all;
  margin: 4px 0 0 0;
  color: #c9d1d9;
}

.log-item.error .log-out {
  color: #ff5555;
  background: rgba(255, 85, 85, 0.05);
  padding: 4px 8px;
  border-radius: 4px;
}

.log-item.success .log-out {
  color: #50fa7b;
}

.console-shortcuts {
  display: flex;
  padding: 8px 16px;
  gap: 8px;
  background: #161b22;
  overflow-x: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.console-shortcuts button {
  background: #21262d;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #8b949e;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;
}

.console-shortcuts button:hover {
  background: #30363d;
  color: #f0f6fc;
  border-color: #8b949e;
}

.console-input-group {
  display: flex;
  padding: 12px 16px;
  gap: 8px;
  background: #161b22;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.cmd-input {
  flex: 1;
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #fff;
  padding: 8px 12px;
  border-radius: 6px;
  outline: none;
  font-size: 13px;
}

.cmd-input:focus {
  border-color: #58a6ff;
  box-shadow: 0 0 8px rgba(88, 166, 255, 0.2);
}

.send-btn {
  background: #58a6ff;
  color: white;
  border: none;
  padding: 0 18px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.send-btn:hover:not(:disabled) {
  background: #1f85ff;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 2. ADB 交互终端样式 */
.adb-tab-panel {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.adb-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px;
  color: #8b949e;
  background: #0c0c14;
}

.adb-icon {
  width: 64px;
  height: 64px;
  color: #58a6ff;
  margin-bottom: 16px;
  opacity: 0.7;
}

.adb-placeholder h3 {
  color: #f0f6fc;
  font-size: 16px;
  margin-bottom: 8px;
}

.adb-placeholder p {
  font-size: 13px;
  max-width: 420px;
  margin-bottom: 20px;
  line-height: 1.6;
}

.adb-connect-btn {
  background: #58a6ff;
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.adb-connect-btn:hover:not(:disabled) {
  background: #1f85ff;
}

.adb-connect-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.xterm-view-container {
  flex: 1;
  width: 100%;
  height: 0;
  min-height: 0;
  padding: 12px;
  box-sizing: border-box;
  background: #000;
}

/* 3. AI 助手界面样式 */
.ai-tab-panel {
  flex: 1;
  display: flex;
  height: 100%;
  overflow: hidden;
  background: #0c0c14;
}

/* 快捷技能侧边栏 */
.ai-skills-sidebar {
  width: 200px;
  background: #121221;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.sidebar-header h4 {
  font-size: 12px;
  font-weight: 600;
  color: #8b949e;
  margin: 0;
}

.add-skill-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #8b949e;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.add-skill-btn:hover {
  background: rgba(88, 166, 255, 0.1);
  color: #58a6ff;
  border-color: #58a6ff;
}

.skills-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skill-item {
  background: #1c1c2e;
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: all 0.2s;
  width: 100%;
}

.skill-item:hover:not(:disabled) {
  border-color: #58a6ff;
  background: rgba(88, 166, 255, 0.05);
  transform: translateY(-1px);
}

.skill-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.skill-name {
  font-size: 11px;
  font-weight: bold;
  color: #f0f6fc;
  margin-bottom: 2px;
}

.skill-desc {
  font-size: 9px;
  color: #8b949e;
  line-height: 1.3;
}

.skill-delete {
  position: absolute;
  top: 4px;
  right: 6px;
  color: #f85149;
  font-size: 14px;
  opacity: 0.6;
  cursor: pointer;
  transition: opacity 0.2s;
}

.skill-delete:hover {
  opacity: 1;
}

/* AI 对话主区域 */
.ai-main-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.ai-config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #121221;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 11px;
  color: #8b949e;
  flex-shrink: 0;
}

.ai-settings-toggle {
  background: none;
  border: none;
  color: #8b949e;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-settings-toggle:hover {
  color: #f0f6fc;
}

.ai-settings-toggle .icon {
  width: 12px;
  height: 12px;
}

.ai-model-badge {
  background: rgba(88, 166, 255, 0.1);
  color: #58a6ff;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

/* Settings Drawer */
.ai-settings-panel {
  background: #161b22;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 10;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.form-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.form-row label {
  width: 110px;
  font-size: 12px;
  color: #8b949e;
  text-align: right;
}

.form-row input {
  flex: 1;
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: white;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  outline: none;
}

.password-input-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.password-input-wrapper input {
  width: 100%;
  padding-right: 32px;
}

.eye-toggle-btn {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  color: #8b949e;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
  outline: none;
}

.eye-toggle-btn:hover {
  color: white;
}

.eye-toggle-btn .icon {
  width: 15px;
  height: 15px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.save-settings-btn {
  background: #3fb950;
  color: white;
  border: none;
  padding: 5px 14px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.save-settings-btn:hover {
  background: #2ea043;
}

/* System Action Tracing Logs */
.ai-trace-panel {
  background: #09090f;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  max-height: 120px;
  overflow-y: auto;
  padding: 8px 16px;
  display: flex;
  flex-direction: column;
  font-family: monospace;
  font-size: 10px;
}

.trace-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #8b949e;
  margin-bottom: 4px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
  padding-bottom: 4px;
}

.clear-trace-btn {
  background: none;
  border: none;
  color: #f85149;
  cursor: pointer;
  font-size: 9px;
}

.trace-log-line {
  display: flex;
  gap: 8px;
  line-height: 1.4;
}

.trace-time {
  color: #44445c;
  flex-shrink: 0;
}

.trace-text.system { color: #8b949e; }
.trace-text.info { color: #58a6ff; }
.trace-text.tool { color: #e94560; font-weight: bold; }
.trace-text.success { color: #50fa7b; }
.trace-text.error { color: #ff5555; }
.trace-text.warning { color: #ffb86c; }

/* 聊天内容区 */
.ai-chat-history {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #07070d;
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 90%;
  text-align: center;
  color: #8b949e;
}

.chat-empty h3 {
  color: #f0f6fc;
  font-size: 16px;
  margin-bottom: 6px;
}

.chat-empty p {
  font-size: 12px;
  line-height: 1.6;
  max-width: 440px;
}

.chat-bubble-wrapper {
  display: flex;
  width: 100%;
}

.chat-bubble-wrapper.user {
  justify-content: flex-end;
}

.chat-bubble-wrapper.assistant {
  justify-content: flex-start;
}

.chat-bubble {
  max-width: 85%;
  border-radius: 12px;
  padding: 10px 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  position: relative;
}

.chat-bubble-wrapper.user .chat-bubble {
  background: #1f6feb;
  color: white;
  border-bottom-right-radius: 2px;
}

.chat-bubble-wrapper.assistant .chat-bubble {
  background: #161b22;
  color: #c9d1d9;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom-left-radius: 2px;
}

.bubble-header {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 4px;
  font-weight: bold;
}

.chat-bubble-wrapper.user .bubble-header {
  text-align: right;
}

.bubble-content {
  font-size: 12.5px;
  line-height: 1.5;
}

.formatted-text {
  white-space: pre-wrap;
  word-break: break-all;
  font-family: inherit;
  margin: 0;
}

.tool-calls-display {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  border-top: 1px dashed rgba(255, 255, 255, 0.06);
  padding-top: 6px;
}

.tool-badge {
  font-size: 10px;
  color: #ffb86c;
  background: rgba(255, 184, 108, 0.08);
  padding: 3px 8px;
  border-radius: 4px;
  font-family: monospace;
}

/* AI 等待加载点动画 */
.loading-state .chat-bubble {
  background: #161b22;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  padding: 12px 20px;
}

.loading-dots {
  display: flex;
  gap: 4px;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  background: #58a6ff;
  border-radius: 50%;
  animation: dot-bounce 1.4s infinite ease-in-out both;
}

.loading-dots span:nth-child(1) { animation-delay: -0.32s; }
.loading-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes dot-bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1.0); }
}

.loading-tip {
  font-size: 9px;
  color: #8b949e;
}

/* AI 输入区 */
.ai-input-group {
  display: flex;
  padding: 12px 16px;
  gap: 8px;
  background: #121221;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.ai-chat-input {
  flex: 1;
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  outline: none;
  font-size: 13px;
  resize: none;
  font-family: inherit;
}

.ai-chat-input:focus {
  border-color: #58a6ff;
}

.ai-send-btn {
  background: #58a6ff;
  color: white;
  border: none;
  padding: 0 16px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
  align-self: flex-end;
  height: 38px;
}

.ai-send-btn:hover:not(:disabled) {
  background: #1f85ff;
}

.ai-send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Transition Animations */
.slide-enter-active, .slide-leave-active {
  transition: all 0.2s ease-out;
}
.slide-enter-from, .slide-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

/* 响应式样式 (移动端适配) */
@media (max-width: 768px) {
  .ai-tab-panel,
  .text-tab-panel {
    flex-direction: column;
  }
  
  .ai-skills-sidebar,
  .quick-text-sidebar {
    width: 100%;
    height: 110px;
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  
  .skills-list,
  .quick-text-items {
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 6px;
    height: 76px;
  }
  
  .skill-item,
  .quick-text-card {
    width: 140px;
    flex-shrink: 0;
  }
}

.device-selector-dropdown {
  background: #21262d;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: #c9d1d9;
  font-family: monospace;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  padding: 4px 8px;
  transition: border-color 0.2s;
}

.device-selector-dropdown:hover {
  border-color: #58a6ff;
}

.device-selector-dropdown option {
  background: #161b22;
  color: #c9d1d9;
}

/* 全屏最大化样式 */
.device-console.is-maximized {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw !important;
  height: 100vh !important;
  z-index: 2100;
  border-radius: 0;
  border-top: none;
}

/* 控制台顶部工具按钮 */
.console-tool-btn {
  background: none;
  border: none;
  color: #8b949e;
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.console-tool-btn:hover {
  color: #58a6ff;
  background: rgba(88, 166, 255, 0.15);
}

.console-tool-btn svg {
  width: 15px;
  height: 15px;
}

/* 二级 ADB 多会话终端 Tab 栏样式 */
.adb-sessions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #0d1117;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding: 0 12px;
  height: 36px;
  flex-shrink: 0;
  user-select: none;
}

.adb-tabs-group {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 100%;
}

.adb-session-tab {
  background: none;
  border: none;
  color: #8b949e;
  padding: 0 12px;
  height: 28px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.adb-session-tab:hover {
  color: #c9d1d9;
  background: rgba(255, 255, 255, 0.03);
}

.adb-session-tab.active {
  color: #58a6ff;
  background: rgba(88, 166, 255, 0.1);
  font-weight: 600;
}

.tab-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #8b949e;
}

.tab-status-dot.connected {
  background: #3fb950;
  box-shadow: 0 0 8px rgba(63, 185, 80, 0.5);
}

.tab-status-dot.disconnected {
  background: #f85149;
  box-shadow: 0 0 6px rgba(248, 81, 73, 0.4);
}

.close-sess-btn {
  font-size: 14px;
  line-height: 1;
  color: #8b949e;
  transition: color 0.2s;
  padding: 2px;
  border-radius: 50%;
}

.close-sess-btn:hover {
  color: #f85149;
  background: rgba(248, 81, 73, 0.15);
}

.add-sess-btn {
  background: none;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  color: #8b949e;
  width: 22px;
  height: 22px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
  padding: 0;
}

.add-sess-btn:hover:not(:disabled) {
  color: #58a6ff;
  border-color: #58a6ff;
  background: rgba(88, 166, 255, 0.05);
}

.add-sess-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.max-sess-tip {
  font-size: 11px;
  color: #484f58;
}

/* 批量 Shell 样式系统 */
.batch-shell-tab-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  box-sizing: border-box;
  overflow: hidden;
}

.batch-shell-devices-selector {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 批量与单台整合终端样式 */
.shell-targets-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #161b22;
  border-top: 1px solid #30363d;
  border-bottom: 1px solid #30363d;
  padding: 8px 16px;
  box-sizing: border-box;
}

.targets-control-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  width: 100%;
}

.select-all-check {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  color: #c9d1d9;
  cursor: pointer;
  user-select: none;
}

.select-all-check input {
  margin-right: 6px;
  cursor: pointer;
}

.tag-filters {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.tag-filter-label {
  font-size: 12px;
  color: #8b949e;
}

.tag-filter-btn {
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 12px;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
  font-weight: 500;
  background: transparent;
}

.tag-filter-btn:hover {
  filter: brightness(1.2);
}

.shell-targets-bar .label {
  font-size: 12px;
  font-weight: 600;
  color: #8b949e;
}

.shell-targets-bar .targets-list {
  display: flex;
  align-items: center;
  gap: 12px;
}

.target-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #c9d1d9;
  cursor: pointer;
  user-select: none;
}

.target-check.current {
  opacity: 0.8;
  cursor: default;
}

.target-check input[type="checkbox"] {
  width: 13px;
  height: 13px;
  accent-color: #58a6ff;
  cursor: pointer;
}

.target-check.current input[type="checkbox"] {
  cursor: default;
}

/* 整合历史面板中的批量输出渲染 */
.log-item.batch_result {
  border-left: 2px solid #58a6ff;
  padding-left: 8px;
  margin: 12px 0;
  background: rgba(88, 166, 255, 0.02);
}

.batch-outputs-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.batch-output-row {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 4px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.batch-output-row.running {
  border-color: rgba(210, 153, 34, 0.4);
}

.batch-output-row.success {
  border-color: rgba(46, 160, 67, 0.4);
}

.batch-output-row.failed {
  border-color: rgba(248, 81, 73, 0.4);
}

.batch-output-row .row-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.batch-output-row .dev-tag {
  font-size: 12px;
  font-weight: 600;
  color: #c9d1d9;
}

.batch-output-row .status-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 600;
}

.batch-output-row .status-tag.running {
  background: rgba(210, 153, 34, 0.15);
  color: #d29922;
}

.batch-output-row .status-tag.success {
  background: rgba(46, 160, 67, 0.15);
  color: #56d364;
}

.batch-output-row .status-tag.failed {
  background: rgba(248, 81, 73, 0.15);
  color: #ff7b72;
}

.batch-output-row .dev-output {
  margin: 0;
  font-family: SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace;
  font-size: 12px;
  line-height: 1.5;
  color: #c9d1d9;
  white-space: pre-wrap;
  word-break: break-all;
  background: #0d1117;
  padding: 6px 10px;
  border-radius: 4px;
}

/* 覆盖 xterm.js 视口与屏幕渲染的底部留白，防输入行遮挡 */
:deep(.xterm-viewport) {
  padding-bottom: 32px !important;
}
:deep(.xterm-screen) {
  padding-bottom: 32px !important;
}

.console-shortcuts button.system-btn {
  background: rgba(88, 166, 255, 0.1);
  color: #58a6ff;
  border-color: rgba(88, 166, 255, 0.2);
}

.console-shortcuts button.system-btn:hover {
  background: rgba(88, 166, 255, 0.2);
  color: #58a6ff;
  border-color: #58a6ff;
}

.console-shortcuts button.edit-btn {
  margin-left: auto;
}

/* 自定义快捷指令弹窗 */
.shortcut-modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.shortcut-modal-card {
  width: 90%;
  max-width: 600px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  max-height: 80%;
  animation: modalEnter 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.shortcut-modal-card .modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #30363d;
}

.shortcut-modal-card .modal-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #f0f6fc;
}

.shortcut-modal-card .modal-header .close-btn {
  background: transparent;
  border: none;
  color: #8b949e;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
}

.shortcut-modal-card .modal-header .close-btn:hover {
  color: #f0f6fc;
}

.shortcut-modal-card .modal-body {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.shortcut-item-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  background: #0d1117;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid #21262d;
}

.shortcut-item-row .input-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.shortcut-item-row .input-col label {
  font-size: 11px;
  color: #8b949e;
}

.shortcut-item-row .input-col input {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 4px;
  color: #c9d1d9;
  padding: 6px 10px;
  font-size: 12px;
  outline: none;
}

.shortcut-item-row .input-col input:focus {
  border-color: #58a6ff;
}

.shortcut-item-row .name-col {
  flex: 1;
}

.shortcut-item-row .cmd-col {
  flex: 2;
}

.shortcut-item-row .delete-btn {
  background: transparent;
  border: none;
  color: #f85149;
  cursor: pointer;
  padding: 8px;
  font-size: 14px;
}

.shortcut-item-row .delete-btn:hover {
  opacity: 0.8;
}

.no-shortcuts {
  text-align: center;
  color: #8b949e;
  padding: 20px 0;
  font-size: 12px;
}

.add-row-btn {
  background: transparent;
  border: 1px dashed #30363d;
  color: #58a6ff;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
  text-align: center;
}

.add-row-btn:hover {
  background: rgba(88, 166, 255, 0.05);
  border-color: #58a6ff;
}

.shortcut-modal-card .modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid #30363d;
  background: #0d1117;
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
}

.shortcut-modal-card .modal-footer .btn {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid transparent;
}

.shortcut-modal-card .modal-footer .btn-reset {
  background: transparent;
  border-color: #30363d;
  color: #f85149;
}

.shortcut-modal-card .modal-footer .btn-reset:hover {
  background: rgba(248, 81, 73, 0.05);
}

.shortcut-modal-card .modal-footer .footer-actions {
  display: flex;
  gap: 8px;
}

.shortcut-modal-card .modal-footer .btn-cancel {
  background: transparent;
  border-color: #30363d;
  color: #c9d1d9;
}

.shortcut-modal-card .modal-footer .btn-cancel:hover {
  background: rgba(255, 255, 255, 0.05);
}

.shortcut-modal-card .modal-footer .btn-save {
  background: #238636;
  color: #fff;
}

.shortcut-modal-card .modal-footer .btn-save:hover {
  background: #2ea043;
}

/* 4. 文本下发面板样式 (左侧快捷短语侧边栏 + 右侧主操作区) */
.text-tab-panel {
  display: flex;
  flex-direction: row;
  height: 100%;
  width: 100%;
  background: #0d1117;
  overflow: hidden;
}

/* 快捷短语侧边栏 (对标 AI 助手的快捷技能侧边栏) */
.quick-text-sidebar {
  width: 220px;
  background: #121221;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.add-qt-btn, .manage-qt-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #8b949e;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}

.add-qt-btn:hover {
  background: rgba(88, 166, 255, 0.15);
  color: #58a6ff;
  border-color: #58a6ff;
}

.manage-qt-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #f0f6fc;
}

.quick-text-items {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quick-text-card {
  background: #1c1c2e;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
  transition: all 0.18s ease;
  position: relative;
}

.quick-text-card:hover {
  border-color: #58a6ff;
  background: rgba(88, 166, 255, 0.06);
  transform: translateY(-1px);
}

.qt-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.qt-card-title {
  font-size: 12px;
  font-weight: 600;
  color: #e6edf3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qt-card-enter-badge {
  font-size: 10px;
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  padding: 0 4px;
  border-radius: 3px;
  font-weight: 700;
}

.qt-card-snippet {
  font-size: 11px;
  color: #8b949e;
  word-break: break-all;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}

.qt-card-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  opacity: 0.6;
  transition: opacity 0.15s;
}

.quick-text-card:hover .qt-card-actions {
  opacity: 1;
}

.qt-card-action {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.12s;
}

.send-btn-mini {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border-color: rgba(56, 189, 248, 0.3);
}

.send-btn-mini:hover {
  background: rgba(56, 189, 248, 0.3);
  color: #7dd3fc;
}

.del-btn-mini {
  background: transparent;
  color: #8b949e;
  font-size: 12px;
  padding: 1px 5px;
}

.del-btn-mini:hover {
  color: #f85149;
  background: rgba(248, 81, 73, 0.15);
}

.qt-sidebar-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px 10px;
  color: #6e7681;
  font-size: 12px;
  gap: 8px;
}

.qt-empty-add-btn {
  background: rgba(88, 166, 255, 0.1);
  border: 1px solid rgba(88, 166, 255, 0.25);
  color: #58a6ff;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.qt-empty-add-btn:hover {
  background: rgba(88, 166, 255, 0.2);
}

/* 文本主操作区域 (右侧) */
.text-main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  background: #0d1117;
}

.text-history {
  flex: 1;
  min-height: 120px;
  overflow-y: auto;
  padding: 12px;
}

.text-log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
}

.text-log-badge {
  color: #58a6ff;
  font-weight: 600;
}

.text-log-time {
  color: #8b949e;
  font-size: 11px;
}

.text-log-targets-summary {
  color: #e6edf3;
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 6px;
  border-radius: 4px;
}

.text-log-mode-tag, .text-log-enter-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.3);
}

.text-log-enter-tag {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  border-color: rgba(34, 197, 94, 0.3);
}

.text-log-body {
  background: #161b22;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 8px 12px;
  margin: 4px 0 6px 0;
  color: #f0f6fc;
  font-family: inherit;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-word;
}

.text-log-dev-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.text-dev-pill {
  font-size: 11px;
  color: #8b949e;
  background: rgba(255, 255, 255, 0.04);
  padding: 1px 6px;
  border-radius: 3px;
}

/* 文本输入与下发底部区域 */
.text-input-section {
  padding: 10px 14px;
  background: #161b22;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.batch-text-textarea {
  width: 100%;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 8px 12px;
  color: #f0f6fc;
  font-size: 13px;
  resize: vertical;
  min-height: 52px;
  box-sizing: border-box;
  outline: none;
  font-family: inherit;
  transition: border-color 0.2s;
}

.batch-text-textarea:focus {
  border-color: #58a6ff;
  box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.15);
}

.text-input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text-options {
  display: flex;
  align-items: center;
  gap: 12px;
}

.text-options .checkbox-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #c9d1d9;
  cursor: pointer;
  user-select: none;
}

.text-char-count {
  font-size: 11px;
  color: #6e7681;
}

.btn-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.clear-text-btn {
  padding: 6px 12px;
  background: transparent;
  border: 1px solid #30363d;
  color: #8b949e;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

.clear-text-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
  color: #f0f6fc;
}

.text-send-btn {
  padding: 6px 16px;
  font-weight: 600;
  background: linear-gradient(135deg, #1f6feb 0%, #238636 100%);
  border: none;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.text-send-btn:hover:not(:disabled) {
  opacity: 0.92;
  box-shadow: 0 2px 8px rgba(35, 134, 54, 0.4);
}

.targets-selected-summary {
  margin-left: auto;
  font-size: 12px;
  color: #58a6ff;
  font-weight: 500;
}

/* 快捷短语管理模态框 */
.quick-text-modal-card {
  max-width: 680px;
  width: 90%;
}

.modal-intro-tip {
  font-size: 12px;
  color: #8b949e;
  margin-bottom: 12px;
}

.quick-text-edit-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.quick-text-edit-row {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-row-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.edit-title-input {
  flex: 1;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 6px 10px;
  color: #f0f6fc;
  font-size: 13px;
  outline: none;
}

.edit-title-input:focus {
  border-color: #58a6ff;
}

.auto-enter-check {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #8b949e;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.edit-content-textarea {
  width: 100%;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 6px 10px;
  color: #f0f6fc;
  font-size: 13px;
  outline: none;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
}

.edit-content-textarea:focus {
  border-color: #58a6ff;
}

/* 5. 批量安装与文件传输面板样式 */
.files-tab-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #0d1117;
  overflow: hidden;
}

.files-targets-bar {
  flex-shrink: 0;
}

.files-main-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 16px;
  padding: 16px;
  overflow-y: auto;
  box-sizing: border-box;
}

@media (max-width: 900px) {
  .files-main-grid {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 12px;
  }
}

.files-config-card,
.files-dashboard-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
}

.card-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: #f0f6fc;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.clear-task-btn {
  background: rgba(248, 81, 73, 0.12);
  border: 1px solid rgba(248, 81, 73, 0.3);
  color: #f85149;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.clear-task-btn:hover {
  background: rgba(248, 81, 73, 0.25);
  border-color: rgba(248, 81, 73, 0.5);
}

.upload-dropzone {
  border: 2px dashed #30363d;
  border-radius: 8px;
  padding: 16px 12px;
  text-align: center;
  cursor: pointer;
  background: rgba(22, 27, 34, 0.5);
  transition: all 0.2s;
  position: relative;
}

.upload-dropzone:hover,
.upload-dropzone.dragging {
  border-color: #58a6ff;
  background: rgba(88, 166, 255, 0.08);
}

.file-input-hidden {
  display: none;
}

.dropzone-icon {
  width: 28px;
  height: 28px;
  stroke: #58a6ff;
  margin-bottom: 6px;
}

.dropzone-text {
  font-size: 12px;
  color: #8b949e;
  line-height: 1.5;
}

.dropzone-text a {
  color: #58a6ff;
  text-decoration: none;
  font-weight: 600;
}

.dropzone-sub {
  margin: 4px 0 0 0;
  font-size: 11px;
  color: #6e7681;
}

.uploaded-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.file-name-badge {
  font-size: 12px;
  font-weight: 600;
  color: #58a6ff;
  word-break: break-all;
}

.file-size-badge {
  font-size: 11px;
  color: #8b949e;
}

.clear-file-btn {
  background: rgba(248, 81, 73, 0.15);
  border: 1px solid rgba(248, 81, 73, 0.3);
  color: #f85149;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
}

.dropzone-progress {
  margin-top: 10px;
  position: relative;
  background: #21262d;
  border-radius: 4px;
  height: 18px;
  overflow: hidden;
}

.progress-bar-fill {
  background: linear-gradient(90deg, #1f6feb, #238636);
  height: 100%;
  transition: width 0.2s ease;
}

.progress-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12px;
  font-weight: 600;
  color: #c9d1d9;
}

.form-select,
.form-input {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 8px 10px;
  color: #f0f6fc;
  font-size: 12px;
  outline: none;
  box-sizing: border-box;
  width: 100%;
}

.form-select:focus,
.form-input:focus {
  border-color: #58a6ff;
}

.form-row {
  display: flex;
  gap: 10px;
}

.form-item.half {
  flex: 1;
}

.form-actions {
  margin-top: 4px;
}

.submit-batch-btn {
  background: #238636;
  border: 1px solid rgba(240, 246, 252, 0.1);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  padding: 9px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.submit-batch-btn:hover:not(:disabled) {
  background: #2ea043;
}

.submit-batch-btn:disabled {
  background: #21262d;
  color: #484f58;
  border-color: transparent;
  cursor: not-allowed;
}

.task-summary-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 8px 12px;
}

.task-meta-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.task-id-tag {
  font-family: monospace;
  font-size: 11px;
  color: #58a6ff;
  background: rgba(88, 166, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.task-type-badge {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.task-time-text {
  font-size: 11px;
  color: #8b949e;
}

.task-stats-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.stat-pill {
  font-size: 11px;
  color: #c9d1d9;
  background: #21262d;
  padding: 2px 8px;
  border-radius: 999px;
}

.stat-pill.success {
  color: #3fb950;
  background: rgba(46, 160, 67, 0.15);
}

.stat-pill.failed {
  color: #f85149;
  background: rgba(248, 81, 73, 0.15);
}

.dual-progress-bar {
  display: flex;
  height: 6px;
  background: #21262d;
  border-radius: 3px;
  overflow: hidden;
}

.progress-seg.success {
  background: #238636;
  transition: width 0.3s ease;
}

.progress-seg.failed {
  background: #da3633;
  transition: width 0.3s ease;
}

.subtask-table-wrap {
  flex: 1;
  overflow-y: auto;
  max-height: 280px;
  border: 1px solid #30363d;
  border-radius: 6px;
}

.subtask-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  text-align: left;
}

.subtask-table th {
  background: #161b22;
  color: #8b949e;
  padding: 8px 10px;
  font-weight: 600;
  border-bottom: 1px solid #30363d;
  position: sticky;
  top: 0;
  z-index: 2;
}

.subtask-table td {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  color: #c9d1d9;
  vertical-align: middle;
}

.dev-id-cell {
  font-weight: 600;
  color: #f0f6fc;
  font-family: monospace;
}

.status-pill {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.status-pill.queued {
  background: rgba(139, 148, 158, 0.15);
  color: #8b949e;
}

.status-pill.running {
  background: rgba(88, 166, 255, 0.15);
  color: #58a6ff;
}

.status-pill.success {
  background: rgba(46, 160, 67, 0.15);
  color: #3fb950;
}

.status-pill.failed {
  background: rgba(248, 81, 73, 0.15);
  color: #f85149;
}

.sub-progress-track {
  display: inline-block;
  width: 60px;
  height: 6px;
  background: #21262d;
  border-radius: 3px;
  overflow: hidden;
  margin-right: 6px;
  vertical-align: middle;
}

.sub-progress-fill {
  height: 100%;
  background: #238636;
  transition: width 0.2s;
}

.view-output-btn {
  background: rgba(88, 166, 255, 0.12);
  border: 1px solid rgba(88, 166, 255, 0.3);
  color: #58a6ff;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.view-output-btn:hover {
  background: rgba(88, 166, 255, 0.25);
}

.log-err-text {
  color: #f85149;
  font-size: 11px;
  display: inline-block;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-empty-dash {
  color: #484f58;
}

.dashboard-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 180px;
  color: #8b949e;
  text-align: center;
  padding: 20px;
}

.dashboard-empty-state .empty-icon {
  width: 36px;
  height: 36px;
  stroke: #484f58;
  margin-bottom: 10px;
}

.empty-title {
  font-size: 13px;
  font-weight: 600;
  color: #c9d1d9;
  margin: 0 0 6px 0;
}

.empty-desc {
  font-size: 12px;
  color: #6e7681;
  max-width: 340px;
  margin: 0;
  line-height: 1.5;
}

.log-modal-card {
  max-width: 600px;
  width: 90%;
}

.log-output-pre {
  background: #0d1117;
  color: #3fb950;
  padding: 12px;
  border-radius: 6px;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 400px;
  overflow-y: auto;
  margin: 0;
}
</style>
