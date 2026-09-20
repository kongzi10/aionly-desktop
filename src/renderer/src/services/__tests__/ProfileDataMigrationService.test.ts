import { beforeEach, describe, expect, it } from 'vitest'

import {
  classifyLegacyDataOwner,
  copyMissingRecords,
  isLegacyProfileDataMigrationEnabled,
  migrateLegacyProfileData,
  migrateLegacyReduxState,
  readLegacyReduxUserId,
  readProfileAuthUserId,
  replaceLegacyReduxState
} from '../ProfileDataMigrationService'

const profileId = '0123456789abcdef0123456789abcdef'

describe('ProfileDataMigrationService', () => {
  beforeEach(() => localStorage.clear())

  it('enables legacy profile migration for upgraded installations', () => {
    expect(isLegacyProfileDataMigrationEnabled()).toBe(true)
  })

  it('copies legacy Redux state once without overwriting profile data', () => {
    localStorage.setItem('persist:aionly', 'legacy')
    localStorage.setItem('ai302_token', 'legacy-token')

    expect(migrateLegacyReduxState(localStorage, profileId)).toBe(true)
    expect(localStorage.getItem(`persist:aionly:${profileId}`)).toBe('legacy')
    expect(localStorage.getItem(`profile:${profileId}:ai302_token`)).toBe('legacy-token')

    localStorage.setItem(`persist:aionly:${profileId}`, 'profile')
    expect(migrateLegacyReduxState(localStorage, profileId)).toBe(false)
    expect(localStorage.getItem(`persist:aionly:${profileId}`)).toBe('profile')
  })

  it('copies missing records and keeps destination conflicts', async () => {
    const source = [
      { id: 'same', value: 'legacy' },
      { id: 'missing', value: 'copied' }
    ]
    const destination = new Map([['same', { id: 'same', value: 'profile' }]])
    let reads = 0
    let writes = 0

    await copyMissingRecords(source, (record) => record.id, {
      getMany: async (keys) => {
        reads += 1
        return keys.map((key) => destination.get(key))
      },
      addMany: async (records) => {
        writes += 1
        for (const record of records) destination.set(record.id, record)
      }
    })

    expect([...destination.values()]).toEqual([
      { id: 'same', value: 'profile' },
      { id: 'missing', value: 'copied' }
    ])
    expect(reads).toBe(2)
    expect(writes).toBe(1)
  })

  it('restores legacy Redux data without replacing the current user slice', () => {
    const legacyState = JSON.stringify({
      user: JSON.stringify({ token: 'old-token', userInfo: { userId: 'old-user' } }),
      settings: JSON.stringify({ theme: 'dark' })
    })
    const currentUser = JSON.stringify({ token: 'new-token', userInfo: { userId: 'new-user' } })
    localStorage.setItem('persist:aionly', legacyState)
    localStorage.setItem(`persist:aionly:${profileId}`, JSON.stringify({ user: currentUser }))

    replaceLegacyReduxState(localStorage, profileId)

    const restored = JSON.parse(localStorage.getItem(`persist:aionly:${profileId}`) || '{}')
    expect(restored.user).toBe(currentUser)
    expect(JSON.parse(restored.settings)).toEqual({ theme: 'dark' })
  })

  it('reads the owning user id from legacy Redux data', () => {
    localStorage.setItem('persist:aionly', JSON.stringify({ user: JSON.stringify({ userInfo: { userId: 42 } }) }))

    expect(readLegacyReduxUserId(localStorage)).toBe('42')
  })

  it('classifies matching, mismatched, and unknown legacy owners', () => {
    expect(classifyLegacyDataOwner('42', '42')).toBe('match')
    expect(classifyLegacyDataOwner('42', '43')).toBe('mismatch')
    expect(classifyLegacyDataOwner(null, '43')).toBe('unknown')
  })

  it('reads the current user id from profile authentication storage', () => {
    localStorage.setItem(`profile:${profileId}:userInfo`, JSON.stringify({ userId: 'current-user' }))

    expect(readProfileAuthUserId(localStorage, profileId)).toBe('current-user')
  })

  it('keeps a pending marker after failure and completes on retry', async () => {
    const markerKey = `aionly:renderer-migration:${profileId}`
    const failingCopy = async () => {
      throw new Error('copy failed')
    }

    await expect(migrateLegacyProfileData(localStorage, profileId, failingCopy)).rejects.toThrow('copy failed')
    expect(localStorage.getItem(markerKey)).toBe('pending')

    await migrateLegacyProfileData(localStorage, profileId, async () => undefined)
    expect(localStorage.getItem(markerKey)).toBe('completed')
  })
})
