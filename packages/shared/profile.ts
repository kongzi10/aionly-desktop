/**
 * 切换身份（历史登录账号）跨进程共享类型。
 *
 * 设计约束（docs/切换身份改造/切换身份功能改造开发文档.md §3.2/§3.4）：
 * - `AccountMeta`（含账号原文与 userId）仅主进程持有，渲染进程只能拿到 `AccountView`（掩码元数据）；
 * - `credentials`（长期加密凭据）永不经过渲染进程持久化，切换时经 `Profile_PrepareSwitch` 一次性下发；
 * - 历史账号最多保留 `MAX_HISTORY_ACCOUNTS` 条，超出按 `lastLoginAt` LRU 淘汰（不淘汰当前登录）。
 */

/** 与主进程 `ProfileBootstrap` 同构的凭据载荷（token/userInfo/serviceInfo/localUserSecret） */
export interface ProfileBootstrapPayload {
  token?: string
  userInfo?: string
  serviceInfo?: string
  localUserSecret?: string
}

/** 历史登录账号元数据（仅主进程持有完整结构） */
export interface AccountMeta {
  /** 服务端 userId（明文，仅主进程持有） */
  userId: string
  /** sha256(userId).slice(0,32) */
  profileId: string
  /** 展示用账号 ID（服务端 accountId） */
  accountId: string
  /** 登录账号原文（手机号/邮箱/用户名），仅主进程持有 */
  account: string
  /** 掩码展示串（主进程计算后下发） */
  accountMasked: string
  accountType: 'main' | 'sub'
  nickName: string
  avatarUrl: string
  /** ISO8601，LRU 依据 */
  lastLoginAt: string
}

/** 下发给渲染进程的账号视图（剥离 account 原文与 userId） */
export type AccountView = Omit<AccountMeta, 'account' | 'userId'>

export interface ListAccountsResult {
  activeProfileId: string | null
  /** 当前登录置顶，其余按 lastLoginAt 降序 */
  accounts: AccountView[]
}

export interface UpsertAccountRequest {
  userId: string
  /** 登录账号原文（手机号/邮箱/用户名；扫码登录等无法提供时允许为空串） */
  account: string
  accountType: 'main' | 'sub'
  nickName: string
  avatarUrl: string
  /** 展示用账号 ID（服务端 accountId，可为空串） */
  accountId?: string
  bootstrap: ProfileBootstrapPayload
}

export interface UpsertAccountResult {
  profileId: string
}

export interface PreparedSwitch {
  userId: string
  profileId: string
  bootstrap: ProfileBootstrapPayload
  /** 账号原文，仅用于渲染进程内存中预填登录表单（不落盘） */
  account: string
}

/** 历史账号上限（LRU） */
export const MAX_HISTORY_ACCOUNTS = 5

/** 切换身份相关错误码（IPC 层以 `Error(message)` 前缀透传，渲染进程按包含关系识别） */
export const PROFILE_ACCOUNT_ERROR = {
  CREDENTIAL_MISSING: 'CREDENTIAL_MISSING',
  ACTIVE_PROFILE_PROTECTED: 'ACTIVE_PROFILE_PROTECTED',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND'
} as const

export type ProfileAccountErrorCode = (typeof PROFILE_ACCOUNT_ERROR)[keyof typeof PROFILE_ACCOUNT_ERROR]

export function isProfileAccountError(error: unknown, code: ProfileAccountErrorCode): boolean {
  return error instanceof Error && error.message.includes(code)
}
