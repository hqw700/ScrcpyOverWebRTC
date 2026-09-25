import { ref, watch } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { debugLog } from '@/utils/debug'

export function useAdb(webrtc) {
  const isAdbConnected = ref(false)
  let term = null
  let fitAddon = null
  let sessionChannel = null
  let unwatchWebrtcStatus = null

  function handleDisconnect(reason = '远程设备连接已断开') {
    if (!isAdbConnected.value && !sessionChannel) return
    isAdbConnected.value = false
    if (term) {
      term.writeln(`\r\n\x1b[1;31m[ADB 调试] ⚠️ ${reason}，终端会话已终止。\x1b[0m`)
      term.writeln('\x1b[90m提示: 远程连接已断开，如需继续调试请重新连接设备。\x1b[0m\r\n')
    }
  }

  let boundContainer = null
  let focusCleanup = null
  let resizeObserver = null

  function focus() {
    if (term) {
      try {
        term.focus()
        const helper = boundContainer?.querySelector('.xterm-helper-textarea') || boundContainer?.querySelector('textarea')
        if (helper) {
          helper.focus({ preventScroll: true })
        }
      } catch (e) {}
    }
  }

  async function initAdb(container) {
    if (isAdbConnected.value) return
    boundContainer = container

    const isMobile = window.innerWidth <= 768
    term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: isMobile ? 12 : 13,
      lineHeight: 1.22,
      fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace',
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff'
      },
      scrollback: 10000,
      convertEol: true,
      scrollOnUserInput: true
    })
    fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)

    // 单一手势事件主动聚焦，防止 touchstart + click 重复调用导致界面抖动和失焦
    const handleTouchOrClick = (e) => {
      focus()
    }
    container.addEventListener('click', handleTouchOrClick)
    focusCleanup = () => {
      container.removeEventListener('click', handleTouchOrClick)
    }

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (fitAddon && term) {
          try {
            fitAddon.fit()
            term.scrollToBottom()
          } catch (e) {}
        }
      })
      resizeObserver.observe(container)
    }

    try {
      fitAddon.fit()
      term.scrollToBottom()
    } catch (e) {}

    setTimeout(() => {
      if (fitAddon && term) {
        try {
          fitAddon.fit()
          term.scrollToBottom()
        } catch (e) {}
      }
    }, 150)

    term.writeln('\x1b[33m[Shell] 正在建立 WebRTC 终端通道...\x1b[0m')

    try {
      if (typeof webrtc.createAdbSessionChannel !== 'function') {
        throw new Error('WebRTC interface does not support session channel factory')
      }
      
      // 为该 Session 独立创建专用的 DataChannel 实例
      sessionChannel = webrtc.createAdbSessionChannel()

      // 绑定通道生命周期断开监听
      if (sessionChannel?.channel) {
        sessionChannel.channel.addEventListener('close', () => {
          handleDisconnect('数据通道已关闭')
        })
        sessionChannel.channel.addEventListener('error', (e) => {
          console.error('[Shell] DataChannel error:', e)
          handleDisconnect('数据通道发生异常')
        })
      }

      // 监听 WebRTC 全局连接状态
      if (webrtc && webrtc.status) {
        unwatchWebrtcStatus = watch(() => webrtc.status.value, (newStatus) => {
          if (newStatus === 'disconnected' || newStatus === 'failed') {
            handleDisconnect('远程设备连接已断开')
          }
        })
      }

      // 等待 150ms 确保 DataChannel 建立稳定
      await new Promise(r => setTimeout(r, 150))

      term.writeln('\x1b[33m[Shell] 正在创建独立终端会话...\x1b[0m')

      // 发送初始化窗口行列前先重新 fit 一次，确保准确上报当前移动端或桌面端可视行列
      if (fitAddon) {
        try { fitAddon.fit() } catch (e) {}
      }

      let cols = term.cols || 80
      let rows = term.rows || 24
      if (isMobile) {
        // 手机端半屏抽屉根据容器实际高度精准计算 rows，防止上报过大导致 PTY 滚屏失效
        const containerH = container.clientHeight || 150
        const calcRows = Math.max(6, Math.floor((containerH - 10) / 16))
        rows = (term.rows && term.rows > 0 && term.rows <= 25) ? term.rows : calcRows
        cols = term.cols || 44
      }
      const initPayload = JSON.stringify({ type: 'init', rows, cols })
      sessionChannel.sendData(new TextEncoder().encode(initPayload))

      term.writeln('\x1b[32m[Shell] 反代终端已就绪\x1b[0m\r\n')
      isAdbConnected.value = true
      setTimeout(() => { 
        if (fitAddon && term) {
          try { 
            fitAddon.fit()
            term.scrollToBottom()
          } catch (e) {}
        }
      }, 150)

      // 绑定当前 session 专属 channel 的接收回调 (直接接收裸字节流并输入到终端)
      sessionChannel.channel.onmessage = (evt) => {
        if (term) {
          term.write(new Uint8Array(evt.data), () => {
            try { 
              term.scrollToBottom() 
              const viewport = boundContainer?.querySelector('.xterm-viewport')
              if (viewport) {
                viewport.scrollTop = viewport.scrollHeight
              }
            } catch (e) {}
          })
        }
      }

      // 绑定键盘输入回调，写入该会话的 channel 发送
      term.onData((data) => {
        if (!isAdbConnected.value || !sessionChannel || sessionChannel.channel?.readyState !== 'open') {
          if (term) {
            term.write('\x07')
          }
          return
        }
        sessionChannel.sendData(new TextEncoder().encode(data))
      })

    } catch (e) {
      console.error('[Shell] Connection failed:', e)
      if (term) term.writeln(`\r\n\x1b[31m[Shell] 连接失败: ${e.message}\x1b[0m`)
      isAdbConnected.value = false
    }
  }

  async function closeAdb() {
    debugLog('[Shell] Closing session')
    isAdbConnected.value = false

    if (focusCleanup) {
      focusCleanup()
      focusCleanup = null
    }
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    boundContainer = null

    if (unwatchWebrtcStatus) {
      unwatchWebrtcStatus()
      unwatchWebrtcStatus = null
    }

    if (sessionChannel) {
      sessionChannel.close()
      sessionChannel = null
    }

    if (term) {
      const t = term
      term = null
      fitAddon = null
      try { t.dispose() } catch (e) {}
    }
  }

  function resize() {
    if (fitAddon && term) {
      try {
        fitAddon.fit()
        term.scrollToBottom()
      } catch (e) {}
    }
  }

  function scrollToBottom() {
    if (term) {
      try { term.scrollToBottom() } catch (e) {}
    }
  }

  return { isAdbConnected, initAdb, closeAdb, resize, scrollToBottom, focus }
}
