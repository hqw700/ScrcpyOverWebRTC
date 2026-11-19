<template>
  <div 
    class="connection-logo" 
    :style="containerStyle"
    role="img"
    :aria-label="ariaLabel || $t('deviceClient.establishingConn')"
  >
    <svg 
      viewBox="0 0 1024 1024" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      class="connection-svg"
    >
      <defs>
        <linearGradient :id="gradId" x1="140" y1="0" x2="920" y2="800" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#1671FF" />
          <stop offset="100%" stop-color="#12D9BC" />
        </linearGradient>
      </defs>

      <!-- 1. 底层静止云朵轮廓线描 (blue 16% alpha, Stroke 14) -->
      <path
        class="cloud-bg"
        d="M284 776C157 776 92 689 92 584c0-111 83-196 193-200 28-139 139-225 269-225 151 0 257 116 265 247 106 1 177 83 177 185 0 110-89 185-204 185Z"
      />

      <!-- 2. 动态渐变描边轨迹 (blue -> mint, Stroke 14, 随 reveal 环绕画线) -->
      <path
        class="cloud-trace"
        :stroke="`url(#${gradId})`"
        d="M284 776C157 776 92 689 92 584c0-111 83-196 193-200 28-139 139-225 269-225 151 0 257 116 265 247 106 1 177 83 177 185 0 110-89 185-204 185Z"
      />

      <!-- 3. 云朵实体填充 (在 reveal 达到 0.45 ~ 0.85 之间随 fill 渐显) -->
      <path
        class="cloud-fill"
        fill="#1671FF"
        d="M284 776C157 776 92 689 92 584c0-111 83-196 193-200 28-139 139-225 269-225 151 0 257 116 265 247 106 1 177 83 177 185 0 110-89 185-204 185Z"
      />
      <path
        class="cloud-teal"
        fill="#12D9BC"
        d="M762 388c135-17 234 73 234 198 0 117-85 190-201 190H663c-48-40-60-106-47-167 14-69 59-185 146-221Z"
      />

      <!-- 4. 浮动手机层 (常驻线描 + 动态实体填充) -->
      <g class="phone-motion">
        <!-- 手机底衬与白色底板 (随 fill 渐显) -->
        <g class="phone-fade">
          <rect x="362" y="296" width="345" height="525" rx="63" ry="63" fill="#BBDFFF" />
          <rect x="350" y="280" width="345" height="525" rx="63" ry="63" fill="#FFFFFF" />
        </g>

        <!-- 手机线描轮廓 (Stroke 12, #DBEEFF, 初始即常驻可见，构成第一阶段的完整线描) -->
        <rect x="350" y="280" width="345" height="525" rx="63" ry="63" class="phone-frame-stroke" />

        <!-- 内部屏幕与播放按键 (随 fill 渐显) -->
        <g class="phone-fade">
          <rect x="383" y="315" width="279" height="445" rx="43" ry="43" fill="#125DF5" />
          <path d="M486 480 L486 596 L585 538 Z" fill="#FFFFFF" />
        </g>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'

let seed = 0

const props = defineProps({
  size: {
    type: [Number, String],
    default: 120
  },
  duration: {
    type: [Number, String],
    default: 1.5
  },
  ariaLabel: {
    type: String,
    default: ''
  }
})

const gradId = `conn_trace_grad_${++seed}`

const containerStyle = computed(() => {
  const s = typeof props.size === 'number' ? `${props.size}px` : props.size
  const d = typeof props.duration === 'number' ? `${props.duration}s` : props.duration
  return {
    width: s,
    height: s,
    '--conn-duration': d
  }
})
</script>

<style scoped>
.connection-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  pointer-events: none;
}

.connection-svg {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}

/* 底层云朵线描基线 (16% 透明度) */
.cloud-bg {
  stroke: #1671FF;
  stroke-opacity: 0.16;
  stroke-width: 14;
  fill: none;
}

/* 动态描边轨迹 (1.5s FastOutSlowInEasing 反向循环) */
.cloud-trace {
  stroke-width: 14;
  stroke-linecap: round;
  fill: none;
  stroke-dasharray: 2500;
  animation: connTrace var(--conn-duration, 1.5s) cubic-bezier(0.4, 0, 0.2, 1) infinite alternate;
  will-change: stroke-dashoffset;
}

@keyframes connTrace {
  0% {
    stroke-dashoffset: 2500;
    opacity: 0;
  }
  1% {
    opacity: 1;
  }
  100% {
    stroke-dashoffset: 0;
    opacity: 1;
  }
}

/* 手机常驻线描边框：不随 fill 消失，开局与云朵线描共同构成线描初态 */
.phone-frame-stroke {
  fill: none;
  stroke: #DBEEFF;
  stroke-width: 12;
}

/* 实体填充层 (在 reveal 达到 0.45 ~ 0.85 之间随 fill 渐显) */
.cloud-fill,
.cloud-teal,
.phone-fade {
  animation: connFillFade var(--conn-duration, 1.5s) linear infinite alternate;
  will-change: opacity;
}

@keyframes connFillFade {
  0%, 33.1% {
    opacity: 0;
  }
  35% {
    opacity: 0.125;
  }
  40% {
    opacity: 0.409;
  }
  45% {
    opacity: 0.636;
  }
  50% {
    opacity: 0.814;
  }
  55% {
    opacity: 0.954;
  }
  56.9%, 100% {
    opacity: 1;
  }
}

/* 手机位移、倾斜与缩放成型动效 (88px -> 0, 0° -> -13°, 0.78/0.66 -> 1.0) */
.phone-motion {
  transform-box: view-box;
  transform-origin: 50.78125% 53.22265625%;
  animation: connPhoneMotion var(--conn-duration, 1.5s) cubic-bezier(0.4, 0, 0.2, 1) infinite alternate;
  will-change: transform;
}

@keyframes connPhoneMotion {
  0% {
    transform: translate(0, 8.59375%) rotate(0deg) scale(0.78, 0.66);
  }
  100% {
    transform: translate(0, 0) rotate(-13deg) scale(1, 1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cloud-trace,
  .cloud-fill,
  .cloud-teal,
  .phone-motion,
  .phone-fade {
    animation: none;
    opacity: 1;
    transform: translate(0, 0) rotate(-13deg) scale(1, 1);
    stroke-dashoffset: 0;
  }
}
</style>
