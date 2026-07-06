import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    components: {
      default: () => import('@/views/DeviceList.vue')
    }
  },
  {
    path: '/deploy',
    name: 'Deploy',
    components: {
      default: () => import('@/views/DeployPage.vue')
    }
  },
  {
    path: '/monitor',
    name: 'Monitor',
    components: {
      default: () => import('@/views/Dashboard.vue')
    }
  },
  {
    path: '/advanced',
    name: 'Advanced',
    components: {
      default: () => import('@/views/AdvancedPage.vue')
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
