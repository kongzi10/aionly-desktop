import type { Model } from '@renderer/types'
import { describe, expect, it } from 'vitest'

import { canSendRoundtableMessage } from '../roundtablePolicy'

const createModel = (id: string): Model => ({
  id,
  provider: 'test-provider',
  name: `Model ${id}`,
  group: 'test'
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
