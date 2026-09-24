import { describe, expect, it } from 'vitest'

import { toDisplayStatus } from '../status'
import { AGENT_ROUTER_TARGET_IDS } from '../types'

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

describe('agent router targets', () => {
  it('includes Claude Code as a configurable target', () => {
    expect(AGENT_ROUTER_TARGET_IDS).toContain('claude-code')
  })
})
