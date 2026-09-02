import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentRouter } from '../useAgentRouter'

vi.mock('../useAgentRouterSources', () => {
  const sources = {
    accountId: 'account-a',
    apiUrl: 'https://api.aionly.com/v1',
    apiModels: [{ id: 'gpt-5', name: 'GPT-5' }],
    tokenPlanModels: [],
    tokenPlanModelsLoading: false,
    apiCredentials: [{ id: 'credential-1', kind: 'api', label: 'Key', value: 'secret' }],
    tokenPlanCredentials: [],
    credentialAliases: [],
    refreshTokenPlan: vi.fn()
  }
  return { useAgentRouterSources: () => sources }
})

describe('useAgentRouter', () => {
  const inspectTarget = vi.fn()
  const getRouteConfig = vi.fn()
  const saveRouteModels = vi.fn()
  const removeRouteModels = vi.fn()
  const createAgentRoute = vi.fn()
  const updateAgentRoute = vi.fn()
  const copyTemplatesToAgent = vi.fn()
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
    createAgentRoute.mockResolvedValue({ ...routeFixture, credentialId: 'new-key', enabled: true })
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
          copyTemplatesToAgent,
          removeRouteModels,
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

  it('creates a batch of routes enabled and applies them once', async () => {
    createAgentRoute
      .mockResolvedValueOnce({ ...routeFixture, credentialId: 'new-key', enabled: true })
      .mockResolvedValueOnce({ ...routeFixture, modelId: 'claude-sonnet', credentialId: 'new-key-2', enabled: true })
    const { result } = renderHook(() => useAgentRouter())
    await waitFor(() => expect(result.current.target?.revision).toBe('revision-1'))
    await act(() =>
      result.current.createAgentRoute([
        {
          modelId: 'gpt-5',
          displayName: 'GPT-5',
          accessMode: 'api',
          apiKey: 'secret',
          modelTypes: ['function_calling']
        },
        { modelId: 'claude-sonnet', accessMode: 'api', apiKey: 'secret', modelTypes: [] }
      ])
    )
    expect(createAgentRoute).toHaveBeenCalledWith('account-a', expect.objectContaining({ modelId: 'gpt-5' }))
    expect(previewWorkBuddyRoutes).toHaveBeenCalledWith(
      expect.objectContaining({
        enabledRoutes: [
          { modelId: 'gpt-5', credentialId: 'new-key' },
          { modelId: 'claude-sonnet', credentialId: 'new-key-2' }
        ]
      })
    )
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('preserves duplicate route state and disables an old key when adding an alternate', async () => {
    const existing = { ...routeFixture, credentialId: 'credential-1', enabled: true }
    getRouteConfig.mockResolvedValue({ targetId: 'workbuddy', models: [existing] })
    createAgentRoute
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({ ...routeFixture, credentialId: 'new-key', enabled: true })
    const { result } = renderHook(() => useAgentRouter())
    await waitFor(() => expect(result.current.routes).toHaveLength(1))
    await act(() =>
      result.current.createAgentRoute([{ modelId: 'gpt-5', accessMode: 'api', apiKey: 'secret', modelTypes: [] }])
    )
    expect(apply).not.toHaveBeenCalled()
    await act(() =>
      result.current.createAgentRoute([{ modelId: 'gpt-5', accessMode: 'api', apiKey: 'other-secret', modelTypes: [] }])
    )
    expect(previewWorkBuddyRoutes).toHaveBeenCalledWith(
      expect.objectContaining({
        enabledRoutes: [{ modelId: 'gpt-5', credentialId: 'new-key' }]
      })
    )
  })

  it('enables copied routes with the last same-model key winning while preserving unrelated routes', async () => {
    const other = { ...routeFixture, modelId: 'other', credentialId: 'other-key', enabled: true }
    getRouteConfig.mockResolvedValue({
      targetId: 'workbuddy',
      models: [other, { ...routeFixture, credentialId: 'old-key', enabled: true }]
    })
    copyTemplatesToAgent.mockResolvedValue([
      { ...routeFixture, credentialId: 'new-key-1', enabled: true },
      { ...routeFixture, credentialId: 'new-key-2', enabled: true }
    ])
    const { result } = renderHook(() => useAgentRouter())
    await waitFor(() => expect(result.current.routes).toHaveLength(2))
    await act(() => result.current.copyTemplatesToAgent(['template-1', 'template-2']))
    expect(previewWorkBuddyRoutes).toHaveBeenCalledWith(
      expect.objectContaining({
        enabledRoutes: [
          { modelId: 'other', credentialId: 'other-key' },
          { modelId: 'gpt-5', credentialId: 'new-key-2' }
        ]
      })
    )
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it.each(['direct', 'copy'])('rolls back only new records after a failed %s apply', async (path) => {
    const existing = { ...routeFixture, credentialId: 'credential-1', enabled: true }
    getRouteConfig.mockResolvedValue({ targetId: 'workbuddy', models: [existing] })
    copyTemplatesToAgent.mockResolvedValue([{ ...routeFixture, credentialId: 'new-key', enabled: true }])
    previewWorkBuddyRoutes.mockRejectedValueOnce(new Error('REVISION_CONFLICT'))
    const { result } = renderHook(() => useAgentRouter())
    await waitFor(() => expect(result.current.routes).toHaveLength(1))
    await act(async () => {
      const operation =
        path === 'direct'
          ? result.current.createAgentRoute([
              { modelId: 'gpt-5', accessMode: 'api', apiKey: 'new-secret', modelTypes: [] }
            ])
          : result.current.copyTemplatesToAgent(['template-new'])
      await expect(operation).rejects.toThrow('REVISION_CONFLICT')
    })
    expect(removeRouteModels).toHaveBeenCalledWith('account-a', [{ modelId: 'gpt-5', credentialId: 'new-key' }])
    expect(result.current.routes).toEqual([existing])
  })

  it('removes an inactive record even when WorkBuddy is unavailable', async () => {
    const route = { ...routeFixture, credentialId: 'credential-1', enabled: false }
    getRouteConfig.mockResolvedValue({ targetId: 'workbuddy', models: [route] })
    inspectTarget.mockResolvedValue({ targetId: 'workbuddy', exists: false })
    const { result } = renderHook(() => useAgentRouter())
    await waitFor(() => expect(result.current.routes).toHaveLength(1))
    await act(() => result.current.removeRoute(route))
    expect(removeRouteModels).toHaveBeenCalledWith('account-a', [{ modelId: 'gpt-5', credentialId: 'credential-1' }])
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
