import { beforeEach, describe, expect, it } from 'vitest'

import {
  copyMissingRecords,
  isLegacyProfileDataMigrationEnabled,
  migrateLegacyProfileData,
  migrateLegacyReduxState
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
