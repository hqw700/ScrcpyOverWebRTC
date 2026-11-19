<template>
  <Teleport to="body">
    <dialog ref="dialog" class="projection-exit" aria-labelledby="projection-exit-title"
      @cancel.prevent="choose('cancel')">
      <h2 id="projection-exit-title">{{ $t('deviceClient.projectionExitTitle') }}</h2>
      <p>{{ $t(canResume ? 'deviceClient.projectionExitChoices' : 'deviceClient.projectionExitPending') }}</p>
      <div class="actions">
        <button type="button" autofocus @click="choose('cancel')">{{ $t('common.cancel') }}</button>
        <button v-if="canResume" type="button" class="temporary" @click="choose('temporary')">
          {{ $t('deviceClient.projectionLeaveTemporarily') }}
        </button>
        <button type="button" class="end" @click="choose('end')">
          {{ $t(canResume ? 'deviceClient.projectionEndSharing' : 'deviceClient.projectionCancelRequest') }}
        </button>
      </div>
    </dialog>
  </Teleport>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useDeviceStore } from '@/stores/devices'

const store = useDeviceStore()
const dialog = ref(null)
const canResume = computed(() => store.projectionExitOptions?.canResume === true)

function choose(choice) {
  store.resolveProjectionExit(choice)
}

watch([dialog, () => store.projectionExitOptions], ([element, options]) => {
  if (!element) return
  if (options && !element.open) element.showModal()
  if (!options && element.open) element.close()
}, { flush: 'post' })

onUnmounted(() => {
  if (store.projectionExitOptions) choose('cancel')
})
</script>

<style scoped>
.projection-exit {
  width: min(420px, calc(100vw - 32px));
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
  padding: 20px;
  border: 1px solid var(--border, #30363d);
  border-radius: 12px;
  background: var(--bg-secondary, #161b22);
  color: #e6edf3;
}
.projection-exit::backdrop { background: rgb(0 0 0 / 60%); }
h2 { text-align: center; margin: 0 0 8px; font-size: 18px; }
p { text-align: center; margin: 0 0 18px; line-height: 1.5; color: #adbac7; }
.actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
button {
  flex-shrink: 0;
  padding: 7px 12px;
  border: 1px solid #454c55;
  border-radius: 6px;
  color: inherit;
  background: #21262d;
  cursor: pointer;
}
.temporary { border-color: #539bf5; color: #a5d6ff; }
.end { border-color: #da3633; color: #ff9b99; }
</style>
