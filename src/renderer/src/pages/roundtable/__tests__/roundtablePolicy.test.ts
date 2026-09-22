import type { Model } from '@renderer/types'
import { describe, expect, it } from 'vitest'

import {
  canSendRoundtableMessage,
  getRoundtableMaxModels,
  isRoundtableMember,
  ROUNDTABLE_MAX_MODELS_FREE,
  ROUNDTABLE_MAX_MODELS_MEMBER
} from '../roundtablePolicy'

const createModel = (id: string): Model => ({
  id,
  provider: 'test-provider',
  name: `Model ${id}`,
  group: 'test'
})

describe('getRoundtableMaxModels', () => {
  it('allows free users to select at most two models', () => {
    expect(getRoundtableMaxModels(false)).toBe(ROUNDTABLE_MAX_MODELS_FREE)
    expect(getRoundtableMaxModels(false)).toBe(2)
  })

  it('allows members to select at most four models', () => {
    expect(getRoundtableMaxModels(true)).toBe(ROUNDTABLE_MAX_MODELS_MEMBER)
    expect(getRoundtableMaxModels(true)).toBe(4)
  })
})

describe('isRoundtableMember', () => {
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  it('recognizes an active member', () => {
    expect(isRoundtableMember({ memberFlag: '1', memberStatus: '1', memberDate: futureDate })).toBe(true)
  })

  it('recognizes a member without expiry date', () => {
    expect(isRoundtableMember({ memberFlag: '1', memberStatus: '1' })).toBe(true)
  })

  it('rejects non-member flags', () => {
    expect(isRoundtableMember({ memberFlag: '0', memberStatus: '1', memberDate: futureDate })).toBe(false)
    expect(isRoundtableMember({ memberFlag: '1', memberStatus: '0', memberDate: futureDate })).toBe(false)
  })

  it('rejects an expired membership', () => {
    expect(isRoundtableMember({ memberFlag: '1', memberStatus: '1', memberDate: pastDate })).toBe(false)
  })

  it('rejects missing user info', () => {
    expect(isRoundtableMember(null)).toBe(false)
    expect(isRoundtableMember(undefined)).toBe(false)
    expect(isRoundtableMember({})).toBe(false)
  })
})

describe('canSendRoundtableMessage', () => {
  it('rejects a roundtable message when fewer than two models are selected', () => {
    expect(canSendRoundtableMessage([])).toBe(false)
    expect(canSendRoundtableMessage([createModel('a')])).toBe(false)
  })

  it('allows a roundtable message when at least two models are selected', () => {
    expect(canSendRoundtableMessage([createModel('a'), createModel('b')])).toBe(true)
    expect(canSendRoundtableMessage([createModel('a'), createModel('b'), createModel('c')])).toBe(true)
  })
})
