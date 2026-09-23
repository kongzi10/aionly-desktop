import { describe, expect, it } from 'vitest'

import { PROFILE_PERSIST_BLACKLIST, PROFILE_PERSIST_VERSION } from '../persistence'

describe('profile persistence', () => {
  it('does not persist profile authentication in redux', () => {
    expect(PROFILE_PERSIST_BLACKLIST).toContain('user')
  })

  it('runs the latest persisted-state migration', () => {
    expect(PROFILE_PERSIST_VERSION).toBe(208)
  })
})
