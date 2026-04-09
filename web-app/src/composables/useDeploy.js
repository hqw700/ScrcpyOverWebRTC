import { ref } from 'vue'
import { Adb, AdbDaemonTransport } from '@yume-chan/adb'
import { AdbDaemonWebUsbDeviceManager } from '@yume-chan/adb-daemon-webusb'
import AdbWebCredentialStore from '@yume-chan/adb-credential-web'

const credentialStore = new AdbWebCredentialStore('cloudphone-web')

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
   * @param {number} [options.bitrate=4000000] - 可选
   * @param {number} [options.maxSize=0] - 可选，视频最大尺寸（长边），0=不限制
   * @param {number} [options.maxFps=0] - 可选，视频最大帧率，0=不限制
   * @param {string} [options.videoCodecOptions=''] - 可选，scrcpy video_codec_options
   * @param {boolean} [options.runAsRoot=false] - 可选
   * @param {string} [options.externalAddr=''] - 可选，外部地址
   * @param {string} [options.webrtcPort=''] - 可选，WebRTC 端口
   */
  async function deployAgent(options) {
    const {
      signalingUrl,
      deviceId,
      bitrate = 4000000,
      maxSize = 0,
      maxFps = 0,
      videoCodecOptions = '',
      runAsRoot = false,
      externalAddr = '',
      webrtcPort = '',
    } = options

    if (!signalingUrl) throw new Error('必须指定 signaling 服务器地址 (IP:Port)')

    isDeploying.value = true
    deployError.value = null
    deployProgress.value = 0
    deployLog.value = []

    let transport = null

    try {
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
      const isArm64 = abi.includes('arm64') || abi.includes('aarch64')
      const arch = isArm64 ? 'arm64' : 'amd64'
      const agentPath = isArm64 ? '/agent/cloudphone-agent-arm64' : '/agent/cloudphone-agent-amd64'
      log(`设备架构: ${abi.trim()} → 使用 ${arch} 二进制`)
      deployProgress.value = 40

      // 步骤 4: 推送文件
      deployStatus.value = '推送 Agent 程序...'
      log('下载 agent 和 scrcpy-server.jar...')
      const [agentResp, jarResp] = await Promise.all([fetch(agentPath), fetch('/agent/scrcpy-server.jar')])
      if (!agentResp.ok) throw new Error(`下载 agent 失败: ${agentResp.status}`)
      if (!jarResp.ok) throw new Error(`下载 scrcpy-server.jar 失败: ${jarResp.status}`)

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
          filename: '/data/local/tmp/scrcpy-server.jar',
          file: jarResp.body,
          permission: 0o644,
        })
        log('scrcpy-server.jar 已推送')
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
      const args = [`-signaling ${signalingUrl}`]
      if (deviceId) args.push(`-id ${deviceId}`)
      if (bitrate !== 4000000) args.push(`-bitrate ${bitrate}`)
      if (maxSize > 0) args.push(`-max-size ${maxSize}`)
      if (maxFps > 0) args.push(`-max-fps ${maxFps}`)
      if (videoCodecOptions) args.push(`-video-codec-options "${videoCodecOptions}"`)
      if (externalAddr) args.push(`-external-addr ${externalAddr}`)
      if (webrtcPort) args.push(`-webrtc-port ${webrtcPort}`)
      if (runAsRoot) args.push('-root')
      const argsStr = args.join(' ')

      const fullCommand = `sh -c "exec setsid nohup ${cloudphoneAgent} ${argsStr} > ${logPath} 2>&1 & sleep 0.5"`
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
      deployError.value = e.message
      deployStatus.value = '部署失败'
      log(`错误: ${e.message}`)
      return false
    } finally {
      isDeploying.value = false
      if (transport) try { await transport.close() } catch (err) {}
    }
  }

  return { isDeploying, deployStatus, deployProgress, deployError, deployLog, deployAgent }
}
