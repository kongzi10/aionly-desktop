import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  autoMigrateLegacyProfileData,
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
const markerKey = `aionly:renderer-migration:${profileId}`

function seedLegacyReduxOwner(userId: string): void {
  localStorage.setItem('persist:aionly', JSON.stringify({ user: JSON.stringify({ userInfo: { userId } }) }))
}

function seedProfileAuth(userId: string): void {
  localStorage.setItem(`profile:${profileId}:userInfo`, JSON.stringify({ userId }))
}

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

describe('autoMigrateLegacyProfileData', () => {
  beforeEach(() => localStorage.clear())

  it('marks completion and does nothing when no legacy data exists', async () => {
    const migrate = vi.fn()

    const result = await autoMigrateLegacyProfileData(profileId, {
      legacyDatabaseExists: async () => false,
      migrate
    })

    expect(result).toBe('none')
    expect(migrate).not.toHaveBeenCalled()
    expect(localStorage.getItem(markerKey)).toBe('completed')
  })

  it('returns none immediately when the marker is already completed', async () => {
    localStorage.setItem(markerKey, 'completed')
    seedLegacyReduxOwner('42')
    seedProfileAuth('42')
    const migrate = vi.fn()

    const result = await autoMigrateLegacyProfileData(profileId, {
      legacyDatabaseExists: async () => true,
      migrate
    })

    expect(result).toBe('none')
    expect(migrate).not.toHaveBeenCalled()
  })

  it('never migrates data owned by another account', async () => {
    seedLegacyReduxOwner('42')
    seedProfileAuth('43')
    const migrate = vi.fn()

    const result = await autoMigrateLegacyProfileData(profileId, {
      legacyDatabaseExists: async () => false,
      migrate
    })

    expect(result).toBe('skipped-owner-mismatch')
    expect(migrate).not.toHaveBeenCalled()
    expect(localStorage.getItem(markerKey)).toBeNull()
  })

  it('skips when the legacy owner cannot be determined', async () => {
    localStorage.setItem('persist:aionly', JSON.stringify({ settings: '{}' }))
    seedProfileAuth('43')
    const migrate = vi.fn()

    const result = await autoMigrateLegacyProfileData(profileId, {
      legacyDatabaseExists: async () => false,
      migrate
    })

    expect(result).toBe('skipped-owner-unknown')
    expect(migrate).not.toHaveBeenCalled()
  })

  it('copies legacy data when the profile namespace is untouched', async () => {
    seedLegacyReduxOwner('42')
    seedProfileAuth('42')
    localStorage.setItem('ai302_token', 'legacy-token')

    const result = await autoMigrateLegacyProfileData(profileId, {
      legacyDatabaseExists: async () => true,
      migrate: (storage, id) => migrateLegacyProfileData(storage, id, async () => undefined)
    })

    expect(result).toBe('copied')
    expect(localStorage.getItem(`persist:aionly:${profileId}`)).not.toBeNull()
    expect(localStorage.getItem(`profile:${profileId}:ai302_token`)).toBe('legacy-token')
    expect(localStorage.getItem(markerKey)).toBe('completed')
    // 只拷不删：旧命名空间数据保留，支持回滚
    expect(localStorage.getItem('persist:aionly')).not.toBeNull()
  })

  it('replaces an unused profile namespace that was already initialized', async () => {
    seedLegacyReduxOwner('42')
    seedProfileAuth('42')
    localStorage.setItem(`persist:aionly:${profileId}`, JSON.stringify({ user: JSON.stringify({ token: 't' }) }))
    const replaceIndexedDb = vi.fn(async () => undefined)

    const result = await autoMigrateLegacyProfileData(profileId, {
      legacyDatabaseExists: async () => true,
      profileDatabaseInUse: async () => false,
      replaceIndexedDb
    })

    expect(result).toBe('replaced')
    expect(replaceIndexedDb).toHaveBeenCalledWith(profileId)
    expect(localStorage.getItem(markerKey)).toBe('completed')
    // user slice 保留当前登录态，其余 slice 来自旧数据
    const restored = JSON.parse(localStorage.getItem(`persist:aionly:${profileId}`) || '{}')
    expect(JSON.parse(restored.user)).toEqual({ token: 't' })
  })

  it('never replaces a profile namespace that already has conversation data', async () => {
    seedLegacyReduxOwner('42')
    seedProfileAuth('42')
    localStorage.setItem(`persist:aionly:${profileId}`, JSON.stringify({ user: '{}' }))
    const replaceReduxState = vi.fn()
    const replaceIndexedDb = vi.fn()

    const result = await autoMigrateLegacyProfileData(profileId, {
      legacyDatabaseExists: async () => true,
      profileDatabaseInUse: async () => true,
      replaceReduxState,
      replaceIndexedDb
    })

    expect(result).toBe('skipped-target-in-use')
    expect(replaceReduxState).not.toHaveBeenCalled()
    expect(replaceIndexedDb).not.toHaveBeenCalled()
    expect(localStorage.getItem(markerKey)).toBeNull()
  })

  it('marks failure and rethrows when replacement fails', async () => {
    seedLegacyReduxOwner('42')
    seedProfileAuth('42')
    localStorage.setItem(`persist:aionly:${profileId}`, JSON.stringify({ user: '{}' }))

    await expect(
      autoMigrateLegacyProfileData(profileId, {
        legacyDatabaseExists: async () => true,
        profileDatabaseInUse: async () => false,
        replaceIndexedDb: async () => {
          throw new Error('replace failed')
        }
      })
    ).rejects.toThrow('replace failed')
    expect(localStorage.getItem(markerKey)).toBe('failed')
  })

  it('skips when only the legacy database exists and the owner is undeterminable', async () => {
    seedProfileAuth('42')
    const migrate = vi.fn(async () => undefined)
    const replaceReduxState = vi.fn()

    const result = await autoMigrateLegacyProfileData(profileId, {
      legacyDatabaseExists: async () => true,
      profileDatabaseInUse: async () => false,
      migrate,
      replaceReduxState
    })

    // 无旧 redux 状态则无法判定归属，保守跳过（可走设置里的手动"数据恢复"）
    expect(result).toBe('skipped-owner-unknown')
    expect(migrate).not.toHaveBeenCalled()
    expect(replaceReduxState).not.toHaveBeenCalled()
  })
})
