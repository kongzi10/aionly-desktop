import { describe, expect, it } from 'vitest'

import { toDisplayStatus } from '../status'

describe('toDisplayStatus', () => {
  it.each([
    ['synced', 'effective'],
    ['pendingAdd', 'pending'],
    ['pendingUpdate', 'pending'],
    ['pendingRemove', 'pending'],
    ['externallyModified', 'actionRequired'],
    ['credentialInvalid', 'actionRequired'],
    ['targetNotWritable', 'actionRequired']
  ] as const)('maps %s to %s', (detailStatus, displayStatus) => {
    expect(toDisplayStatus(detailStatus)).toBe(displayStatus)
  })
})
