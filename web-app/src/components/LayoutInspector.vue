<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="layout-inspector-window"
      :class="{
        'is-mobile': isMobile,
        'is-maximized': isMaximized,
        'is-dragging': isDraggingWindow || isResizing || isSplitting
      }"
      :style="windowStyle"
      @mousedown="bringToFront"
    >
      <!-- 窗口顶部可拖动标题栏 -->
      <div class="window-titlebar" @mousedown="onTitlebarMouseDown" :title="$t('layoutInspector.dragTip')">
        <div class="titlebar-left">
          <span class="window-icon">📐</span>
          <span class="window-title">{{ $t('layoutInspector.title') }}</span>
          <span v-if="deviceName" class="device-tag">{{ deviceName }}</span>
          <span v-if="snapshot && snapshot.display" class="display-badge">
            {{ snapshot.display.width }}×{{ snapshot.display.height }}
            <span v-if="snapshot.display.rotation">({{ snapshot.display.rotation }}°)</span>
          </span>
          <span v-if="snapshot && snapshot.nodes" class="node-count-badge">
            {{ snapshot.nodes.length }} {{ $t('layoutInspector.nodeCount') }}
          </span>
        </div>

        <div class="titlebar-tools" @mousedown.stop>
          <!-- 视图模式切换 -->
          <div class="view-mode-tabs" v-if="!isMobile">
            <button
              class="tab-btn"
              :class="{ active: viewMode === 'canvas' }"
              @click="viewMode = 'canvas'"
              :title="$t('layoutInspector.viewCanvas')"
            >
              📱 {{ $t('layoutInspector.viewCanvas') }}
            </button>
            <button
              class="tab-btn"
              :class="{ active: viewMode === 'details' }"
              @click="viewMode = 'details'"
              :title="$t('layoutInspector.viewDetails')"
            >
              📋 {{ $t('layoutInspector.viewDetails') }}
            </button>
            <button
              class="tab-btn"
              :class="{ active: viewMode === 'split' }"
              @click="viewMode = 'split'"
              :title="$t('layoutInspector.viewSplit')"
            >
              ↔️ {{ $t('layoutInspector.viewSplit') }}
            </button>
          </div>

          <!-- 自动刷新 -->
          <label class="auto-refresh-label" :title="$t('layoutInspector.autoRefresh')">
            <input type="checkbox" v-model="autoRefresh" :disabled="loading" />
            <span>3s</span>
          </label>

          <!-- 手动刷新按键 -->
          <button
            class="win-tool-btn refresh-btn"
            :disabled="loading"
            @click="fetchSnapshot"
            :title="$t('layoutInspector.refresh')"
            :aria-label="$t('layoutInspector.refresh')"
          >
            <svg
              class="icon"
              :class="{ 'spin-icon': loading }"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              width="14"
              height="14"
            >
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
          </button>

          <!-- 最大化 / 还原按键 -->
          <button
            v-if="!isMobile"
            class="win-tool-btn max-btn"
            @click="toggleMaximize"
            :title="isMaximized ? $t('layoutInspector.restore') : $t('layoutInspector.maximize')"
            :aria-label="isMaximized ? $t('layoutInspector.restore') : $t('layoutInspector.maximize')"
          >
            <svg
              v-if="isMaximized"
              class="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              width="14"
              height="14"
            >
              <polyline points="4 14 10 14 10 20"></polyline>
              <polyline points="20 10 14 10 14 4"></polyline>
              <line x1="14" y1="10" x2="21" y2="3"></line>
              <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
            <svg
              v-else
              class="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              width="14"
              height="14"
            >
              <polyline points="15 3 21 3 21 9"></polyline>
              <polyline points="9 21 3 21 3 15"></polyline>
              <line x1="21" y1="3" x2="14" y2="10"></line>
              <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
          </button>

          <!-- 关闭按键 -->
          <button
            class="win-tool-btn close-btn"
            @click="$emit('update:visible', false)"
            :title="$t('layoutInspector.close')"
            :aria-label="$t('layoutInspector.close')"
          >
            <svg
              class="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              width="14"
              height="14"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- 错误提示条 -->
      <div v-if="errorMessage" class="error-banner">
        <div class="error-text">⚠️ {{ errorMessage }}</div>
        <button class="retry-btn" @click="fetchSnapshot">{{ $t('common.retry') || '重试' }}</button>
      </div>

      <!-- 主工作区 -->
      <div class="window-body custom-scrollbar" :class="`view-${viewMode}`" ref="windowBodyRef">
        <!-- 矢量手机画布区域 (在 canvas 或 split 模式下展示) -->
        <div
          v-show="viewMode === 'canvas' || viewMode === 'split'"
          class="canvas-panel"
          :style="canvasPanelStyle"
        >
          <!-- 画布内悬浮工具栏 (手势模式 + 快捷翻页 + 缩放控制器 + 快捷重置) -->
          <div class="canvas-zoom-toolbar" @mousedown.stop>
            <!-- 模式切换：选中审查 vs 触控直连 vs 漫游拖动 -->
            <div class="tool-mode-group">
              <button
                class="mode-btn"
                :class="{ active: interactMode === 'select' }"
                @click="interactMode = 'select'"
                :title="$t('layoutInspector.selectModeTip')"
              >
                {{ $t('layoutInspector.modeSelect') }}
              </button>
              <button
                class="mode-btn"
                :class="{ active: interactMode === 'touch' || interactMode === 'tap' }"
                @click="interactMode = 'touch'"
                :title="$t('layoutInspector.touchModeTip')"
              >
                {{ $t('layoutInspector.modeTouch') }}
              </button>
              <button
                class="mode-btn"
                :class="{ active: interactMode === 'pan' }"
                @click="interactMode = 'pan'"
                :title="$t('layoutInspector.modePan') + ' (按住鼠标左键任意拖动画布)'"
              >
                {{ $t('layoutInspector.modePan') }}
              </button>
            </div>

            <div class="toolbar-divider"></div>

            <!-- 快捷翻页/滑动按键 (在选中与触控模式下呈现) -->
            <div class="tool-swipe-group" v-if="interactMode !== 'pan'">
              <button class="swipe-btn" @click="swipeUp" :title="$t('layoutInspector.swipeUp') + ' (模拟手指向上推，浏览下方内容)'">
                {{ $t('layoutInspector.swipeUp') }}
              </button>
              <button class="swipe-btn" @click="swipeDown" :title="$t('layoutInspector.swipeDown') + ' (模拟手指向下拉，浏览上方内容)'">
                {{ $t('layoutInspector.swipeDown') }}
              </button>
            </div>

            <div class="toolbar-divider" v-if="interactMode !== 'pan'"></div>

            <button class="zoom-btn" @click="zoomOut" :title="$t('layoutInspector.zoomOut')">🔍−</button>
            <span class="zoom-text" @click="resetZoom" :title="$t('layoutInspector.zoomReset')">{{ Math.round(zoomLevel * 100) }}%</span>
            <button class="zoom-btn" @click="zoomIn" :title="$t('layoutInspector.zoomIn')">🔍＋</button>
            <button class="zoom-btn fit-btn" @click="fitZoom" :title="$t('layoutInspector.zoomFit')">🔄 适应窗口</button>
          </div>

          <div v-if="loading && !snapshot" class="loading-state">
            <div class="spinner"></div>
            <p>{{ $t('layoutInspector.loading') }}</p>
          </div>

          <div v-else-if="!snapshot" class="empty-state">
            <p>{{ $t('layoutInspector.empty') }}</p>
            <button class="primary-btn" @click="fetchSnapshot">{{ $t('layoutInspector.captureNow') }}</button>
          </div>

          <!-- 可缩放与平移的视口容器 -->
          <div
            v-else
            class="canvas-viewport"
            ref="viewportRef"
            :class="{
              'cursor-pan-ready': interactMode === 'pan' || isSpacePressed,
              'cursor-panning': isPanning
            }"
            @wheel.prevent="onCanvasWheel"
            @mousedown="onCanvasMouseDown"
          >
            <!-- 手机外框与画布包裹器 (尺寸由 Contain 算法精确驱动，保持100%设备比例，绝不畸变拉伸) -->
            <div
              class="phone-canvas-wrapper"
              :style="canvasWrapperStyle"
            >
              <!-- 顶部前摄传感器刘海装饰 -->
              <div class="notch-decor"></div>

              <!-- SVG 矢量重绘 (支持精准点按、连续手势拖拽滑动与滚轮滚屏) -->
              <svg
                class="layout-svg"
                ref="layoutSvgRef"
                :viewBox="`0 0 ${displayW} ${displayH}`"
                preserveAspectRatio="xMidYMid meet"
                @pointerdown="onSvgPointerDown"
                @pointermove="onSvgPointerMove"
                @pointerup="onSvgPointerUp"
                @pointercancel="onSvgPointerCancel"
                @lostpointercapture="onSvgPointerCancel"
                @mouseleave="onSvgMouseLeave"
              >
                <defs>
                  <filter id="glow-select" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#ec4899" flood-opacity="0.8" />
                  </filter>
                </defs>

                <!-- 渲染节点列表 (子元素设置 pointer-events: none，杜绝大容器遮挡截断点击) -->
                <g v-for="node in visibleNodes" :key="node.id">
                  <!-- 控件矩形框 -->
                  <rect
                    :x="node.bounds[0]"
                    :y="node.bounds[1]"
                    :width="Math.max(0, node.bounds[2] - node.bounds[0])"
                    :height="Math.max(0, node.bounds[3] - node.bounds[1])"
                    :class="getNodeClass(node)"
                  />

                  <!-- 文字标签渲染 (包含半透明底衬与自适应字号，确保清晰可辨) -->
                  <g v-if="node.text && (node.bounds[3] - node.bounds[1] > 20)">
                    <text
                      :x="node.bounds[0] + 10"
                      :y="node.bounds[1] + getNodeTextBaseline(node)"
                      class="node-text"
                      :style="{ fontSize: `${getNodeFontSize(node)}px` }"
                      :class="{ 'interactive-text': node.clickable }"
                    >
                      {{ formatNodeText(node.text) }}
                    </text>
                  </g>

                  <!-- 开关状态胶囊 (Switch / Checkbox) -->
                  <g v-if="node.checkable && node.checked !== null && node.checked !== undefined">
                    <rect
                      :x="node.bounds[2] - 56"
                      :y="node.bounds[1] + 8"
                      width="48"
                      height="24"
                      rx="12"
                      :fill="node.checked ? '#22c55e' : '#64748b'"
                      class="switch-pill"
                    />
                    <text
                      :x="node.bounds[2] - 32"
                      :y="node.bounds[1] + 24"
                      text-anchor="middle"
                      class="switch-text"
                    >
                      {{ node.checked ? 'ON' : 'OFF' }}
                    </text>
                  </g>
                </g>

                <!-- 仅选中模式下的涟漪反馈 (清爽青蓝科技光圈) -->
                <circle
                  v-if="selectRipple"
                  :cx="selectRipple.x"
                  :cy="selectRipple.y"
                  r="26"
                  class="select-ripple"
                />

                <!-- 触控点击涟漪反馈 (粉红触控反馈) -->
                <circle
                  v-if="clickRipple"
                  :cx="clickRipple.x"
                  :cy="clickRipple.y"
                  r="28"
                  class="click-ripple"
                />

                <!-- 滑动手势动效轨迹与端点指示 -->
                <g v-if="swipeTrail.length >= 2" class="swipe-trail-layer">
                  <path
                    :d="swipeTrailPath"
                    class="swipe-trail-glow"
                  />
                  <path
                    :d="swipeTrailPath"
                    class="swipe-trail-core"
                  />
                  <circle
                    :cx="swipeTrail[0].x"
                    :cy="swipeTrail[0].y"
                    r="8"
                    class="swipe-point-start"
                  />
                  <circle
                    :cx="swipeTrail[swipeTrail.length - 1].x"
                    :cy="swipeTrail[swipeTrail.length - 1].y"
                    r="10"
                    class="swipe-point-end"
                  />
                </g>
              </svg>
            </div>
          </div>
        </div>

        <!-- 垂直可拖动分割条 (在 split 并列模式下展示) -->
        <div
          v-if="viewMode === 'split' && !isMobile"
          class="split-divider"
          @mousedown.stop.prevent="startSplitResize"
          title="左右拖动调节画面与属性面板比例"
        >
          <div class="divider-line"></div>
        </div>

        <!-- 节点属性与检索面板 (在 details 或 split 模式下展示) -->
        <div
          v-show="viewMode === 'details' || viewMode === 'split'"
          class="details-panel custom-scrollbar"
          :style="detailsPanelStyle"
        >
          <!-- 快速过滤搜索栏 -->
          <div class="filter-bar">
            <input
              v-model="filterKeyword"
              type="text"
              class="filter-input"
              :placeholder="$t('layoutInspector.filterPlaceholder')"
            />
            <button v-if="filterKeyword" class="clear-filter-btn" @click="filterKeyword = ''">✕</button>
          </div>

          <!-- 选中节点卡片 -->
          <div v-if="activeSelectedNode" class="node-detail-card">
            <!-- 节点层级面包屑路径 (点击任一父级可直接跳转选中) -->
            <div v-if="selectedAncestors.length > 1" class="node-breadcrumb custom-scrollbar">
              <span class="bc-label">层级:</span>
              <div class="bc-trail">
                <span
                  v-for="(ancestor, idx) in selectedAncestors"
                  :key="ancestor.id"
                  class="bc-item"
                  :class="{ current: ancestor.id === activeSelectedNode.id }"
                  @click="selectNodeOnly(ancestor)"
                  :title="`${ancestor.class} (${ancestor.bounds.join(',')})`"
                >
                  <span class="bc-name">{{ shortClassName(ancestor.class) }}</span>
                  <span v-if="idx < selectedAncestors.length - 1" class="bc-sep">/</span>
                </span>
              </div>
            </div>

            <div class="card-header">
              <span class="node-class-name" :title="activeSelectedNode.class">
                {{ shortClassName(activeSelectedNode.class) }}
              </span>
              <div class="header-badges">
                <span class="node-depth-badge">Depth: {{ nodeDepthMap.get(activeSelectedNode.id) || 0 }}</span>
                <span class="node-id-badge">ID: {{ activeSelectedNode.id }}</span>
              </div>
            </div>

            <div v-if="activeSelectedNode.package" class="detail-row">
              <span class="detail-label">Package:</span>
              <span class="detail-value text-mono">{{ activeSelectedNode.package }}</span>
            </div>

            <div v-if="activeSelectedNode.resourceId" class="detail-row">
              <span class="detail-label">Resource ID:</span>
              <span class="detail-value text-mono text-accent">{{ activeSelectedNode.resourceId }}</span>
            </div>

            <div v-if="activeSelectedNode.text" class="detail-row">
              <span class="detail-label">Text:</span>
              <span class="detail-value text-strong">{{ activeSelectedNode.text }}</span>
            </div>

            <div v-if="activeSelectedNode.desc" class="detail-row">
              <span class="detail-label">Desc:</span>
              <span class="detail-value">{{ activeSelectedNode.desc }}</span>
            </div>

            <div class="detail-row">
              <span class="detail-label">Bounds:</span>
              <span class="detail-value text-mono">
                [{{ activeSelectedNode.bounds.join(', ') }}]
                ({{ activeSelectedNode.bounds[2] - activeSelectedNode.bounds[0] }}×{{ activeSelectedNode.bounds[3] - activeSelectedNode.bounds[1] }})
              </span>
            </div>

            <!-- 属性状态标签集 -->
            <div class="flag-badges">
              <span v-if="activeSelectedNode.clickable" class="flag-badge active">clickable</span>
              <span v-if="activeSelectedNode.checkable" class="flag-badge active">
                checkable ({{ activeSelectedNode.checked ? 'checked' : 'unchecked' }})
              </span>
              <span v-if="activeSelectedNode.scrollable" class="flag-badge info">scrollable</span>
              <span v-if="activeSelectedNode.focused" class="flag-badge warn">focused</span>
              <span v-if="activeSelectedNode.selected" class="flag-badge warn">selected</span>
              <span v-if="activeSelectedNode.enabled === false" class="flag-badge disabled">disabled</span>
            </div>

            <!-- 操作按键区 -->
            <div class="action-buttons">
              <button v-if="activeSelectedNode.resourceId" class="btn-copy" @click="copyText(activeSelectedNode.resourceId, $t('layoutInspector.copied'))">
                📋 {{ $t('layoutInspector.copyId') }}
              </button>
              <button v-if="activeSelectedNode.text" class="btn-copy" @click="copyText(activeSelectedNode.text, $t('layoutInspector.copied'))">
                📋 {{ $t('layoutInspector.copyText') }}
              </button>
              <button class="btn-copy" @click="copyText(JSON.stringify(activeSelectedNode.bounds), $t('layoutInspector.copied'))">
                📋 {{ $t('layoutInspector.copyBounds') }}
              </button>
              <!-- 显式执行真机点按按钮 -->
              <button class="btn-action tap-btn" :disabled="!snapshotReady" @click="tapNode(activeSelectedNode)" :title="$t('layoutInspector.tapThisNode')">
                👆 点击该控件
              </button>
            </div>
          </div>

          <div v-else class="no-selection-hint">
            <p>👆 {{ $t('layoutInspector.selectHint') }}</p>
          </div>

          <!-- 元素视图容器 (支持树形层级与扁平列表切换，点击仅选中高亮绝不乱点真机) -->
          <div class="nodes-list-container custom-scrollbar">
            <div class="list-toolbar">
              <div class="list-title">
                <span>{{ listDisplayMode === 'tree' ? $t('layoutInspector.treeView') : $t('layoutInspector.flatView') }}</span>
                <span class="count-tag">
                  ({{ listDisplayMode === 'tree' ? visibleTreeNodes.length : filteredNodes.length }}/{{ snapshot?.nodes?.length || 0 }})
                </span>
              </div>
              <div class="list-actions">
                <template v-if="listDisplayMode === 'tree' && !filterKeyword">
                  <button class="list-tool-btn" @click="expandAll" :title="$t('layoutInspector.expandAll')">⊞ 展开</button>
                  <button class="list-tool-btn" @click="collapseAll" :title="$t('layoutInspector.collapseAll')">⊟ 收起</button>
                </template>
                <button
                  class="list-tool-btn mode-switch-btn"
                  @click="listDisplayMode = (listDisplayMode === 'tree' ? 'flat' : 'tree')"
                  :title="listDisplayMode === 'tree' ? '切换为扁平列表' : '切换为层级树'"
                >
                  {{ listDisplayMode === 'tree' ? '📋 ' + $t('layoutInspector.flatView') : '🌲 ' + $t('layoutInspector.treeView') }}
                </button>
              </div>
            </div>

            <!-- 1. 树形层级视图 (Tree View) -->
            <div v-if="listDisplayMode === 'tree'" class="tree-nodes-list">
              <div
                v-for="item in visibleTreeNodes"
                :key="item.id"
                class="node-tree-item"
                :data-node-id="item.id"
                :class="{
                  active: activeSelectedNode?.id === item.id,
                  'is-hovered': hoveredNode?.id === item.id
                }"
                :style="{ paddingLeft: `${item.depth * 14 + 6}px` }"
                @click="selectNodeOnly(item)"
                @mouseenter="hoveredNode = item"
                @mouseleave="hoveredNode = null"
              >
                <!-- 展开/折叠箭头指示器 -->
                <span
                  class="tree-arrow"
                  :class="{
                    expanded: item.isExpanded,
                    leaf: !item.hasChildren
                  }"
                  @click.stop="toggleExpand(item.id)"
                >
                  <template v-if="item.hasChildren">
                    <svg viewBox="0 0 24 24" class="arrow-svg"><path d="M8 5v14l11-7z" fill="currentColor"></path></svg>
                  </template>
                  <template v-else>
                    <span class="leaf-dot">•</span>
                  </template>
                </span>

                <!-- 节点内容 -->
                <div class="tree-item-content">
                  <span class="item-class" :title="item.class">{{ shortClassName(item.class) }}</span>
                  <span v-if="item.text" class="item-text" :title="item.text">"{{ formatNodeText(item.text) }}"</span>
                  <span v-else-if="item.resourceId" class="item-res" :title="item.resourceId">#{{ item.resourceId.split('/').pop() }}</span>
                  <span v-if="item.childrenCount > 0" class="children-badge">({{ item.childrenCount }})</span>
                </div>

                <!-- 元数据标签 -->
                <div class="item-meta">
                  <span v-if="item.clickable" class="badge-dot" title="clickable"></span>
                  <span class="item-bounds">[{{ item.bounds[0] }},{{ item.bounds[1] }}]</span>
                </div>
              </div>

              <div v-if="visibleTreeNodes.length === 0" class="empty-filter-hint">
                未找到匹配节点
              </div>
            </div>

            <!-- 2. 扁平列表视图 (Flat List) -->
            <div v-else class="flat-nodes-list">
              <div
                v-for="item in filteredNodes.slice(0, 200)"
                :key="item.id"
                class="node-list-item"
                :class="{ active: activeSelectedNode?.id === item.id }"
                @click="selectNodeOnly(item)"
                @mouseenter="hoveredNode = item"
                @mouseleave="hoveredNode = null"
              >
                <div class="item-main">
                  <span class="item-depth-badge">L{{ nodeDepthMap.get(item.id) || 0 }}</span>
                  <span class="item-class">{{ shortClassName(item.class) }}</span>
                  <span v-if="item.text" class="item-text">"{{ formatNodeText(item.text) }}"</span>
                  <span v-else-if="item.resourceId" class="item-res">#{{ item.resourceId.split('/').pop() }}</span>
                </div>
                <div class="item-meta">
                  <span v-if="item.clickable" class="badge-dot" title="clickable"></span>
                  <span class="item-bounds">[{{ item.bounds[0] }},{{ item.bounds[1] }}]</span>
                </div>
              </div>
              <div v-if="filteredNodes.length > 200" class="more-nodes-hint">
                仅展示前 200 个匹配节点，请使用搜索框细化
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 8 方向全向调整拉伸边缘 (在非最大化且非移动端时呈现) -->
      <template v-if="!isMaximized && !isMobile">
        <div class="win-resize-edge edge-top" @mousedown.stop.prevent="startResize('top', $event)"></div>
        <div class="win-resize-edge edge-bottom" @mousedown.stop.prevent="startResize('bottom', $event)"></div>
        <div class="win-resize-edge edge-left" @mousedown.stop.prevent="startResize('left', $event)"></div>
        <div class="win-resize-edge edge-right" @mousedown.stop.prevent="startResize('right', $event)"></div>
        <div class="win-resize-corner corner-tl" @mousedown.stop.prevent="startResize('tl', $event)"></div>
        <div class="win-resize-corner corner-tr" @mousedown.stop.prevent="startResize('tr', $event)"></div>
        <div class="win-resize-corner corner-bl" @mousedown.stop.prevent="startResize('bl', $event)"></div>
        <div class="win-resize-corner corner-br" @mousedown.stop.prevent="startResize('br', $event)"></div>
      </template>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  visible: { type: Boolean, default: false },
  webrtc: { type: Object, default: null },
  deviceId: { type: String, required: true },
  deviceName: { type: String, default: '' },
  isMobile: { type: Boolean, default: false }
})

const emit = defineEmits(['update:visible'])
const { t } = useI18n()

const snapshot = ref(null)
const loading = ref(false)
const errorMessage = ref('')
const autoRefresh = ref(false)
const selectedNode = ref(null)
const hoveredNode = ref(null)
const filterKeyword = ref('')
const clickRipple = ref(null)
const selectRipple = ref(null)
const layoutSvgRef = ref(null)

// 手势交互与连续滑动状态 (支持拖拽滑动、单点精确点击、滚轮滚动)
const gesture = reactive({
  isDown: false,
  isSwiping: false,
  startClientX: 0,
  startClientY: 0,
  startDevX: 0,
  startDevY: 0,
  mode: null,
  lastMoveTime: 0,
  pointerId: null
})

// 滑动手势轨迹动态指示
const swipeTrail = ref([])

const swipeTrailPath = computed(() => {
  if (swipeTrail.value.length < 2) return ''
  const pts = swipeTrail.value
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x} ${pts[i].y}`
  }
  return d
})

// 窗口尺寸与定位 (独立顶级浮动窗口)
const defaultW = typeof window !== 'undefined' ? Math.min(960, Math.max(720, window.innerWidth - 80)) : 920
const defaultH = typeof window !== 'undefined' ? Math.min(820, Math.max(540, window.innerHeight - 80)) : 760

const winWidth = ref(defaultW)
const winHeight = ref(defaultH)
const winTop = ref(typeof window !== 'undefined' ? Math.max(30, Math.round((window.innerHeight - defaultH) / 2)) : 40)
const winLeft = ref(typeof window !== 'undefined' ? Math.max(20, Math.round((window.innerWidth - defaultW) / 2)) : 40)
const isMaximized = ref(false)
const zIndex = ref(10050)

// 视图模式：'split' (并列) | 'canvas' (仅画面) | 'details' (仅属性)
const viewMode = ref('split')

// 列表展示模式：'tree' (层级树) | 'flat' (扁平列表)
const listDisplayMode = ref('tree')
// 树形节点展开集合 (存储已展开的 node.id)
const expandedNodeIds = ref(new Set())

// 左右分栏分割比 (split 模式下左侧画面宽度比例，默认 0.58)
const splitRatio = ref(0.58)
const isSplitting = ref(false)

// 画布手势模式：'select' (选中审查) | 'touch' (触控直连) | 'pan' (漫游平移)
const interactMode = ref('select')
const isSpacePressed = ref(false)

// 画布视口宽高响应式追踪
const viewportRef = ref(null)
const windowBodyRef = ref(null)
const viewportWidth = ref(480)
const viewportHeight = ref(600)
let viewportResizeObserver = null

// 画布缩放与平移
const zoomLevel = ref(1.0)
const panX = ref(0)
const panY = ref(0)
let isPanning = false
let panStartX = 0
let panStartY = 0
let startPanX = 0
let startPanY = 0

// 窗口拖动与调整大小
const isDraggingWindow = ref(false)
const isResizing = ref(false)
let dragStartX = 0
let dragStartY = 0
let initialWinLeft = 0
let initialWinTop = 0
let resizeDirection = ''
let initialW = 0
let initialH = 0

let snapshotRequest = null
let snapshotReceivedAt = 0
let activeTouch = null
const snapshotReady = ref(false)
let autoRefreshTimer = null
let refreshDebounceTimer = null

const displayW = computed(() => snapshot.value?.display?.width || 1080)
const displayH = computed(() => snapshot.value?.display?.height || 1920)

// 浮窗主样式
const windowStyle = computed(() => {
  if (props.isMobile) {
    return {
      top: '0px',
      left: '0px',
      width: '100vw',
      height: '100vh',
      zIndex: zIndex.value
    }
  }
  if (isMaximized.value) {
    return {
      top: '12px',
      left: '12px',
      width: 'calc(100vw - 24px)',
      height: 'calc(100vh - 24px)',
      zIndex: zIndex.value
    }
  }
  return {
    top: `${winTop.value}px`,
    left: `${winLeft.value}px`,
    width: `${winWidth.value}px`,
    height: `${winHeight.value}px`,
    zIndex: zIndex.value
  }
})

// 分栏宽度计算
const canvasPanelStyle = computed(() => {
  if (viewMode.value === 'canvas') return { flex: '1', width: '100%' }
  if (viewMode.value === 'details') return { display: 'none' }
  return {
    flex: `0 0 ${Math.round(splitRatio.value * 100)}%`,
    maxWidth: `${Math.round(splitRatio.value * 100)}%`
  }
})

const detailsPanelStyle = computed(() => {
  if (viewMode.value === 'details') return { flex: '1', width: '100%' }
  if (viewMode.value === 'canvas') return { display: 'none' }
  return {
    flex: '1',
    minWidth: '240px'
  }
})

// Contain 算法：手机外壳基准物理尺寸 (绝不变形，严格保持设备分辨率宽高比，最大化填充当前视口)
const phoneBaseSize = computed(() => {
  const pad = 36 // 留给外围边距与悬浮栏的空间
  const availW = Math.max(120, viewportWidth.value - pad)
  const availH = Math.max(160, viewportHeight.value - pad)
  const aspect = displayW.value / displayH.value

  let targetW = availW
  let targetH = targetW / aspect
  if (targetH > availH) {
    targetH = availH
    targetW = targetH * aspect
  }

  return {
    width: Math.max(100, Math.round(targetW)),
    height: Math.max(140, Math.round(targetH))
  }
})

// 画布外层包裹容器样式 (支持无级缩放与平移)
const canvasWrapperStyle = computed(() => {
  const { width, height } = phoneBaseSize.value
  return {
    width: `${width}px`,
    height: `${height}px`,
    transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoomLevel.value})`,
    transformOrigin: 'center center'
  }
})

const visibleNodes = computed(() => {
  if (!snapshot.value?.nodes) return []
  return snapshot.value.nodes.filter(n => {
    if (!n.bounds || n.bounds.length !== 4) return false
    const w = n.bounds[2] - n.bounds[0]
    const h = n.bounds[3] - n.bounds[1]
    return w > 0 && h > 0
  })
})

const activeSelectedNode = computed(() => selectedNode.value)

const filteredNodes = computed(() => {
  if (!snapshot.value?.nodes) return []
  const kw = filterKeyword.value.trim().toLowerCase()
  if (!kw) return snapshot.value.nodes
  return snapshot.value.nodes.filter(n => {
    const text = (n.text || '').toLowerCase()
    const resId = (n.resourceId || '').toLowerCase()
    const cls = (n.class || '').toLowerCase()
    const desc = (n.desc || '').toLowerCase()
    return text.includes(kw) || resId.includes(kw) || cls.includes(kw) || desc.includes(kw)
  })
})

// --- DOM 层级树计算 (Parent-Child 拓扑关联) ---

// 节点哈希表 (id -> node)
const nodeMap = computed(() => {
  const map = new Map()
  if (!snapshot.value?.nodes) return map
  for (const n of snapshot.value.nodes) {
    map.set(n.id, n)
  }
  return map
})

// 父子索引表 (parentId -> children[])
const childrenMap = computed(() => {
  const map = new Map()
  if (!snapshot.value?.nodes) return map
  for (const n of snapshot.value.nodes) {
    if (n.parentId !== null && n.parentId !== undefined) {
      if (!map.has(n.parentId)) {
        map.set(n.parentId, [])
      }
      map.get(n.parentId).push(n)
    }
  }
  return map
})

// 每个节点的深度 (根节点深度 0, 子节点递增)
const nodeDepthMap = computed(() => {
  const depths = new Map()
  if (!snapshot.value?.nodes) return depths
  for (const n of snapshot.value.nodes) {
    let d = 0
    let curr = n
    // 防环保护，最大 50 层
    while (curr && curr.parentId !== null && curr.parentId !== undefined && d < 50) {
      d++
      curr = nodeMap.value.get(curr.parentId)
    }
    depths.set(n.id, d)
  }
  return depths
})

// 当前选中节点的完整祖先路径 (用于面包屑)
const selectedAncestors = computed(() => {
  if (!selectedNode.value) return []
  const list = []
  let curr = selectedNode.value
  let guard = 0
  while (curr && guard < 50) {
    guard++
    list.unshift(curr)
    if (curr.parentId === null || curr.parentId === undefined) break
    curr = nodeMap.value.get(curr.parentId)
  }
  return list
})

// 树形模式下当前可见的节点列表 (根据展开/折叠与搜索自动计算)
const visibleTreeNodes = computed(() => {
  if (!snapshot.value?.nodes) return []
  const kw = filterKeyword.value.trim().toLowerCase()

  // 若处于搜索状态：自动展开并呈现包含搜索词的分支链路
  if (kw) {
    const matchedIds = new Set()
    for (const n of snapshot.value.nodes) {
      const match = (n.text && n.text.toLowerCase().includes(kw)) ||
                    (n.resourceId && n.resourceId.toLowerCase().includes(kw)) ||
                    (n.class && n.class.toLowerCase().includes(kw)) ||
                    (n.desc && n.desc.toLowerCase().includes(kw))
      if (match) {
        matchedIds.add(n.id)
        let pId = n.parentId
        let g = 0
        while (pId !== null && pId !== undefined && g < 50) {
          g++
          matchedIds.add(pId)
          const p = nodeMap.value.get(pId)
          pId = p ? p.parentId : null
        }
      }
    }
    return snapshot.value.nodes.filter(n => matchedIds.has(n.id)).map(n => {
      const children = childrenMap.value.get(n.id) || []
      const depth = nodeDepthMap.value.get(n.id) || 0
      return {
        ...n,
        depth,
        childrenCount: children.length,
        hasChildren: children.length > 0,
        isExpanded: true
      }
    })
  }

  // 正常模式：根据 expandedNodeIds 深度优先遍历
  const result = []
  const rootNodes = snapshot.value.nodes.filter(n => n.parentId === null || n.parentId === undefined || !nodeMap.value.has(n.parentId))

  function traverse(node) {
    const children = childrenMap.value.get(node.id) || []
    const depth = nodeDepthMap.value.get(node.id) || 0
    const isExpanded = expandedNodeIds.value.has(node.id)

    result.push({
      ...node,
      depth,
      childrenCount: children.length,
      hasChildren: children.length > 0,
      isExpanded
    })

    if (isExpanded && children.length > 0) {
      for (const child of children) {
        traverse(child)
      }
    }
  }

  for (const r of rootNodes) {
    traverse(r)
  }

  return result
})

function shortClassName(fullClass) {
  if (!fullClass) return 'View'
  const parts = fullClass.split('.')
  return parts[parts.length - 1] || fullClass
}

function formatNodeText(str) {
  if (!str) return ''
  return str.length > 28 ? str.slice(0, 26) + '...' : str
}

// 计算文本基线与大小 (在 720/1080 原生坐标系下清晰锐利)
function getNodeFontSize(node) {
  const h = node.bounds[3] - node.bounds[1]
  return Math.max(22, Math.min(36, Math.round(h * 0.45)))
}

function getNodeTextBaseline(node) {
  const h = node.bounds[3] - node.bounds[1]
  const fs = getNodeFontSize(node)
  return Math.min(h - 6, Math.max(fs + 2, Math.round(h * 0.6)))
}

function getNodeClass(node) {
  const classes = ['svg-node']
  if (node.clickable) classes.push('is-clickable')
  if (node.checkable) classes.push('is-checkable')
  if (node.scrollable) classes.push('is-scrollable')
  if (!node.text && !node.desc && (!node.clickable || !node.resourceId)) classes.push('is-container')
  if (hoveredNode.value?.id === node.id) classes.push('is-hovered')
  if (selectedNode.value?.id === node.id) classes.push('is-selected')
  return classes.join(' ')
}

function bringToFront() {
  zIndex.value = Math.max(zIndex.value, 10050) + 1
}

function toggleMaximize() {
  isMaximized.value = !isMaximized.value
  nextTick(() => {
    updateViewportSize()
  })
}

// --- 窗口顶部拖动 ---
function onTitlebarMouseDown(e) {
  if (isMaximized.value || props.isMobile) return
  if (e.target.closest('.titlebar-tools')) return
  isDraggingWindow.value = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  initialWinLeft = winLeft.value
  initialWinTop = winTop.value

  const onMouseMove = (moveEvt) => {
    if (!isDraggingWindow.value) return
    const dx = moveEvt.clientX - dragStartX
    const dy = moveEvt.clientY - dragStartY
    winLeft.value = Math.max(10, Math.min(window.innerWidth - 120, initialWinLeft + dx))
    winTop.value = Math.max(10, Math.min(window.innerHeight - 80, initialWinTop + dy))
  }

  const onMouseUp = () => {
    isDraggingWindow.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.userSelect = ''
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.body.style.userSelect = 'none'
}

// --- 8 方向边缘拉伸 (修复参数传递与全向计算) ---
function startResize(dir, e) {
  if (isMaximized.value || props.isMobile) return
  isResizing.value = true
  resizeDirection = dir
  dragStartX = e.clientX
  dragStartY = e.clientY
  initialW = winWidth.value
  initialH = winHeight.value
  initialWinLeft = winLeft.value
  initialWinTop = winTop.value

  document.addEventListener('mousemove', onResizing)
  document.addEventListener('mouseup', stopResize)
  document.body.style.userSelect = 'none'
}

function onResizing(e) {
  if (!isResizing.value) return
  const dx = e.clientX - dragStartX
  const dy = e.clientY - dragStartY

  // 水平调整
  if (resizeDirection.includes('right')) {
    winWidth.value = Math.max(460, Math.min(window.innerWidth - winLeft.value - 10, initialW + dx))
  } else if (resizeDirection.includes('left')) {
    const newW = Math.max(460, Math.min(initialWinLeft + initialW - 10, initialW - dx))
    const actualDx = newW - initialW
    winLeft.value = initialWinLeft - actualDx
    winWidth.value = newW
  }

  // 垂直调整
  if (resizeDirection.includes('bottom')) {
    winHeight.value = Math.max(380, Math.min(window.innerHeight - winTop.value - 10, initialH + dy))
  } else if (resizeDirection.includes('top')) {
    const newH = Math.max(380, Math.min(initialWinTop + initialH - 10, initialH - dy))
    const actualDy = newH - initialH
    winTop.value = initialWinTop - actualDy
    winHeight.value = newH
  }

  updateViewportSize()
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', onResizing)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.userSelect = ''
  updateViewportSize()
}

// --- 左右分栏分割条拖拽 ---
function startSplitResize(e) {
  if (props.isMobile || viewMode.value !== 'split') return
  isSplitting.value = true
  const startX = e.clientX
  const containerW = windowBodyRef.value ? windowBodyRef.value.clientWidth : winWidth.value
  const initialRatio = splitRatio.value

  const onMouseMove = (moveEvt) => {
    if (!isSplitting.value) return
    const dx = moveEvt.clientX - startX
    const deltaRatio = dx / containerW
    splitRatio.value = Math.max(0.25, Math.min(0.80, +(initialRatio + deltaRatio).toFixed(3)))
    updateViewportSize()
  }

  const onMouseUp = () => {
    isSplitting.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.userSelect = ''
    updateViewportSize()
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.body.style.userSelect = 'none'
}

// --- 视口尺寸监听 ---
function updateViewportSize() {
  if (viewportRef.value) {
    viewportWidth.value = viewportRef.value.clientWidth || 400
    viewportHeight.value = viewportRef.value.clientHeight || 500
  }
}

// --- 缩放与平移逻辑 ---
function zoomIn() {
  zoomLevel.value = Math.min(4.0, +(zoomLevel.value + 0.15).toFixed(2))
}

function zoomOut() {
  zoomLevel.value = Math.max(0.3, +(zoomLevel.value - 0.15).toFixed(2))
}

function resetZoom() {
  zoomLevel.value = 1.0
  panX.value = 0
  panY.value = 0
}

function fitZoom() {
  zoomLevel.value = 1.0
  panX.value = 0
  panY.value = 0
  updateViewportSize()
}

function onCanvasWheel(e) {
  // 1. 若处于漫游模式，或按住 Ctrl / Meta 键，或光标不在手机画面内：走视口缩放 (Zoom)
  const isZoom = e.ctrlKey || e.metaKey || interactMode.value === 'pan' || !e.target?.closest?.('.phone-canvas-wrapper')
  if (isZoom) {
    const delta = e.deltaY < 0 ? 0.12 : -0.12
    const newZoom = Math.max(0.3, Math.min(4.0, +(zoomLevel.value + delta).toFixed(2)))
    zoomLevel.value = newZoom
    return
  }

  // 2. 处于操作模式且光标在手机画面内：转为真机滚动 (Scroll)
  if (interactMode.value !== 'touch' || !canStartTouch()) return
  const pt = getSvgPoint(e)
  const x = pt ? pt.x : Math.round(displayW.value / 2)
  const y = pt ? pt.y : Math.round(displayH.value / 2)

  // deltaY > 0 为向下滚轮 (查看下方内容)，在 scrcpy 的 inject_scroll 中 scroll_v = -1
  const scrollV = e.deltaY > 0 ? -1 : 1

  if (props.webrtc && typeof props.webrtc.sendScrollDirect === 'function') {
    if (props.webrtc.sendScrollDirect(x, y, 0, scrollV, displayW.value, displayH.value)) {
      snapshotReady.value = false
      scheduleDebouncedRefresh(500)
    }
  } else if (props.webrtc && typeof props.webrtc.sendTouchDirect === 'function') {
    // 兜底小位移滑动
    const swipeDelta = e.deltaY > 0 ? -220 : 220
    performSwipeGesture(x, y, x, Math.max(0, Math.min(displayH.value - 1, y + swipeDelta)), 160)
  }
}

// 画布平移启动判定 (支持漫游模式、空格键、中键或点按空白处)
function onCanvasMouseDown(e) {
  const isMiddleButton = e.button === 1
  const isPanMode = interactMode.value === 'pan'
  const isSpace = isSpacePressed.value
  const isBlankClick = e.target.classList.contains('canvas-viewport') || e.target.classList.contains('phone-canvas-wrapper')

  // 若处于选择点按模式且点击在控件节点上，且未按空格/中键，则保留给控件点按事件
  if (!isPanMode && !isSpace && !isMiddleButton && !isBlankClick) {
    return
  }

  isPanning = true
  panStartX = e.clientX
  panStartY = e.clientY
  startPanX = panX.value
  startPanY = panY.value

  const onPanMove = (moveEvt) => {
    if (!isPanning) return
    panX.value = startPanX + (moveEvt.clientX - panStartX)
    panY.value = startPanY + (moveEvt.clientY - panStartY)
  }

  const onPanEnd = () => {
    isPanning = false
    document.removeEventListener('mousemove', onPanMove)
    document.removeEventListener('mouseup', onPanEnd)
  }

  document.addEventListener('mousemove', onPanMove)
  document.addEventListener('mouseup', onPanEnd)
}

// --- 键盘事件监听 (空格键平移漫游) ---
function onKeyDown(e) {
  if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) {
    isSpacePressed.value = true
  }
}

function onKeyUp(e) {
  if (e.code === 'Space') {
    isSpacePressed.value = false
  }
}

// --- 数据采集逻辑 ---
async function fetchSnapshot() {
  if (!props.visible || loading.value || activeTouch) return
  const request = props.webrtc?.requestLayoutSnapshot
  if (!request) {
    errorMessage.value = t('layoutInspector.unsupported')
    return
  }

  const controller = new AbortController()
  snapshotRequest = controller
  loading.value = true
  snapshotReady.value = false
  errorMessage.value = ''

  try {
    const res = await request(15000, controller.signal)
    if (snapshotRequest !== controller || request !== props.webrtc?.requestLayoutSnapshot) return
    snapshot.value = res
    snapshotReceivedAt = performance.now()
    snapshotReady.value = true
    selectedNode.value = null
    hoveredNode.value = null
    initDefaultExpanded()
    nextTick(updateViewportSize)
  } catch (err) {
    if (controller.signal.aborted || snapshotRequest !== controller) return
    console.error('[LayoutInspector] Failed to capture snapshot:', err)
    const code = err.code || err.message
    if (code === 'capture_timeout') {
      errorMessage.value = t('layoutInspector.captureTimeout')
    } else if (code === 'display_changed') {
      errorMessage.value = t('layoutInspector.displayChanged')
    } else if (code === 'snapshot_too_large') {
      errorMessage.value = t('layoutInspector.snapshotTooLarge')
    } else if (code === 'permission_denied') {
      errorMessage.value = t('layoutInspector.permissionDenied')
    } else {
      errorMessage.value = `${t('layoutInspector.errorPrefix')}: ${err.message || code}`
    }
  } finally {
    if (snapshotRequest === controller) {
      snapshotRequest = null
      loading.value = false
    }
  }
}

// --- SVG 原生数学矩阵逆变换 (0 像素物理偏差) ---
function getSvgPoint(e) {
  if (!layoutSvgRef.value) return null
  try {
    const pt = layoutSvgRef.value.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = layoutSvgRef.value.getScreenCTM()
    if (!ctm) return null
    const svgP = pt.matrixTransform(ctm.inverse())
    const x = Math.max(0, Math.min(displayW.value - 1, Math.round(svgP.x)))
    const y = Math.max(0, Math.min(displayH.value - 1, Math.round(svgP.y)))
    return { x, y }
  } catch (err) {
    console.warn('[LayoutInspector] Failed to transform point:', err)
    return null
  }
}

// --- 画布指针与滑动手势处理 (精准区分单点点击、手势拖拽滑动与滚轮滚屏) ---

function onSvgPointerDown(e) {
  // 漫游模式、空格平移或非鼠标主键时交由视口平移处理
  if (interactMode.value === 'pan' || isSpacePressed.value || e.button !== 0 || gesture.isDown || activeTouch) {
    return
  }
  const pt = getSvgPoint(e)
  if (!pt) return

  gesture.isDown = true
  gesture.mode = interactMode.value
  gesture.isSwiping = false
  gesture.startClientX = e.clientX
  gesture.startClientY = e.clientY
  gesture.startDevX = pt.x
  gesture.startDevY = pt.y
  gesture.lastMoveTime = 0
  gesture.pointerId = e.pointerId
  swipeTrail.value = []

  try {
    e.currentTarget?.setPointerCapture?.(e.pointerId)
  } catch (_) {}
}

function onSvgPointerMove(e) {
  if (interactMode.value === 'pan' || isSpacePressed.value) {
    hoveredNode.value = null
    return
  }

  // 1. 未按下按键时：执行悬浮节点碰撞高亮检测
  if (!gesture.isDown) {
    const pt = getSvgPoint(e)
    if (!pt) {
      hoveredNode.value = null
      return
    }
    hoveredNode.value = findBestNodeAtPoint(pt.x, pt.y)
    return
  }

  if (e.pointerId !== gesture.pointerId || gesture.mode !== 'touch') return
  const pt = getSvgPoint(e)
  if (!pt) return

  if (!gesture.isSwiping) {
    const dist = Math.hypot(e.clientX - gesture.startClientX, e.clientY - gesture.startClientY)
    if (dist < 8 || !beginTouch(gesture.startDevX, gesture.startDevY)) return
    gesture.isSwiping = true
    hoveredNode.value = null
    swipeTrail.value = [{ x: gesture.startDevX, y: gesture.startDevY }]
  }

  const now = performance.now()
  if (now - gesture.lastMoveTime >= 16) {
    gesture.lastMoveTime = now
    moveTouch(pt.x, pt.y)
  }
  swipeTrail.value.push(pt)
  if (swipeTrail.value.length > 25) swipeTrail.value.shift()
}

function onSvgPointerUp(e) {
  if (!gesture.isDown || e.pointerId !== gesture.pointerId) return
  gesture.isDown = false

  if (gesture.isSwiping) {
    gesture.isSwiping = false
    const pt = getSvgPoint(e)
    finishTouch(pt?.x, pt?.y)
    return
  }

  // 2. 如果未发生滑动（位移 < 8px），则为普通单点点击/选中
  swipeTrail.value = []
  const pt = getSvgPoint(e)
  if (!pt) return

  // 1) 精准命中叶子节点，并在右侧树与属性卡片展开联动展示
  const hitNode = findBestNodeAtPoint(pt.x, pt.y)
  if (hitNode) {
    selectNodeOnly(hitNode)
  }

  // 2) 模式判定：若为 select (选中审查模式)，绝不向真机下发点击事件！
  if (gesture.mode === 'select') {
    selectRipple.value = { x: pt.x, y: pt.y }
    setTimeout(() => {
      selectRipple.value = null
    }, 350)
    return
  }

  // 3) 若为 touch (触控模式)，向真机直通下发物理单点点击
  if (gesture.mode === 'touch') sendTouchAt(pt.x, pt.y)
}

function onSvgPointerCancel(e) {
  if (!gesture.isDown || e.pointerId !== gesture.pointerId) return
  gesture.isDown = false
  if (gesture.isSwiping) finishTouch()
  gesture.isSwiping = false
}

function onSvgMouseLeave() {
  if (!gesture.isDown) {
    hoveredNode.value = null
  }
}

// 模拟平滑滑动手势 (从 (startX, startY) 滑动到 (endX, endY)，时长 durationMs)
function performSwipeGesture(startX, startY, endX, endY, durationMs = 240) {
  if (!beginTouch(startX, startY)) return
  const touch = activeTouch
  const steps = Math.max(6, Math.round(durationMs / 20))
  swipeTrail.value = [{ x: startX, y: startY }]
  let step = 0
  touch.timer = setInterval(() => {
    const progress = ++step / steps
    if (step === steps) {
      finishTouch(endX, endY)
      return
    }
    const ease = 1 - (1 - progress) ** 2
    const x = Math.round(startX + (endX - startX) * ease)
    const y = Math.round(startY + (endY - startY) * ease)
    moveTouch(x, y)
    swipeTrail.value.push({ x, y })
  }, durationMs / steps)
}

// 快速向上滑 (模拟手指向上推，浏览下方内容)
function swipeUp() {
  const w = displayW.value
  const h = displayH.value
  performSwipeGesture(Math.round(w / 2), Math.round(h * 0.72), Math.round(w / 2), Math.round(h * 0.28), 240)
}

// 快速向下滑 (模拟手指向下拉，浏览上方内容/下拉刷新)
function swipeDown() {
  const w = displayW.value
  const h = displayH.value
  performSwipeGesture(Math.round(w / 2), Math.round(h * 0.28), Math.round(w / 2), Math.round(h * 0.72), 240)
}

// 选中节点并联动展开布局树 (严格杜绝向真机下发点击)
function selectNodeOnly(node) {
  if (!node) return
  selectedNode.value = node

  // 若当前处于仅画面模式，自动切为并列模式以展示展开的布局树与属性
  if (viewMode.value === 'canvas') {
    viewMode.value = 'split'
  }

  // 确保处于树形层级模式，直观展现展开后的 DOM 结构
  listDisplayMode.value = 'tree'

  revealNodeInTree(node)
}

// --- 树形层级展开/收起控制 ---

function toggleExpand(id) {
  const set = new Set(expandedNodeIds.value)
  if (set.has(id)) {
    set.delete(id)
  } else {
    set.add(id)
  }
  expandedNodeIds.value = set
}

function expandAll() {
  const set = new Set()
  if (snapshot.value?.nodes) {
    for (const n of snapshot.value.nodes) {
      set.add(n.id)
    }
  }
  expandedNodeIds.value = set
}

function collapseAll() {
  expandedNodeIds.value = new Set()
}

// 展开某个节点的所有祖先链及其自身子布局，并在 DOM 中居中滚动至可见
function revealNodeInTree(node) {
  if (!node) return
  const set = new Set(expandedNodeIds.value)
  let curr = node
  let changed = false
  let g = 0

  // 1. 展开其所有祖先节点
  while (curr && curr.parentId !== null && curr.parentId !== undefined && g < 50) {
    g++
    const p = nodeMap.value.get(curr.parentId)
    if (p && !set.has(p.id)) {
      set.add(p.id)
      changed = true
    }
    curr = p
  }

  // 2. 若选中节点自身拥有子节点，也将自身展开以呈现内部子控件布局
  const hasChildren = (childrenMap.value.get(node.id) || []).length > 0
  if (hasChildren && !set.has(node.id)) {
    set.add(node.id)
    changed = true
  }

  if (changed) {
    expandedNodeIds.value = set
  }

  nextTick(() => {
    const el = document.querySelector(`.node-tree-item[data-node-id="${node.id}"]`)
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.classList.add('flash-highlight')
      setTimeout(() => {
        el.classList.remove('flash-highlight')
      }, 800)
    }
  })
}

// 初始默认展开：默认展开前 3 层节点（root 深度 0, 1, 2）
function initDefaultExpanded() {
  const set = new Set()
  if (!snapshot.value?.nodes) return
  for (const n of snapshot.value.nodes) {
    const depth = nodeDepthMap.value.get(n.id) || 0
    if (depth <= 2) {
      set.add(n.id)
    }
  }
  expandedNodeIds.value = set
}

// 控件中心点按 (仅当用户点击属性卡片里的【👆 点击该控件】按钮时才调用)
function canStartTouch() {
  if (!props.visible || !snapshotReady.value || activeTouch || loading.value) return false
  if (performance.now() - snapshotReceivedAt <= 15000) return true
  fetchSnapshot()
  return false
}

function beginTouch(x, y) {
  if (!canStartTouch()) return false
  const send = props.webrtc?.sendTouchDirect
  const w = displayW.value
  const h = displayH.value
  if (!send?.(0, x, y, w, h, 0)) return false
  activeTouch = { send, w, h, x, y, timer: null }
  snapshotReady.value = false
  return true
}

function moveTouch(x, y) {
  if (!activeTouch) return
  const touch = activeTouch
  touch.x = x
  touch.y = y
  touch.send(2, x, y, touch.w, touch.h, 0)
}

function finishTouch(x, y, refresh = true) {
  if (!activeTouch) return
  const touch = activeTouch
  activeTouch = null
  clearInterval(touch.timer)
  touch.send(1, x ?? touch.x, y ?? touch.y, touch.w, touch.h, 0)
  swipeTrail.value = []
  clickRipple.value = null
  if (refresh) scheduleDebouncedRefresh(450)
}

function tapNode(node) {
  if (!node?.bounds || node.enabled === false) return
  const [left, top, right, bottom] = node.bounds
  const l = Math.max(0, left)
  const t = Math.max(0, top)
  const r = Math.min(displayW.value, right)
  const bottomEdge = Math.min(displayH.value, bottom)
  if (l >= r || t >= bottomEdge) return
  sendTouchAt(Math.floor((l + r) / 2), Math.floor((t + bottomEdge) / 2))
}

function sendTouchAt(x, y) {
  if (!beginTouch(x, y)) return
  clickRipple.value = { x, y }
  activeTouch.timer = setTimeout(() => finishTouch(), 50)
}

// 智能叶子节点碰撞检测 (优先匹配面积小、具体度高、可点击的子节点，避免全屏容器霸占命中)
function findBestNodeAtPoint(x, y) {
  if (!snapshot.value?.nodes) return null
  let best = null
  let minScore = Infinity

  for (const node of snapshot.value.nodes) {
    if (!node.bounds || node.bounds.length !== 4) continue
    const [l, t, r, b] = node.bounds
    if (x >= l && x <= r && y >= t && y <= b) {
      const w = r - l
      const h = b - t
      const area = w * h
      if (area <= 0) continue

      let weight = 1.0
      if (node.clickable) weight *= 0.5
      if (node.text) weight *= 0.6
      if (node.resourceId) weight *= 0.7
      if (node.checkable) weight *= 0.6
      // 纯大容器（无文本、无描述、不可点击、无ID）权重拉大，保证子节点优先胜出
      if (!node.text && !node.desc && !node.clickable && !node.resourceId && !node.checkable) {
        weight *= 4.0
      }

      const score = area * weight
      if (score < minScore) {
        minScore = score
        best = node
      }
    }
  }
  return best
}

function scheduleDebouncedRefresh(delay = 350) {
  if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer)
  refreshDebounceTimer = setTimeout(() => {
    if (props.visible) {
      fetchSnapshot()
    }
  }, delay)
}

function copyText(str, msg) {
  if (!str) return
  navigator.clipboard.writeText(str).then(() => {
    alert(msg)
  }).catch(() => {
    prompt('请按 Ctrl+C 复制:', str)
  })
}

function resetLayoutSession() {
  finishTouch(undefined, undefined, false)
  gesture.isDown = false
  gesture.isSwiping = false
  snapshotRequest?.abort()
  snapshotRequest = null
  loading.value = false
  snapshotReady.value = false
  snapshot.value = null
  selectedNode.value = null
  hoveredNode.value = null
  clearTimeout(refreshDebounceTimer)
  refreshDebounceTimer = null
}

watch([autoRefresh, () => props.visible], ([enabled, visible]) => {
  clearInterval(autoRefreshTimer)
  autoRefreshTimer = enabled && visible ? setInterval(fetchSnapshot, 3000) : null
})

watch([
  () => props.visible,
  () => props.deviceId,
  () => props.webrtc?.requestLayoutSnapshot,
  () => props.webrtc?.status?.value,
  () => props.webrtc?.layoutDisplayRevision?.value
], ([visible, , request, status]) => {
  resetLayoutSession()
  if (!visible) return
  bringToFront()
  if (!request || status === 'connected') fetchSnapshot()
  nextTick(updateViewportSize)
})

watch(interactMode, () => {
  if (gesture.isSwiping) finishTouch()
  gesture.isDown = false
  gesture.isSwiping = false
})

watch(viewMode, () => {
  nextTick(() => {
    updateViewportSize()
  })
})

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  // 监听视口大小变化
  if (windowBodyRef.value && typeof ResizeObserver !== 'undefined') {
    viewportResizeObserver = new ResizeObserver(() => {
      updateViewportSize()
    })
    viewportResizeObserver.observe(windowBodyRef.value)
  }

  if (props.visible) {
    fetchSnapshot()
    nextTick(() => {
      updateViewportSize()
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  if (viewportResizeObserver) {
    viewportResizeObserver.disconnect()
    viewportResizeObserver = null
  }
  clearInterval(autoRefreshTimer)
  resetLayoutSession()
})
</script>

<style scoped>
.layout-inspector-window {
  position: fixed;
  background: rgba(15, 23, 42, 0.96);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 12px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
  box-sizing: border-box;
}

.layout-inspector-window.is-maximized {
  border-radius: 6px;
}

.layout-inspector-window.is-mobile {
  border-radius: 0;
  border: none;
}

/* 顶部标题栏 */
.window-titlebar {
  height: 44px;
  padding: 0 14px;
  background: rgba(15, 23, 42, 0.88);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: move;
  user-select: none;
  flex-shrink: 0;
  gap: 8px;
}

.titlebar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.window-icon {
  font-size: 16px;
}

.window-title {
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
  white-space: nowrap;
}

.device-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.3);
  white-space: nowrap;
}

.display-badge, .node-count-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  color: #94a3b8;
  font-family: monospace;
  white-space: nowrap;
}

.titlebar-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  cursor: default;
}

.view-mode-tabs {
  display: flex;
  background: rgba(0, 0, 0, 0.45);
  padding: 2px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.tab-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 3px 8px;
  font-size: 11px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: #fff;
}

.tab-btn.active {
  background: rgba(56, 189, 248, 0.25);
  color: #38bdf8;
  font-weight: 600;
}

.auto-refresh-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #94a3b8;
  cursor: pointer;
  user-select: none;
}

.auto-refresh-label input {
  accent-color: #38bdf8;
  cursor: pointer;
}

.win-tool-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #e2e8f0;
  border-radius: 6px;
  padding: 0;
  width: 28px;
  height: 28px;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
  box-sizing: border-box;
}

.win-tool-btn .icon,
.win-tool-btn svg {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  display: block;
  flex-shrink: 0;
}

.win-tool-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.14);
  color: #38bdf8;
  border-color: rgba(56, 189, 248, 0.35);
}

.win-tool-btn.close-btn:hover {
  background: rgba(239, 68, 68, 0.25);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.5);
}

.win-tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

.error-banner {
  background: rgba(239, 68, 68, 0.15);
  border-bottom: 1px solid rgba(239, 68, 68, 0.3);
  padding: 6px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #fca5a5;
  flex-shrink: 0;
}

.retry-btn {
  background: rgba(239, 68, 68, 0.3);
  border: 1px solid rgba(239, 68, 68, 0.5);
  color: #fff;
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
}

/* 窗口主体区 */
.window-body {
  flex: 1;
  min-height: 0;
  display: flex;
  padding: 12px;
  gap: 0;
  overflow: hidden;
  box-sizing: border-box;
  position: relative;
}

/* 画布面板 */
.canvas-panel {
  height: 100%;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}

/* 垂直可拖动分割条 */
.split-divider {
  width: 12px;
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  flex-shrink: 0;
  transition: background 0.15s ease;
}

.split-divider:hover .divider-line {
  background: #38bdf8;
  box-shadow: 0 0 8px rgba(56, 189, 248, 0.8);
}

.divider-line {
  width: 2px;
  height: 48px;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 1px;
  transition: all 0.15s ease;
}

/* 悬浮工具栏 (手势模式与缩放) */
.canvas-zoom-toolbar {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
  display: flex;
  align-items: center;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 6px;
  padding: 3px 6px;
  gap: 4px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
}

.tool-mode-group {
  display: flex;
  background: rgba(0, 0, 0, 0.4);
  padding: 2px;
  border-radius: 4px;
}

.mode-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-btn:hover {
  color: #fff;
}

.mode-btn.active {
  background: rgba(56, 189, 248, 0.25);
  color: #38bdf8;
  font-weight: 600;
}

.tool-swipe-group {
  display: flex;
  gap: 3px;
}

.swipe-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #e2e8f0;
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.swipe-btn:hover {
  background: rgba(56, 189, 248, 0.2);
  border-color: rgba(56, 189, 248, 0.5);
  color: #38bdf8;
}

.swipe-btn:active {
  transform: translateY(1px);
}

.toolbar-divider {
  width: 1px;
  height: 14px;
  background: rgba(255, 255, 255, 0.14);
  margin: 0 2px;
}

.zoom-btn {
  background: transparent;
  border: none;
  color: #cbd5e1;
  font-size: 11px;
  padding: 3px 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.zoom-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.zoom-btn.fit-btn {
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  padding-left: 6px;
  color: #38bdf8;
}

.zoom-text {
  font-size: 11px;
  color: #38bdf8;
  font-family: monospace;
  font-weight: 600;
  padding: 0 4px;
  cursor: pointer;
}

/* 画布视口：自适应居中，平移与滚轮缩放 */
.canvas-viewport {
  flex: 1;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  padding: 16px;
  box-sizing: border-box;
}

.canvas-viewport.cursor-pan-ready {
  cursor: grab;
}

.canvas-viewport.cursor-panning {
  cursor: grabbing !important;
}

/* 手机机壳外框 (尺寸由 phoneBaseSize 精确驱动，绝对保真) */
.phone-canvas-wrapper {
  background: #020617;
  border-radius: 18px;
  border: 2px solid #334155;
  box-shadow: 0 20px 48px -8px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.05);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  flex-shrink: 0;
  transition: transform 0.06s ease-out;
}

/* 顶部刘海/圆孔装饰 */
.notch-decor {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  z-index: 5;
  pointer-events: none;
}

.layout-svg {
  width: 100%;
  height: 100%;
  display: block;
  cursor: crosshair; /* 精准准星标尺，提示可直接点按落屏 */
  touch-action: none; /* 接管所有原生指针与滑动事件 */
}

.canvas-viewport.cursor-pan-ready .layout-svg {
  cursor: grab !important;
}

.canvas-viewport.cursor-panning .layout-svg {
  cursor: grabbing !important;
}

.svg-node {
  fill: transparent;
  stroke: rgba(255, 255, 255, 0.15);
  stroke-width: 1.2;
  transition: all 0.1s ease;
  pointer-events: none; /* 让所有子图形穿透，由 SVG 原生矩阵统一计算精确坐标与碰撞，彻底消除大容器遮挡 */
}

.svg-node.is-clickable {
  stroke: #38bdf8;
  stroke-width: 1.8;
  fill: rgba(56, 189, 248, 0.1);
}

.svg-node.is-checkable {
  stroke: #f59e0b;
}

.svg-node.is-container {
  stroke-dasharray: 4 2;
}

.svg-node.is-hovered {
  stroke: #60a5fa !important;
  stroke-width: 2.8 !important;
  fill: rgba(96, 165, 250, 0.22) !important;
}

.svg-node.is-selected {
  stroke: #ec4899 !important;
  stroke-width: 3.8 !important;
  fill: rgba(236, 72, 153, 0.3) !important;
}

.node-text {
  fill: #e2e8f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: 500;
  paint-order: stroke fill;
  stroke: rgba(2, 6, 23, 0.85);
  stroke-width: 3px;
  stroke-linejoin: round;
  pointer-events: none;
  user-select: none;
}

.node-text.interactive-text {
  fill: #7dd3fc;
  font-weight: 600;
}

.switch-pill {
  transition: fill 0.2s ease;
}

.switch-text {
  fill: #ffffff;
  font-size: 11px;
  font-weight: bold;
  font-family: sans-serif;
}

.select-ripple {
  fill: rgba(56, 189, 248, 0.22);
  stroke: #38bdf8;
  stroke-width: 2.2;
  animation: selectRippleOut 0.35s ease-out forwards;
}

@keyframes selectRippleOut {
  from { r: 6; opacity: 1; }
  to { r: 38; opacity: 0; }
}

.click-ripple {
  fill: rgba(236, 72, 153, 0.4);
  stroke: #ec4899;
  stroke-width: 2.5;
  animation: rippleOut 0.4s ease-out forwards;
}

@keyframes rippleOut {
  from { r: 8; opacity: 1; }
  to { r: 42; opacity: 0; }
}

/* 滑动手势轨迹动效 */
.swipe-trail-layer {
  pointer-events: none;
}

.swipe-trail-glow {
  fill: none;
  stroke: rgba(56, 189, 248, 0.35);
  stroke-width: 14;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.swipe-trail-core {
  fill: none;
  stroke: #38bdf8;
  stroke-width: 3.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 0 4px rgba(56, 189, 248, 0.9));
}

.swipe-point-start {
  fill: #38bdf8;
  stroke: #ffffff;
  stroke-width: 2.5;
  filter: drop-shadow(0 0 4px rgba(56, 189, 248, 0.9));
}

.swipe-point-end {
  fill: #f43f5e;
  stroke: #ffffff;
  stroke-width: 2.5;
  filter: drop-shadow(0 0 6px rgba(244, 63, 94, 0.9));
  animation: pulsePoint 0.5s infinite alternate;
}

@keyframes pulsePoint {
  from { r: 8; opacity: 0.85; }
  to { r: 11; opacity: 1; }
}

/* 属性详情面板 */
.details-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  box-sizing: border-box;
  padding-left: 8px;
}

.filter-bar {
  position: relative;
  flex-shrink: 0;
}

.filter-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 7px 28px 7px 10px;
  color: #fff;
  font-size: 12px;
  outline: none;
  box-sizing: border-box;
}

.filter-input:focus {
  border-color: #38bdf8;
}

.clear-filter-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 11px;
}

.node-detail-card {
  background: rgba(30, 41, 59, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

/* 节点层级面包屑 */
.node-breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  overflow-x: auto;
  white-space: nowrap;
}

.bc-label {
  color: #64748b;
  font-size: 10px;
  flex-shrink: 0;
}

.bc-trail {
  display: flex;
  align-items: center;
  gap: 4px;
}

.bc-item {
  color: #94a3b8;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: color 0.15s ease;
}

.bc-item:hover {
  color: #38bdf8;
  text-decoration: underline;
}

.bc-item.current {
  color: #ec4899;
  font-weight: 600;
  cursor: default;
  text-decoration: none;
}

.bc-sep {
  color: #475569;
  font-size: 10px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 6px;
  margin-bottom: 4px;
}

.node-class-name {
  font-size: 13px;
  font-weight: 600;
  color: #38bdf8;
}

.header-badges {
  display: flex;
  align-items: center;
  gap: 6px;
}

.node-depth-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.12);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.25);
  font-family: monospace;
}

.node-id-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
}

.detail-row {
  display: flex;
  gap: 6px;
  font-size: 11px;
  align-items: baseline;
}

.detail-label {
  color: #94a3b8;
  flex-shrink: 0;
  width: 80px;
}

.detail-value {
  color: #e2e8f0;
  word-break: break-all;
}

.text-mono {
  font-family: monospace;
}

.text-accent {
  color: #a78bfa;
}

.text-strong {
  font-weight: 600;
  color: #f1f5f9;
}

.flag-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.flag-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
}

.flag-badge.active {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.3);
}

.flag-badge.info {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
}

.flag-badge.warn {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.btn-copy {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-copy:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

.tap-btn {
  background: rgba(236, 72, 153, 0.2);
  border: 1px solid rgba(236, 72, 153, 0.4);
  color: #f472b6;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
}

.tap-btn:hover {
  background: rgba(236, 72, 153, 0.35);
  color: #fff;
}

.no-selection-hint {
  padding: 20px 14px;
  text-align: center;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  color: #64748b;
  font-size: 11px;
  flex-shrink: 0;
}

.nodes-list-container {
  flex: 1;
  min-height: 140px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  gap: 8px;
}

.list-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
}

.count-tag {
  color: #64748b;
  font-size: 10px;
  font-weight: normal;
  font-family: monospace;
}

.list-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.list-tool-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.list-tool-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #38bdf8;
}

.list-tool-btn.mode-switch-btn {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border-color: rgba(56, 189, 248, 0.3);
}

/* 树形列表与扁平列表容器 */
.tree-nodes-list, .flat-nodes-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

/* 树形单行节点 */
.node-tree-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 6px 3px 0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.1s ease;
  position: relative;
  user-select: none;
}

.node-tree-item:hover, .node-tree-item.is-hovered {
  background: rgba(255, 255, 255, 0.08);
}

.node-tree-item.active {
  background: rgba(236, 72, 153, 0.22);
  border: 1px solid rgba(236, 72, 153, 0.45);
  color: #f472b6;
}

.node-tree-item.flash-highlight {
  animation: flashTreeHighlight 0.8s ease-out;
}

@keyframes flashTreeHighlight {
  0% {
    background-color: rgba(56, 189, 248, 0.45);
    box-shadow: 0 0 12px rgba(56, 189, 248, 0.7);
    color: #ffffff;
  }
  100% {
    background-color: rgba(236, 72, 153, 0.22);
    box-shadow: none;
  }
}

.tree-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: #94a3b8;
  cursor: pointer;
  margin-right: 2px;
  transition: transform 0.15s ease;
}

.tree-arrow:hover {
  color: #38bdf8;
}

.tree-arrow .arrow-svg {
  width: 10px;
  height: 10px;
  transition: transform 0.15s ease;
}

.tree-arrow.expanded .arrow-svg {
  transform: rotate(90deg);
}

.tree-arrow.leaf {
  cursor: default;
  opacity: 0.35;
}

.leaf-dot {
  font-size: 8px;
}

.tree-item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.children-badge {
  font-size: 9px;
  color: #64748b;
  font-family: monospace;
}

.item-depth-badge {
  font-size: 9px;
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  color: #94a3b8;
  font-family: monospace;
  margin-right: 4px;
}

.empty-filter-hint {
  padding: 24px 10px;
  text-align: center;
  color: #64748b;
  font-size: 11px;
}

.node-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  transition: background 0.1s ease;
}

.node-list-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.node-list-item.active {
  background: rgba(236, 72, 153, 0.22);
  border: 1px solid rgba(236, 72, 153, 0.45);
  color: #f472b6;
}

.item-main {
  display: flex;
  gap: 6px;
  align-items: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-class {
  color: #94a3b8;
  font-family: monospace;
}

.item-text {
  color: #f1f5f9;
  font-weight: 500;
}

.item-res {
  color: #a78bfa;
  font-size: 10px;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #38bdf8;
}

.item-bounds {
  font-size: 10px;
  color: #64748b;
  font-family: monospace;
}

.more-nodes-hint {
  font-size: 10px;
  color: #64748b;
  text-align: center;
  padding: 8px 0;
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  color: #94a3b8;
  font-size: 12px;
  gap: 10px;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(56, 189, 248, 0.2);
  border-top-color: #38bdf8;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.primary-btn {
  background: #0284c7;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 12px;
  cursor: pointer;
}

.primary-btn:hover {
  background: #0369a1;
}

/* 8 方向全向调整拉伸边缘 */
.win-resize-edge {
  position: absolute;
  z-index: 1003;
}
.win-resize-edge.edge-top {
  top: 0;
  left: 0;
  width: 100%;
  height: 7px;
  cursor: ns-resize;
}
.win-resize-edge.edge-bottom {
  bottom: 0;
  left: 0;
  width: 100%;
  height: 7px;
  cursor: ns-resize;
}
.win-resize-edge.edge-left {
  top: 0;
  left: 0;
  width: 7px;
  height: 100%;
  cursor: ew-resize;
}
.win-resize-edge.edge-right {
  top: 0;
  right: 0;
  width: 7px;
  height: 100%;
  cursor: ew-resize;
}

.win-resize-corner {
  position: absolute;
  width: 16px;
  height: 16px;
  z-index: 1004;
}
.win-resize-corner.corner-tl {
  top: 0;
  left: 0;
  cursor: nwse-resize;
}
.win-resize-corner.corner-tr {
  top: 0;
  right: 0;
  cursor: nesw-resize;
}
.win-resize-corner.corner-bl {
  bottom: 0;
  left: 0;
  cursor: nesw-resize;
}
.win-resize-corner.corner-br {
  bottom: 0;
  right: 0;
  cursor: nwse-resize;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}
</style>
