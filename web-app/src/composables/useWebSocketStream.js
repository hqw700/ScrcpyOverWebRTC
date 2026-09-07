/**
 * useWebSocketStream - 基于 WebSocket H.264 裸流与信令交互的极速投屏与直控 Composable
 *
 * 特性：
 * 1. 100% TCP 穿透：在复杂对称 NAT、防火墙拦截 UDP、无可用 TURN 服务器环境下，作为 WebRTC 的稳定免穿透投屏替代方案；
 * 2. 硬件级解码：默认基于 WebCodecs VideoDecoder 直接硬件显存直通解码，未支持时无缝平滑回退至 WASM (h264decoder)；
 * 3. 完整直控支持：与 useWebRTC 保持一致的方法签名（sendTouch, sendInjectKeycode, sendScroll, sendText 等），
 *    自动处理 object-fit: contain 黑边与坐标归一化逆映射，下发至 Agent group_control_event；
 * 4. 动态统计：支持统计真实视频解码 FPS、传输码率 (kbps/Mbps) 与分辨率自适应更新。
 */

import { ref, computed, watch, onUnmounted } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import { H264Decoder } from 'h264decoder'

export function useWebSocketStream(deviceId, options = {}) {
  const deviceStore = useDeviceStore()

  // --- 状态变量 (对齐 useWebRTC 规范) ---
  const status = ref('disconnected') // 'disconnected' | 'connecting' | 'connected'
  const error = ref(null)
  const isWebCodecsActive = ref(typeof VideoDecoder !== 'undefined')
  const stream = ref(null) // 兼容占位
  const agentVersion = ref('unknown')
  const cameraSupport = ref(false)
  const deviceRotation = ref(0)
  const isFirstFrameRendered = ref(false)

  // 视频分辨率与统计 (设备屏幕物理基准尺寸)
  const currentDevice = computed(() => deviceStore.devices.find(d => d.id === deviceId))
  const displayInfo = computed(() => currentDevice.value?.info?.displays?.[0])
  const DEVICE_W = ref(displayInfo.value?.x_res || 1080)
  const DEVICE_H = ref(displayInfo.value?.y_res || 1920)

  watch(displayInfo, (info) => {
    if (info && info.x_res && info.y_res) {
      DEVICE_W.value = info.x_res
      DEVICE_H.value = info.y_res
    }
  }, { immediate: true })

  const videoNaturalSize = ref({ width: 0, height: 0 })
  const realFps = ref(0)
  const realBitrate = ref(0)
  const targetBitrateMbps = ref(
    options.bitrate
      ? (options.bitrate >= 10000 ? Math.round(options.bitrate / 100000) / 10 : options.bitrate)
      : (options.preview_bitrate ? Math.round(options.preview_bitrate / 100000) / 10 : 4)
  )

  // Canvas 与 DOM 元素 Getter
  let canvasGetter = null
  let frameSizeCallback = null
  let controlEventCallback = null
  let screenshotCallback = null
  let clipboardCallback = null

  // 连接超时：发出 start_preview 后等待首个关键帧渲染，超时则报错允许重试
  const CONNECT_TIMEOUT_MS = 10000
  let connectTimeoutTimer = null
  function armConnectTimeout() {
    clearConnectTimeout()
    connectTimeoutTimer = setTimeout(() => {
      if (status.value === 'connecting') {
        error.value = '等待设备推流超时：设备可能离线、Agent 版本过旧不支持 WS 投屏，或 TCP 通道被阻断'
        status.value = 'disconnected'
      }
    }, CONNECT_TIMEOUT_MS)
  }
  function clearConnectTimeout() {
    if (connectTimeoutTimer) {
      clearTimeout(connectTimeoutTimer)
      connectTimeoutTimer = null
    }
  }

  // 解码器实例与缓存
  let videoDecoder = null
  let h264Decoder = null
  let hasConfigured = false
  let lastSps = null
  let lastPps = null
  let hasReceivedKeyFrame = false

  // 触控序列号与防抖
  let touchSeq = 0
  let lastMoveSentTs = 0
  let lastMoveSentX = -999
  let lastMoveSentY = -999
  const THROTTLE_INTERVAL_MS = 20
  const MOVE_DISTANCE_THRESHOLD_SQ = 9 // 3px^2

  // 统计追踪 (FPS / Bitrate)
  let frameCount = 0
  let byteCount = 0
  let lastStatsTime = performance.now()
  let statsTimer = null

  // --- 辅助工具函数 ---
  function areBuffersEqual(buf1, buf2) {
    if (!buf1 || !buf2) return false
    if (buf1.length !== buf2.length) return false
    for (let i = 0; i < buf1.length; i++) {
      if (buf1[i] !== buf2[i]) return false
    }
    return true
  }

  function parseAnnexB(buffer) {
    const naluList = []
    const len = buffer.length
    let i = 0
    while (i < len) {
      let startCodeLen = 0
      if (i + 2 < len && buffer[i] === 0 && buffer[i + 1] === 0 && buffer[i + 2] === 1) {
        startCodeLen = 3
      } else if (i + 3 < len && buffer[i] === 0 && buffer[i + 1] === 0 && buffer[i + 2] === 0 && buffer[i + 3] === 1) {
        startCodeLen = 4
      }

      if (startCodeLen > 0) {
        const naluStart = i + startCodeLen
        i = naluStart
        while (i < len) {
          if (i + 2 < len && buffer[i] === 0 && buffer[i + 1] === 0 && buffer[i + 2] === 1) {
            break
          }
          if (i + 3 < len && buffer[i] === 0 && buffer[i + 1] === 0 && buffer[i + 2] === 0 && buffer[i + 3] === 1) {
            break
          }
          i++
        }
        const naluEnd = i
        if (naluEnd > naluStart) {
          naluList.push(buffer.subarray(naluStart, naluEnd))
        }
      } else {
        i++
      }
    }
    return naluList
  }

  // --- 解码器初始化与管线 ---
  function initDecoder(preferredMode = 'webcodecs') {
    if (preferredMode === 'webcodecs' && typeof VideoDecoder !== 'undefined') {
      if (videoDecoder && videoDecoder.state !== 'closed') return

      try {
        videoDecoder = new VideoDecoder({
          output: (frame) => {
            frameCount++
            const canvasEl = canvasGetter ? canvasGetter() : null
            if (!canvasEl) {
              frame.close()
              return
            }
            const ctx = canvasEl.getContext('2d', { desynchronized: true })
            if (!ctx) {
              frame.close()
              return
            }

            const dispW = frame.displayWidth || frame.codedWidth
            const dispH = frame.displayHeight || frame.codedHeight

            if (canvasEl.width !== dispW || canvasEl.height !== dispH) {
              canvasEl.width = dispW
              canvasEl.height = dispH
              videoNaturalSize.value = { width: dispW, height: dispH }
              if (!DEVICE_W.value || !DEVICE_H.value) {
                DEVICE_W.value = dispW
                DEVICE_H.value = dispH
              }
              if (frameSizeCallback) {
                frameSizeCallback(dispW, dispH)
              }
            }

            ctx.drawImage(frame, 0, 0, canvasEl.width, canvasEl.height)
            frame.close() // 及时关闭以释放显存缓冲区

            if (!isFirstFrameRendered.value) {
              isFirstFrameRendered.value = true
              status.value = 'connected'
              clearConnectTimeout()
            }
          },
          error: (err) => {
            console.warn(`[useWebSocketStream] WebCodecs hardware decoder error for ${deviceId}, falling back to WASM:`, err)
            isWebCodecsActive.value = false
            try {
              videoDecoder.close()
            } catch (e) {}
            videoDecoder = null
            initDecoder('wasm')
          }
        })

        isWebCodecsActive.value = true
        hasConfigured = false
        lastSps = null
        lastPps = null
        return
      } catch (e) {
        console.warn(`[useWebSocketStream] Failed to initialize WebCodecs for ${deviceId}:`, e)
      }
    }

    // 回退 WASM 软件解码器
    isWebCodecsActive.value = false
    if (!h264Decoder) {
      try {
        h264Decoder = new H264Decoder()
      } catch (err) {
        console.error(`[useWebSocketStream] Failed to initialize WASM decoder:`, err)
        error.value = 'WASM 解码器初始化失败'
      }
    }
  }

  // WASM YUV 渲染
  function renderYUV(canvasEl, yuv, width, height) {
    frameCount++
    const ctx = canvasEl.getContext('2d')
    if (!ctx) return

    if (canvasEl.width !== width || canvasEl.height !== height) {
      canvasEl.width = width
      canvasEl.height = height
      videoNaturalSize.value = { width, height }
      if (!DEVICE_W.value || !DEVICE_H.value) {
        DEVICE_W.value = width
        DEVICE_H.value = height
      }
      if (frameSizeCallback) {
        frameSizeCallback(width, height)
      }
    }

    const imgData = ctx.createImageData(width, height)
    const buf = new ArrayBuffer(imgData.data.length)
    const buf8 = new Uint8ClampedArray(buf)
    const buf32 = new Uint32Array(buf)

    const ySize = width * height
    const chromaSize = ySize >> 2

    let i = 0
    for (let y = 0; y < height; y++) {
      const yOffset = y * width
      const uvRow = (y >> 1) * (width >> 1)
      for (let x = 0; x < width; x++) {
        const Y = yuv[yOffset + x]
        const uvCol = x >> 1
        const U = yuv[ySize + uvRow + uvCol] - 128
        const V = yuv[ySize + chromaSize + uvRow + uvCol] - 128

        let r = Y + 1.402 * V
        let g = Y - 0.344 * U - 0.714 * V
        let b = Y + 1.772 * U

        const R = r < 0 ? 0 : (r > 255 ? 255 : r | 0)
        const G = g < 0 ? 0 : (g > 255 ? 255 : g | 0)
        const B = b < 0 ? 0 : (b > 255 ? 255 : b | 0)

        buf32[i++] = (255 << 24) | (B << 16) | (G << 8) | R
      }
    }

    imgData.data.set(buf8)
    ctx.putImageData(imgData, 0, 0)

    if (!isFirstFrameRendered.value) {
      isFirstFrameRendered.value = true
      status.value = 'connected'
      clearConnectTimeout()
    }
  }

  // 接收 H.264 裸帧进行解码
  function feedFrame(nalu, isKey, ptsUs) {
    byteCount += nalu.length

    // 首帧关键帧保护
    if (!hasReceivedKeyFrame) {
      if (!isKey) return
      hasReceivedKeyFrame = true
    }

    const cleanNalu = new Uint8Array(nalu.length)
    cleanNalu.set(nalu)

    if (isWebCodecsActive.value) {
      if (!videoDecoder || videoDecoder.state === 'closed') {
        initDecoder('webcodecs')
      }
      if (!videoDecoder) return

      const naluList = parseAnnexB(cleanNalu)
      let sps = null
      let pps = null
      const slices = []

      for (const n of naluList) {
        if (n.length === 0) continue
        const naluType = n[0] & 0x1F
        if (naluType === 7) {
          sps = n
        } else if (naluType === 8) {
          pps = n
        } else if (naluType === 5 || naluType === 1) {
          slices.push(n)
        }
      }

      // 动态生成 AVCDecoderConfigurationRecord 并配置
      if (sps && pps && (!areBuffersEqual(sps, lastSps) || !areBuffersEqual(pps, lastPps))) {
        lastSps = sps
        lastPps = pps

        const record = new Uint8Array(11 + sps.length + pps.length)
        record[0] = 1 // configurationVersion
        record[1] = sps[1] // AVCProfileIndication
        record[2] = sps[2] // profile_compatibility
        record[3] = sps[3] // AVCLevelIndication
        record[4] = 0xff // lengthSizeMinusOne (4 字节长度头)
        record[5] = 0xe1 // numOfSequenceParameterSets: 1

        record[6] = (sps.length >> 8) & 0xff
        record[7] = sps.length & 0xff
        record.set(sps, 8)

        const ppsOffset = 8 + sps.length
        record[ppsOffset] = 1 // numOfPictureParameterSets: 1
        record[ppsOffset + 1] = (pps.length >> 8) & 0xff
        record[ppsOffset + 2] = pps.length & 0xff
        record.set(pps, ppsOffset + 3)

        const codecStr = `avc1.${[sps[1], sps[2], sps[3]].map(b => b.toString(16).padStart(2, '0')).join('')}`
        try {
          videoDecoder.configure({
            codec: codecStr,
            description: record,
            optimizeForLatency: true,
            hardwareAcceleration: 'prefer-hardware'
          })
          hasConfigured = true
        } catch (err) {
          console.warn(`[useWebSocketStream] WebCodecs configure failed with ${codecStr}:`, err)
        }
      }

      if (!hasConfigured) return

      if (slices.length > 0) {
        let totalLen = 0
        for (const slice of slices) {
          totalLen += 4 + slice.length
        }

        const avccBuffer = new Uint8Array(totalLen)
        let offset = 0
        for (const slice of slices) {
          const len = slice.length
          avccBuffer[offset] = (len >> 24) & 0xff
          avccBuffer[offset + 1] = (len >> 16) & 0xff
          avccBuffer[offset + 2] = (len >> 8) & 0xff
          avccBuffer[offset + 3] = len & 0xff
          avccBuffer.set(slice, offset + 4)
          offset += 4 + len
        }

        // 背压保护：解码队列积压严重时丢弃非关键帧，防止延迟不断累加
        if (videoDecoder.decodeQueueSize > 6 && !isKey) {
          return
        }

        const chunk = new EncodedVideoChunk({
          type: isKey ? 'key' : 'delta',
          timestamp: ptsUs,
          data: avccBuffer
        })

        try {
          videoDecoder.decode(chunk)
        } catch (err) {
          console.warn(`[useWebSocketStream] WebCodecs decode failed:`, err)
        }
      }
    } else {
      // WASM 模式
      if (!h264Decoder) {
        initDecoder('wasm')
      }
      if (!h264Decoder) return

      try {
        const result = h264Decoder.decode(cleanNalu)
        if (result === H264Decoder.PIC_RDY) {
          const canvasEl = canvasGetter ? canvasGetter() : null
          if (canvasEl) {
            renderYUV(canvasEl, h264Decoder.pic, h264Decoder.width, h264Decoder.height)
          }
        }
      } catch (err) {
        console.warn(`[useWebSocketStream] WASM decode failed:`, err)
      }
    }
  }

  // --- 坐标换算 (剥离 object-fit: contain 黑边，与 WebRTC 100% 对齐) ---
  function computeTargetCoords(clientX, clientY, rotatedCoord = null) {
    const canvasEl = canvasGetter ? canvasGetter() : null
    if (!canvasEl) return null

    const rect = canvasEl.getBoundingClientRect()
    if (!rect.width || !rect.height) return null

    const videoW = videoNaturalSize.value.width || canvasEl.width || DEVICE_W.value || 1080
    const videoH = videoNaturalSize.value.height || canvasEl.height || DEVICE_H.value || 1920
    if (!videoW || !videoH) return null

    const isDefaultLandscape = DEVICE_W.value > DEVICE_H.value
    const isVideoLandscape = videoW > videoH
    const isRotated = isVideoLandscape !== isDefaultLandscape
    const targetW = isRotated ? DEVICE_H.value : DEVICE_W.value
    const targetH = isRotated ? DEVICE_W.value : DEVICE_H.value

    let finalX, finalY

    // 如果提供了预计算的旋转坐标 (例如移动端横屏)，直接使用
    if (rotatedCoord && rotatedCoord.isRotated) {
      const x = Math.round(rotatedCoord.x / videoW * targetW)
      const y = Math.round(rotatedCoord.y / videoH * targetH)
      finalX = Math.max(0, Math.min(targetW, x))
      finalY = Math.max(0, Math.min(targetH, y))
    } else {
      // 正常计算：完美剔除 object-fit: contain 产生的四周留白黑边
      const clientW = rect.width
      const clientH = rect.height

      const videoRatio = videoW / videoH
      const clientRatio = clientW / clientH

      let actualW, actualH, offsetX, offsetY
      if (clientRatio > videoRatio) {
        // 左右有留白 (Pillarbox)
        actualH = clientH
        actualW = clientH * videoRatio
        offsetX = (clientW - actualW) / 2
        offsetY = 0
      } else {
        // 上下有留白 (Letterbox)
        actualW = clientW
        actualH = clientW / videoRatio
        offsetX = 0
        offsetY = (clientH - actualH) / 2
      }

      // 计算相对于实际视频内容的坐标
      const relativeX = clientX - rect.left - offsetX
      const relativeY = clientY - rect.top - offsetY

      // 映射到设备逻辑分辨率
      const x = Math.round(relativeX / actualW * targetW)
      const y = Math.round(relativeY / actualH * targetH)

      // 越界保护
      finalX = Math.max(0, Math.min(targetW, x))
      finalY = Math.max(0, Math.min(targetH, y))
    }

    return {
      x: finalX,
      y: finalY,
      w: targetW,
      h: targetH
    }
  }

  // --- 触控与按键下发 ---
  function sendTouch(action, clientX, clientY, id = 0, rotatedCoord = null) {
    const coords = computeTargetCoords(clientX, clientY, rotatedCoord)
    if (!coords) return

    const now = Date.now()
    if (action === 2) {
      // 触控 MOVE 节流
      const dx = coords.x - lastMoveSentX
      const dy = coords.y - lastMoveSentY
      const distSq = dx * dx + dy * dy
      if (now - lastMoveSentTs < THROTTLE_INTERVAL_MS && distSq < MOVE_DISTANCE_THRESHOLD_SQ) {
        return
      }
      lastMoveSentTs = now
      lastMoveSentX = coords.x
      lastMoveSentY = coords.y
    } else if (action === 0) {
      touchSeq++
      lastMoveSentTs = 0
      lastMoveSentX = coords.x
      lastMoveSentY = coords.y
    }

    const payload = {
      type: 'touch',
      action,
      x: coords.x,
      y: coords.y,
      w: coords.w,
      h: coords.h,
      id,
      seq: touchSeq,
      client_ts_ms: now
    }

    deviceStore.sendGroupControlEvent([deviceId], payload)
    if (controlEventCallback) {
      controlEventCallback(payload)
    }
  }

  function sendInjectKeycode(action, keycode, repeat = 0, meta = 0) {
    const payload = {
      type: 'inject_keycode',
      action,
      keycode,
      repeat,
      meta
    }
    deviceStore.sendGroupControlEvent([deviceId], payload)
    if (controlEventCallback) {
      controlEventCallback(payload)
    }
  }

  function sendText(text) {
    if (!text) return
    const payload = {
      type: 'inject_text',
      text
    }
    deviceStore.sendGroupControlEvent([deviceId], payload)
  }

  function sendScroll(clientX, clientY, scrollH, scrollV, rotatedCoord = null) {
    const coords = computeTargetCoords(clientX, clientY, rotatedCoord)
    if (!coords) return false

    const payload = {
      type: 'scroll',
      action: 0,
      x: coords.x,
      y: coords.y,
      w: coords.w,
      h: coords.h,
      scrollH,
      scrollV
    }
    deviceStore.sendGroupControlEvent([deviceId], payload)
    return true
  }

  // 系统快捷按键封装 (Android Keycode: Back=4, Home=3, AppSwitch=187, Power=26, VolumeUp=24, VolumeDown=25)
  function sendBack() {
    sendInjectKeycode(0, 4)
    setTimeout(() => sendInjectKeycode(1, 4), 50)
  }

  function sendHome() {
    sendInjectKeycode(0, 3)
    setTimeout(() => sendInjectKeycode(1, 3), 50)
  }

  function sendAppSwitch() {
    sendInjectKeycode(0, 187)
    setTimeout(() => sendInjectKeycode(1, 187), 50)
  }

  function sendPower() {
    sendInjectKeycode(0, 26)
    setTimeout(() => sendInjectKeycode(1, 26), 50)
  }

  function sendVolumeUp() {
    sendInjectKeycode(0, 24)
    setTimeout(() => sendInjectKeycode(1, 24), 50)
  }

  function sendVolumeDown() {
    sendInjectKeycode(0, 25)
    setTimeout(() => sendInjectKeycode(1, 25), 50)
  }

  function sendCommand(cmd) {
    return false
  }

  function setClipboard(text, opts = {}) {
    if (text) {
      sendText(text)
      return true
    }
    return false
  }

  function getClipboard() {
    return false
  }

  // --- 指标统计定时器 ---
  function startStatsLoop() {
    stopStatsLoop()
    statsTimer = setInterval(() => {
      const now = performance.now()
      const deltaSec = (now - lastStatsTime) / 1000
      if (deltaSec > 0.5) {
        realFps.value = Math.round(frameCount / deltaSec)
        realBitrate.value = Math.round((byteCount * 8) / deltaSec) // bps
        frameCount = 0
        byteCount = 0
        lastStatsTime = now
      }
    }, 1000)
  }

  function stopStatsLoop() {
    if (statsTimer) {
      clearInterval(statsTimer)
      statsTimer = null
    }
  }

  async function getVideoStats() {
    const kbps = Math.round(realBitrate.value / 1000)
    return {
      fps: realFps.value,
      bitrate: kbps,
      targetBitrate: targetBitrateMbps.value,
      packetsLost: 0,
      jitterMs: 0,
      rttMs: 0
    }
  }

  function resetStats() {
    frameCount = 0
    byteCount = 0
    lastStatsTime = performance.now()
    realFps.value = 0
    realBitrate.value = 0
  }

  // --- 连接与断连生命周期 ---
  function connect() {
    if (status.value === 'connected' || status.value === 'connecting') return
    status.value = 'connecting'
    error.value = null
    hasReceivedKeyFrame = false
    isFirstFrameRendered.value = false

    // 获取期望的高清参数（默认 30fps / 1080p / 4Mbps）
    const fps = options.max_fps || 30
    const maxSize = options.max_size || 1080
    if (options.bitrate) {
      targetBitrateMbps.value = options.bitrate >= 10000 ? Math.round(options.bitrate / 100000) / 10 : options.bitrate
    } else if (options.preview_bitrate) {
      targetBitrateMbps.value = Math.round(options.preview_bitrate / 100000) / 10
    }
    const bitrate = targetBitrateMbps.value || 4
    const stayAwake = options.stay_awake !== false

    // 初始化解码器
    initDecoder('webcodecs')

    // 注册流回调 (subscriberId 为 'stream')
    deviceStore.registerPreviewCallback(deviceId, 'stream', (nalu, isKey, ptsUs) => {
      feedFrame(nalu, isKey, ptsUs)
    })

    // 发送高清 start_preview 信令
    deviceStore.sendPreviewControl('start_preview', deviceId, fps, maxSize, bitrate, stayAwake)

    startStatsLoop()
    armConnectTimeout()
  }

  function disconnect() {
    status.value = 'disconnected'
    stopStatsLoop()
    clearConnectTimeout()

    // 注销流回调；只有当无其他订阅者时才向服务端发送 stop_preview
    deviceStore.unregisterPreviewCallback(deviceId, 'stream')
    if (!deviceStore.hasPreviewSubscribers(deviceId)) {
      deviceStore.sendPreviewControl('stop_preview', deviceId)
    }

    // 释放 WebCodecs 资源
    if (videoDecoder) {
      try {
        videoDecoder.close()
      } catch (e) {}
      videoDecoder = null
    }
    hasConfigured = false
    lastSps = null
    lastPps = null

    // 释放 WASM 资源
    if (h264Decoder) {
      h264Decoder = null
    }

    isFirstFrameRendered.value = false
    hasReceivedKeyFrame = false
  }

  // --- 回调设置方法 ---
  function setCanvasGetter(fn) {
    canvasGetter = fn
  }

  function setVideoGetter(fn) {
    // 兼容占位
  }

  function onFrameSize(cb) {
    frameSizeCallback = cb
  }

  function onControlEvent(cb) {
    controlEventCallback = cb
  }

  function onScreenshot(cb) {
    screenshotCallback = cb
  }

  function onClipboard(cb) {
    clipboardCallback = cb
  }

  const audioMuted = ref(true)
  function setAudioMuted(val) {
    audioMuted.value = Boolean(val)
  }

  function toggleAudioMuted() {
    audioMuted.value = !audioMuted.value
    return audioMuted.value
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    // 状态
    isWebSocketStream: true,
    status,
    error,
    isWebCodecsActive,
    stream,
    agentVersion,
    cameraSupport,
    deviceRotation,
    DEVICE_W,
    DEVICE_H,
    videoNaturalSize,
    isFirstFrameRendered,
    fps: realFps,
    bitrate: realBitrate,
    targetBitrate: targetBitrateMbps,

    // 方法
    connect,
    disconnect,
    setCanvasGetter,
    setVideoGetter,
    onFrameSize,
    onControlEvent,
    onScreenshot,
    onClipboard,
    audioMuted,
    setAudioMuted,
    toggleAudioMuted,
    getVideoStats,
    resetStats,

    // 交互与按键
    sendTouch,
    sendInjectKeycode,
    sendText,
    sendScroll,
    sendCommand,
    setClipboard,
    getClipboard,
    sendBack,
    sendHome,
    sendAppSwitch,
    sendPower,
    sendVolumeUp,
    sendVolumeDown
  }
}
