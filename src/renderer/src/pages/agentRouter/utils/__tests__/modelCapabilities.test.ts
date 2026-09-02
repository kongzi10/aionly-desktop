import type { Model } from '@renderer/types'
import { describe, expect, it } from 'vitest'

import { resolveAgentRouteModelTypes } from '../modelCapabilities'

const model = (overrides: Partial<Model>): Model => ({
  id: 'unknown-model',
  name: 'Unknown',
  provider: 'aionly',
  group: '',
  ...overrides
})

describe('resolveAgentRouteModelTypes', () => {
  it('keeps every explicitly enabled supported model type', () => {
    expect(
      resolveAgentRouteModelTypes(
        model({
          capabilities: [
            { type: 'vision', isUserSelected: true },
            { type: 'web_search', isUserSelected: true },
            { type: 'reasoning', isUserSelected: true },
            { type: 'function_calling', isUserSelected: true },
            { type: 'rerank', isUserSelected: true },
            { type: 'embedding', isUserSelected: true }
          ]
        })
      )
    ).toEqual(['vision', 'web_search', 'reasoning', 'function_calling', 'rerank', 'embedding'])
  })

  it('excludes explicitly disabled model types', () => {
    expect(
      resolveAgentRouteModelTypes(model({ capabilities: [{ type: 'function_calling', isUserSelected: false }] }))
    ).toEqual([])
  })

  it('ignores custom model types', () => {
    expect(
      resolveAgentRouteModelTypes(
        model({
          capabilities: [
            { type: 'vision', isUserSelected: true },
            { type: 'custom_type' as never, isUserSelected: true }
          ]
        })
      )
    ).toEqual(['vision'])
  })

  it('infers model types with the same local rules as model settings when the API omits them', () => {
    expect(
      resolveAgentRouteModelTypes(model({ id: 'claude-fable-5-1', name: 'Claude Fable 5.1', capabilities: [] }))
    ).toEqual(['function_calling'])
  })

  it('lets an explicit API capability disable a locally inferred model type', () => {
    expect(
      resolveAgentRouteModelTypes(
        model({
          id: 'claude-fable-5-1',
          name: 'Claude Fable 5.1',
          capabilities: [{ type: 'function_calling', isUserSelected: false }]
        })
      )
    ).toEqual([])
  })
})
