import { ENABLED_PLAN_STORAGE_KEY } from '@shared/config/constant'
import { describe, expect, it, vi } from 'vitest'

import { createCurrentStoreModelSetters } from '../modelProfileInitialization'
import { readUserEnabledPlan } from '../useUserTokenPlan'

describe('createCurrentStoreModelSetters', () => {
  it('dispatches every default model action through the current profile store', () => {
    const dispatch = vi.fn()
    const model = { id: 'model-1', name: 'Model 1', provider: 'aionly' } as never

    const setters = createCurrentStoreModelSetters(dispatch)
    setters.setDefaultModel(model)
    setters.setQuickModel(model)
    setters.setTranslateModel(model)

    expect(dispatch.mock.calls.map(([action]) => action.type)).toEqual([
      'llm/setDefaultModel',
      'llm/setQuickModel',
      'llm/setTranslateModel'
    ])
  })
})

describe('readUserEnabledPlan', () => {
  it('reads the plan for the newly authenticated user instead of the pre-login user', () => {
    localStorage.setItem(`${ENABLED_PLAN_STORAGE_KEY}_new-user`, JSON.stringify({ id: 'plan-new' }))
    localStorage.setItem(`${ENABLED_PLAN_STORAGE_KEY}_undefined`, JSON.stringify({ id: 'plan-old' }))

    expect(readUserEnabledPlan('new-user', localStorage)).toEqual({ id: 'plan-new' })
  })
})
