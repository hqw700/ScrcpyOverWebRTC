import { ref } from 'vue'
import { Adb, AdbDaemonTransport, AdbPacket, AdbPacketSerializeStream } from '@yume-chan/adb'
import AdbWebCredentialStore from '@yume-chan/adb-credential-web'
import { PushReadableStream, Consumable, StructDeserializeStream, pipeFrom } from '@yume-chan/stream-extra'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

const credentialStore = new AdbWebCredentialStore('cloudphone-adb')

/**
 * 通过 WebRTC DataChannel 建立 ADB 连接，使用 @yume-chan/adb 处理认证和协议
 */
export function useAdb(webrtc) {
  const isAdbConnected = ref(false)
  let term = null
  let fitAddon = null
  let adb = null
  let transport = null
  let shellSocket = null
  let readableController = null

  /**
   * 将 WebRTC DataChannel 的原始字节流包装为 AdbDaemonConnection
   */
  function createConnectionFromDataChannel() {
    // readable: DataChannel 收到的原始字节 → AdbPacket 对象
    const rawReadable = new PushReadableStream((controller) => {
      readableController = controller

      // 注册 WebRTC 数据回调
      webrtc.onAdbData((data) => {
        const bytes = new Uint8Array(data)
        controller.enqueue(bytes)
      })

      controller.abortSignal.addEventListener('abort', () => {
        webrtc.onAdbData(null)
        readableController = null
      })
    })

    const readable = rawReadable.pipeThrough(new StructDeserializeStream(AdbPacket))

    // writable: AdbPacket 对象 → 序列化为原始字节 → 通过 DataChannel 发送
    const writable = pipeFrom(
      new Consumable.WritableStream({
        write(chunk) {
          // chunk 是 Uint8Array，发送到 WebRTC DataChannel
          webrtc.sendAdbData(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength))
        },
      }),
      new AdbPacketSerializeStream(),
    )

    return { readable, writable }
  }

  async function initAdb(container) {
    console.log('[ADB] initAdb requested (yume-chan)')

    if (adb || transport) {
      closeAdb()
      await new Promise(r => setTimeout(r, 150))
    }

    // 初始化终端
    term = new Terminal({
      cursorBlink: true,
      background: '#000',
      theme: { background: '#000' },
      fontSize: 12,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace'
    })
    fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)
    setTimeout(() => { if (fitAddon) try { fitAddon.fit() } catch (e) {} }, 100)

    term.writeln('\x1b[33m[ADB] 正在通过 WebRTC 隧道建立连接...\x1b[0m')

    try {
      // 1. 创建基于 DataChannel 的连接
      const connection = createConnectionFromDataChannel()

      // 2. 使用 yume-chan/adb 进行认证握手
      term.writeln('\x1b[33m[ADB] 正在认证...\x1b[0m')
      transport = await AdbDaemonTransport.authenticate({
        serial: 'webrtc-adb',
        connection,
        credentialStore,
        preserveConnection: false,
      })

      adb = new Adb(transport)
      console.log('[ADB] Authenticated, banner:', transport.banner.toString())
      term.writeln(`\x1b[32m[ADB] 认证成功 (${transport.banner.product || 'device'})\x1b[0m`)

      // 3. 打开交互式 shell
      term.writeln('\x1b[33m[ADB] 正在打开 Shell...\x1b[0m')
      shellSocket = await adb.createSocket('shell:')

      term.writeln('\x1b[32m[ADB] Shell 已就绪\x1b[0m\r\n')
      isAdbConnected.value = true
      setTimeout(() => { if (fitAddon) try { fitAddon.fit() } catch (e) {} }, 200)

      // 4. 读取 shell 输出 → 终端
      const reader = shellSocket.readable.getReader()
      ;(async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (term && value) {
              term.write(value)
            }
          }
        } catch (e) {
          if (e.name !== 'AbortError') {
            console.error('[ADB] Shell read error:', e)
          }
        }
        if (term) term.writeln('\r\n\x1b[31m[ADB] Shell 已断开\x1b[0m')
        isAdbConnected.value = false
      })()

      // 5. 终端输入 → shell
      term.onData((data) => {
        if (shellSocket) {
          const writer = shellSocket.writable.getWriter()
          writer.write(new TextEncoder().encode(data)).then(() => writer.releaseLock()).catch(() => {})
        }
      })

    } catch (e) {
      console.error('[ADB] Connection failed:', e)
      if (term) term.writeln(`\r\n\x1b[31m[ADB] 连接失败: ${e.message}\x1b[0m`)
      isAdbConnected.value = false
    }
  }

  function closeAdb() {
    console.log('[ADB] Closing session')

    if (shellSocket) {
      try { shellSocket.close() } catch (e) {}
      shellSocket = null
    }

    if (adb) {
      try { adb.close() } catch (e) {}
      adb = null
    }

    if (transport) {
      try { transport.close() } catch (e) {}
      transport = null
    }

    webrtc.onAdbData(null)
    readableController = null

    if (term) {
      const t = term
      term = null
      fitAddon = null
      try { t.dispose() } catch (e) {}
    }

    isAdbConnected.value = false
  }

  return { isAdbConnected, initAdb, closeAdb }
}
