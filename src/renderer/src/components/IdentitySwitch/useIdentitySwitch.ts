/**
 * 切换身份抽屉的状态与动作封装。
 *
 * 安全链路（docs/切换身份改造/切换身份功能改造开发文档.md §4.1/§7）：
 * `prepareSwitch`（主进程解码长期凭据，一次性内存返回）→ `activate`（重写启动 bootstrap，
 * 异常回退可保会话恢复）→ `applyProfileSwitch`（flush/pause/reset + initializeProfile
 * 会话校验）→ navigate('#/')。凭据/token 严禁写入渲染层日志与 localStorage 持久化。
 */

import { useMinappPopup } from '@renderer/hooks/useMinappPopup'
import { setPendingLoginAccount } from '@renderer/services/identityPrefill'
import { applyProfileSwitch } from '@renderer/services/ProfileLifecycleService'
import { initializeSwitchedSession } from '@renderer/services/sessionBootstrap'
import { store } from '@renderer/store'
import { clearToken } from '@renderer/store/user'
import type { AccountView } from '@shared/profile'
import { isProfileAccountError, PROFILE_ACCOUNT_ERROR } from '@shared/profile'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface UseIdentitySwitchResult {
  loading: boolean
  error: string | null
  accounts: AccountView[]
  activeProfileId: string | null
  managing: boolean
  setManaging: (managing: boolean) => void
  switchingId: string | null
  removingId: string | null
  refresh: () => Promise<void>
  switchTo: (account: AccountView) => Promise<void>
  removeAccount: (account: AccountView) => Promise<void>
  loginOther: () => Promise<void>
}

export function useIdentitySwitch(enabled: boolean): UseIdentitySwitchResult {
  const { t } = useTranslation()
  const { closeAllMinapps } = useMinappPopup()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<AccountView[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [managing, setManaging] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  // 切换/移除进行中禁止并发操作（抽屉关闭后异步回调不再 setState）
  const busyRef = useRef(false)
  // t 经 ref 转发：翻译函数身份变化（如语言热切换/测试桩）不应导致回调与加载 effect 重建
  const tRef = useRef(t)
  tRef.current = t

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.profile.listAccounts()
      setAccounts(result.accounts)
      setActiveProfileId(result.activeProfileId)
    } catch {
      setError(tRef.current('identity.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) void refresh()
  }, [enabled, refresh])

  const switchTo = useCallback(
    async (account: AccountView) => {
      if (busyRef.current) return
      if (account.profileId === activeProfileId) return
      busyRef.current = true
      setSwitchingId(account.profileId)
      setError(null)
      try {
        // 1. 主进程解码长期凭据（CREDENTIAL_MISSING/ACCOUNT_NOT_FOUND 在此抛出）
        const prepared = await window.api.profile.prepareSwitch(account.profileId)
        // 2. 重写启动 bootstrap：后续任一环节异常，重启仍可恢复新会话
        // 展开为对象字面量，使 ProfileBootstrapPayload 满足 activate 的 Record 索引签名要求
        const activated = (await window.api.profile.activate(prepared.userId, {
          ...prepared.bootstrap
        })) as {
          profileId?: string | null
        }
        if (!activated?.profileId) throw new Error('Profile activation failed')
        // 3. flush/pause/reset + 会话初始化（缓存点亮 UI → 服务端刷新校验）
        let sessionExpired = false
        await applyProfileSwitch({ profileId: prepared.profileId, bootstrap: prepared.bootstrap }, async () => {
          const state = await initializeSwitchedSession(prepared.userId, prepared.bootstrap.userInfo)
          sessionExpired = state === 'expired'
        })
        if (sessionExpired) {
          // Token 过期：请求层已清 token 并提示，此处预填账号并转登录页（保留 Profile 数据）
          setPendingLoginAccount(prepared.account)
          window.location.hash = '#/login'
          window.toast.warning(tRef.current('identity.expiredRelogin'))
          return
        }
        window.toast.success(tRef.current('identity.switchSuccess', { account: account.accountMasked }))
      } catch (e) {
        // 先兜底刷新列表保证视图与主进程一致（refresh 会清 error），再写入本次失败提示
        await refresh().catch(() => undefined)
        if (isProfileAccountError(e, PROFILE_ACCOUNT_ERROR.CREDENTIAL_MISSING)) {
          // 凭据缺失（LRU 淘汰/safeStorage 不可用）：降级提示重新登录
          setError(tRef.current('identity.credentialMissing'))
        } else {
          setError(tRef.current('identity.switchFailed'))
        }
      } finally {
        busyRef.current = false
        setSwitchingId(null)
      }
    },
    [activeProfileId, refresh]
  )

  const removeAccount = useCallback(
    async (account: AccountView) => {
      if (busyRef.current) return
      busyRef.current = true
      setRemovingId(account.profileId)
      setError(null)
      try {
        await window.api.profile.removeAccount(account.profileId)
        await refresh()
        window.toast.success(tRef.current('identity.removedToast'))
      } catch (e) {
        // 先兜底刷新（refresh 会清 error），再写入本次失败提示
        await refresh().catch(() => undefined)
        if (isProfileAccountError(e, PROFILE_ACCOUNT_ERROR.ACTIVE_PROFILE_PROTECTED)) {
          setError(tRef.current('identity.removeActiveProtected'))
        } else {
          setError(tRef.current('identity.removeFailed'))
        }
      } finally {
        busyRef.current = false
        setRemovingId(null)
      }
    },
    [refresh]
  )

  const loginOther = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    try {
      // 清理复用退出登录路径（关闭小程序子窗/Redux persist flush/存储重置），
      // 但不 deactivate、不清主进程凭据：历史账号与 Profile 数据保留，登录页可再切回
      closeAllMinapps()
      store.dispatch(clearToken())
      await applyProfileSwitch({ profileId: null, bootstrap: null })
    } catch (e) {
      busyRef.current = false
      window.toast.error(tRef.current('common.error'))
      throw e
    }
  }, [closeAllMinapps])

  return {
    loading,
    error,
    accounts,
    activeProfileId,
    managing,
    setManaging,
    switchingId,
    removingId,
    refresh,
    switchTo,
    removeAccount,
    loginOther
  }
}
