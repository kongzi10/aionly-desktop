import { describe, expect, it, vi } from 'vitest'

import { ProfileGeneration, switchRendererProfile } from '../ProfileRendererRuntime'

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
        resetStore: () => calls.push('reset-store'),
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
})
