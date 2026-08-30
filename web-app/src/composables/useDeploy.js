import { ref } from 'vue'
import { Adb, AdbDaemonTransport } from '@yume-chan/adb'
import { AdbDaemonWebUsbDeviceManager } from '@yume-chan/adb-daemon-webusb'

export function useDeploy() {
  const isDeploying = ref(false)
  const deployStatus = ref('')
  const deployProgress = ref(0)
  const deployError = ref(null)
  const deployLog = ref([])

  function log(msg) {
    const ts = new Date().toLocaleTimeString()
    deployLog.value.push(`[${ts}] ${msg}`)
  }

  /**
   * @param {Object} options
   * @param {string} options.signalingUrl - 必填
   * @param {string} [options.deviceId] - 可选
   * @param {number} [options.maxFps=0] - 可选，视频最大帧率，0=不限制
   * @param {string} [options.videoCodecOptions=''] - 可选，scrcpy video_codec_options
   * @param {string} [options.externalAddr=''] - 可选，外部地址
   * @param {string} [options.webrtcPort=''] - 可选，WebRTC 端口
   * @param {string} [options.iceServers=''] - 可选，ICE Servers 地址
   */
  async function deployAgent(options) {
    const {
      signalingUrl,
      deviceId,
      maxFps = 0,
      videoCodecOptions = '',
      externalAddr = '',
      webrtcPort = '',
      iceServers = '',
    } = options

    if (!signalingUrl) throw new Error('必须指定 signaling 服务器地址 (IP:Port)')

    let formattedSignalingUrl = signalingUrl
    if (!formattedSignalingUrl.startsWith('ws://') && !formattedSignalingUrl.startsWith('wss://')) {
      const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://'
      formattedSignalingUrl = protocol + formattedSignalingUrl
    }

    isDeploying.value = true
    deployError.value = null
    deployProgress.value = 0
    deployLog.value = []

    let transport = null

    try {
      const AdbWebCredentialStore = (await import('@yume-chan/adb-credential-web')).default
      const credentialStore = new AdbWebCredentialStore('cloudphone-web')

      // 步骤 1: 连接 USB 设备
      log('请求 USB 设备连接...')
      deployStatus.value = '请选择 USB 设备...'
      const device = await AdbDaemonWebUsbDeviceManager.BROWSER.requestDevice()
      if (!device) throw new Error('未选择设备')

      log(`已选择设备: ${device.name}`)
      deployStatus.value = `正在连接 ${device.name}...`
      const connection = await device.connect()
      log('USB 连接已建立')

      // 步骤 2: ADB 认证
      deployStatus.value = '正在认证握手，请确认手机屏幕...'
      log('正在进行 ADB 认证...')
      transport = await AdbDaemonTransport.authenticate({
        serial: device.serial || 'webadb',
        connection,
        credentialStore,
      })

      const adb = new Adb(transport)
      deployProgress.value = 20
      log('ADB 认证成功')

      // 步骤 3: 探测架构
      deployStatus.value = '探测设备架构...'
      log('探测 CPU 架构...')
      const abi = await adb.subprocess.noneProtocol.spawnWaitText('getprop ro.product.cpu.abi')
      let arch = 'amd64'
      let agentPath = '/agent/cloudphone-agent-amd64'
      if (abi.includes('arm64') || abi.includes('aarch64')) {
        arch = 'arm64'
        agentPath = '/agent/cloudphone-agent-arm64'
      } else if (abi.includes('arm') || abi.includes('armeabi')) {
        arch = 'armeabi-v7a'
        agentPath = '/agent/cloudphone-agent-armeabi-v7a'
      }
      log(`设备架构: ${abi.trim()} → 使用 ${arch} 二进制`)
      deployProgress.value = 40

      // 步骤 4: 推送文件
      deployStatus.value = '推送 Agent 程序...'
      log('下载 agent 和 libsys_core.so...')
      const [agentResp, jarResp] = await Promise.all([fetch(agentPath), fetch('/agent/libsys_core.so')])
      if (!agentResp.ok) throw new Error(`下载 agent 失败: ${agentResp.status}`)
      if (!jarResp.ok) throw new Error(`下载 libsys_core.so 失败: ${jarResp.status}`)

      log('推送文件到设备...')
      const sync = await adb.sync()
      try {
        await sync.write({
          filename: '/data/local/tmp/cloudphone-agent',
          file: agentResp.body,
          permission: 0o755,
        })
        log('cloudphone-agent 已推送')
        deployProgress.value = 60
        await sync.write({
          filename: '/data/local/tmp/libsys_core.so',
          file: jarResp.body,
          permission: 0o644,
        })
        log('libsys_core.so 已推送')
      } finally {
        await sync.dispose()
      }
      deployProgress.value = 80

      // 步骤 5: 启动服务
      deployStatus.value = '正在后台启动服务...'
      log('清理旧进程...')
      const killSocket = await adb.createSocket('shell:killall cloudphone-agent 2>/dev/null; true')
      await killSocket.closed

      const logPath = '/data/local/tmp/cloudphone-agent.log'
      const cloudphoneAgent = '/data/local/tmp/cloudphone-agent'

      await adb.subprocess.noneProtocol.spawnWaitText(`chmod 755 ${cloudphoneAgent}`)

      // 构建启动参数
      const args = [
        `-signaling ${formattedSignalingUrl}`,
        '-jar /data/local/tmp/libsys_core.so'
      ]
      if (deviceId) args.push(`-id ${deviceId}`)
      if (maxFps > 0) args.push(`-max-fps ${maxFps}`)
      if (videoCodecOptions) args.push(`-video-codec-options "${videoCodecOptions}"`)
      if (externalAddr) args.push(`-external-addr ${externalAddr}`)
      if (webrtcPort) args.push(`-webrtc-port ${webrtcPort}`)
      if (iceServers) args.push(`-ice-servers "${iceServers}"`)
      const argsStr = args.join(' ')

      const fullCommand = `sh -c "export CP_AGENT_JAR=/data/local/tmp/libsys_core.so; exec setsid nohup env GODEBUG=asyncpreemptoff=1 ${cloudphoneAgent} ${argsStr} > ${logPath} 2>&1 & sleep 0.5"`
      log(`启动命令: ${cloudphoneAgent} ${argsStr}`)

      const startSocket = await adb.createSocket(`shell:${fullCommand}`)
      const reader2 = startSocket.readable.getReader()
      while (true) {
        const { done } = await reader2.read()
        if (done) break
      }

      await new Promise(r => setTimeout(r, 1000))
      log('等待进程启动...')

      // 验证进程
      const checkResult = await adb.subprocess.noneProtocol.spawnWaitText('pidof cloudphone-agent || echo NOTFOUND')
      if (checkResult.trim() === 'NOTFOUND' || checkResult.trim() === '') {
        const logContent = await adb.subprocess.noneProtocol.spawnWaitText(`cat ${logPath} 2>/dev/null`)
        log(`启动失败，日志: ${logContent.trim()}`)
        throw new Error(`Agent 启动失败\n${logContent}`)
      }

      log(`进程已启动, PID: ${checkResult.trim()}`)
      deployStatus.value = '部署成功！'
      deployProgress.value = 100
      log('部署完成!')
      return true
    } catch (e) {
      let msg = e.message || String(e)
      if (/already in use/i.test(msg) || /already in used/i.test(msg) || /already claimed/i.test(msg) || /unable to claim/i.test(msg) || /device busy/i.test(msg)) {
        msg = `USB 设备被其他程序占用 (通常是本地电脑运行了 ADB 或手机助手抢占了 USB 接口)。\n💡 解决方案：请在电脑终端 (CMD / Terminal) 执行 "adb kill-server" 并退出其他手机管家后重试。`
      }
      deployError.value = msg
      deployStatus.value = '部署失败'
      log(`错误: ${msg}`)
      return false
    } finally {
      isDeploying.value = false
      if (transport) try { await transport.close() } catch (err) {}
    }
  }

  return { isDeploying, deployStatus, deployProgress, deployError, deployLog, deployAgent }
}
