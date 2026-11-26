/**
 * useIdentitySwitch 单元测试：切换编排、会话过期预填降级、CREDENTIAL_MISSING 兜底、移除保护。
 */
import type { AccountView } from '@shared/profile'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  applyProfileSwitch: vi.fn(),
  initializeSwitchedSession: vi.fn(),
  setPendingLoginAccount: vi.fn(),
  closeAllMinapps: vi.fn(),
  dispatch: vi.fn(),
  clearToken: vi.fn(() => ({ type: 'user/clearToken' }))
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))
vi.mock('@renderer/services/ProfileLifecycleService', () => ({
  applyProfileSwitch: mocks.applyProfileSwitch
}))
vi.mock('@renderer/services/sessionBootstrap', () => ({
  initializeSwitchedSession: mocks.initializeSwitchedSession
}))
vi.mock('@renderer/services/identityPrefill', () => ({
  setPendingLoginAccount: mocks.setPendingLoginAccount
}))
vi.mock('@renderer/hooks/useMinappPopup', () => ({
  useMinappPopup: () => ({ closeAllMinapps: mocks.closeAllMinapps, hideMinappPopup: vi.fn() })
}))
vi.mock('@renderer/store', () => ({
  store: { dispatch: mocks.dispatch }
}))
vi.mock('@renderer/store/user', () => ({
  clearToken: mocks.clearToken
}))

import { useIdentitySwitch } from '../useIdentitySwitch'

const accountA: AccountView = {
  profileId: 'p-a',
  accountId: '1001',
  accountMasked: '152****7105',
  accountType: 'main',
  nickName: '用户A',
  avatarUrl: '',
  lastLoginAt: '2026-01-02T00:00:00.000Z'
}
const accountB: AccountView = { ...accountA, profileId: 'p-b', accountMasked: 'use****@example.com', nickName: '用户B' }

const prepared = {
  userId: 'user-b',
  profileId: 'p-b',
  bootstrap: { token: 't', userInfo: '{"userId":"user-b"}' },
  account: 'user_b@example.com'
}

const setupWindowApi = () => {
  const profileApi = {
    listAccounts: vi.fn().mockResolvedValue({ activeProfileId: 'p-a', accounts: [accountA, accountB] }),
    prepareSwitch: vi.fn().mockResolvedValue(prepared),
    activate: vi.fn().mockResolvedValue({ profileId: 'p-b' }),
    removeAccount: vi.fn().mockResolvedValue({ success: true })
  }
  ;(window as any).api = { profile: profileApi }
  ;(window as any).toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn() }
  return profileApi
}

describe('useIdentitySwitch', () => {
  let profileApi: ReturnType<typeof setupWindowApi>

  beforeEach(() => {
    vi.clearAllMocks()
    profileApi = setupWindowApi()
    mocks.applyProfileSwitch.mockImplementation(async (_target: any, init?: () => Promise<void>) => {
      await init?.()
    })
    mocks.initializeSwitchedSession.mockResolvedValue('ok')
    window.location.hash = ''
  })

  it('打开时加载账号列表与当前登录', async () => {
    const { result } = renderHook(() => useIdentitySwitch(true))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(profileApi.listAccounts).toHaveBeenCalledTimes(1)
    expect(result.current.accounts).toEqual([accountA, accountB])
    expect(result.current.activeProfileId).toBe('p-a')
  })

  it('switchTo：prepareSwitch → activate → applyProfileSwitch(会话初始化) → 成功提示', async () => {
    const { result } = renderHook(() => useIdentitySwitch(true))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.switchTo(accountB)
    })

    expect(profileApi.prepareSwitch).toHaveBeenCalledWith('p-b')
    expect(profileApi.activate).toHaveBeenCalledWith('user-b', prepared.bootstrap)
    expect(mocks.applyProfileSwitch).toHaveBeenCalledWith(
      { profileId: 'p-b', bootstrap: prepared.bootstrap },
      expect.any(Function)
    )
    expect(mocks.initializeSwitchedSession).toHaveBeenCalledWith('user-b', prepared.bootstrap.userInfo)
    expect((window as any).toast.success).toHaveBeenCalledWith('identity.switchSuccess')
    expect(result.current.switchingId).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('switchTo：切换当前登录账号为无操作', async () => {
    const { result } = renderHook(() => useIdentitySwitch(true))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.switchTo(accountA)
    })
    expect(profileApi.prepareSwitch).not.toHaveBeenCalled()
    expect(mocks.applyProfileSwitch).not.toHaveBeenCalled()
  })

  it('switchTo：会话过期（expired）→ 预填账号并跳转 #/login，不提示成功', async () => {
    mocks.initializeSwitchedSession.mockResolvedValue('expired')
    const { result } = renderHook(() => useIdentitySwitch(true))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.switchTo(accountB)
    })

    expect(mocks.setPendingLoginAccount).toHaveBeenCalledWith('user_b@example.com')
    expect(window.location.hash).toBe('#/login')
    expect((window as any).toast.warning).toHaveBeenCalledWith('identity.expiredRelogin')
    expect((window as any).toast.success).not.toHaveBeenCalled()
  })

  it('switchTo：CREDENTIAL_MISSING → 提示重新登录并刷新列表', async () => {
    profileApi.prepareSwitch.mockRejectedValueOnce(new Error('CREDENTIAL_MISSING: p-b'))
    const { result } = renderHook(() => useIdentitySwitch(true))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.switchTo(accountB)
    })

    expect(mocks.applyProfileSwitch).not.toHaveBeenCalled()
    expect(result.current.error).toBe('identity.credentialMissing')
    // 首次加载 + 失败后兜底刷新
    expect(profileApi.listAccounts).toHaveBeenCalledTimes(2)
  })

  it('switchTo：未知异常 → 通用失败提示', async () => {
    profileApi.activate.mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useIdentitySwitch(true))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.switchTo(accountB)
    })

    expect(result.current.error).toBe('identity.switchFailed')
  })

  it('removeAccount：成功移除并刷新；ACTIVE_PROFILE_PROTECTED → 受保护提示', async () => {
    const { result } = renderHook(() => useIdentitySwitch(true))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.removeAccount(accountB)
    })
    expect(profileApi.removeAccount).toHaveBeenCalledWith('p-b')
    expect((window as any).toast.success).toHaveBeenCalledWith('identity.removedToast')

    profileApi.removeAccount.mockRejectedValueOnce(new Error('ACTIVE_PROFILE_PROTECTED: active'))
    await act(async () => {
      await result.current.removeAccount(accountB)
    })
    expect(result.current.error).toBe('identity.removeActiveProtected')
  })

  it('loginOther：关闭子窗、清理内存态并走 applyProfileSwitch(null)，不 deactivate', async () => {
    const { result } = renderHook(() => useIdentitySwitch(true))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.loginOther()
    })

    expect(mocks.closeAllMinapps).toHaveBeenCalledTimes(1)
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: 'user/clearToken' })
    expect(mocks.applyProfileSwitch).toHaveBeenCalledWith({ profileId: null, bootstrap: null })
    expect((window as any).api.profile.deactivate ?? vi.fn()).not.toHaveBeenCalled()
  })
})
