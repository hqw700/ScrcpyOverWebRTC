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

const isPosition = (pos) => Number.isFinite(pos?.x) && Number.isFinite(pos?.y)

function hasProfileFields(profile) {
  return typeof profile?.id === 'string' && typeof profile.name === 'string' &&
    Array.isArray(profile.mappings)
}

export function isValidProfile(profile) {
  return hasProfileFields(profile) && profile.mappings.every(isValidMapping)
}

function isValidMapping(mapping) {
  if (typeof mapping?.id !== 'string') return false
  switch (mapping.type) {
    case 'tap':
      return typeof mapping.key === 'string' && isPosition(mapping.pos)
    case 'swipe':
      return typeof mapping.key === 'string' && isPosition(mapping.startPos) && isPosition(mapping.endPos)
    case 'joystick':
      return ['up', 'down', 'left', 'right'].every(dir => typeof mapping.keys?.[dir] === 'string') &&
        isPosition(mapping.center) && Number.isFinite(mapping.radius)
    case 'wheel':
      return ['scroll', 'zoom'].includes(mapping.action) && isPosition(mapping.pos)
    case 'command':
      return typeof mapping.key === 'string' && typeof mapping.cmd === 'string'
    default:
      return false
  }
}

export const useKeymapStore = defineStore('keymap', {
  state: () => {
    let data = structuredClone(DEFAULT_CONFIG)
    try {
      const stored = localStorage.getItem('cloudphone_keymap')
      if (stored) {
        const config = JSON.parse(stored)
        const profiles = Array.isArray(config?.profiles)
          ? config.profiles.filter(hasProfileFields).map(profile => ({
              ...profile,
              mappings: profile.mappings.filter(isValidMapping)
            }))
          : []
        if (profiles.length) data = { ...config, profiles }
      }
    } catch (e) {
      console.warn('Failed to load keymap config', e)
    }
    return {
      config: data,
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
