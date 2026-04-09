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
    path: '/device/:deviceId',
    name: 'DeviceDetail',
    components: {
      default: () => import('@/views/DeviceList.vue'),
      panel: () => import('@/views/DeviceClient.vue')
    }
  },
  {
    path: '/deploy',
    name: 'Deploy',
    components: {
      default: () => import('@/views/DeployPage.vue')
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
