// 管理端 API 通用助手：统一携带 Bearer token（localStorage auth_token）
export function authHeaders(extra = {}) {
  const token = localStorage.getItem('auth_token') || ''
  return {
    ...extra,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  }
}

// 读取错误响应的纯文本/JSON 错误信息
export async function readError(res, fallback) {
  try {
    const text = await res.text()
    if (text) {
      try {
        const data = JSON.parse(text)
        if (data && data.error) return data.error
      } catch (e) { /* 非 JSON，按纯文本返回 */ }
      return text
    }
  } catch (e) { /* ignore */ }
  return fallback || ('HTTP ' + res.status)
}
