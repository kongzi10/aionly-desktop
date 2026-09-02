import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AgentRouterCredential } from '../useAgentRouterSources'
import { useTokenPlanModels } from '../useTokenPlanModels'

const query = vi.hoisted(() => vi.fn())
vi.mock('@renderer/api/billManagement', () => ({ selectTokenPlanHourlyDayUsageApi: query }))
vi.mock('../../utils/modelCapabilities', () => ({ resolveAgentRouteModelTypes: () => [] }))

const first: AgentRouterCredential = {
  id: 'key-1',
  kind: 'tokenPlan',
  label: 'First',
  value: 'secret-1',
  subscriptionId: 'sub-1',
  planId: 'plan-1'
}
const second: AgentRouterCredential = { ...first, id: 'key-2', subscriptionId: 'sub-2', planId: 'plan-2' }
const response = (id: string) => ({ rows: [{ model: id, modelName: id }] })

describe('useTokenPlanModels', () => {
  beforeEach(() => {
    query.mockReset()
    localStorage.clear()
  })

  it('does not query until a TokenPlan credential with both IDs is selected', () => {
    const { result, rerender } = renderHook(
      ({ credential }: { credential?: AgentRouterCredential }) => useTokenPlanModels(credential),
      { initialProps: {} }
    )
    rerender({ credential: { ...first, subscriptionId: undefined } })
    expect(query).not.toHaveBeenCalled()
    expect(result.current.models).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('loads without local activation and clears models when the credential is cleared', async () => {
    query.mockResolvedValue(response('model-one'))
    const { result, rerender } = renderHook(
      ({ credential }: { credential?: AgentRouterCredential }) => useTokenPlanModels(credential),
      { initialProps: { credential: first } as { credential?: AgentRouterCredential } }
    )
    await waitFor(() => expect(result.current.models.map((m) => m.id)).toEqual(['model-one']))
    expect(query).toHaveBeenCalledWith({ subscribeId: 'sub-1', planId: 'plan-1' })
    rerender({ credential: undefined })
    expect(result.current.models).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('ignores a previous subscription response after switching keys', async () => {
    let resolveFirst!: (value: ReturnType<typeof response>) => void
    query
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockResolvedValueOnce(response('model-two'))
    const { result, rerender } = renderHook(({ credential }) => useTokenPlanModels(credential), {
      initialProps: { credential: first }
    })
    rerender({ credential: second })
    expect(result.current.models).toEqual([])
    await waitFor(() => expect(result.current.models.map((m) => m.id)).toEqual(['model-two']))
    expect(query).toHaveBeenLastCalledWith({ subscribeId: 'sub-2', planId: 'plan-2' })
    await act(async () => {
      resolveFirst(response('stale-model'))
    })
    expect(result.current.models.map((m) => m.id)).toEqual(['model-two'])
  })

  it('does not retain the previous models when a new subscription request fails', async () => {
    query.mockResolvedValueOnce(response('model-one')).mockRejectedValueOnce(new Error('offline'))
    const { result, rerender } = renderHook(({ credential }) => useTokenPlanModels(credential), {
      initialProps: { credential: first }
    })
    await waitFor(() => expect(result.current.models).toHaveLength(1))
    rerender({ credential: second })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.models).toEqual([])
  })
})
