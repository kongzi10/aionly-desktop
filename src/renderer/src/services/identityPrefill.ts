/**
 * 登录页预填账号（内存传递，严禁持久化——docs/切换身份改造开发文档 §3.6）。
 *
 * 场景：切换身份时会话校验失败（Token 过期）→ 记录该账号原文 → 路由 #/login →
 * 登录页 take 一次后按账号形态选中对应页签并预填，用户仅需重新验证（验证码/密码）。
 */

let pendingLoginAccount: string | null = null

export function setPendingLoginAccount(account: string): void {
  pendingLoginAccount = account && account.trim() ? account.trim() : null
}

/** 读取并清空（一次性消费，避免残留导致后续登录页误预填） */
export function takePendingLoginAccount(): string | null {
  const account = pendingLoginAccount
  pendingLoginAccount = null
  return account
}

/** 依据账号形态推断登录页签：'1' 短信（手机号）/ '2' 邮箱 / '3' 账号 */
export function inferLoginTab(account: string): '1' | '2' | '3' {
  if (/^1\d{10}$/.test(account.trim())) return '1'
  if (account.includes('@')) return '2'
  return '3'
}
