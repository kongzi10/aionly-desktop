import type { Model } from '@renderer/types'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  findPendingRoundtableMention,
  setPendingRoundtableMentions,
  setRoundtableMentionFallback,
  updatePendingRoundtableMentionRole
} from '../roundtableMentions'

const createModel = (id: string): Model => ({
  id,
  provider: 'test-provider',
  name: `Model ${id}`,
  group: 'test'
})

const modelA = createModel('a')
const modelB = createModel('b')

describe('updatePendingRoundtableMentionRole', () => {
  beforeEach(() => {
    setPendingRoundtableMentions([])
    setRoundtableMentionFallback(null)
  })

  it('creates a binding when the model has no pending mention', () => {
    updatePendingRoundtableMentionRole(modelA, 'role-1')
    expect(findPendingRoundtableMention(modelA)?.assistantId).toBe('role-1')
  })

  it('updates the binding of the target model only', () => {
    setPendingRoundtableMentions([
      { model: modelA, assistantId: 'role-1' },
      { model: modelB, assistantId: 'role-2' }
    ])
    updatePendingRoundtableMentionRole(modelA, 'role-3')
    expect(findPendingRoundtableMention(modelA)?.assistantId).toBe('role-3')
    expect(findPendingRoundtableMention(modelB)?.assistantId).toBe('role-2')
  })

  it('restores the default role with undefined and takes priority over the fallback source', () => {
    setRoundtableMentionFallback(() => [{ model: modelA, assistantId: 'history-role' }])
    expect(findPendingRoundtableMention(modelA)?.assistantId).toBe('history-role')
    updatePendingRoundtableMentionRole(modelA, undefined)
    expect(findPendingRoundtableMention(modelA)?.assistantId).toBeUndefined()
  })
})
