#!/bin/bash

if [ "$1" == "-h" ] || [ "$1" == "--help" ]; then
    echo "Usage: ./run.sh [adb-serial] [options]"
    echo "Example: ./run.sh -id my-device -signaling ws://192.168.5.84:8443"
    echo "         ./run.sh -id my-redroid -signaling ws://192.168.5.84:8443  -external-addr 192.168.5.85 -webrtc-port 50000"
    exit 0
fi

SERIAL=""
# 如果第一个参数不是以 '-' 开头，则认为它是 adb serial
if [ $# -gt 0 ] && [[ ! "$1" == -* ]]; then
    SERIAL="-s $1"
    shift
fi

# 探测目标设备架构
ARCH=$(adb $SERIAL shell uname -m | tr -d '\r')
if [[ "$ARCH" == *"x86_64"* ]] || [[ "$ARCH" == *"amd64"* ]]; then
    AGENT_BIN="cloudphone-agent-amd64"
else
    AGENT_BIN="cloudphone-agent-arm64"
fi

echo "=== Deploying to device ($ARCH) ==="
echo "Pushing $AGENT_BIN..."
adb $SERIAL push "$AGENT_BIN" /data/local/tmp/cloudphone-agent
echo "Pushing scrcpy-server.jar..."
adb $SERIAL push scrcpy-server.jar /data/local/tmp/ss.jar
adb $SERIAL shell chmod +x /data/local/tmp/cloudphone-agent

echo "=== Starting Agent ==="
# 1. 强制清理旧进程 (Agent & scrcpy-server)
adb $SERIAL shell "pkill -f cloudphone-agent || killall cloudphone-agent || true"
adb $SERIAL shell "pkill -f scrcpy.Server || true"

# 2. 后台静默启动 (setsid + nohup) 并保存日志
START_CMD="setsid nohup /data/local/tmp/cloudphone-agent -jar /data/local/tmp/ss.jar $@ > /data/local/tmp/cloudphone-agent.log 2>&1 &"
echo "Executing: $START_CMD"
adb $SERIAL shell "sh -c '$START_CMD'"

# 3. 验证启动结果
sleep 1
if adb $SERIAL shell "ps | grep cloudphone-agent" > /dev/null; then
    echo "=== [OK] Agent started successfully in background. ==="
    echo "Log file: /data/local/tmp/cloudphone-agent.log"
else
    echo "=== [ERROR] Agent failed to start. Please check logs on device. ==="
fi
