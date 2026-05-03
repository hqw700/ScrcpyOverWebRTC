export class KeymapEngine {
  constructor(sendTouchCallback, sendCommandCallback) {
    this.activeProfile = null;
    this.sendTouch = sendTouchCallback;
    this.sendCommand = sendCommandCallback;
    
    // 虚拟触控 ID 从 10 开始，避免与真实手指/鼠标 (0-9 或 -1) 冲突
    this.pointerIdBase = 10;
    this.activePointers = new Map(); // mapping.id -> pointerId
    
    // 摇杆状态记录 mapping.id -> { state: { up, down, left, right }, pointerId: number|null }
    this.joysticks = new Map(); 
  }

  updateProfile(profile) {
    this.activeProfile = profile;
    // 如果切换配置，释放所有当前激活的模拟触控
    this.releaseAll();
  }

  releaseAll() {
    // 发送 ACTION_UP (1) 释放所有 tap 触控
    for (const [mapId, pointerId] of this.activePointers.entries()) {
      this.sendTouch(1, 0, 0, pointerId, { x: 0, y: 0, isRotated: true });
    }
    this.activePointers.clear();

    // 释放所有 joystick 触控
    for (const [mapId, joy] of this.joysticks.entries()) {
      if (joy.pointerId !== null) {
        this.sendTouch(1, 0, 0, joy.pointerId, { x: 0, y: 0, isRotated: true });
        joy.pointerId = null;
      }
      joy.state = { up: false, down: false, left: false, right: false };
    }
  }

  /**
   * 处理键盘事件
   * @param {KeyboardEvent} event 
   * @param {boolean} isDown 
   * @param {number} videoWidth 
   * @param {number} videoHeight 
   * @returns {boolean} 是否拦截（消耗）了该事件
   */
  handleKeyEvent(event, isDown, videoWidth, videoHeight) {
    if (!this.activeProfile || !this.activeProfile.mappings) return false;
    
    const key = event.key.toLowerCase();
    let consumed = false;
    
    for (const map of this.activeProfile.mappings) {
      if (map.type === 'tap' && map.key.toLowerCase() === key) {
        if (!event.repeat) {
          this.handleTap(map, isDown, videoWidth, videoHeight);
        }
        consumed = true;
      }
      else if (map.type === 'command' && map.key.toLowerCase() === key) {
        if (isDown && !event.repeat) {
          // console.log(`[Keymap] Executing command for key ${key}: ${map.cmd}`);
          this.sendCommand(map.cmd);
        }
        consumed = true;
      }
      else if (map.type === 'joystick') {
        const keys = map.keys;
        let direction = null;
        if (key === keys.up.toLowerCase()) direction = 'up';
        else if (key === keys.down.toLowerCase()) direction = 'down';
        else if (key === keys.left.toLowerCase()) direction = 'left';
        else if (key === keys.right.toLowerCase()) direction = 'right';
        
        if (direction) {
          if (!event.repeat) {
            this.handleJoystick(map, direction, isDown, videoWidth, videoHeight);
          }
          consumed = true;
        }
      }
      else if (map.type === 'swipe' && map.key.toLowerCase() === key) {
        if (!event.repeat) {
          this.handleSwipe(map, isDown, videoWidth, videoHeight);
        }
        consumed = true;
      }
    }
    
    return consumed;
  }

  handleTap(map, isDown, videoWidth, videoHeight) {
    // 映射坐标计算：pos.x/y 是相对于视频原尺寸的百分比
    const px = map.pos.x * videoWidth;
    const py = map.pos.y * videoHeight;
    const coord = { x: px, y: py, isRotated: true };

    if (isDown) {
      if (!this.activePointers.has(map.id)) {
        const ptrId = this.pointerIdBase++;
        this.activePointers.set(map.id, ptrId);
        // Action 0: ACTION_DOWN
        this.sendTouch(0, 0, 0, ptrId, coord); 
      }
    } else {
      if (this.activePointers.has(map.id)) {
        const ptrId = this.activePointers.get(map.id);
        // Action 1: ACTION_UP
        this.sendTouch(1, 0, 0, ptrId, coord);
        this.activePointers.delete(map.id);
      }
    }
  }

  handleJoystick(map, direction, isDown, videoWidth, videoHeight) {
    if (!this.joysticks.has(map.id)) {
      this.joysticks.set(map.id, { state: { up: false, down: false, left: false, right: false }, pointerId: null });
    }
    const joy = this.joysticks.get(map.id);
    
    // 更新按下状态
    joy.state[direction] = isDown;
    
    // 计算方向向量
    let dx = 0;
    let dy = 0;
    if (joy.state.up) dy -= 1;
    if (joy.state.down) dy += 1;
    if (joy.state.left) dx -= 1;
    if (joy.state.right) dx += 1;
    
    const isNeutral = (dx === 0 && dy === 0);
    
    const centerX = map.center.x * videoWidth;
    const centerY = map.center.y * videoHeight;
    const radiusPx = map.radius * videoWidth; // 半径基于宽度比例计算
    
    if (isNeutral) {
      // 状态：活动 -> 归位 (发送 ACTION_UP)
      if (joy.pointerId !== null) {
        const centerCoord = { x: centerX, y: centerY, isRotated: true };
        this.sendTouch(1, 0, 0, joy.pointerId, centerCoord);
        joy.pointerId = null;
      }
    } else {
      // 标准化向量，保证斜向距离也是 radius
      const length = Math.sqrt(dx * dx + dy * dy);
      const nx = dx / length;
      const ny = dy / length;
      
      const targetX = centerX + nx * radiusPx;
      const targetY = centerY + ny * radiusPx;
      const coord = { x: targetX, y: targetY, isRotated: true };
      
      if (joy.pointerId === null) {
        // 状态：归位 -> 活动 (先在中心点 ACTION_DOWN，紧接着 ACTION_MOVE 到边缘)
        joy.pointerId = this.pointerIdBase++;
        const centerCoord = { x: centerX, y: centerY, isRotated: true };
        this.sendTouch(0, 0, 0, joy.pointerId, centerCoord);
        this.sendTouch(2, 0, 0, joy.pointerId, coord);
      } else {
        // 状态：活动 -> 活动 (方向改变，发送 ACTION_MOVE)
        this.sendTouch(2, 0, 0, joy.pointerId, coord);
      }
    }
  }

  handleSwipe(map, isDown, videoWidth, videoHeight) {
    if (isDown) {
      if (this.activePointers.has(map.id)) return;

      const ptrId = this.pointerIdBase++;
      this.activePointers.set(map.id, ptrId);

      const startX = map.startPos.x * videoWidth;
      const startY = map.startPos.y * videoHeight;
      const endX = map.endPos.x * videoWidth;
      const endY = map.endPos.y * videoHeight;
      
      const duration = map.duration || 150; 
      const startTime = Date.now();
      
      this.sendTouch(0, 0, 0, ptrId, { x: startX, y: startY, isRotated: true });
      
      const requestAnimFrame = (typeof requestAnimationFrame !== 'undefined') 
        ? requestAnimationFrame 
        : (cb) => setTimeout(cb, 16);

      const animate = () => {
        if (!this.activePointers.has(map.id) || this.activePointers.get(map.id) !== ptrId) {
          return;
        }
        
        const now = Date.now();
        const elapsed = now - startTime;
        let progress = elapsed / duration;
        if (progress >= 1) progress = 1;
        
        const currentX = startX + (endX - startX) * progress;
        const currentY = startY + (endY - startY) * progress;
        
        this.sendTouch(2, 0, 0, ptrId, { x: currentX, y: currentY, isRotated: true });
        
        if (progress < 1) {
          requestAnimFrame(animate);
        }
      };
      
      requestAnimFrame(animate);
      
    } else {
      if (this.activePointers.has(map.id)) {
        const ptrId = this.activePointers.get(map.id);
        const endX = map.endPos.x * videoWidth;
        const endY = map.endPos.y * videoHeight;
        this.sendTouch(1, 0, 0, ptrId, { x: endX, y: endY, isRotated: true });
        this.activePointers.delete(map.id);
      }
    }
  }
}
