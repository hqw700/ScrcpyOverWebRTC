import { ref } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { debugLog } from '@/utils/debug'

export function useAdb(webrtc) {
  const isAdbConnected = ref(false)
  let term = null
  let fitAddon = null
  let sessionChannel = null

  async function initAdb(container) {
    if (isAdbConnected.value) return

    term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: 'Consolas, "Liberation Mono", Menlo, Courier, monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#aeafad'
      },
      scrollback: 10000
    })
    fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)
    setTimeout(() => { if (fitAddon) try { fitAddon.fit() } catch (e) {} }, 100)

    term.writeln('\x1b[33m[Shell] 正在建立 WebRTC 终端通道...\x1b[0m')

    try {
      if (typeof webrtc.createAdbSessionChannel !== 'function') {
        throw new Error('WebRTC interface does not support session channel factory')
      }
      
      // 为该 Session 独立创建专用的 DataChannel 实例
      sessionChannel = webrtc.createAdbSessionChannel()

      // 等待 150ms 确保 DataChannel 建立稳定
      await new Promise(r => setTimeout(r, 150))

      term.writeln('\x1b[33m[Shell] 正在创建独立终端会话...\x1b[0m')

      // 发送初始化窗口行列的 JSON 信息，通知后端以 BARE PTY 裸数据流运行
      const cols = term.cols || 80
      const rows = term.rows || 24
      const initPayload = JSON.stringify({ type: 'init', rows, cols })
      sessionChannel.sendData(new TextEncoder().encode(initPayload))

      term.writeln('\x1b[32m[Shell] 反代终端已就绪\x1b[0m\r\n')
      isAdbConnected.value = true
      setTimeout(() => { if (fitAddon) try { fitAddon.fit() } catch (e) {} }, 200)

      // 绑定当前 session 专属 channel 的接收回调 (直接接收裸字节流并输入到终端)
      sessionChannel.channel.onmessage = (evt) => {
        if (term) {
          term.write(new Uint8Array(evt.data))
        }
      }

      // 绑定键盘输入回调，写入该会话的 channel 发送
      term.onData((data) => {
        if (sessionChannel) {
          sessionChannel.sendData(new TextEncoder().encode(data))
        }
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
    if (fitAddon) {
      try { fitAddon.fit() } catch (e) {}
    }
  }

  return { isAdbConnected, initAdb, closeAdb, resize }
}
