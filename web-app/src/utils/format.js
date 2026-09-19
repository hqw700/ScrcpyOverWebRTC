// 到期时间 / 剩余时长格式化（用户账号有效期与设备租约共用）
// Go 零值时间（0001-01-01）= 永久，parseExpire 返回 null
export function parseExpire(expiresAt) {
  if (!expiresAt) return null
  const t = new Date(expiresAt)
  if (Number.isNaN(t.getTime()) || t.getFullYear() <= 1) return null
  return t
}

export function isExpiredAt(expiresAt) {
  const t = parseExpire(expiresAt)
  return !!t && t.getTime() <= Date.now()
}

export function formatExpire(expiresAt) {
  const t = parseExpire(expiresAt)
  if (!t) return '♾️ 永久'
  if (t.getTime() <= Date.now()) return '已到期'
  return t.toLocaleString('zh-CN', { hour12: false })
}

export function formatRemain(expiresAt) {
  const t = parseExpire(expiresAt)
  if (!t) return ''
  const ms = t.getTime() - Date.now()
  if (ms <= 0) return ''
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (d > 0) return `剩余 ${d} 天 ${h} 小时`
  if (h > 0) return `剩余 ${h} 小时 ${m} 分`
  return `剩余 ${m} 分`
}

// 租约 remaining_seconds：-1 = 永久，<=0 = 已到期
export function formatLeaseRemaining(remainingSeconds) {
  if (remainingSeconds === undefined || remainingSeconds === null) return '-'
  if (remainingSeconds < 0) return '♾️ 永久'
  if (remainingSeconds === 0) return '已到期'
  const d = Math.floor(remainingSeconds / 86400)
  const h = Math.floor((remainingSeconds % 86400) / 3600)
  const m = Math.floor((remainingSeconds % 3600) / 60)
  if (d > 0) return `剩余 ${d} 天 ${h} 小时`
  if (h > 0) return `剩余 ${h} 小时 ${m} 分`
  return `剩余 ${m} 分`
}
