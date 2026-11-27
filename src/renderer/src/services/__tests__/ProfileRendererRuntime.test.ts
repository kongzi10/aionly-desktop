import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CacheService } from '../CacheService'
import { applyRendererProfileStorage, ProfileGeneration, switchRendererProfile } from '../ProfileRendererRuntime'
import { ACTIVE_PROFILE_STORAGE_KEY } from '../ProfileStorageService'

describe('switchRendererProfile', () => {
  it('invalidates work started before an account switch', () => {
    const generation = new ProfileGeneration()
    const startedAt = generation.capture()
    generation.advance()

    expect(() => generation.assertCurrent(startedAt)).toThrow('Profile changed before the operation completed')
    expect(() => generation.assertCurrent(generation.capture())).not.toThrow()
  })

  it('disposes the old runtime and creates the new profile runtime without reloading the page', async () => {
    const calls: string[] = []

    await switchRendererProfile(
      {
        profileId: '9a4da247945bd930a8911fd0b1526ad0',
        bootstrap: { token: 'next-token', userInfo: '{"userId":"42"}' }
      },
      {
        flushStore: async () => calls.push('flush'),
        pauseStore: () => calls.push('pause'),
        closeDatabase: () => calls.push('close-db'),
        applyProfileStorage: () => calls.push('storage'),
        resetDatabase: () => calls.push('reset-db'),
        resetStore: () => {
          calls.push('reset-store')
        },
        initializeProfile: () => {
          calls.push('initialize')
        },
        notifyProfileChanged: () => calls.push('notify'),
        navigate: () => calls.push('navigate')
      }
    )

    expect(calls).toEqual([
      'flush',
      'pause',
      'close-db',
      'storage',
      'reset-db',
      'reset-store',
      'initialize',
      'notify',
      'navigate'
    ])
  })

  it('waits for the new profile store to rehydrate before initializing profile data', async () => {
    const calls: string[] = []
    let finishRehydration: (() => void) | undefined
    const rehydrated = new Promise<void>((resolve) => {
      finishRehydration = resolve
    })

    const switching = switchRendererProfile(
      { profileId: '9a4da247945bd930a8911fd0b1526ad0', bootstrap: null },
      {
        flushStore: async () => undefined,
        pauseStore: () => undefined,
        closeDatabase: () => undefined,
        applyProfileStorage: () => undefined,
        resetDatabase: () => undefined,
        resetStore: () => {
          calls.push('reset-store')
          return rehydrated
        },
        initializeProfile: () => {
          calls.push('initialize')
        },
        notifyProfileChanged: () => undefined,
        navigate: () => undefined
      }
    )

    await Promise.resolve()
    expect(calls).toEqual(['reset-store'])

    finishRehydration?.()
    await switching

    expect(calls).toEqual(['reset-store', 'initialize'])
  })

  it('uses the same lifecycle when switching to the logged-out runtime', async () => {
    const applyProfileStorage = vi.fn()

    await switchRendererProfile(
      { profileId: null, bootstrap: null },
      {
        flushStore: async () => undefined,
        pauseStore: () => undefined,
        closeDatabase: () => undefined,
        applyProfileStorage,
        resetDatabase: () => undefined,
        resetStore: () => undefined,
        notifyProfileChanged: () => undefined,
        navigate: vi.fn()
      }
    )

    expect(applyProfileStorage).toHaveBeenCalledWith({ profileId: null, bootstrap: null })
  })

  it('requests recovery after a partially committed switch fails', async () => {
    const recover = vi.fn()

    await expect(
      switchRendererProfile(
        { profileId: '9a4da247945bd930a8911fd0b1526ad0', bootstrap: null },
        {
          flushStore: async () => undefined,
          pauseStore: () => undefined,
          closeDatabase: () => undefined,
          applyProfileStorage: () => undefined,
          resetDatabase: () => undefined,
          resetStore: () => undefined,
          initializeProfile: async () => {
            throw new Error('initialization failed')
          },
          notifyProfileChanged: () => undefined,
          navigate: () => undefined,
          recover
        }
      )
    ).rejects.toThrow('initialization failed')

    expect(recover).toHaveBeenCalledOnce()
  })

  it('requests recovery when disposing the old database fails', async () => {
    const recover = vi.fn()

    await expect(
      switchRendererProfile(
        { profileId: 'profile-b', bootstrap: null },
        {
          flushStore: async () => undefined,
          pauseStore: () => undefined,
          closeDatabase: () => {
            throw new Error('close failed')
          },
          applyProfileStorage: () => undefined,
          resetDatabase: () => undefined,
          resetStore: () => undefined,
          notifyProfileChanged: () => undefined,
          navigate: () => undefined,
          recover
        }
      )
    ).rejects.toThrow('close failed')

    expect(recover).toHaveBeenCalledOnce()
  })

  it('clears renderer memory caches so the previous profile draft does not leak into the new profile', async () => {
    CacheService.set('inputbar-draft', 'previous profile draft', 60_000)

    await switchRendererProfile(
      { profileId: 'profile-b', bootstrap: null },
      {
        flushStore: async () => undefined,
        pauseStore: () => undefined,
        closeDatabase: () => undefined,
        applyProfileStorage: () => undefined,
        resetDatabase: () => undefined,
        resetStore: () => undefined,
        notifyProfileChanged: () => undefined,
        navigate: () => undefined
      }
    )

    expect(CacheService.get('inputbar-draft')).toBeNull()
  })
})

describe('applyRendererProfileStorage', () => {
  const profileId = '0123456789abcdef0123456789abcdef'

  beforeEach(() => localStorage.clear())

  it('keeps profile-scoped serviceInfo when the bootstrap does not carry it', () => {
    localStorage.setItem(`profile:${profileId}:serviceInfo`, '{"planStatus":1}')

    applyRendererProfileStorage({ profileId, bootstrap: { token: 'next-token', userInfo: '{"userId":"42"}' } })

    expect(localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY)).toBe(profileId)
    expect(localStorage.getItem(`profile:${profileId}:serviceInfo`)).toBe('{"planStatus":1}')
    expect(localStorage.getItem(`profile:${profileId}:token`)).toBe('next-token')
  })

  it('overwrites serviceInfo when the bootstrap carries a newer value', () => {
    localStorage.setItem(`profile:${profileId}:serviceInfo`, '{"planStatus":0}')

    applyRendererProfileStorage({ profileId, bootstrap: { serviceInfo: '{"planStatus":1}' } })

    expect(localStorage.getItem(`profile:${profileId}:serviceInfo`)).toBe('{"planStatus":1}')
  })

  it('still removes credential keys missing from the bootstrap and clears plain keys', () => {
    localStorage.setItem(`profile:${profileId}:token`, 'old-token')
    localStorage.setItem(`profile:${profileId}:userSecretKey`, 'old-secret')
    localStorage.setItem('serviceInfo', 'plain-service-info')

    applyRendererProfileStorage({ profileId, bootstrap: { userInfo: '{"userId":"42"}' } })

    expect(localStorage.getItem(`profile:${profileId}:token`)).toBeNull()
    expect(localStorage.getItem(`profile:${profileId}:userSecretKey`)).toBeNull()
    expect(localStorage.getItem('serviceInfo')).toBeNull()
  })

  it('clears plain auth keys entirely when switching to the logged-out runtime', () => {
    localStorage.setItem('token', 'plain-token')
    localStorage.setItem('serviceInfo', 'plain-service-info')

    applyRendererProfileStorage({ profileId: null, bootstrap: null })

    expect(localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('serviceInfo')).toBeNull()
  })
})
