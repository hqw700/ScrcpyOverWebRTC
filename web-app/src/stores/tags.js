import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const STORAGE_KEY = 'cloudphone_device_tags_v1'

export const DEFAULT_TAG_COLORS = [
  '#38bdf8',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#a78bfa',
  '#14b8a6',
  '#f97316',
  '#e879f9'
]

function normalizeName(name) {
  return String(name || '').trim()
}

function normalizeColor(color) {
  const value = String(color || '').trim()
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : DEFAULT_TAG_COLORS[0]
}

function uniqueIds(ids, allowedIds) {
  if (!Array.isArray(ids)) return []
  const seen = new Set()
  return ids
    .filter(id => typeof id === 'string' && allowedIds.has(id) && !seen.has(id) && seen.add(id))
}

function createTagId() {
  return `tag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export const useTagStore = defineStore('deviceTags', () => {
  const tags = ref([])
  const deviceTags = ref({})
  const selectedTagIds = ref([])

  const tagMap = computed(() => {
    const map = new Map()
    for (const tag of tags.value) {
      map.set(tag.id, tag)
    }
    return map
  })

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tags: tags.value,
      deviceTags: deviceTags.value
    }))
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return

      const parsed = JSON.parse(raw)
      const normalizedTags = Array.isArray(parsed?.tags)
        ? parsed.tags
          .map(tag => ({
            id: typeof tag.id === 'string' && tag.id ? tag.id : createTagId(),
            name: normalizeName(tag.name),
            color: normalizeColor(tag.color)
          }))
          .filter(tag => tag.name)
        : []

      const tagIds = new Set(normalizedTags.map(tag => tag.id))
      const normalizedDeviceTags = {}
      if (parsed?.deviceTags && typeof parsed.deviceTags === 'object') {
        for (const [deviceId, ids] of Object.entries(parsed.deviceTags)) {
          if (typeof deviceId !== 'string' || !deviceId) continue
          const filteredIds = uniqueIds(ids, tagIds)
          if (filteredIds.length > 0) {
            normalizedDeviceTags[deviceId] = filteredIds
          }
        }
      }

      tags.value = normalizedTags
      deviceTags.value = normalizedDeviceTags
    } catch (e) {
      tags.value = []
      deviceTags.value = {}
    }
  }

  async function load() {
    // 标签为管理员专属的平台运营分组信息：非管理员清空本地缓存并跳过拉取
    // （后端 GET/POST /api/tags 均已收口 requireAdmin，这里避免本地残留旧标签继续展示）
    if (localStorage.getItem('auth_role') !== 'admin') {
      tags.value = []
      deviceTags.value = {}
      selectedTagIds.value = []
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    loadLocal() // 优先使用本地数据快速启动

    try {
      const token = localStorage.getItem('auth_token') || ''
      const res = await fetch('/api/tags', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      })
      if (res.ok) {
        const data = await res.json()
        tags.value = data.tags || []
        deviceTags.value = data.deviceTags || {}
        persist()
      }
    } catch (e) {
      console.error('[Tags] Failed to load tags from server:', e)
    }
  }

  async function saveAndSync() {
    if (localStorage.getItem('auth_role') !== 'admin') return // 标签写入仅管理员
    persist()

    try {
      const token = localStorage.getItem('auth_token') || ''
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          tags: tags.value,
          deviceTags: deviceTags.value
        })
      })
      if (!res.ok) {
        console.error('[Tags] Failed to save tags:', res.statusText)
      }
    } catch (e) {
      console.error('[Tags] Failed to sync tags to server:', e)
    }
  }

  function updateTagsFromRemote(remoteTags, remoteDeviceTags) {
    tags.value = remoteTags || []
    deviceTags.value = remoteDeviceTags || {}
    persist()
  }

  function tagNameExists(name, excludeId = '') {
    const normalized = normalizeName(name).toLowerCase()
    if (!normalized) return false
    return tags.value.some(tag => tag.id !== excludeId && tag.name.toLowerCase() === normalized)
  }

  async function createTag(name, color = DEFAULT_TAG_COLORS[0]) {
    const normalized = normalizeName(name)
    if (!normalized || tagNameExists(normalized)) return null

    const tag = {
      id: createTagId(),
      name: normalized,
      color: normalizeColor(color)
    }
    tags.value.push(tag)
    await saveAndSync()
    return tag
  }

  async function updateTag(id, updates) {
    const tag = tags.value.find(item => item.id === id)
    if (!tag) return false

    const name = normalizeName(updates?.name ?? tag.name)
    if (!name || tagNameExists(name, id)) return false

    tag.name = name
    tag.color = normalizeColor(updates?.color ?? tag.color)
    await saveAndSync()
    return true
  }

  async function deleteTag(id) {
    tags.value = tags.value.filter(tag => tag.id !== id)
    const nextDeviceTags = {}
    for (const [deviceId, ids] of Object.entries(deviceTags.value)) {
      const nextIds = ids.filter(tagId => tagId !== id)
      if (nextIds.length > 0) {
        nextDeviceTags[deviceId] = nextIds
      }
    }
    deviceTags.value = nextDeviceTags
    await saveAndSync()
  }

  function getTagIdsForDevice(deviceId) {
    return Array.isArray(deviceTags.value[deviceId]) ? [...deviceTags.value[deviceId]] : []
  }

  function getTagsForDevice(deviceId) {
    return getTagIdsForDevice(deviceId)
      .map(id => tagMap.value.get(id))
      .filter(Boolean)
  }

  function setDeviceTagsInMemory(deviceId, tagIds) {
    if (!deviceId) return
    const allowedIds = new Set(tags.value.map(tag => tag.id))
    const nextIds = uniqueIds(tagIds, allowedIds)
    const nextDeviceTags = { ...deviceTags.value }

    if (nextIds.length > 0) {
      nextDeviceTags[deviceId] = nextIds
    } else {
      delete nextDeviceTags[deviceId]
    }

    deviceTags.value = nextDeviceTags
    persist()
  }

  async function setDeviceTags(deviceId, tagIds) {
    setDeviceTagsInMemory(deviceId, tagIds)
    await saveAndSync()
  }

  async function toggleDeviceTag(deviceId, tagId) {
    if (!deviceId || !tagMap.value.has(tagId)) return

    const current = getTagIdsForDevice(deviceId)
    if (current.includes(tagId)) {
      await setDeviceTags(deviceId, current.filter(id => id !== tagId))
    } else {
      await setDeviceTags(deviceId, [...current, tagId])
    }
  }

  function setSelectedTag(id) {
    if (!id) {
      selectedTagIds.value = []
    } else if (tagMap.value.has(id)) {
      selectedTagIds.value = [id]
    }
  }

  function toggleSelectedTag(id) {
    if (!tagMap.value.has(id)) return
    const index = selectedTagIds.value.indexOf(id)
    if (index > -1) {
      selectedTagIds.value.splice(index, 1)
    } else {
      selectedTagIds.value.push(id)
    }
  }

  function clearSelectedTags() {
    selectedTagIds.value = []
  }

  // load() - 移去初始化时立即执行，改由 App.vue 中在 isLoggedIn 确定时触发

  return {
    tags,
    deviceTags,
    selectedTagIds,
    tagNameExists,
    createTag,
    updateTag,
    deleteTag,
    getTagIdsForDevice,
    getTagsForDevice,
    setDeviceTagsInMemory,
    setDeviceTags,
    toggleDeviceTag,
    setSelectedTag,
    toggleSelectedTag,
    clearSelectedTags,
    saveAndSync,
    updateTagsFromRemote,
    load
  }
})
