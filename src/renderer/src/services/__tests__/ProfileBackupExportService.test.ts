import { describe, expect, it } from 'vitest'

import { collectProfileStorage, createProfileBackupPayload } from '../ProfileBackupExportService'

const profileId = '0123456789abcdef0123456789abcdef'

describe('ProfileBackupExportService', () => {
  it('exports only storage entries owned by the active profile', async () => {
    const storage = new Map<string, string>([
      [`persist:aionly:${profileId}`, 'current-redux'],
      [`profile:${profileId}:token`, 'secret-token'],
      ['persist:aionly:other-profile', 'other-redux'],
      ['profile:other-profile:token', 'other-token'],
      ['unrelated', 'global']
    ])

    expect(collectProfileStorage(storage, profileId)).toEqual({
      [`persist:aionly:${profileId}`]: 'current-redux',
      [`profile:${profileId}:token`]: 'secret-token'
    })
  })

  it('creates version 7 single-profile metadata without raw identity fields', async () => {
    const payload = await createProfileBackupPayload({
      profileId,
      storage: new Map(),
      exportIndexedDb: async () => ({ topics: [{ id: 'topic-1' }] }),
      timestamp: 123
    })

    expect(payload.metadata).toMatchObject({
      version: 7,
      scope: 'single-profile',
      timestamp: 123,
      profile: { id: profileId, userIdHash: profileId }
    })
    expect(JSON.stringify(payload.metadata)).not.toContain('token')
    expect(payload.indexedDB).toEqual({ topics: [{ id: 'topic-1' }] })
  })
})
