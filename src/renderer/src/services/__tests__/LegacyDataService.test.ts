import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RendererLegacyDataService } from '../LegacyDataService'

const profileId = '0123456789abcdef0123456789abcdef'

describe('RendererLegacyDataService', () => {
  beforeEach(() => localStorage.clear())

  it('replaces active profile storage even when the target already exists', async () => {
    localStorage.setItem('persist:aionly', JSON.stringify({ settings: JSON.stringify({ legacy: true }) }))
    localStorage.setItem('ai302_token', 'legacy-token')
    localStorage.setItem(
      `persist:aionly:${profileId}`,
      JSON.stringify({ user: JSON.stringify({ userInfo: { userId: 'current' } }) })
    )
    localStorage.setItem(`profile:${profileId}:ai302_token`, 'current-token')
    localStorage.setItem(`profile:${profileId}:cacheUpdatedModels`, 'current-only')
    const migrateIndexedDb = vi.fn(async () => undefined)
    const service = new RendererLegacyDataService(localStorage, {
      legacyIndexedDbExists: async () => true,
      migrateIndexedDb,
      deleteLegacyIndexedDb: async () => undefined
    })

    await service.recover(profileId)

    expect(JSON.parse(localStorage.getItem(`persist:aionly:${profileId}`) || '{}')).toEqual({
      settings: JSON.stringify({ legacy: true }),
      user: JSON.stringify({ userInfo: { userId: 'current' } })
    })
    expect(localStorage.getItem(`profile:${profileId}:ai302_token`)).toBe('legacy-token')
    expect(localStorage.getItem(`profile:${profileId}:cacheUpdatedModels`)).toBeNull()
    expect(migrateIndexedDb).toHaveBeenCalledWith(profileId)
    expect((await service.getStatus(profileId)).recoveryState).toBe('completed')
  })

  it('allows deleting exact legacy renderer data without recovering first', async () => {
    localStorage.setItem('persist:aionly', 'legacy-redux')
    localStorage.setItem('ai302_token', 'legacy-token')
    localStorage.setItem(`persist:aionly:${profileId}`, 'current-redux')
    const deleteLegacyIndexedDb = vi.fn(async () => undefined)
    const service = new RendererLegacyDataService(localStorage, {
      legacyIndexedDbExists: async () => true,
      migrateIndexedDb: async () => undefined,
      deleteLegacyIndexedDb
    })

    await service.cleanup()

    expect(localStorage.getItem('persist:aionly')).toBeNull()
    expect(localStorage.getItem('ai302_token')).toBeNull()
    expect(localStorage.getItem(`persist:aionly:${profileId}`)).toBe('current-redux')
    expect(deleteLegacyIndexedDb).toHaveBeenCalledOnce()
  })

  it('allows cleanup when only a flat legacy storage key exists', async () => {
    localStorage.setItem('ai302_token', 'legacy-token')
    const service = new RendererLegacyDataService(localStorage, {
      legacyIndexedDbExists: async () => false,
      migrateIndexedDb: async () => undefined,
      deleteLegacyIndexedDb: async () => undefined
    })

    expect((await service.getStatus(profileId)).cleanupAllowed).toBe(true)
  })

  it('reports recovery while indexedDB replacement is still running', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const service = new RendererLegacyDataService(localStorage, {
      legacyIndexedDbExists: async () => true,
      migrateIndexedDb: () => pending,
      deleteLegacyIndexedDb: async () => undefined
    })

    const recovery = service.recover(profileId)
    expect((await service.getStatus(profileId)).recoveryState).toBe('recovering')
    release()
    await recovery
  })
})
