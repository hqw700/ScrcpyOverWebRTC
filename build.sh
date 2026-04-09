#!/bin/bash

# ==============================================================================
# Web App 构建脚本
# ==============================================================================

set -e

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
WEB_APP_DIR="${SCRIPT_DIR}/web-app"

echo "=== Building Web App ==="

cd "$WEB_APP_DIR"

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo "-> Installing dependencies..."
    npm install --registry=https://registry.npmmirror.com
fi

# 构建
echo "-> Building..."
npm run build

echo "------------------------------------------------"
echo "Build Complete!"
echo "Output: ${WEB_APP_DIR}/dist/"
echo "------------------------------------------------"
