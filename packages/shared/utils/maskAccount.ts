/**
 * 登录账号掩码（纯函数，主进程统一计算后下发；渲染进程只接收掩码结果，无法反推原文）。
 *
 * 规则（docs/切换身份改造/切换身份功能改造开发文档.md §3.3）：
 * - 大陆手机号 `/^1\d{10}$/`：前 3 + `****` + 后 4，如 `152****7105`
 * - 邮箱（含 `@`）：前缀前 3 位（不足取 1 位）+ `****` + `@域名`，如 `810****@qq.com`
 * - 其他用户名：长度 > 4 → 前 2 + `****` + 后 2；否则首字符 + `***`
 * - 空串返回空串
 */
export function maskAccount(account: string): string {
  const value = (account ?? '').trim()
  if (!value) return ''

  // 大陆手机号
  if (/^1\d{10}$/.test(value)) {
    return `${value.slice(0, 3)}****${value.slice(-4)}`
  }

  // 邮箱
  const atIndex = value.indexOf('@')
  if (atIndex > 0) {
    const prefix = value.slice(0, atIndex)
    const domain = value.slice(atIndex)
    const visible = prefix.length >= 3 ? prefix.slice(0, 3) : prefix.slice(0, 1)
    return `${visible}****${domain}`
  }

  // 其他用户名兜底
  if (value.length > 4) {
    return `${value.slice(0, 2)}****${value.slice(-2)}`
  }
  return `${value.slice(0, 1)}***`
}
