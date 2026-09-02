import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentRouter } from '../useAgentRouter'

vi.mock('../useAgentRouterSources', () => ({
  useAgentRouterSources: () => ({
    accountId: 'account-a',
    apiUrl: 'https://api.aionly.com/v1',
    apiModels: [{ id: 'gpt-5', name: 'GPT-5' }],
    tokenPlanModels: [],
    tokenPlanModelsLoading: false,
    apiCredentials: [{ id: 'credential-1', kind: 'api', label: 'Key', value: 'secret' }],
    tokenPlanCredentials: [],
    credentialAliases: [],
    refreshTokenPlan: vi.fn()
  })
}))

describe('useAgentRouter', () => {
  const inspectTarget = vi.fn()
  const getRouteConfig = vi.fn()
  const saveRouteModels = vi.fn()
  const createAgentRoute = vi.fn()
  const updateAgentRoute = vi.fn()
  const previewWorkBuddyRoutes = vi.fn()
  const apply = vi.fn()
  const listGlobalTemplates = vi.fn()
  const listAgentCredentialSummaries = vi.fn()
  let targetChanged: ((targetId: 'workbuddy' | 'codex') => void) | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    targetChanged = undefined
    inspectTarget.mockResolvedValue({ targetId: 'workbuddy', writable: true, revision: 'revision-1' })
    getRouteConfig.mockResolvedValue({ targetId: 'workbuddy', models: [] })
    saveRouteModels.mockResolvedValue(undefined)
    createAgentRoute.mockResolvedValue(undefined)
    updateAgentRoute.mockResolvedValue({ ...routeFixture, credentialId: 'credential-2', enabled: false })
    previewWorkBuddyRoutes.mockResolvedValue({
      previewToken: 'token',
      expectedRevision: 'revision-1',
      counts: { added: 1, updated: 0, removed: 0, unchanged: 0 }
    })
    apply.mockResolvedValue({ targetId: 'workbuddy', revision: 'revision-2' })
    listGlobalTemplates.mockResolvedValue([])
    listAgentCredentialSummaries.mockResolvedValue([])
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        agentRouter: {
          inspectTarget,
          getRouteConfig,
          listGlobalTemplates,
          listAgentCredentialSummaries,
          saveRouteModels,
          createAgentRoute,
          updateAgentRoute,
          removeRouteModels: vi.fn(),
          previewWorkBuddyRoutes,
          apply,
          onTargetChanged: vi.fn((callback) => {
            targetChanged = callback
            return vi.fn()
          }),
          selectConfig: vi.fn()
        }
      }
    })
  })

  afterEach(() => vi.useRealTimers())

  it('creates a direct route disabled without applying it', async () => {
    const { result } = renderHook(() => useAgentRouter())
    await waitFor(() => expect(result.current.target?.revision).toBe('revision-1'))
    await act(() =>
      result.current.createAgentRoute({
        modelId: 'gpt-5',
        displayName: 'GPT-5',
        accessMode: 'api',
        apiKey: 'secret',
        modelTypes: ['function_calling']
      })
    )
    expect(createAgentRoute).toHaveBeenCalledWith('account-a', expect.objectContaining({ modelId: 'gpt-5' }))
    expect(previewWorkBuddyRoutes).not.toHaveBeenCalled()
    expect(apply).not.toHaveBeenCalled()
  })

  it('refreshes when the WorkBuddy config file changes', async () => {
    renderHook(() => useAgentRouter())
    await waitFor(() => expect(getRouteConfig).toHaveBeenCalledTimes(1))

    act(() => targetChanged?.('workbuddy'))

    await waitFor(() => expect(getRouteConfig).toHaveBeenCalledTimes(2))
  })

  it('keeps the refreshing indicator visible for at least 500ms', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useAgentRouter())

    await act(async () => {})
    expect(result.current.refreshing).toBe(true)

    await act(() => vi.advanceTimersByTimeAsync(499))
    expect(result.current.refreshing).toBe(true)

    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(result.current.refreshing).toBe(false)
  })

  it('automatically applies an enabled-state change', async () => {
    getRouteConfig.mockResolvedValue({
      targetId: 'workbuddy',
      models: [
        {
          modelId: 'gpt-5',
          displayName: 'GPT-5',
          accessMode: 'api',
          credentialId: 'credential-1',
          enabled: true,
          modelTypes: ['function_calling'],
          routedAt: '2026-08-31T00:00:00Z'
        }
      ]
    })
    const { result } = renderHook(() => useAgentRouter())
    await waitFor(() => expect(result.current.routes).toHaveLength(1))
    const route = result.current.routes[0]
    await act(() => result.current.setRouteEnabled(route, false))
    expect(saveRouteModels).toHaveBeenCalledWith('account-a', [expect.objectContaining({ enabled: false })])
    expect(previewWorkBuddyRoutes).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'account-a' }))
    expect(apply).toHaveBeenCalledWith({
      accountId: 'account-a',
      previewToken: 'token',
      expectedRevision: 'revision-1'
    })
  })

  it('disables an enabled same-model route when enabling its alternate key', async () => {
    getRouteConfig.mockResolvedValue({
      targetId: 'workbuddy',
      models: [
        { ...routeFixture, credentialId: 'credential-1', enabled: true },
        { ...routeFixture, credentialId: 'credential-2', enabled: false }
      ]
    })
    const { result } = renderHook(() => useAgentRouter())
    await waitFor(() => expect(result.current.routes).toHaveLength(2))
    await act(() => result.current.setRouteEnabled(result.current.routes[1], true))
    expect(saveRouteModels).toHaveBeenCalledWith('account-a', [
      expect.objectContaining({ credentialId: 'credential-1', enabled: false }),
      expect.objectContaining({ credentialId: 'credential-2', enabled: true })
    ])
  })

  it('keeps an enabled route active while replacing its credential', async () => {
    getRouteConfig.mockResolvedValue({
      targetId: 'workbuddy',
      models: [{ ...routeFixture, credentialId: 'credential-1', enabled: true }]
    })
    const { result } = renderHook(() => useAgentRouter())
    await waitFor(() => expect(result.current.routes).toHaveLength(1))

    await act(() =>
      result.current.updateAgentRoute(result.current.routes[0], {
        displayName: '',
        accessMode: 'api',
        apiKey: 'new-secret',
        modelTypes: routeFixture.modelTypes
      })
    )

    expect(previewWorkBuddyRoutes).toHaveBeenCalledWith(
      expect.objectContaining({ enabledRoutes: [{ modelId: 'gpt-5', credentialId: 'credential-2' }] })
    )
  })
})

const routeFixture = {
  modelId: 'gpt-5',
  displayName: 'GPT-5',
  accessMode: 'api' as const,
  modelTypes: ['function_calling'] as const,
  routedAt: '2026-08-31T00:00:00Z'
}
