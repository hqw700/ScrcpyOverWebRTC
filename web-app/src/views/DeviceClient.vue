<template>
  <div class="device-panel-view" :class="{ 'is-mobile': isMobile, 'mobile-landscape': isMobile && isVideoLandscape, 'is-web-fullscreen': isWebFullscreen, 'is-camera-surveillance': isCameraMode }">
    <!-- 主内容区 (视频部分) -->
    <div class="device-client-main">
      <!-- 主视频容器 -->
      <div class="video-wrapper" ref="containerRef">
        <!-- 监控专属 OSD 水印状态栏 -->
        <div v-if="isCameraMode" class="camera-osd-bar">
          <div class="osd-left">
            <span class="osd-badge live-dot">● 实时监控</span>
            <span class="osd-item osd-title" :title="currentId">{{ currentId }}</span>
            <span class="osd-divider">|</span>
            <span class="osd-item osd-lens">📷 {{ currentLensName }}</span>
            <span class="osd-divider">|</span>
            <span class="osd-item osd-res">{{ currentResText }}</span>
            <span class="osd-divider" v-if="videoStats">|</span>
            <span class="osd-item osd-fps" v-if="videoStats">{{ videoStats.fps }}fps</span>
            <span class="osd-item osd-bitrate" v-if="videoStats">{{ videoStats.bitrate > 1000 ? (videoStats.bitrate / 1000).toFixed(1) + ' Mbps' : videoStats.bitrate + ' kbps' }}</span>
          </div>

          <div class="osd-center" v-if="isRecording">
            <span class="osd-rec-badge">
              <span class="rec-blink-dot"></span>
              REC {{ formattedRecordingTime }}
            </span>
          </div>

          <div class="osd-right">
            <span class="osd-item osd-battery" v-if="deviceBatteryText" :class="{ 'temp-warn': isBatteryTempHigh }">
              {{ deviceBatteryText }}
            </span>
            <span class="osd-item osd-clock">{{ cameraClock }}</span>
          </div>
        </div>

        <!-- 移动端退出按钮 (右上角) -->
        <button v-if="isMobile" class="mobile-close-fab" @click="deviceStore.clearActiveDevice()" title="关闭连接">
          ✕
        </button>

        <!-- 悬浮全屏按钮 (移入视频容器内，保证全屏时可见) -->
        <button class="fullscreen-fab" @click="toggleFullscreen" title="系统全屏">
          <svg class="icon" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
        </button>

        <!-- 页面全屏按钮 -->
        <button 
          v-if="!isMobile" 
          class="webfullscreen-fab" 
          :class="{ 'is-active': isWebFullscreen }" 
          @click="toggleWebFullscreen" 
          :title="isWebFullscreen ? '退出页面全屏 (按 Esc 键)' : '页面全屏'"
        >
          <svg v-if="isWebFullscreen" class="icon" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          <svg v-else class="icon" viewBox="0 0 24 24"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
        </button>
        <!-- 画中画按钮 -->
        <button v-if="!isMobile && pictureInPictureSupported" class="pip-fab" @click="togglePictureInPicture" :title="isPiP ? '退出画中画' : '画中画'">
          <svg class="icon" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><rect x="11" y="9" width="9" height="7" rx="1" ry="1" fill="currentColor" stroke="none"></rect></svg>
        </button>

        <!-- WebCodecs 极速锁相 Canvas 渲染器 -->
        <canvas
          v-show="isWebCodecs"
          ref="canvasElement"
          class="video-stream"
          :class="{
            'hwc-rotated-90': isHwcRotated90 && !isCameraMode,
            'hwc-rotated-270': isHwcRotated270 && !isCameraMode
          }"
          :style="videoStreamStyle"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
          @mouseleave="onMouseLeave"
          @wheel.prevent="onWheel"
          @dblclick="onCameraDblClick"
          @contextmenu.prevent
          @touchstart.prevent="onTouchStart"
          @touchmove.prevent="onTouchMove"
          @touchend.prevent="onTouchEnd"
          @touchcancel.prevent="onTouchEnd"
        />

        <!-- HTML5 <video> 兼容渲染器 (回退/画中画) -->
        <video
          v-show="!isWebCodecs"
          ref="videoElement"
          autoplay
          playsinline
          webkit-playsinline
          disableremoteplayback
          controlslist="nodownload nofullscreen noremoteplayback noplaybackrate"
          x-webkit-airplay="deny"
          muted
          class="video-stream"
          :style="videoStreamStyle"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
          @mouseleave="onMouseLeave"
          @wheel.prevent="onWheel"
          @dblclick="onCameraDblClick"
          @contextmenu.prevent
          @touchstart.prevent="onTouchStart"
          @touchmove.prevent="onTouchMove"
          @touchend.prevent="onTouchEnd"
          @touchcancel.prevent="onTouchEnd"
          @loadedmetadata="onVideoLoaded"
          @resize="onVideoResize"
        />

        <textarea
          v-if="!isCameraMode"
          ref="hiddenInput"
          class="hidden-keyboard-input"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          @input="onKeyboardInput"
          @keydown="onKeyboardKeyDown"
          @keyup="onKeyboardKeyUp"
          @paste="onKeyboardPaste"
          @compositionstart="onCompositionStart"
          @compositionend="onCompositionEnd"
        ></textarea>


        <!-- 视频流状态面板 (常规模式左上角) -->
        <div v-if="videoStats && localSettings.showStats !== false && !isCameraMode" class="stats-badge">
          <span class="stat-fps">{{ videoStats.fps }}fps</span>
          <span class="stat-delimiter">|</span>
          <span class="stat-delay" title="网络延迟(RTT) + 缓冲(JB) + 解码 + 云端处理">E2E ~{{ videoStats.e2eDelay }}ms</span>
          <span class="stat-delimiter">|</span>
          <span class="stat-delay" title="Jitter Buffer">JB {{ videoStats.jbDelay }}ms</span>
          <span class="stat-delimiter">|</span>
          <span class="stat-delay" title="网络往返延迟">RTT {{ videoStats.rtt }}ms</span>
          <span class="stat-delimiter">|</span>
          <span class="stat-bitrate" title="当前视频接收码率">{{ videoStats.bitrate > 1000 ? (videoStats.bitrate / 1000).toFixed(1) + ' Mbps' : videoStats.bitrate + ' kbps' }}</span>
          <span class="stat-delimiter">|</span>
          <span class="stat-conn-type" title="WebRTC 传输通道类型">{{ videoStats.connectionType || 'UDP p2p' }}</span>
          <span class="stat-delimiter">|</span>
          <span :class="['stat-lost', { 'stat-warn': videoStats.lostCount > 0 }]">Lost {{ videoStats.lostCount }}</span>
        </div>

        <!-- 加载/错误覆盖层 -->
        <div v-if="showOverlay" class="panel-overlay">
          <div class="overlay-box">
            <div v-if="connMetaText" class="conn-meta">{{ connMetaText }}</div>
            <template v-if="['connecting', 'signaling', 'waiting_offer', 'connecting_webrtc'].includes(currentWebRTC.status.value)">
              <div class="mini-spinner"></div>
              <p>{{ loadingText }}</p>
            </template>
            <template v-else-if="currentWebRTC.error.value">
              <p class="error-msg">❌ 连接失败</p>
              <p class="error-tip">{{ currentWebRTC.error.value }}</p>
              <button class="retry-btn" @click="retry">重试</button>
            </template>
            <template v-else-if="currentWebRTC.status.value === 'disconnected'">
              <p>连接已断开</p>
              <button class="retry-btn" @click="retry">重新连接</button>
            </template>
          </div>
        </div>

        <!-- 悬浮菜单展开时的全屏点击遮罩 -->
        <div v-if="(isMobile || isFullscreen || isWebFullscreen) && showMobileMenu" class="fab-overlay" @mousedown.stop.prevent="showMobileMenu = false" @touchstart.stop.prevent="showMobileMenu = false"></div>

        <!-- 手机端悬浮菜单 (移入视频容器内，保证全屏时可见) -->
        <div v-if="isMobile || isFullscreen || isWebFullscreen" class="mobile-fab-container" :style="fabStyle">
          <button class="mobile-fab-main" :class="{ 'active': showMobileMenu }"
            @mousedown="onFabStart" @mousemove="onFabMove" @mouseup="onFabEnd" @mouseleave="onFabEnd"
            @touchstart.prevent="onFabStart" @touchmove.prevent="onFabMove" @touchend.prevent="onFabEnd">
            <svg v-if="showMobileMenu" class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            <svg v-else class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          </button>
          
          <div class="mobile-fab-menu" :class="{ 'show': showMobileMenu, 'align-left': isFabOnLeft, 'align-top': isFabOnTop }">
            <!-- 监控模式下的快捷悬浮菜单 -->
            <template v-if="isCameraMode">
              <div class="fab-section-title">镜头选择</div>
              <button 
                v-for="lens in availableLenses" 
                :key="lens.key" 
                class="fab-item" 
                :class="{ 'cam-active': isLensActive(lens) }" 
                @click="selectLens(lens); showMobileMenu=false"
              >
                {{ lens.icon }} {{ lens.shortName || lens.name }}
              </button>
              <div class="fab-divider"></div>
              <div class="fab-section-title">硬件分辨率</div>
              <div class="fab-res-row">
                <button 
                  v-for="res in ['3840x2160', '1920x1080', '1280x720', '640x480']" 
                  :key="res" 
                  class="fab-item mini-res" 
                  :class="{ 'cam-active': (localSettings.cameraSize === res) || (!localSettings.cameraSize && res === '1920x1080') }" 
                  @click="selectResolution(res); showMobileMenu=false"
                >
                  {{ res === '3840x2160' ? '4K' : (res === '1920x1080' ? '1080P' : (res === '1280x720' ? '720P' : '480P')) }}
                </button>
              </div>
              <div class="fab-divider"></div>
              <button class="fab-item" @click="rotateCamera(); showMobileMenu=false">
                🔄 旋转 90° (当前 {{ cameraRotation }}°)
              </button>
              <button class="fab-item" :class="{ 'cam-active': cameraMirrored }" @click="toggleMirror(); showMobileMenu=false">
                ↔️ 水平镜像
              </button>
              <button class="fab-item" @click="takeCameraSnapshot(); showMobileMenu=false">
                📸 高清抓拍 (JPG)
              </button>
              <button class="fab-item" :class="{ 'recording': isRecording }" @click="toggleCameraRecording(); showMobileMenu=false">
                <span class="rec-dot" v-if="isRecording"></span>
                🔴 {{ isRecording ? `停止录像 (${formattedRecordingTime})` : '本地即时录像' }}
              </button>
              <button class="fab-item" @click="togglePageMute(); showMobileMenu=false">
                {{ pageAudioMuted ? '🔊 开启声音监听' : '🔇 静音' }}
              </button>
              <div class="fab-divider"></div>
              <button class="fab-item" @click="showSettingsModal = true; showMobileMenu=false">
                <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> 监控设置
              </button>
              <button class="fab-item danger" @click="goBackToList(); showMobileMenu=false">
                <svg class="icon" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> 断开监控
              </button>
            </template>

            <!-- 常规云手机快捷菜单 -->
            <template v-else>
              <button v-if="authStore.isAdmin" class="fab-item" :class="{ 'group-active': groupControlStore.isGroupControlActive }" @click="toggleGroupControl(); showMobileMenu=false">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"></rect><rect x="14" y="3" width="7" height="5" rx="1"></rect><rect x="14" y="12" width="7" height="9" rx="1"></rect><rect x="3" y="16" width="7" height="5" rx="1"></rect></svg>
                {{ groupControlStore.isGroupControlActive ? '取消群控' : '群控主控' }}
              </button>
              <div class="fab-divider"></div>
              <button class="fab-item" @click="quickKey('input keyevent 26'); showMobileMenu=false">
                <svg class="icon" viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg> 电源
              </button>
              <button class="fab-item" @click="quickKey('input keyevent 3'); showMobileMenu=false">
                <svg class="icon" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg> 首页
              </button>
              <button class="fab-item" @click="quickKey('input keyevent 4'); showMobileMenu=false">
                <svg class="icon" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"></path></svg> 返回
              </button>
              <button class="fab-item" @click="quickKey('input keyevent 24'); showMobileMenu=false">
                <svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="19" y1="9" x2="19" y2="15"></line><line x1="16" y1="12" x2="22" y2="12"></line></svg> 音量+
              </button>
              <button class="fab-item" @click="quickKey('input keyevent 25'); showMobileMenu=false">
                <svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="19" y1="12" x2="15" y2="12"></line></svg> 音量-
              </button>
              <button class="fab-item" @click="togglePageMute(); showMobileMenu=false">
                <svg v-if="pageAudioMuted" class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                <svg v-else class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15 9a5 5 0 0 1 0 6"></path><path d="M17.7 6.3a9 9 0 0 1 0 11.4"></path></svg>
                {{ pageAudioMuted ? '取消静音' : '页面静音' }}
              </button>
              <button class="fab-item" @click="toggleConsole(); showMobileMenu=false">
                <svg class="icon" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg> 终端
              </button>
              <button class="fab-item" @click="keymapStore.setEditMode(true); showMobileMenu=false">
                <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg> 按键映射
              </button>
              <button class="fab-item" @click="keymapStore.toggleKeyHints(); showMobileMenu=false">
                <svg v-if="keymapStore.showKeyHints" class="icon" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                <svg v-else class="icon" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                {{ keymapStore.showKeyHints ? '隐藏提示' : '显示提示' }}
              </button>
              <button class="fab-item" @click="showSettingsModal = true; showMobileMenu=false">
                <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> 设置
              </button>
              <button class="fab-item" @click="sendClipboardToDevice(); showMobileMenu=false">
                <svg class="icon" viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg> 送剪贴板
              </button>
              <button class="fab-item" @click="getClipboardFromDevice(); showMobileMenu=false">
                <svg class="icon" viewBox="0 0 24 24">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                  <path d="M12 11v6M9 14l3 3 3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>
                </svg> 收剪贴板
              </button>
              
              <div class="fab-divider" v-if="customButtons.length > 0"></div>
              <div v-for="(btn, idx) in customButtons" :key="idx" class="fab-item-wrapper">
                <button class="fab-item custom-item" @click="quickKey(btn.cmd); showMobileMenu=false" :title="btn.cmd">
                  <svg class="icon" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg> {{ btn.name }}
                </button>
                <button class="fab-item-delete" @click.stop="removeCustomButton(idx)" title="删除此按键">×</button>
              </div>
              <button class="fab-item add-btn" @click="addCustomButton">
                <svg class="icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> 添加按键
              </button>
              
              <div class="fab-divider"></div>
              <button class="fab-item danger" @click="goBackToList(); showMobileMenu=false">
                <svg class="icon" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> 断开连接
              </button>
              <button class="fab-item danger" @click="quitAgent(); showMobileMenu=false">
                <svg class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg> 退出 Agent
              </button>
            </template>
            <div class="fab-agent-version" :title="'Agent 完整版本号: ' + agentVersion">
              Agent {{ agentVersion.split('-')[0] }}
            </div>
          </div>
        </div>

        <!-- 按键映射编辑器 (仅常规模式) -->
        <KeymapEditor v-if="!isCameraMode" :video-element="videoElement" />
      </div>
    </div>

    <!-- PC 右侧控制栏 (常规云手机模式) -->
    <div v-if="!isMobile && !isMini && !isCameraMode" class="control-sidebar">
      <div class="sidebar-group">
        <button v-if="authStore.isAdmin" class="sidebar-btn group-control-btn" :class="{ active: groupControlStore.isGroupControlActive }" @click="toggleGroupControl" :title="groupControlStore.isGroupControlActive ? '退出群控主控模式' : '设为群控主控机'">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="9" rx="1"></rect>
            <rect x="14" y="3" width="7" height="5" rx="1"></rect>
            <rect x="14" y="12" width="7" height="9" rx="1"></rect>
            <rect x="3" y="16" width="7" height="5" rx="1"></rect>
          </svg>
          <span class="btn-text">{{ groupControlStore.isGroupControlActive ? '取消群控' : '群控主控' }}</span>
        </button>
        <div class="sidebar-divider"></div>
        <button class="sidebar-btn" @click="quickKey('input keyevent 26')" title="电源">
          <svg class="icon" viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
          <span class="btn-text">电源</span>
        </button>
        <button class="sidebar-btn" @click="quickKey('input keyevent 3')" title="HOME">
          <svg class="icon" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          <span class="btn-text">首页</span>
        </button>
        <button class="sidebar-btn" @click="quickKey('input keyevent 4')" title="BACK">
          <svg class="icon" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"></path></svg>
          <span class="btn-text">返回</span>
        </button>
        <button class="sidebar-btn" @click="quickKey('input keyevent 24')" title="音量加">
          <svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="19" y1="9" x2="19" y2="15"></line><line x1="16" y1="12" x2="22" y2="12"></line></svg>
          <span class="btn-text">音量+</span>
        </button>
        <button class="sidebar-btn" @click="quickKey('input keyevent 25')" title="音量减">
          <svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="19" y1="12" x2="15" y2="12"></line></svg>
          <span class="btn-text">音量-</span>
        </button>
        <button class="sidebar-btn" :class="{ active: pageAudioMuted }" @click="togglePageMute" :title="pageAudioMuted ? '取消页面静音' : '页面静音'">
          <svg v-if="pageAudioMuted" class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
          <svg v-else class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15 9a5 5 0 0 1 0 6"></path><path d="M17.7 6.3a9 9 0 0 1 0 11.4"></path></svg>
          <span class="btn-text">{{ pageAudioMuted ? '取消静音' : '静音' }}</span>
        </button>
        <button class="sidebar-btn" :class="{ active: deviceStore.showGlobalConsole && deviceStore.consoleDeviceId === currentId }" @click="toggleConsole" title="控制台">
          <svg class="icon" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
          <span class="btn-text">终端</span>
        </button>
        <button class="sidebar-btn" @click="keymapStore.setEditMode(true)" title="按键映射">
          <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
          <span class="btn-text">映射</span>
        </button>
        <button class="sidebar-btn" @click="keymapStore.toggleKeyHints()" :title="keymapStore.showKeyHints ? '隐藏按键提示' : '显示按键提示'">
          <svg v-if="keymapStore.showKeyHints" class="icon" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          <svg v-else class="icon" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
          <span class="btn-text">提示</span>
        </button>
        <button class="sidebar-btn" @click="sendClipboardToDevice" title="发送剪切板到设备">
          <svg class="icon" viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
          <span class="btn-text">送剪贴板</span>
        </button>
        <button class="sidebar-btn" @click="getClipboardFromDevice" title="获取设备剪切板到本地">
          <svg class="icon" viewBox="0 0 24 24">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            <path d="M12 11v6M9 14l3 3 3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>
          </svg>
          <span class="btn-text">收剪贴板</span>
        </button>
      </div>
      
      <div class="sidebar-divider"></div>
      
      <div class="sidebar-group custom-group">
        <div v-for="(btn, idx) in customButtons" :key="idx" class="sidebar-btn-wrapper">
          <button class="sidebar-btn custom-btn" @click="quickKey(btn.cmd)" :title="btn.cmd">
            <svg class="icon" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
            <span class="btn-text">{{ btn.name }}</span>
          </button>
          <button class="sidebar-btn-delete" @click.stop="removeCustomButton(idx)" title="删除此按键">×</button>
        </div>
        <button class="sidebar-btn add-btn" @click="addCustomButton" title="添加按键">
          <svg class="icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span class="btn-text">添加</span>
        </button>
      </div>
      
      <div style="flex: 1"></div>
      
      <button class="sidebar-btn danger" @click="quitAgent" title="退出 Agent">
        <svg class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg>
        <span class="btn-text">退出</span>
      </button>

      <button class="sidebar-btn" @click="showSettingsModal = true" title="连接设置">
        <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        <span class="btn-text">设置</span>
      </button>

      <!-- 底部微小 Agent 版本号展示 -->
      <div class="sidebar-agent-version" :title="'Agent 完整版本号: ' + agentVersion">
        {{ agentVersion.split('-')[0] }}
      </div>
    </div>

    <!-- PC 右侧监控专属控制栏 (摄像头监控模式) -->
    <div v-if="!isMobile && !isMini && isCameraMode" class="camera-sidebar">
      <div class="camera-sidebar-title">
        <svg viewBox="0 0 24 24" class="sidebar-title-icon" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
          <circle cx="12" cy="13" r="4"></circle>
        </svg>
        <span>监控控制台</span>
      </div>

      <div class="camera-sidebar-scroll">
        <!-- 1. 镜头切换 -->
        <div class="cam-section">
          <div class="cam-section-header">
            <span>镜头选择</span>
            <span class="cam-badge">{{ currentLensName }}</span>
          </div>
          <div class="cam-btn-grid">
            <button 
              v-for="lens in availableLenses" 
              :key="lens.key" 
              class="cam-btn" 
              :class="{ active: isLensActive(lens) }"
              @click="selectLens(lens)"
              :title="lens.name"
            >
              <span class="cam-btn-icon">{{ lens.icon }}</span>
              <span class="cam-btn-label">{{ lens.shortName || lens.name }}</span>
            </button>
          </div>
        </div>

        <!-- 2. 硬件分辨率 -->
        <div class="cam-section">
          <div class="cam-section-header">
            <span>硬件分辨率</span>
            <span class="cam-badge">{{ currentResText }}</span>
          </div>
          <div class="cam-btn-grid res-grid">
            <button 
              v-for="res in ['3840x2160', '1920x1080', '1280x720', '640x480']" 
              :key="res" 
              class="cam-btn res-btn" 
              :class="{ active: (localSettings.cameraSize === res) || (!localSettings.cameraSize && res === '1920x1080') }"
              @click="selectResolution(res)"
            >
              {{ res === '3840x2160' ? '4K' : (res === '1920x1080' ? '1080P' : (res === '1280x720' ? '720P' : '480P')) }}
            </button>
          </div>
        </div>

        <!-- 3. PTZ 数字变焦 -->
        <div class="cam-section">
          <div class="cam-section-header">
            <span>PTZ 数字变焦</span>
            <span class="cam-badge zoom-val">{{ cameraZoom.toFixed(1) }}x</span>
          </div>
          <div class="zoom-slider-row">
            <input 
              type="range" 
              min="1.0" 
              max="10.0" 
              step="0.1" 
              v-model.number="cameraZoom" 
              class="zoom-range" 
              @input="onZoomSliderChange"
            />
          </div>
          <div class="cam-btn-grid zoom-presets">
            <button class="cam-btn preset-btn" :class="{ active: cameraZoom === 1.0 }" @click="setZoom(1.0)">1.0x</button>
            <button class="cam-btn preset-btn" :class="{ active: cameraZoom === 2.0 }" @click="setZoom(2.0)">2.0x</button>
            <button class="cam-btn preset-btn" :class="{ active: cameraZoom === 3.0 }" @click="setZoom(3.0)">3.0x</button>
            <button class="cam-btn preset-btn" :class="{ active: cameraZoom === 5.0 }" @click="setZoom(5.0)">5.0x</button>
            <button class="cam-btn reset-btn" @click="resetPTZ" title="复位缩放和平移">复位</button>
          </div>
        </div>

        <!-- 4. 画面方向与校正 -->
        <div class="cam-section">
          <div class="cam-section-header">
            <span>画面校正</span>
            <span class="cam-badge">{{ cameraRotation }}° {{ cameraMirrored ? '镜像' : '' }}</span>
          </div>
          <div class="cam-btn-grid">
            <button class="cam-btn" @click="rotateCamera" title="顺时针旋转90度 (适配吊装/侧装)">
              <svg class="icon" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
              <span>旋转 90°</span>
            </button>
            <button class="cam-btn" :class="{ active: cameraMirrored }" @click="toggleMirror" title="水平镜像翻转 (矫正前置自拍)">
              <svg class="icon" viewBox="0 0 24 24"><path d="M12 2v20M7 8l-4 4 4 4M17 8l4 4-4 4"></path></svg>
              <span>水平镜像</span>
            </button>
          </div>
        </div>

        <!-- 5. 环境音监听 -->
        <div class="cam-section">
          <div class="cam-section-header">
            <span>环境声音监听</span>
            <span class="cam-badge" :class="{ 'audio-on': !pageAudioMuted }">{{ pageAudioMuted ? '已静音' : '监听中' }}</span>
          </div>
          <div class="audio-control-row">
            <button class="cam-btn audio-toggle-btn" :class="{ active: !pageAudioMuted }" @click="togglePageMute">
              <svg v-if="!pageAudioMuted" class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15 9a5 5 0 0 1 0 6"></path><path d="M17.7 6.3a9 9 0 0 1 0 11.4"></path></svg>
              <svg v-else class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
              <span>{{ pageAudioMuted ? '开启声音监听' : '关闭声音监听' }}</span>
            </button>
          </div>
        </div>

        <!-- 6. 抓拍与即时录像 -->
        <div class="cam-section">
          <div class="cam-section-header">
            <span>安防存证</span>
          </div>
          <div class="cam-btn-grid">
            <button class="cam-btn snapshot-btn" @click="takeCameraSnapshot" title="抓拍当前高清帧并保存为JPG">
              <svg class="icon" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              <span>高清抓拍</span>
            </button>
            <button 
              class="cam-btn record-btn" 
              :class="{ recording: isRecording }" 
              @click="toggleCameraRecording"
              :title="isRecording ? '点击停止录像并下载' : '开启本地录像'"
            >
              <span class="rec-dot"></span>
              <span>{{ isRecording ? `停止 (${formattedRecordingTime})` : '本地录像' }}</span>
            </button>
          </div>
        </div>

        <!-- 7. 系统设置与退出 -->
        <div class="cam-section bottom-section">
          <div class="cam-btn-grid">
            <button class="cam-btn" @click="showSettingsModal = true" title="高级监控与编码设置">
              <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              <span>设置</span>
            </button>
            <button class="cam-btn danger-btn" @click="goBackToList" title="退出监控返回列表">
              <svg class="icon" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              <span>断开</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 截图预览弹窗 -->
    <ScreenshotModal 
      v-if="showScreenshot" 
      :image-data="screenshotData" 
      @close="showScreenshot = false" 
    />

    <!-- 连接设置弹窗 -->
    <SettingsModal 
      v-if="showSettingsModal" 
      :settings="localSettings" 
      :is-connected="true"
      :camera-support="cameraSupport"
      :is-custom="hasCustomSettings(currentId)"
      :locked-sections="policyLocked"
      :show-preview-tab="authStore.isAdmin"
      @close="showSettingsModal = false" 
      @save="saveSettings" 
      @reset="resetSettings"
    />

  </div>
</template>

<script setup>
import { ref, shallowRef, computed, onMounted, onUnmounted, watch } from 'vue'
import { debugLog, debugWarn } from '@/utils/debug'
import { useDeviceStore } from '@/stores/devices'
import { useWebRTC } from '@/composables/useWebRTC'
import { useKeymapStore } from '@/stores/keymap'
import { KeymapEngine } from '@/utils/keymapEngine'
import { getDeviceSettings, saveDeviceSettings, hasCustomSettings, deleteDeviceSettings, applyPolicyToSettings, policyLockedSections, getCameraPreferences, saveCameraPreferences } from '@/utils/settings'
import { useAuthStore } from '@/stores/auth'
import { useGroupControlStore } from '@/stores/groupControl'
import ConnectionStatus from '@/components/ConnectionStatus.vue'
import ScreenshotModal from '@/components/ScreenshotModal.vue'
import SettingsModal from '@/components/SettingsModal.vue'
import KeymapEditor from '@/components/KeymapEditor.vue'

const props = defineProps({
  deviceId: {
    type: String,
    default: null
  },
  isMini: {
    type: Boolean,
    default: false
  },
  isFocused: {
    type: Boolean,
    default: false
  },
  audioMuted: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['recommend-layout', 'close'])

const deviceStore = useDeviceStore()
const currentId = computed(() => props.deviceId)
const groupControlStore = useGroupControlStore()

// 多机直连环境下的焦点判定与音频判定
const effectiveFocused = computed(() => 
  props.isFocused || 
  deviceStore.focusedDeviceId === currentId.value || 
  deviceStore.activeDeviceIds.length <= 1
)
const effectiveAudioMuted = computed(() => {
  if (props.audioMuted) return true
  return pageAudioMuted.value
})

// --- Demo 模式动态仿真 Canvas 驱动 ---
const demoRipples = ref([])
let demoAnimationId = null

function runDemoLoop() {
  if (import.meta.env.VITE_DEMO_MODE !== 'true') return
  import('@/mock/demoEngine').then(({ renderMockScreenCanvas }) => {
    function loop() {
      const cvs = canvasElement.value
      if (cvs) {
        if (!cvs.width || cvs.width < 300) cvs.width = 360
        if (!cvs.height || cvs.height < 500) cvs.height = 640
        
        demoRipples.value.forEach(r => {
          r.radius += 2.5
          r.alpha -= 0.04
        })
        demoRipples.value = demoRipples.value.filter(r => r.alpha > 0)
        
        renderMockScreenCanvas(cvs, currentId.value, demoRipples.value)
      }
      demoAnimationId = requestAnimationFrame(loop)
    }
    loop()
  })
}

// --- 群控从机渲染与事件分发逻辑 ---
const lastSentMoveTime = {} // pointerId -> timestamp
const lastSentMoveCoords = {} // pointerId -> { x, y }
const THROTTLE_INTERVAL_MS = 25 // 40fps 
const MOVE_DISTANCE_THRESHOLD = 4 // 4px

// 群控广播发送处理 (包含滑动限流)
function handleGroupControlBroadcast(evt) {
  if (!groupControlStore.isGroupControlActive || groupControlStore.selectedSlaveIds.length === 0) return
  
  if (evt.type === 'touch' && evt.action === 2) { // Action 2 is MOVE
    const ptrId = evt.id
    const now = Date.now()
    const lastTime = lastSentMoveTime[ptrId] || 0
    const lastCoords = lastSentMoveCoords[ptrId]
    
    let shouldSend = false
    if (now - lastTime >= THROTTLE_INTERVAL_MS) {
      shouldSend = true
    } else if (lastCoords) {
      const dx = evt.x - lastCoords.x
      const dy = evt.y - lastCoords.y
      if (dx * dx + dy * dy >= MOVE_DISTANCE_THRESHOLD * MOVE_DISTANCE_THRESHOLD) {
        shouldSend = true
      }
    } else {
      shouldSend = true
    }
    
    if (!shouldSend) return
    
    lastSentMoveTime[ptrId] = now
    lastSentMoveCoords[ptrId] = { x: evt.x, y: evt.y }
  }
  
  deviceStore.sendGroupControlEvent(groupControlStore.selectedSlaveIds, evt)
}

function bindWebRTCEvents(webrtcInstance) {
  if (!webrtcInstance) return
  webrtcInstance.onControlEvent((evt) => {
    handleGroupControlBroadcast(evt)
  })
}

function toggleGroupControl() {
  const active = !groupControlStore.isGroupControlActive
  groupControlStore.toggleGroupControl(active, currentId.value)
}

const goBackToList = () => {
  deviceStore.setDeviceMode(currentId.value, 'display')
  deviceStore.clearActiveDevice()
}

const videoElement = ref(null)
const canvasElement = ref(null)
const hiddenInput = ref(null)
const containerRef = ref(null)
const isFullscreen = ref(false)
const isWebFullscreen = ref(false)
const CLIPBOARD_SOURCE_LOCAL = 'local'
const CLIPBOARD_SOURCE_DEVICE = 'device'
const CLIPBOARD_SOURCE_KEYBOARD = 'keyboard'
const CLIPBOARD_ECHO_TTL_MS = 5000
let lastLocalClipboardText = ''
let lastDeviceClipboardText = ''
const pendingClipboardWrites = []
const showScreenshot = ref(false)
const screenshotData = ref(null)
const showSettingsModal = ref(false)
const cameraSupport = ref(true)

// 用户级设置管控：管理员配置的锁定项（码率/帧率/分辨率/音频）在 UI 置灰，服务端同步强制
const authStore = useAuthStore()
const policyLocked = computed(() => policyLockedSections(authStore.userPolicy))

const currentSessionMode = deviceStore.getDeviceMode(currentId.value)
const initialSettings = getDeviceSettings(currentId.value)
initialSettings.videoSource = currentSessionMode

if (currentSessionMode === 'camera') {
  const camPref = getCameraPreferences(currentId.value)
  initialSettings.cameraFacing = camPref.cameraFacing
  initialSettings.cameraId = camPref.cameraId
  initialSettings.cameraSize = camPref.cameraSize
  initialSettings.cameraFps = camPref.cameraFps
  initialSettings.cameraZoomRatio = camPref.cameraZoomRatio || 1.0
  initialSettings.cameraOrientation = camPref.cameraOrientation || 'auto'
  initialSettings.audioSource = camPref.audioSource || 'mic'
}

const localSettings = ref(applyPolicyToSettings(initialSettings, authStore.userPolicy))
const pageAudioMuted = ref(Boolean(localSettings.value.pageAudioMuted))

if (!authStore.userPolicy && authStore.token) {
  authStore.fetchMe().then(() => {
    localSettings.value = applyPolicyToSettings(localSettings.value, authStore.userPolicy)
  })
}

const scrcpyOptions = computed(() => {
  return {
    max_fps: localSettings.value.fps,
    max_size: localSettings.value.size,
    bitrate: localSettings.value.bitrate * 1000000,
    min_bitrate: localSettings.value.minBitrate * 1000000,
    max_bitrate: localSettings.value.maxBitrate * 1000000,
    bwe: localSettings.value.bwe,
    audio: localSettings.value.audio,
    audio_gain: localSettings.value.audioGain,
    audio_source: localSettings.value.audioSource,
    audio_dup: localSettings.value.audioDup,
    audio_low_latency: localSettings.value.audioLowLatency,
    debug: localSettings.value.debug,
    snapshot_interval: localSettings.value.snapshotInterval,
    power_off: localSettings.value.powerOff,
    video_codec_options: localSettings.value.videoCodecOptions,
    camera: localSettings.value.camera,
    stay_awake: localSettings.value.stayAwake,
    video_source: localSettings.value.videoSource,
    camera_facing: localSettings.value.cameraFacing,
    camera_id: localSettings.value.cameraId,
    camera_size: localSettings.value.cameraSize,
    camera_fps: localSettings.value.cameraFps,
    camera_high_speed: localSettings.value.cameraHighSpeed,
    camera_ar: localSettings.value.cameraAr,
    camera_zoom: localSettings.value.cameraZoomRatio || 1.0,
    camera_orientation: localSettings.value.cameraOrientation || 'auto'
  }
})

// --- 📷 摄像头监控专属状态与控制 ---
const isCameraMode = computed(() => localSettings.value?.videoSource === 'camera')

const currentDevice = computed(() => {
  return deviceStore.devices.find(d => d.id === currentId.value)
})

const availableLenses = computed(() => {
  const detected = currentDevice.value?.info?.cameras
  if (Array.isArray(detected) && detected.length > 0) {
    return detected.map(cam => {
      let icon = '📷'
      let shortName = cam.name || `镜头 ${cam.id}`
      const zoom = cam.zoom || (cam.type === 'ultra_wide' ? 0.5 : (cam.type === 'telephoto' ? 5.0 : 1.0))
      if (cam.type === 'ultra_wide' || (cam.focal_length && cam.focal_length < 2.8) || zoom < 0.9) {
        icon = '🌐'
        shortName = zoom <= 0.6 ? `${zoom.toFixed(1)}x 广角` : '超广角'
      } else if (cam.type === 'telephoto' || (cam.focal_length && cam.focal_length >= 7.0) || zoom >= 2.5) {
        icon = '🔭'
        shortName = `${zoom.toFixed(1)}x 长焦`
      } else if (cam.facing === 'front') {
        icon = '🤳'
        shortName = '前置自拍'
      } else if (cam.facing === 'external') {
        icon = '🔌'
        shortName = '外接镜头'
      } else if (cam.id === '0' || cam.type === 'main') {
        icon = '📷'
        shortName = '1.0x 主摄'
      }
      return {
        key: `${cam.facing}_${cam.type || cam.id}_${zoom}`,
        id: cam.id || '0',
        facing: cam.facing || 'back',
        zoom,
        name: cam.name || `${cam.facing} camera`,
        shortName,
        icon
      }
    })
  }

  // 默认物理/虚拟镜头预设（后置所有多摄统一走 Camera 0 + 硬件 zoomRatio，绝不传递不存在的 2/3 导致崩溃）
  return [
    { key: 'back_main', id: '0', facing: 'back', zoom: 1.0, name: '后置主摄 (1.0x)', shortName: '1.0x 主摄', icon: '📷' },
    { key: 'back_wide', id: '0', facing: 'back', zoom: 0.5, name: '后置超广角 (0.5x)', shortName: '0.5x 广角', icon: '🌐' },
    { key: 'back_tele', id: '0', facing: 'back', zoom: 5.0, name: '后置长焦镜头', shortName: '长焦镜头', icon: '🔭' },
    { key: 'front_1', id: '1', facing: 'front', zoom: 1.0, name: '前置自拍镜头', shortName: '前置自拍', icon: '🤳' },
    { key: 'external', id: '', facing: 'external', zoom: 1.0, name: '外接摄像头', shortName: '外接镜头', icon: '🔌' }
  ]
})

function isLensActive(lens) {
  if (localSettings.value.cameraFacing !== lens.facing) return false
  if (lens.facing === 'back') {
    const currentZoom = localSettings.value.cameraZoomRatio || 1.0
    const targetZoom = lens.zoom || 1.0
    return Math.abs(currentZoom - targetZoom) < 0.15
  }
  return !localSettings.value.cameraId || localSettings.value.cameraId === lens.id
}

const currentLensName = computed(() => {
  const matched = availableLenses.value.find(l => isLensActive(l))
  if (matched) return matched.shortName || matched.name
  if (localSettings.value.cameraFacing === 'front') return '前置自拍'
  if (localSettings.value.cameraFacing === 'external') return '外接镜头'
  return '后置主摄'
})

const currentResText = computed(() => {
  const s = localSettings.value.cameraSize
  if (!s) return '1080P'
  if (s === '3840x2160') return '4K'
  if (s === '1920x1080') return '1080P'
  if (s === '1280x720') return '720P'
  if (s === '640x480') return '480P'
  return s
})

function selectLens(lens) {
  if (isLensActive(lens)) return
  localSettings.value.cameraFacing = lens.facing
  localSettings.value.cameraId = lens.id || ''
  cameraMirrored.value = (lens.facing === 'front')
  if (lens.zoom) {
    localSettings.value.cameraZoomRatio = lens.zoom
    cameraZoom.value = 1.0
  }
  saveCameraPreferences(currentId.value, {
    cameraFacing: lens.facing,
    cameraId: lens.id || '',
    cameraZoomRatio: lens.zoom || 1.0
  })
  reconnectStream(`正在切换至 [${lens.shortName || lens.name}]...`)
}

function selectResolution(res) {
  if (localSettings.value.cameraSize === res) return
  localSettings.value.cameraSize = res
  saveCameraPreferences(currentId.value, {
    cameraSize: res
  })
  const label = res === '3840x2160' ? '4K' : (res === '1920x1080' ? '1080P' : (res === '1280x720' ? '720P' : '480P'))
  reconnectStream(`正在切换分辨率至 [${label}]...`)
}

function reconnectStream(msg = '正在切换参数并重新建连...') {
  if (isCameraMode.value) {
    saveCameraPreferences(currentId.value, {
      cameraFacing: localSettings.value.cameraFacing,
      cameraId: localSettings.value.cameraId,
      cameraSize: localSettings.value.cameraSize,
      cameraFps: localSettings.value.cameraFps,
      cameraZoomRatio: localSettings.value.cameraZoomRatio || 1.0,
      cameraOrientation: localSettings.value.cameraOrientation || 'auto',
      audioSource: localSettings.value.audioSource
    })
  }

  if (currentId.value) {
    webrtc.disconnect()
    setTimeout(() => {
      currentWebRTC.value = useWebRTC(currentId.value, scrcpyOptions.value)
      deviceStore.setActiveWebRTC(webrtc)
      setupWebRTC()
    }, 800)
  }
}

// PTZ 数字变焦与视口平移漫游
const cameraZoom = ref(1.0)
const cameraPanX = ref(0)
const cameraPanY = ref(0)
const isCameraPanning = ref(false)
const panStartPoint = { x: 0, y: 0 }
const panStartOffset = { x: 0, y: 0 }
const cameraRotation = ref(0) // 0, 90, 180, 270
const cameraMirrored = ref(initialSettings.cameraFacing === 'front')

const videoStreamStyle = computed(() => {
  if (!isCameraMode.value) {
    return {}
  }
  return {
    transform: `rotate(${cameraRotation.value}deg) scaleX(${cameraMirrored.value ? -1 : 1}) translate(${cameraPanX.value}px, ${cameraPanY.value}px) scale(${cameraZoom.value})`,
    transformOrigin: 'center center',
    transition: isCameraPanning.value ? 'none' : 'transform 0.15s ease-out',
    cursor: cameraZoom.value > 1.0 ? (isCameraPanning.value ? 'grabbing' : 'grab') : 'default'
  }
})

function setZoom(val) {
  cameraZoom.value = val
  if (val <= 1.0) {
    cameraPanX.value = 0
    cameraPanY.value = 0
  }
}

function onZoomSliderChange() {
  if (cameraZoom.value <= 1.0) {
    cameraPanX.value = 0
    cameraPanY.value = 0
  }
}

function resetPTZ() {
  cameraZoom.value = 1.0
  cameraPanX.value = 0
  cameraPanY.value = 0
  cameraRotation.value = 0
  cameraMirrored.value = false
}

function rotateCamera() {
  cameraRotation.value = (cameraRotation.value + 90) % 360
}

function toggleMirror() {
  cameraMirrored.value = !cameraMirrored.value
}

function onCameraDblClick() {
  if (!isCameraMode.value) return
  if (cameraZoom.value > 1.0) {
    cameraZoom.value = 1.0
    cameraPanX.value = 0
    cameraPanY.value = 0
  } else {
    cameraZoom.value = 2.0
  }
}

// 实时时钟水印
const cameraClock = ref('')
let cameraClockTimer = null

function updateCameraClock() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  cameraClock.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

// 电池与温度告警
const deviceBatteryText = computed(() => {
  const stats = currentDevice.value?.stats
  if (!stats) return ''
  let text = ''
  if (stats.battery_level !== undefined && stats.battery_level >= 0) {
    text += `🔋 ${stats.battery_level}%`
  }
  if (stats.temperature !== undefined && stats.temperature > 0) {
    text += ` (${stats.temperature.toFixed(1)}°C)`
  }
  return text
})

const isBatteryTempHigh = computed(() => {
  const stats = currentDevice.value?.stats
  return Boolean(stats?.temperature && stats.temperature >= 45)
})

// 安防高清抓拍
function takeCameraSnapshot() {
  const video = videoElement.value
  const canvas = canvasElement.value
  const target = isWebCodecs.value ? canvas : video
  if (!target) return
  const offscreen = document.createElement('canvas')
  const w = target.videoWidth || target.width || 1920
  const h = target.videoHeight || target.height || 1080
  offscreen.width = w
  offscreen.height = h
  const ctx = offscreen.getContext('2d')
  ctx.drawImage(target, 0, 0, w, h)
  const dataUrl = offscreen.toDataURL('image/jpeg', 0.95)
  const a = document.createElement('a')
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const timeStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  a.download = `监控抓拍_${currentId.value}_${timeStr}.jpg`
  a.href = dataUrl
  a.click()
}

// 本地录像 (MediaRecorder)
const isRecording = ref(false)
const recordingDuration = ref(0)
let recordingTimer = null
let mediaRecorder = null
let recordedChunks = []

const formattedRecordingTime = computed(() => {
  const m = String(Math.floor(recordingDuration.value / 60)).padStart(2, '0')
  const s = String(recordingDuration.value % 60).padStart(2, '0')
  return `${m}:${s}`
})

function toggleCameraRecording() {
  if (isRecording.value) {
    stopRecording()
  } else {
    startRecording()
  }
}

function startRecording() {
  const stream = currentWebRTC.value?.stream?.value || videoElement.value?.srcObject || (canvasElement.value?.captureStream ? canvasElement.value.captureStream(30) : null)
  if (!stream) {
    alert('视频流尚未就绪，无法开始录像')
    return
  }
  recordedChunks = []
  try {
    const mimeType = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus'))
      ? 'video/webm;codecs=vp8,opus'
      : ((typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm')) ? 'video/webm' : 'video/mp4')
    mediaRecorder = new MediaRecorder(stream, { mimeType })
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data)
      }
    }
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const now = new Date()
      const pad = (n) => String(n).padStart(2, '0')
      const timeStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
      a.download = `监控录像_${currentId.value}_${timeStr}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`
      a.href = url
      a.click()
      URL.revokeObjectURL(url)
      recordedChunks = []
    }
    mediaRecorder.start(1000)
    isRecording.value = true
    recordingDuration.value = 0
    recordingTimer = setInterval(() => {
      recordingDuration.value++
    }, 1000)
  } catch (err) {
    console.error('Recording start failed:', err)
    alert('无法启动本地录像: ' + err.message)
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop() } catch (e) {}
  }
  isRecording.value = false
  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }
}

function saveSettings(newSettings) {
  localSettings.value = newSettings
  pageAudioMuted.value = Boolean(newSettings.pageAudioMuted)
  
  isSavingSettingsSelf = true
  try {
    saveDeviceSettings(currentId.value, newSettings)
  } finally {
    isSavingSettingsSelf = false
  }
  
  // 与手动“关闭面板再点连接”同效：先卸载面板触发完整断开清理（onUnmounted → disconnect），
  // 等待 Agent 完成 scrcpy 停服/重启后再自动重开。
  // 原地断开即连会撞上 Agent 侧停服/重启窗口，导致新推流会话起不来。
  if (currentId.value) {
    const id = currentId.value
    deviceStore.clearActiveDevice()
    setTimeout(() => {
      deviceStore.setActiveDevice(id)
    }, 1000)
  }
}

function resetSettings() {
  isSavingSettingsSelf = true
  try {
    deleteDeviceSettings(currentId.value)
  } finally {
    isSavingSettingsSelf = false
  }
  localSettings.value = applyPolicyToSettings(getDeviceSettings(currentId.value), authStore.userPolicy) // Loads global settings now
  pageAudioMuted.value = Boolean(localSettings.value.pageAudioMuted)
  if (currentId.value) {
    webrtc.disconnect()
    currentWebRTC.value = useWebRTC(currentId.value, scrcpyOptions.value)
    deviceStore.registerWebRTC(currentId.value, webrtc)
    setupWebRTC()
  }
}

const toggleConsole = () => {
  if (deviceStore.showGlobalConsole && deviceStore.consoleDeviceId === currentId.value) {
    deviceStore.closeGlobalConsole()
  } else {
    deviceStore.openGlobalConsole(currentId.value)
  }
}

function goToFileManager() {
  window.history.pushState({}, '', '/files')
  window.dispatchEvent(new Event('popstate'))
}

// 手机悬浮菜单状态及拖拽
const showMobileMenu = ref(false)
const fabStyle = ref({ right: '24px', bottom: '24px' })
const isFabOnLeft = ref(false)
const isFabOnTop = ref(false)
let isDragging = false
let dragStartTime = 0
let startX = 0
let startY = 0

function onFabStart(e) {
  isDragging = false
  dragStartTime = Date.now()
  const ev = e.touches ? e.touches[0] : e
  startX = ev.clientX
  startY = ev.clientY
}

function onFabMove(e) {
  if (!dragStartTime) return
  const ev = e.touches ? e.touches[0] : e
  const dx = ev.clientX - startX
  const dy = ev.clientY - startY
  if (!isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
    isDragging = true
  }
  if (isDragging) {
    let left = ev.clientX - 28 // 56/2 = 28 (center)
    let top = ev.clientY - 28
    
    if (left < 0) left = 0
    if (top < 0) top = 0
    if (left > window.innerWidth - 56) left = window.innerWidth - 56
    if (top > window.innerHeight - 56) top = window.innerHeight - 56
    
    isFabOnLeft.value = left < window.innerWidth / 2
    isFabOnTop.value = top < window.innerHeight / 2

    fabStyle.value = {
      left: left + 'px',
      top: top + 'px',
      right: 'auto',
      bottom: 'auto'
    }
  }
}

function onFabEnd(e) {
  if (dragStartTime && !isDragging && (Date.now() - dragStartTime < 500)) {
    showMobileMenu.value = !showMobileMenu.value
  }
  isDragging = false
  dragStartTime = 0
}

// 自定义按键
const customButtons = ref(JSON.parse(localStorage.getItem('cloudphone_custom_btns') || '[]'))

function addCustomButton() {
  const name = prompt('按钮名称 (最长4个字，如: 划线)')
  if (!name) return
  const cmd = prompt('ADB Shell 命令 (如: settings put system pointer_location 1)')
  if (!cmd) return
  customButtons.value.push({ name: name.substring(0, 4), cmd })
  localStorage.setItem('cloudphone_custom_btns', JSON.stringify(customButtons.value))
}

function removeCustomButton(index) {
  if (confirm('确定删除此按键？')) {
    customButtons.value.splice(index, 1)
    localStorage.setItem('cloudphone_custom_btns', JSON.stringify(customButtons.value))
  }
}

// 视频流统计信息
const videoStats = ref(null)
let statsInterval = null
const agentVersion = ref('unknown')
let stopAgentVersionWatch = null
let isSavingSettingsSelf = false

const currentWebRTC = shallowRef(useWebRTC(currentId.value, scrcpyOptions.value))
const webrtc = new Proxy({}, {
  get(target, prop) {
    const inst = currentWebRTC.value
    if (!inst) return undefined
    const val = inst[prop]
    if (typeof val === 'function') {
      return (...args) => val.apply(inst, args)
    }
    return val
  },
  set(target, prop, value) {
    if (currentWebRTC.value) {
      currentWebRTC.value[prop] = value
    }
    return true
  }
})
const isWebCodecs = computed(() => Boolean(currentWebRTC.value?.isWebCodecsActive?.value))
if (currentId.value) {
  deviceStore.registerWebRTC(currentId.value, webrtc)
}

const keymapStore = useKeymapStore()
const keymapEngine = new KeymapEngine(
  (action, cx, cy, id, coord) => webrtc.sendTouch(action, cx, cy, id, coord),
  (cmd) => webrtc.sendCommand(cmd)
)

watch(() => keymapStore.activeProfile, (newProfile) => {
  keymapEngine.updateProfile(newProfile)
}, { immediate: true, deep: true })

function onGlobalKeyDown(e) {
  // 多机直连隔离：非焦点设备不消费全局键盘事件
  if (!effectiveFocused.value) return

  debugLog('[GlobalKey] KeyDown. target:', e.target.tagName, 'activeElement:', document.activeElement ? document.activeElement.tagName : 'none', 'key:', e.key)
  
  // 拦截 Esc 键快速退出页面全屏
  if (e.key === 'Escape' || e.key === 'Esc') {
    if (isWebFullscreen.value) {
      toggleWebFullscreen()
      e.preventDefault()
      e.stopPropagation()
      return
    }
  }

  if (keymapStore.isEditMode) return;
  
  const hasModal = document.querySelector('.modal-overlay, .modal, .settings-modal, .card-menu, .dialog');
  if (hasModal) return;

  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
  if (!videoNaturalSize.value.width) return;

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
    return
  }

  if (keymapEngine.handleKeyEvent(e, true, videoNaturalSize.value.width, videoNaturalSize.value.height)) {
    e.preventDefault();
  }
}

function onGlobalPaste(e) {
  // 多机直连隔离：非焦点设备不处理全局粘贴
  if (!effectiveFocused.value) return

  if (keymapStore.isEditMode) return
  const tag = e.target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return
  if (!videoNaturalSize.value.width) return
  const text = e.clipboardData?.getData('text')
  if (!text) return
  e.preventDefault()
  setDeviceClipboard(text, { paste: true, source: CLIPBOARD_SOURCE_LOCAL })
  debugLog('[Clipboard] Global paste routed to device')
}

function prunePendingClipboardWrites() {
  const now = Date.now()
  while (pendingClipboardWrites.length > 0 && pendingClipboardWrites[0].expiresAt <= now) {
    pendingClipboardWrites.shift()
  }
}

function rememberClipboardWrite(text, source, suppressBroadcast = false) {
  if (!text) return
  prunePendingClipboardWrites()
  pendingClipboardWrites.push({
    text,
    source,
    suppressBroadcast,
    expiresAt: Date.now() + CLIPBOARD_ECHO_TTL_MS
  })
}

function consumeClipboardWrite(text) {
  prunePendingClipboardWrites()
  const index = pendingClipboardWrites.findIndex(entry => entry.text === text)
  if (index === -1) return null
  const [entry] = pendingClipboardWrites.splice(index, 1)
  return entry
}

function setDeviceClipboard(text, { paste = false, source = CLIPBOARD_SOURCE_LOCAL, suppressBroadcast = false } = {}) {
  if (!text) return false
  const ok = webrtc.setClipboard(text, { paste, source, suppressBroadcast })
  if (ok) {
    rememberClipboardWrite(text, source, suppressBroadcast)
    if (source === CLIPBOARD_SOURCE_LOCAL) {
      lastLocalClipboardText = text
    }
  }
  return ok
}

function onGlobalKeyUp(e) {
  // 多机直连隔离：非焦点设备不处理按键弹起
  if (!effectiveFocused.value) return

  if (keymapStore.isEditMode) return;

  const hasModal = document.querySelector('.modal-overlay, .modal, .settings-modal, .card-menu, .dialog');
  if (hasModal) return;

  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
  if (!videoNaturalSize.value.width) return;

  if (keymapEngine.handleKeyEvent(e, false, videoNaturalSize.value.width, videoNaturalSize.value.height)) {
    e.preventDefault();
  }
}

function onGlobalWheel(e) {
  // 多机直连隔离：非焦点设备不处理滚轮
  if (!effectiveFocused.value) return
  if (isCameraMode.value) return
  if (e.__cloudphoneWheelHandled) return
  handleWheel(e)
}

function onWheel(e) {
  if (isCameraMode.value) {
    const delta = e.deltaY < 0 ? 0.2 : -0.2
    const newZoom = Math.min(10.0, Math.max(1.0, parseFloat((cameraZoom.value + delta).toFixed(1))))
    cameraZoom.value = newZoom
    if (cameraZoom.value === 1.0) {
      cameraPanX.value = 0
      cameraPanY.value = 0
    }
    return
  }
  e.__cloudphoneWheelHandled = true
  handleWheel(e)
}

function isPointInRenderedVideo(clientX, clientY) {
  const video = videoElement.value
  const videoW = videoNaturalSize.value.width
  const videoH = videoNaturalSize.value.height
  if (!video || !videoW || !videoH) return false

  if (needRotateCoords.value) {
    return clientX >= 0 && clientX <= window.innerWidth && clientY >= 0 && clientY <= window.innerHeight
  }

  const rect = video.getBoundingClientRect()
  const clientRatio = rect.width / rect.height
  const videoRatio = videoW / videoH
  let actualW, actualH, offsetX, offsetY
  if (clientRatio > videoRatio) {
    actualH = rect.height
    actualW = rect.height * videoRatio
    offsetX = (rect.width - actualW) / 2
    offsetY = 0
  } else {
    actualW = rect.width
    actualH = rect.width / videoRatio
    offsetX = 0
    offsetY = (rect.height - actualH) / 2
  }

  const left = rect.left + offsetX
  const top = rect.top + offsetY
  return clientX >= left && clientX <= left + actualW && clientY >= top && clientY <= top + actualH
}

function wheelDeltaToScroll(delta) {
  if (!delta) return 0
  const magnitude = Math.max(1, Math.min(16, Math.round(Math.abs(delta) / 8)))
  return -Math.sign(delta) * magnitude
}

function handleWheel(e) {
  debugLog('[Wheel] fired', 'editMode:', keymapStore.isEditMode, 'target:', e.target.tagName, 'deltaX:', e.deltaX, 'deltaY:', e.deltaY)
  if (keymapStore.isEditMode) return;

  const hasModal = document.querySelector('.modal-overlay, .modal, .settings-modal, .card-menu, .dialog');
  if (hasModal) {
    debugLog('[Wheel] blocked by modal')
    return
  }

  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) {
    debugLog('[Wheel] blocked by input')
    return
  }
  if (!videoNaturalSize.value.width) {
    debugLog('[Wheel] blocked: no videoNaturalSize', videoNaturalSize.value)
    return
  }
  if (!isPointInRenderedVideo(e.clientX, e.clientY)) {
    debugLog('[Wheel] ignored outside rendered video')
    return
  }

  const consumed = keymapEngine.handleWheelEvent(e, videoNaturalSize.value.width, videoNaturalSize.value.height);
  debugLog('[Wheel] keymapEngine consumed:', consumed)
  if (consumed) {
    e.preventDefault();
    return;
  }

  const scrollV = wheelDeltaToScroll(e.deltaY);
  const scrollH = wheelDeltaToScroll(e.deltaX);
  debugLog('[Wheel] scrollV:', scrollV, 'scrollH:', scrollH, 'sendScroll:', typeof webrtc.sendScroll)
  if (scrollV !== 0 || scrollH !== 0) {
    const coord = rotateCoords(e.clientX, e.clientY);
    if (webrtc.sendScroll(e.clientX, e.clientY, scrollH, scrollV, coord)) {
      e.preventDefault();
    }
  }
}

// 布局推荐相关
let layoutInterval = null

// 手机端和视频方向检测
const isMobile = ref(window.innerWidth <= 1024)
const isVideoLandscape = ref(false)

function updateMobileState() {
  isMobile.value = window.innerWidth <= 1024
}

function onVideoLoaded() { checkAndRecommendLayout() }
function onVideoResize() { checkAndRecommendLayout() }

// 响应式重新连接
watch(currentId, (newId) => {
  if (newId) {
    webrtc.disconnect()
    const sessionMode = deviceStore.getDeviceMode(newId)
    const st = getDeviceSettings(newId)
    st.videoSource = sessionMode
    if (sessionMode === 'camera') {
      const camPref = getCameraPreferences(newId)
      st.cameraFacing = camPref.cameraFacing
      st.cameraId = camPref.cameraId
      st.cameraSize = camPref.cameraSize
      st.cameraFps = camPref.cameraFps
      st.audioSource = camPref.audioSource || 'mic'
    }
    localSettings.value = applyPolicyToSettings(st, authStore.userPolicy)
    pageAudioMuted.value = Boolean(localSettings.value.pageAudioMuted)
    currentWebRTC.value = useWebRTC(newId, scrcpyOptions.value)
    deviceStore.registerWebRTC(newId, webrtc)
    setupWebRTC()
  }
})

function setupWebRTC() {
  bindWebRTCEvents(currentWebRTC.value)
  if (stopAgentVersionWatch) {
    stopAgentVersionWatch()
    stopAgentVersionWatch = null
  }
  agentVersion.value = webrtc.agentVersion.value
  stopAgentVersionWatch = watch(webrtc.agentVersion, (val) => {
    agentVersion.value = val || 'unknown'
  })

  if (webrtc && webrtc.cameraSupport) {
    cameraSupport.value = webrtc.cameraSupport.value
    watch(webrtc.cameraSupport, (val) => {
      cameraSupport.value = val
    })
  } else {
    cameraSupport.value = true
  }

  webrtc.setVideoGetter(() => videoElement.value)
  webrtc.setCanvasGetter(() => canvasElement.value)
  if (webrtc && webrtc.onFrameSize) {
    webrtc.onFrameSize((w, h) => {
      videoNaturalSize.value = { width: w, height: h }
      checkAndRecommendLayout()
    })
  }
  webrtc.setAudioMuted(effectiveAudioMuted.value)
  webrtc.connect()
  
  // 设置截图回调
  webrtc.onScreenshot((data) => {
    screenshotData.value = data
    showScreenshot.value = true
  })

  // 命令结果在共用组件 DeviceConsole 内处理，此处无需配置

  // 设置剪切板回调
  webrtc.onClipboard((event) => {
    // 多机直连隔离：非焦点设备剪切板变动不冲刷覆盖宿主机本地剪切板
    if (!effectiveFocused.value) return

    const text = event?.text || ''
    if (!text) {
      return
    }
    const source = event.source || CLIPBOARD_SOURCE_DEVICE
    const echo = consumeClipboardWrite(text)
    if (source === CLIPBOARD_SOURCE_KEYBOARD || echo?.suppressBroadcast) {
      debugLog('[Clipboard] Ignored keyboard/temporary clipboard echo')
      return
    }
    if (echo) {
      lastDeviceClipboardText = text
      debugLog('[Clipboard] Ignored local clipboard echo from device')
      return
    }
    if (text === lastDeviceClipboardText) {
      return
    }
    lastDeviceClipboardText = text
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        lastLocalClipboardText = text
        debugLog('[Clipboard] Auto synced from device')
      }).catch(err => {
        debugWarn('[Clipboard] Failed to auto sync to local:', err)
      })
    } else {
      debugWarn('[Clipboard] Browser writeText API is unavailable')
    }
  })

  // 启动视频流统计轮询
  videoStats.value = null
  webrtc.resetStats()
  if (statsInterval) clearInterval(statsInterval)
  statsInterval = setInterval(async () => {
    const stats = await webrtc.getVideoStats()
    if (stats) videoStats.value = stats
  }, 1000)
}

const handlePopState = (e) => {
  // 当用户按下物理返回键，或者浏览器后退时
  // 阻止默认行为，而是断开连接
  deviceStore.clearActiveDevice()
}

function onWindowFocus() {
  if (isComposingText.value) return
  // 多机直连隔离：仅当前聚焦的直控视口响应切屏剪切板自动同步
  if (!effectiveFocused.value) return

  if (navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText().then(text => {
      if (text && text !== lastLocalClipboardText) {
        setDeviceClipboard(text, { paste: false, source: CLIPBOARD_SOURCE_LOCAL })
        debugLog('[Clipboard] Auto synced local clipboard to device')
      }
    }).catch(() => {
      // 静默失败，不打扰用户
    })
  }
}

function handleSettingsUpdated(event) {
  if (isSavingSettingsSelf) {
    return
  }
  const updatedId = event.detail?.deviceId
  if (!updatedId || updatedId === currentId.value) {
    console.log('[DeviceClient] Settings updated globally or for current device, reloading...')
    localSettings.value = applyPolicyToSettings(getDeviceSettings(currentId.value), authStore.userPolicy)
    pageAudioMuted.value = Boolean(localSettings.value.pageAudioMuted)
    if (currentId.value) {
      webrtc.disconnect()
      currentWebRTC.value = useWebRTC(currentId.value, scrcpyOptions.value)
      deviceStore.registerWebRTC(currentId.value, webrtc)
      setupWebRTC()
    }
  }
}

// 监听音频静音状态动态同步
watch(effectiveAudioMuted, (val) => {
  if (webrtc && typeof webrtc.setAudioMuted === 'function') {
    webrtc.setAudioMuted(val)
  }
})

onMounted(() => {
  window.history.pushState({ panel: 'open' }, '')
  window.addEventListener('popstate', handlePopState)
  window.addEventListener('cloudphone-settings-updated', handleSettingsUpdated)
  
  setupWebRTC()
  runDemoLoop()
  updateCameraClock()
  cameraClockTimer = setInterval(updateCameraClock, 1000)

  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
    if (isFullscreen.value) {
      if (isWebFullscreen.value) {
        document.body.classList.remove('web-fullscreen')
        isWebFullscreen.value = false
      }
    }
  })
  document.addEventListener('keydown', onGlobalKeyDown)
  document.addEventListener('keyup', onGlobalKeyUp)
  document.addEventListener('paste', onGlobalPaste)
  document.addEventListener('wheel', onGlobalWheel, { passive: false })
  layoutInterval = setInterval(checkAndRecommendLayout, 2000)
  nowTickTimer = setInterval(() => { nowTick.value = Date.now() }, 30000)
  window.addEventListener('resize', updateMobileState)
  window.addEventListener('focus', onWindowFocus)
})

onUnmounted(() => {
  if (cameraClockTimer) clearInterval(cameraClockTimer)
  if (recordingTimer) clearInterval(recordingTimer)
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop() } catch (e) {}
  }
  if (demoAnimationId) {
    cancelAnimationFrame(demoAnimationId)
    demoAnimationId = null
  }
  if (stopAgentVersionWatch) {
    stopAgentVersionWatch()
    stopAgentVersionWatch = null
  }
  // 退出群控主控模式
  if (groupControlStore.masterId === currentId.value) {
    groupControlStore.toggleGroupControl(false)
  }
  // Close PiP window if open
  if (pipWindow) {
    pipWindow.close()
    pipWindow = null
  }
  // Remove web-fullscreen class
  document.body.classList.remove('web-fullscreen')
  document.body.classList.remove('has-web-fullscreen')
  isWebFullscreen.value = false
  window.removeEventListener('popstate', handlePopState)
  window.removeEventListener('cloudphone-settings-updated', handleSettingsUpdated)
  deviceStore.setDeviceMode(currentId.value, 'display')
  webrtc.disconnect()
  if (currentId.value) {
    deviceStore.unregisterWebRTC(currentId.value)
  }
  document.removeEventListener('keydown', onGlobalKeyDown)
  document.removeEventListener('keyup', onGlobalKeyUp)
  document.removeEventListener('paste', onGlobalPaste)
  document.removeEventListener('wheel', onGlobalWheel)
  if (layoutInterval) clearInterval(layoutInterval)
  if (statsInterval) clearInterval(statsInterval)
  if (nowTickTimer) clearInterval(nowTickTimer)
  window.removeEventListener('resize', updateMobileState)
  window.removeEventListener('focus', onWindowFocus)
})

function sendClipboardToDevice() {
  if (navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText().then(text => {
      if (text) {
        const ok = setDeviceClipboard(text, { paste: true, source: CLIPBOARD_SOURCE_LOCAL })
        if (ok) debugLog('[Clipboard] Sent to device')
      } else {
        alert('本地剪切板为空')
      }
    }).catch(err => {
      const text = prompt('请输入要发送到设备的剪切板内容：', lastLocalClipboardText)
      if (text) {
        setDeviceClipboard(text, { paste: true, source: CLIPBOARD_SOURCE_LOCAL })
      }
    })
  } else {
    const text = prompt('请输入要发送到设备的剪切板内容：', lastLocalClipboardText)
    if (text) {
      setDeviceClipboard(text, { paste: true, source: CLIPBOARD_SOURCE_LOCAL })
    }
  }
}

function getClipboardFromDevice() {
  const ok = webrtc.getClipboard()
  if (ok) {
    debugLog('[Clipboard] Requested clipboard from device')
  } else {
    debugWarn('[Clipboard] Failed to request clipboard from device')
  }
}

const statusText = computed(() => {
  const map = {
    'connected': '已连接',
    'connecting': '连接中',
    'signaling': '信令中',
    'disconnected': '断开',
    'error': '错误'
  }
  return map[currentWebRTC.value.status.value] || currentWebRTC.value.status.value
})

const loadingText = computed(() => {
  if (currentWebRTC.value.status.value === 'waiting_offer') return '等待设备...'
  return '建立连接...'
})

// 蒙板上方：当前连接用户 + 账号剩余有效期（每 30s 刷新一次显示）
const nowTick = ref(Date.now())
let nowTickTimer = null

function formatDuration(ms) {
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (d > 0) return `${d} 天 ${h} 小时`
  if (h > 0) return `${h} 小时 ${m} 分`
  return `${Math.max(1, m)} 分钟`
}

const connMetaText = computed(() => {
  const name = authStore.username
  if (!name) return ''
  const p = authStore.userPolicy
  const t = p && p.expires_at ? new Date(p.expires_at) : null
  if (!t || Number.isNaN(t.getTime()) || t.getFullYear() <= 1) return `👤 ${name}`
  const ms = t.getTime() - nowTick.value
  if (ms <= 0) return `👤 ${name} · 账号已到期`
  return `👤 ${name} · 剩余 ${formatDuration(ms)}`
})

const showOverlay = computed(() => currentWebRTC.value.status.value !== 'connected')

// 是否需要旋转坐标（手机端且视频横屏）
const needRotateCoords = computed(() => isMobile.value && isVideoLandscape.value)

// 存储视频实际尺寸用于坐标转换
const videoNaturalSize = ref({ width: 0, height: 0 })

function checkAndRecommendLayout() {
  const activeMedia = (webrtc && webrtc.isWebCodecsActive && webrtc.isWebCodecsActive.value && canvasElement.value) ? canvasElement.value : videoElement.value
  if (!activeMedia) return
  const videoW = activeMedia.videoWidth || activeMedia.width || videoNaturalSize.value.width || 0
  const videoH = activeMedia.videoHeight || activeMedia.height || videoNaturalSize.value.height || 0
  if (!videoW || !videoH) return
  const isPhysical = videoW > videoH
  const rot = webrtc.deviceRotation ? webrtc.deviceRotation.value : 0
  const isHwc = (rot === 90 || rot === 270) && !isPhysical
  const landscape = isPhysical || isHwc
  const ratio = isHwc ? (videoH / videoW) : (videoW / videoH)
  isVideoLandscape.value = landscape
  videoNaturalSize.value = { width: videoW, height: videoH }
  emit('recommend-layout', { isLandscape: landscape, ratio: ratio })
}

// 旋转坐标转换
function rotateCoords(clientX, clientY) {
  if (!needRotateCoords.value) return { x: clientX, y: clientY }
  
  const activeMedia = (webrtc && webrtc.isWebCodecsActive && webrtc.isWebCodecsActive.value && canvasElement.value) ? canvasElement.value : videoElement.value
  if (!activeMedia) return { x: clientX, y: clientY }
  
  const screenW = window.innerWidth
  const screenH = window.innerHeight
  const videoW = activeMedia.videoWidth || activeMedia.width || videoNaturalSize.value.width
  const videoH = activeMedia.videoHeight || activeMedia.height || videoNaturalSize.value.height
  
  if (!videoW || !videoH) return { x: clientX, y: clientY }
  
  const rotatedRatio = videoH / videoW
  const screenRatio = screenW / screenH
  
  let normInVideoX, normInVideoY
  
  if (screenRatio > rotatedRatio) {
    const videoDisplayW = screenH * rotatedRatio
    const offsetX = (screenW - videoDisplayW) / 2
    const videoX = clientX - offsetX
    normInVideoX = videoX / videoDisplayW
    normInVideoY = clientY / screenH
  } else {
    const videoDisplayH = screenW / rotatedRatio
    const offsetY = (screenH - videoDisplayH) / 2
    const videoY = clientY - offsetY
    normInVideoX = clientX / screenW
    normInVideoY = videoY / videoDisplayH
  }
  
  const origNormX = normInVideoY
  const origNormY = 1 - normInVideoX
  const origX = origNormX * videoW
  const origY = origNormY * videoH
  
  return { x: origX, y: origY, isRotated: true }
}

function retry() {
  webrtc.disconnect()
  webrtc.connect()
}

// iOS Safari（及所有 iOS 浏览器内核）不支持任意元素的 Fullscreen API，
// 此时"全屏"按钮自动退化为 CSS 页面全屏
const nativeFullscreenSupported = ref(!!document.fullscreenEnabled)

function toggleFullscreen() {
  if (!nativeFullscreenSupported.value) {
    toggleWebFullscreen()
    return
  }
  if (!document.fullscreenElement) {
    // 如果处于网页全屏，先退出网页全屏，避免样式污染系统全屏元素
    if (isWebFullscreen.value) {
      document.body.classList.remove('web-fullscreen')
      document.body.classList.remove('has-web-fullscreen')
      isWebFullscreen.value = false
    }
    containerRef.value?.requestFullscreen().catch(() => {
      toggleWebFullscreen()
    })
  } else {
    document.exitFullscreen().catch(() => {})
  }
}

function toggleWebFullscreen() {
  if (!isWebFullscreen.value) {
    // 如果处于系统全屏，先退出系统全屏
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
    document.body.classList.add('has-web-fullscreen')
    isWebFullscreen.value = true
  } else {
    document.body.classList.remove('has-web-fullscreen')
    document.body.classList.remove('web-fullscreen')
    isWebFullscreen.value = false
  }
}

const pictureInPictureSupported = computed(() => {
  return !!('documentPictureInPicture' in window) || !!document.pictureInPictureEnabled
})
const isPiP = ref(false)
let pipWindow = null

async function togglePictureInPicture() {
  if (!videoElement.value) return

  // If already in PiP, exit
  if (isPiP.value) {
    if (pipWindow) {
      pipWindow.close()
      // cleanup handled by pagehide listener
    } else if (document.pictureInPictureElement) {
      await document.exitPictureInPicture()
    }
    isPiP.value = false
    return
  }

  // Try Document PiP first (supports interaction)
  if ('documentPictureInPicture' in window) {
    try {
      const video = videoElement.value
      const vw = video.videoWidth || 480
      const vh = video.videoHeight || 854
      // Scale down to reasonable PiP size
      const scale = Math.min(400 / vw, 700 / vh, 1)
      const pipW = Math.round(vw * scale)
      const pipH = Math.round(vh * scale)

      pipWindow = await window.documentPictureInPicture.requestWindow({
        width: pipW,
        height: pipH,
      })

      // Copy stylesheets into PiP window
      const styles = document.querySelectorAll('style, link[rel="stylesheet"]')
      styles.forEach(s => {
        pipWindow.document.head.appendChild(s.cloneNode(true))
      })

      // Add PiP-specific styles
      const pipStyle = pipWindow.document.createElement('style')
      pipStyle.textContent = `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #000; overflow: hidden; width: 100%; height: 100vh; display: flex; align-items: center; justify-content: center; }
        .pip-video-container { width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; }
        video { width: 100%; height: 100%; object-fit: contain; display: block; }
      `
      pipWindow.document.head.appendChild(pipStyle)

      // Create container and move video into PiP window
      const container = pipWindow.document.createElement('div')
      container.className = 'pip-video-container'
      container.appendChild(video)
      pipWindow.document.body.appendChild(container)

      isPiP.value = true

      // When PiP window closes, move video back
      pipWindow.addEventListener('pagehide', () => {
        const mainContainer = containerRef.value
        if (mainContainer && video) {
          // Re-insert video before the textarea (hidden-keyboard-input)
          const textarea = mainContainer.querySelector('.hidden-keyboard-input')
          if (textarea) {
            mainContainer.insertBefore(video, textarea)
          } else {
            mainContainer.appendChild(video)
          }
        }
        isPiP.value = false
        pipWindow = null
      })

      return
    } catch (err) {
      console.warn('Document PiP failed, falling back to standard PiP:', err)
      pipWindow = null
    }
  }

  // Fallback: standard PiP (view-only, no interaction)
  try {
    await videoElement.value.requestPictureInPicture()
    isPiP.value = true
    videoElement.value.addEventListener('leavepictureinpicture', () => {
      isPiP.value = false
    }, { once: true })
  } catch (err) {
    console.error('PiP error:', err)
  }
}


function takeScreenshot() {
  webrtc.requestScreenshot()
}


function quickKey(cmd) {
  webrtc.sendCommand(cmd)
}

function togglePageMute() {
  if (props.audioMuted) {
    deviceStore.focusDevice(currentId.value)
  }
  pageAudioMuted.value = webrtc.toggleAudioMuted()
}

function quitAgent() {
  if (confirm(`警告：确定要停止设备 "${currentId.value}" 上的 Agent 进程吗？停止后该设备将下线。`)) {
    deviceStore.quitAgent(currentId.value)
  }
}

const CONTROL_KEY_MAP = {
  'Enter': 66,
  'Backspace': 67,
  'Delete': 112,
  'Tab': 61,
  'Escape': 111,
  'ArrowUp': 19,
  'ArrowDown': 20,
  'ArrowLeft': 21,
  'ArrowRight': 22,
  'Space': 62,
  ' ': 62
}

function onKeyboardKeyDown(e) {
  debugLog('[Keyboard] KeyDown:', e.key, e.code, 'isComposing:', e.isComposing)
  if (e.isComposing) return
  if (keymapStore.isEditMode) return
  if (!videoNaturalSize.value.width) return

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
    return
  }

  // 1. 尝试触发按键映射 (Keymapping)
  if (keymapEngine.handleKeyEvent(e, true, videoNaturalSize.value.width, videoNaturalSize.value.height)) {
    debugLog('[Keyboard] Blocked by Keymapping:', e.key)
    e.preventDefault()
    e.stopPropagation()
    return
  }

  // 2. 处理控制键 (Inject Keycode)
  const androidCode = CONTROL_KEY_MAP[e.key]
  if (androidCode !== undefined) {
    debugLog('[Keyboard] Injecting keycode DOWN:', androidCode, e.key)
    webrtc.sendInjectKeycode(0, androidCode) // Action Down
    e.preventDefault()
    e.stopPropagation()
  }
}

function onKeyboardKeyUp(e) {
  debugLog('[Keyboard] KeyUp:', e.key, e.code, 'isComposing:', e.isComposing)
  if (e.isComposing) return
  if (keymapStore.isEditMode) return
  if (!videoNaturalSize.value.width) return

  if (keymapEngine.handleKeyEvent(e, false, videoNaturalSize.value.width, videoNaturalSize.value.height)) {
    e.preventDefault()
    e.stopPropagation()
    return
  }

  const androidCode = CONTROL_KEY_MAP[e.key]
  if (androidCode !== undefined) {
    debugLog('[Keyboard] Injecting keycode UP:', androidCode, e.key)
    webrtc.sendInjectKeycode(1, androidCode) // Action Up
    e.preventDefault()
    e.stopPropagation()
  }
}

const isComposingText = ref(false)

function onCompositionStart(e) {
  isComposingText.value = true
  debugLog('[Keyboard] IME Composition started')
}

function onCompositionEnd(e) {
  isComposingText.value = false
  debugLog('[Keyboard] IME Composition ended. data:', e.data)
  if (e.data) {
    webrtc.sendInjectText(e.data)
  }
  if (hiddenInput.value) {
    hiddenInput.value.value = ''
  }
}

function onKeyboardInput(e) {
  if (isComposingText.value) {
    debugLog('[Keyboard] input ignored (IME composing in progress)')
    return
  }
  const text = e.target.value
  debugLog('[Keyboard] Input event text (direct):', text)
  if (text.length > 0) {
    webrtc.sendInjectText(text)
    // 立即清空输入框
    e.target.value = ''
  }
}

function onKeyboardPaste(e) {
  if (keymapStore.isEditMode) return
  if (!videoNaturalSize.value.width) return
  const text = e.clipboardData?.getData('text')
  if (!text) return
  e.preventDefault()
  setDeviceClipboard(text, { paste: true, source: CLIPBOARD_SOURCE_LOCAL })
  debugLog('[Keyboard] paste event routed to device clipboard')
}

let mouseDown = false
function onMouseDown(e) { 
  if (isCameraMode.value) {
    if (cameraZoom.value > 1.0) {
      isCameraPanning.value = true
      panStartPoint.x = e.clientX
      panStartPoint.y = e.clientY
      panStartOffset.x = cameraPanX.value
      panStartOffset.y = cameraPanY.value
    }
    e.preventDefault()
    return
  }
  if (e.button === 1) { // 中键 -> HOME
    webrtc.sendInjectKeycode(0, 3)
    e.preventDefault()
    return
  }
  if (e.button === 2) { // 右键 -> BACK
    webrtc.sendInjectKeycode(0, 4)
    e.preventDefault()
    return
  }
  const coord = rotateCoords(e.clientX, e.clientY)
  mouseDown = true; 
  deviceStore.focusDevice(currentId.value)
  if (import.meta.env.VITE_DEMO_MODE === 'true' && canvasElement.value) {
    const rect = canvasElement.value.getBoundingClientRect()
    const cvsX = (e.clientX - rect.left) * (canvasElement.value.width / (rect.width || 1))
    const cvsY = (e.clientY - rect.top) * (canvasElement.value.height / (rect.height || 1))
    demoRipples.value.push({ x: cvsX, y: cvsY, radius: 10, alpha: 0.8 })
  }
  webrtc.sendTouch(0, e.clientX, e.clientY, -1, coord)
  if (hiddenInput.value) {
    hiddenInput.value.focus()
    debugLog('[Keyboard] focused hidden input element. activeElement:', document.activeElement ? document.activeElement.tagName : 'none')
  }
  e.preventDefault() // 阻止默认行为，防止焦点被 video 夺走！
}
function onMouseMove(e) { 
  if (isCameraMode.value) {
    if (isCameraPanning.value) {
      const dx = e.clientX - panStartPoint.x
      const dy = e.clientY - panStartPoint.y
      cameraPanX.value = panStartOffset.x + dx
      cameraPanY.value = panStartOffset.y + dy
    }
    return
  }
  if (mouseDown) {
    const coord = rotateCoords(e.clientX, e.clientY)
    webrtc.sendTouch(2, e.clientX, e.clientY, -1, coord)
  }
}
function onMouseUp(e) { 
  if (isCameraMode.value) {
    isCameraPanning.value = false
    return
  }
  if (e.button === 1) { // 中键 -> HOME
    webrtc.sendInjectKeycode(1, 3)
    e.preventDefault()
    return
  }
  if (e.button === 2) { // 右键 -> BACK
    webrtc.sendInjectKeycode(1, 4)
    e.preventDefault()
    return
  }
  const coord = rotateCoords(e.clientX, e.clientY)
  mouseDown = false; 
  webrtc.sendTouch(1, e.clientX, e.clientY, -1, coord)
}
function onMouseLeave(e) { 
  if (isCameraMode.value) {
    isCameraPanning.value = false
    return
  }
  if (mouseDown) { 
    const coord = rotateCoords(e.clientX, e.clientY)
    mouseDown = false; 
    webrtc.sendTouch(1, e.clientX, e.clientY, -1, coord)
  }
}

function onTouchStart(e) {
  if (isCameraMode.value) return
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i]
    const coord = rotateCoords(t.clientX, t.clientY)
    webrtc.sendTouch(0, t.clientX, t.clientY, t.identifier, coord)
  }
}
function onTouchMove(e) {
  if (isCameraMode.value) return
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i]
    const coord = rotateCoords(t.clientX, t.clientY)
    webrtc.sendTouch(2, t.clientX, t.clientY, t.identifier, coord)
  }
}
function onTouchEnd(e) {
  if (isCameraMode.value) return
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i]
    const coord = rotateCoords(t.clientX, t.clientY)
    webrtc.sendTouch(1, t.clientX, t.clientY, t.identifier, coord)
  }
}
</script>

<style scoped>
.hidden-keyboard-input {
  position: absolute;
  left: 0;
  top: 0;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: 0;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: transparent;
  caret-color: transparent;
  z-index: 10;
  overflow: hidden;
}

.device-panel-view {
  height: 100%;
  display: flex;
  flex-direction: row;
  background: #000;
  position: relative;
  overflow: hidden;
}

.device-client-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-width: 0;
}

.icon {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.fullscreen-fab {
  position: absolute;
  top: 16px;
  right: 60px; /* Moved left to accommodate close button */
  width: 36px;
  height: 36px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 100;
  transition: all 0.2s;
}
.fullscreen-fab .icon { width: 18px; height: 18px; }
.fullscreen-fab:hover { background: rgba(0, 0, 0, 0.8); transform: scale(1.1); }

.mobile-close-fab {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  background: rgba(248, 81, 73, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 100;
  font-size: 16px;
  font-weight: bold;
  transition: all 0.2s;
}
.mobile-close-fab:hover { background: rgba(248, 81, 73, 1); transform: scale(1.1); }

/* PC 且无需要返回按钮时，全屏按钮在最右边 */
@media (min-width: 1025px) {
  .fullscreen-fab {
    right: 16px;
  }
}

/* 局部独立页面全屏 (Web Fullscreen) */
.device-panel-view.is-web-fullscreen {
  position: relative !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  z-index: 1000 !important;
  background: #000 !important;
  display: flex !important;
  flex-direction: row !important;
}

.device-panel-view.is-web-fullscreen .device-client-main {
  width: 100% !important;
  height: 100% !important;
  flex: 1 !important;
}

.device-panel-view.is-web-fullscreen .video-wrapper {
  width: 100% !important;
  height: 100% !important;
  background: #000 !important;
}

.device-panel-view.is-web-fullscreen .webfullscreen-fab {
  position: fixed !important;
  top: 20px !important;
  right: 20px !important;
  z-index: 100000 !important;
  background: rgba(248, 81, 73, 0.85) !important;
  border: 1px solid rgba(255, 255, 255, 0.4) !important;
  color: #fff !important;
  width: 40px !important;
  height: 40px !important;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.7) !important;
}

.device-panel-view.is-web-fullscreen .webfullscreen-fab:hover {
  background: rgba(248, 81, 73, 1) !important;
  transform: scale(1.1) !important;
}

.device-panel-view.is-web-fullscreen .fullscreen-fab,
.device-panel-view.is-web-fullscreen .pip-fab {
  display: none !important;
}

.stats-badge {
  position: absolute;
  top: 16px;
  left: 16px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  color: #0f0;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 4px;
  z-index: 100;
  pointer-events: none;
  white-space: nowrap;
}

.sidebar-agent-version {
  font-size: 9px;
  color: #444;
  text-align: center;
  width: 48px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 4px;
  cursor: default;
  user-select: none;
  transition: color 0.2s;
}
.sidebar-agent-version:hover {
  color: #999;
}

.fab-agent-version {
  font-size: 10px;
  color: #555;
  text-align: center;
  padding: 8px 0 2px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  margin-top: 6px;
  user-select: none;
}

.stat-delimiter { color: #555; margin: 0 2px; }
.stat-warn { color: #f85149; }

.video-wrapper {
  flex: 1;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  min-height: 0;
}

.video-stream {
  width: 100%;
  height: 100%;
  object-fit: contain;
  touch-action: none;
}

.panel-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

.overlay-box { text-align: center; padding: 24px; }
.conn-meta { font-size: 12px; color: #8b949e; margin-bottom: 12px; }
.mini-spinner { width: 24px; height: 24px; border: 2px solid rgba(255,255,255,0.1); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 12px; }
@keyframes spin { to { transform: rotate(360deg); } }

.error-msg { color: var(--accent); font-weight: 600; }
.error-tip { font-size: 12px; color: #999; margin: 8px 0 16px; }

.retry-btn { background: var(--accent); color: white; border: none; padding: 6px 16px; border-radius: 4px; font-size: 12px; cursor: pointer; }

/* PC 右侧栏 */
.control-sidebar {
  width: 64px;
  background: #111;
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
  gap: 12px;
  overflow-y: auto;
  z-index: 10;
}

.sidebar-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  align-items: center;
}

.sidebar-btn-wrapper {
  position: relative;
  display: flex;
  justify-content: center;
}

.sidebar-btn-delete {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #dc3545;
  color: white;
  border: 1px solid #111;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 11;
  padding: 0;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.2s;
}

.sidebar-btn-wrapper:hover .sidebar-btn-delete {
  opacity: 1;
}

.sidebar-btn {
  background: #222;
  border: 1px solid #333;
  color: #ccc;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

.sidebar-btn .icon {
  margin-bottom: 2px;
}

.sidebar-btn .btn-text {
  font-size: 10px;
  white-space: nowrap;
}

.sidebar-btn:hover { background: #333; border-color: var(--accent); color: white; }
.sidebar-btn.active { background: rgba(88, 166, 255, 0.18); border-color: var(--accent); color: white; }
.sidebar-btn.danger:hover { background: rgba(248, 81, 73, 0.2); border-color: var(--error); color: var(--error); }
.sidebar-btn.danger { color: #888; }
.sidebar-btn.add-btn { border-style: dashed; }

.sidebar-divider {
  width: 32px;
  height: 1px;
  background: #333;
  margin: 4px 0;
}

/* 悬浮菜单全屏遮罩 */
.fab-overlay {
  position: fixed;
  inset: 0;
  z-index: 99;
}

/* 手机悬浮菜单 */
.mobile-fab-container {
  position: fixed;
  z-index: 100;
  width: 56px;
  height: 56px;
}

.mobile-fab-main {
  position: absolute;
  top: 0;
  left: 0;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, transform 0.2s;
  touch-action: none;
  z-index: 2;
}
.mobile-fab-main .icon {
  width: 24px;
  height: 24px;
}
.mobile-fab-main:active { cursor: grabbing; transform: scale(0.95); }
.mobile-fab-main.active { background: #555; }

.mobile-fab-menu {
  position: absolute;
  bottom: 68px;
  right: 0;
  width: max-content;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(20, 20, 20, 0.9);
  backdrop-filter: blur(10px);
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  opacity: 0;
  pointer-events: none;
  transform: translateY(20px);
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  max-height: 60vh;
  overflow-y: auto;
  z-index: 1;
}

.mobile-fab-menu.align-left {
  right: auto;
  left: 0;
}

.mobile-fab-menu.align-top {
  bottom: auto;
  top: 68px;
  transform: translateY(-20px);
}

.mobile-fab-menu.show {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.fab-item {
  background: #2a2a2a;
  border: 1px solid #444;
  color: #eee;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  display: flex;
  align-items: center;
  width: 100%;
}

.fab-item-wrapper {
  position: relative;
  display: flex;
  width: 100%;
}

.fab-item-delete {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #dc3545;
  color: white;
  border: none;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 11;
  padding: 0;
  line-height: 1;
}

.fab-item .icon {
  margin-right: 8px;
  width: 18px;
  height: 18px;
}

.fab-item:active { background: var(--accent); }
.fab-item.danger { color: #f85149; }
.fab-item.group-active { color: #ff9f43; border-color: rgba(255, 159, 67, 0.4); background: rgba(255, 159, 67, 0.1); }
.fab-item.add-btn { background: transparent; border-style: dashed; justify-content: center; }
.fab-divider { height: 1px; background: rgba(255,255,255,0.1); margin: 4px 0; }

/* 控制台样式 */
.console-drawer {
  height: 380px;
  background: #151515;
  border-top: 2px solid var(--accent);
  display: flex;
  flex-direction: column;
  z-index: 100;
  flex-shrink: 0;
}

.console-drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  background: #161b22;
  border-bottom: 1px solid var(--border);
  height: 40px;
  flex-shrink: 0;
}

.drawer-title {
  font-size: 13px;
  font-weight: 600;
  color: #c9d1d9;
}

.close-console { background: none; border: none; color: #555; cursor: pointer; font-size: 18px; }
.close-console:hover { color: #f85149; }
.adb-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #666; text-align: center; padding: 20px; }
.adb-connect-btn { background: var(--accent); color: white; border: none; padding: 10px 20px; border-radius: 6px; margin-bottom: 12px; cursor: pointer; font-weight: 600; }

/* 手机端横屏视频全屏显示 - 长边对长边 */
@media (max-width: 1024px) {
  .device-panel-view.mobile-landscape {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: #000;
  }
  
  .device-panel-view.mobile-landscape .video-wrapper {
    position: absolute;
    inset: 0;
    z-index: 1;
  }
  
  .device-panel-view.mobile-landscape .video-stream {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100vh;
    height: 100vw;
    transform: translate(-50%, -50%) rotate(90deg);
    object-fit: contain;
  }
  
  .device-panel-view.mobile-landscape .fullscreen-fab {
    z-index: 101;
  }
  
  .device-panel-view.mobile-landscape .console-drawer {
    position: fixed;
    bottom: 60px;
    left: 0;
    right: 0;
    z-index: 100;
  }
  
  .device-panel-view.mobile-landscape .panel-overlay {
    z-index: 50;
  }
}

/* 群控从机侧栏布局 */
.group-control-btn.active { background: rgba(255, 159, 67, 0.18); border-color: #ff9f43; color: #ff9f43; }
.group-control-btn.active:hover { background: rgba(255, 159, 67, 0.28); }

/* =========================================================
   📷 摄像头专属安防监控控制台样式 (Surveillance Mode)
   ========================================================= */

/* --- 监控专属 OSD 水印栏 --- */
.camera-osd-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 42px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.88) 0%, rgba(0, 0, 0, 0.45) 75%, transparent 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  z-index: 90;
  pointer-events: none;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 12px;
  color: #e6edf3;
  user-select: none;
}

.osd-left, .osd-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.osd-divider {
  color: rgba(255, 255, 255, 0.25);
  font-weight: 300;
}

.live-dot {
  background: rgba(46, 160, 67, 0.2);
  color: #3fb950;
  border: 1px solid rgba(46, 160, 67, 0.4);
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
}

.osd-title {
  font-weight: 700;
  color: #58a6ff;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.osd-lens {
  color: #38bdf8;
  font-weight: 600;
}

.osd-res, .osd-fps, .osd-bitrate {
  color: #7ee787;
  font-variant-numeric: tabular-nums;
}

.osd-clock {
  color: #8b949e;
  font-variant-numeric: tabular-nums;
}

.osd-battery {
  color: #a5d6ff;
  font-variant-numeric: tabular-nums;
}

.osd-battery.temp-warn {
  color: #f85149;
  font-weight: bold;
  animation: blink-warn 1s infinite;
}

.osd-rec-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(248, 81, 73, 0.25);
  border: 1px solid #f85149;
  color: #f85149;
  padding: 2px 10px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 11px;
}

.rec-blink-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f85149;
  animation: blink-warn 0.8s infinite ease-in-out;
}

@keyframes blink-warn {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* --- 监控专属右侧控制栏 (Camera Sidebar) --- */
.camera-sidebar {
  width: 250px;
  background: #0d1117;
  border-left: 1px solid #30363d;
  display: flex;
  flex-direction: column;
  z-index: 10;
  color: #c9d1d9;
  flex-shrink: 0;
}

.camera-sidebar-title {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #58a6ff;
  border-bottom: 1px solid #21262d;
  background: #161b22;
}

.sidebar-title-icon {
  width: 18px;
  height: 18px;
  color: #58a6ff;
}

.camera-sidebar-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cam-section {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 10px;
}

.cam-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #8b949e;
}

.cam-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(88, 166, 255, 0.15);
  color: #58a6ff;
  border: 1px solid rgba(88, 166, 255, 0.3);
}

.cam-badge.zoom-val {
  background: rgba(63, 185, 80, 0.15);
  color: #3fb950;
  border-color: rgba(63, 185, 80, 0.3);
}

.cam-badge.audio-on {
  background: rgba(63, 185, 80, 0.15);
  color: #3fb950;
  border-color: rgba(63, 185, 80, 0.3);
}

.cam-btn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.cam-btn-grid.res-grid {
  grid-template-columns: repeat(4, 1fr);
}

.cam-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 8px 6px;
  color: #c9d1d9;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.cam-btn:hover {
  background: #30363d;
  border-color: #8b949e;
}

.cam-btn.active {
  background: rgba(56, 189, 248, 0.15);
  border-color: #38bdf8;
  color: #38bdf8;
  font-weight: 700;
  box-shadow: 0 0 8px rgba(56, 189, 248, 0.25);
}

.cam-btn .icon {
  width: 14px;
  height: 14px;
}

.res-btn {
  padding: 6px 2px;
  font-size: 11px;
}

.zoom-slider-row {
  margin: 6px 0;
}

.zoom-range {
  width: 100%;
  accent-color: #38bdf8;
  cursor: pointer;
}

.zoom-presets {
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
}

.preset-btn {
  padding: 5px 0;
  font-size: 10px;
}

.reset-btn {
  padding: 5px 0;
  font-size: 10px;
  color: #8b949e;
}

.audio-toggle-btn {
  width: 100%;
  padding: 8px;
}

.audio-toggle-btn.active {
  background: rgba(63, 185, 80, 0.15);
  border-color: #3fb950;
  color: #3fb950;
}

.snapshot-btn:hover {
  border-color: #58a6ff;
  color: #58a6ff;
}

.record-btn.recording {
  background: rgba(248, 81, 73, 0.2);
  border-color: #f85149;
  color: #f85149;
}

.danger-btn {
  color: #f85149;
}

.danger-btn:hover {
  background: rgba(248, 81, 73, 0.15);
  border-color: #f85149;
}

/* 手机悬浮菜单监控项扩展 */
.fab-section-title {
  font-size: 11px;
  font-weight: 700;
  color: #8b949e;
  padding: 4px 10px 2px;
  user-select: none;
}

.fab-res-row {
  display: flex;
  gap: 4px;
  padding: 2px 6px;
}

.mini-res {
  flex: 1;
  padding: 4px 0 !important;
  font-size: 10px !important;
  justify-content: center;
}

.fab-item.cam-active {
  border-color: #38bdf8 !important;
  color: #38bdf8 !important;
  background: rgba(56, 189, 248, 0.15) !important;
}

.fab-item.recording {
  border-color: #f85149 !important;
  color: #f85149 !important;
  background: rgba(248, 81, 73, 0.2) !important;
}
</style>
