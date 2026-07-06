import { defineStore } from 'pinia'

const DEFAULT_CONFIG = {
  activeProfileId: 'default',
  profiles: [
    {
      id: 'default',
      name: 'Default Profile',
      mappings: []
    }
  ]
}

export const useKeymapStore = defineStore('keymap', {
  state: () => {
    let data = DEFAULT_CONFIG
    try {
      const stored = localStorage.getItem('cloudphone_keymap')
      if (stored) {
        data = JSON.parse(stored)
        // 自动将默认 default 配置清空 mappings (如果包含系统预置的 'm_1'/'m_2'/'m_3')
        const defProfile = data.profiles?.find(p => p.id === 'default')
        if (defProfile && defProfile.mappings && defProfile.mappings.some(m => m.id === 'm_1' || m.id === 'm_2' || m.id === 'm_3')) {
          defProfile.mappings = []
          localStorage.setItem('cloudphone_keymap', JSON.stringify(data))
        }
      }
    } catch (e) {
      console.warn('Failed to load keymap config', e)
    }
    return {
      config: data,
      isEditMode: false,
      showKeyHints: false
    }
  },
  getters: {
    activeProfile(state) {
      return state.config.profiles.find(p => p.id === state.config.activeProfileId) || state.config.profiles[0]
    }
  },
  actions: {
    save() {
      localStorage.setItem('cloudphone_keymap', JSON.stringify(this.config))
    },
    setActiveProfile(id) {
      this.config.activeProfileId = id
      this.save()
    },
    updateProfile(profile) {
      const index = this.config.profiles.findIndex(p => p.id === profile.id)
      if (index !== -1) {
        this.config.profiles[index] = profile
        this.save()
      }
    },
    setEditMode(mode) {
      this.isEditMode = mode
    },
    toggleKeyHints() {
      this.showKeyHints = !this.showKeyHints
    },
    addProfile(name) {
      const newProfile = {
        id: 'p_' + Date.now(),
        name: name || 'New Profile',
        mappings: []
      }
      this.config.profiles.push(newProfile)
      this.config.activeProfileId = newProfile.id
      this.save()
      return newProfile
    },
    renameProfile(id, newName) {
      const profile = this.config.profiles.find(p => p.id === id)
      if (profile && newName) {
        profile.name = newName
        this.save()
      }
    },
    deleteProfile(id) {
      if (this.config.profiles.length <= 1) return // Must have at least one profile
      this.config.profiles = this.config.profiles.filter(p => p.id !== id)
      if (this.config.activeProfileId === id) {
        this.config.activeProfileId = this.config.profiles[0].id
      }
      this.save()
    },
    importProfile(profile) {
      this.config.profiles.push(profile)
      this.config.activeProfileId = profile.id
      this.save()
    }
  }
})
