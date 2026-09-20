import { describe, expect, it } from 'vitest'

import { validateProfileBackup } from '../ProfileBackupRestoreService'

const profileId = '0123456789abcdef0123456789abcdef'

describe('validateProfileBackup', () => {
  it('accepts a version 7 backup owned by the active profile', () => {
    expect(() =>
      validateProfileBackup(
        { metadata: { version: 7, scope: 'single-profile', profile: { id: profileId } } },
        profileId
      )
    ).not.toThrow()
  })

  it('rejects old and foreign-profile backups', () => {
    expect(() =>
      validateProfileBackup(
        { metadata: { version: 6, scope: 'single-profile', profile: { id: profileId } } },
        profileId
      )
    ).toThrow('Unsupported legacy backup format')
    expect(() =>
      validateProfileBackup({ metadata: { version: 7, scope: 'single-profile', profile: { id: 'other' } } }, profileId)
    ).toThrow('Backup belongs to another profile')
  })

  it('rejects restore without an active profile identity', () => {
    expect(() =>
      validateProfileBackup({ metadata: { version: 7, scope: 'single-profile', profile: { id: '' } } }, '')
    ).toThrow('Profile is not active')
  })
})
