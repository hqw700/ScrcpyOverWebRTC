import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// meta.public: 免登录页面（登录页 / 访客分享页），App.vue 中以裸 router-view 渲染
// meta.adminOnly: 仅管理员可访问，普通用户访问时由全局守卫重定向回首页
// meta.title: 顶栏页面主标题
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { public: true, title: '安全登录' }
  },
  {
    path: '/',
    name: 'DeviceList',
    component: () => import('@/views/DeviceList.vue'),
    meta: { title: '云虚机矩阵' }
  },
  {
    path: '/files',
    name: 'Files',
    component: () => import('@/views/FileManagerPage.vue'),
    meta: { title: '云设备文件中心' }
  },
  {
    path: '/deploy',
    name: 'Deploy',
    component: () => import('@/views/DeployPage.vue'),
    meta: { adminOnly: true, title: '云端自动化部署' }
  },
  {
    path: '/monitor',
    name: 'Monitor',
    component: () => import('@/views/Dashboard.vue'),
    meta: { adminOnly: true, title: '云监控实时大盘' }
  },
  {
    path: '/advanced',
    name: 'Advanced',
    component: () => import('@/views/AdvancedPage.vue'),
    meta: { adminOnly: true, title: '定制外设模拟' }
  },
  {
    path: '/admin/users',
    name: 'UserAdmin',
    component: () => import('@/views/admin/UsersList.vue'),
    meta: { adminOnly: true, title: '用户权限管理' }
  },
  {
    path: '/admin/devices',
    name: 'DevicesAdmin',
    component: () => import('@/views/admin/DevicesAdminPage.vue'),
    meta: { adminOnly: true, title: '设备租约运营' }
  },
  {
    path: '/admin/audit',
    name: 'AuditLog',
    component: () => import('@/views/admin/AuditLogPage.vue'),
    meta: { adminOnly: true, title: '审计日志' }
  },
  {
    path: '/admin/settings',
    name: 'SettingsAdmin',
    component: () => import('@/views/admin/SettingsAdminPage.vue'),
    meta: { adminOnly: true, title: '平台设置' }
  },
  {
    path: '/admin/shares',
    name: 'ShareAdmin',
    component: () => import('@/views/ShareAdminPage.vue'),
    meta: { adminOnly: true, title: '分享与卡密管理' }
  },
  {
    path: '/share',
    name: 'ShareDevice',
    component: () => import('@/views/ShareView.vue'),
    meta: { public: true }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 全局导航守卫：登录态与角色校验（从 auth store 读取，store 初始值来自 localStorage）
router.beforeEach((to) => {
  const authStore = useAuthStore()

  // 免登录页面：/login、/share
  if (to.meta.public) {
    // 已登录用户访问登录页时回首页
    if (to.name === 'Login' && authStore.isLoggedIn) {
      return { path: '/' }
    }
    return true
  }

  // 未登录访问后台页面 → 登录页
  if (!authStore.isLoggedIn) {
    return { path: '/login' }
  }

  // 非管理员访问 admin-only 页面 → 首页
  if (to.meta.adminOnly && !authStore.isAdmin) {
    return { path: '/' }
  }

  return true
})

export default router
