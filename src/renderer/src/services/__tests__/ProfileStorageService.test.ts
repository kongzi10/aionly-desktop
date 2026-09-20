import { beforeEach, describe, expect, it } from 'vitest'

import {
  ACTIVE_PROFILE_STORAGE_KEY,
  authStorage,
  clearAuthTokenIfCurrent,
  getActiveProfileId,
  getDexieDatabaseName,
  getProfileStorageKey,
  getProfileWebviewPartition,
  getReduxPersistKey,
  profileStorage
} from '../ProfileStorageService'

describe('ProfileStorageService', () => {
  beforeEach(() => localStorage.clear())

  it('uses the opaque active profile id for every business storage namespace', () => {
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, '0123456789abcdef0123456789abcdef')

    expect(getActiveProfileId()).toBe('0123456789abcdef0123456789abcdef')
    expect(getProfileStorageKey('draft')).toBe('profile:0123456789abcdef0123456789abcdef:draft')
    expect(getReduxPersistKey()).toBe('aionly:0123456789abcdef0123456789abcdef')
    expect(getDexieDatabaseName()).toBe('AiOnly-0123456789abcdef0123456789abcdef')
  })

  it('derives an isolated webview partition for the active profile', () => {
    const profileId = '0123456789abcdef0123456789abcdef'
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profileId)
    expect(getProfileWebviewPartition()).toBe(`persist:webview-${profileId}`)
    localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY)
    expect(getProfileWebviewPartition()).toBe('persist:webview-login')
  })

  it('rejects profile-owned storage while logged out', () => {
    expect(getActiveProfileId()).toBeNull()
    expect(() => getProfileStorageKey('draft')).toThrow('Profile is not active')
    expect(() => getReduxPersistKey()).toThrow('Profile is not active')
    expect(() => getDexieDatabaseName()).toThrow('Profile is not active')
  })

  it('rejects malformed profile ids', () => {
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, '../another-user')

    expect(getActiveProfileId()).toBeNull()
  })

  it('reads and writes direct business keys only inside the active profile namespace', () => {
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, '0123456789abcdef0123456789abcdef')

    profileStorage.setItem('credential', 'secret')

    expect(localStorage.getItem('credential')).toBeNull()
    expect(localStorage.getItem('profile:0123456789abcdef0123456789abcdef:credential')).toBe('secret')
    expect(profileStorage.getItem('credential')).toBe('secret')
  })

  it('keeps login credentials temporary while logged out and scopes them after activation', () => {
    authStorage.setItem('token', 'login-token')
    expect(localStorage.getItem('token')).toBe('login-token')

    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, '0123456789abcdef0123456789abcdef')
    authStorage.setItem('token', 'profile-token')
    expect(authStorage.getItem('token')).toBe('profile-token')
    expect(localStorage.getItem('profile:0123456789abcdef0123456789abcdef:token')).toBe('profile-token')
  })

  it('uses a newly issued login token while an expired profile is still active', () => {
    const profileId = '0123456789abcdef0123456789abcdef'
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profileId)
    localStorage.setItem(`profile:${profileId}:token`, 'expired-profile-token')
    localStorage.setItem('token', 'new-login-token')

    expect(authStorage.getItem('token')).toBe('new-login-token')
  })

  it('does not clear a newer login token when an older request expires', () => {
    const profileId = '0123456789abcdef0123456789abcdef'
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profileId)
    localStorage.setItem(`profile:${profileId}:token`, 'expired-profile-token')
    localStorage.setItem('token', 'new-login-token')

    expect(clearAuthTokenIfCurrent('expired-profile-token')).toBe(false)
    expect(authStorage.getItem('token')).toBe('new-login-token')
  })

  it('clears the token when the rejected request used the current credential', () => {
    localStorage.setItem('token', 'expired-login-token')

    expect(clearAuthTokenIfCurrent('expired-login-token')).toBe(true)
    expect(authStorage.getItem('token')).toBeNull()
  })
})
