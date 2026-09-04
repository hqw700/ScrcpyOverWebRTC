import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useDeviceStore } from './devices'

export const useGroupControlStore = defineStore('groupControl', () => {
  const isGroupControlActive = ref(false)
  const masterId = ref(null)
  const selectedSlaveIds = ref([])

  function toggleGroupControl(active, mId = null) {
    const deviceStore = useDeviceStore()
    isGroupControlActive.value = active !== undefined ? active : !isGroupControlActive.value
    if (isGroupControlActive.value) {
      masterId.value = mId
      deviceStore.globalPreviewMode = true
    } else {
      masterId.value = null
      clearSlaves()
      deviceStore.globalPreviewMode = false
    }
  }

  function selectSlave(id) {
    if (id === masterId.value) return
    if (!selectedSlaveIds.value.includes(id)) {
      selectedSlaveIds.value.push(id)
    }
  }

  function deselectSlave(id) {
    selectedSlaveIds.value = selectedSlaveIds.value.filter(slaveId => slaveId !== id)
  }

  function toggleSlave(id) {
    if (id === masterId.value) return
    if (selectedSlaveIds.value.includes(id)) {
      deselectSlave(id)
    } else {
      selectSlave(id)
    }
  }

  function clearSlaves() {
    selectedSlaveIds.value = []
  }

  function selectAllOnline(devices) {
    const onlineIds = devices
      .filter(d => d.status === 'online' && d.id !== masterId.value)
      .map(d => d.id)
    selectedSlaveIds.value = onlineIds
  }

  function selectByTag(tagId, devices, tagStore) {
    const onlineDevices = devices.filter(d => d.status === 'online' && d.id !== masterId.value)
    const matchingIds = onlineDevices
      .filter(d => {
        const deviceTags = tagStore.getTagsForDevice(d.id)
        return deviceTags.some(t => t.id === tagId)
      })
      .map(d => d.id)

    // 合并勾选，避免重复
    matchingIds.forEach(id => selectSlave(id))
  }

  return {
    isGroupControlActive,
    masterId,
    selectedSlaveIds,
    toggleGroupControl,
    selectSlave,
    deselectSlave,
    toggleSlave,
    clearSlaves,
    selectAllOnline,
    selectByTag
  }
})
