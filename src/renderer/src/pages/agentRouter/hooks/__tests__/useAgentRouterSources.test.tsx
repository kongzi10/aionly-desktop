import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentRouterSources } from '../useAgentRouterSources'

const storeState = vi.hoisted(() => ({ models: [] as Record<string, unknown>[] }))
const apiModelResponse = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  total: 0
}))

vi.mock('@renderer/config/models/reasoning', () => ({ isReasoningModel: () => false }))
vi.mock('@renderer/config/models/tooluse', () => ({ isFunctionCallingModel: () => false }))
vi.mock('@renderer/config/models/vision', () => ({ isVisionModel: () => false }))
vi.mock('@renderer/config/models/websearch', () => ({ isWebSearchModel: () => false }))

vi.mock('@renderer/hooks/useUserTokenPlan', () => ({
  default: () => ({
    getUserEnabledPlan: () => ({ id: 'subscription-1', planId: 'plan-1', apikey: 'token-plan-secret' })
  })
}))

const selectTokenPlanModels = vi.fn().mockResolvedValue({
  rows: [{ baseId: 'plan-model', model: 'aionly.plan-model', modelName: 'Plan model' }]
})

vi.mock('@renderer/api/billManagement', () => ({
  selectTokenPlanHourlyDayUsageApi: (params: unknown) => selectTokenPlanModels(params)
}))

const getApikeyList = vi.fn().mockResolvedValue({
  rows: [
    { id: 1, appname: 'Key One', apikey: 'sk-aaaa1111bbbb2222cccc' },
    { id: 2, appname: '', apikey: 'sk-dddd4444eeee5555ffff' }
  ]
})

vi.mock('@renderer/api/apikey', () => ({
  getApikeyList: (params: unknown) => getApikeyList(params)
}))

const getIndexTokenPlanPageList = vi.fn().mockResolvedValue({
  rows: [{ id: 7, planName: 'Pro Plan', apikey: 'tp-plan-secret', planId: 'plan-1' }]
})

vi.mock('@renderer/api/balance', () => ({
  getIndexTokenPlanPageListApi: (params: unknown) => getIndexTokenPlanPageList(params)
}))

vi.mock('@renderer/api/openManagement', () => ({
  pageListApi: vi.fn(async () => ({ code: 200, rows: apiModelResponse.rows, total: apiModelResponse.total }))
}))

vi.mock('@renderer/store', () => ({
  useAppSelector: (selector: () => unknown) => selector()
}))

vi.mock('@renderer/store/user', () => ({
  selectUserInfo: () => ({ userId: 'user-1' }),
  selectApiKey: () => 'base-api-secret',
  selectAiOnlyModels: () => storeState.models
}))

vi.mock('@shared/config/constant', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shared/config/constant')>()),
  APP_API_HOST: 'https://api.aionly.com'
}))

describe('useAgentRouterSources', () => {
  beforeEach(() => {
    storeState.models = []
    apiModelResponse.rows = [
      {
        baseId: 'api-model',
        modelName: 'API model',
        serviceName: 'API',
        packageNum: '先用后付',
        capabilities: []
      }
    ]
    apiModelResponse.total = 1
  })

  it('queries the account api keys and Token Plan keys as selectable lists', async () => {
    const { result } = renderHook(() => useAgentRouterSources())

    await waitFor(() => expect(result.current.apiCredentials).toHaveLength(2))
    expect(getApikeyList).toHaveBeenCalledWith({ pageNum: 1, pageSize: 100 })
    expect(result.current.apiCredentials[0]).toEqual({
      id: 'api-key-1',
      kind: 'api',
      label: 'Key One',
      value: 'sk-aaaa1111bbbb2222cccc'
    })
    // appname 为空时回退为脱敏后的密钥展示
    expect(result.current.apiCredentials[1].label).toMatch(/^sk-/)
    expect(result.current.credentialAliases).toEqual([
      { id: 'aionly-api', kind: 'api', label: 'AiOnly', value: 'base-api-secret' }
    ])

    await waitFor(() => expect(result.current.tokenPlanCredentials).toHaveLength(1))
    expect(getIndexTokenPlanPageList).toHaveBeenCalledWith({ pageNum: 1, pageSize: 100, status: 2 })
    expect(result.current.tokenPlanCredentials[0]).toEqual({
      id: 'token-plan-7',
      kind: 'tokenPlan',
      label: 'Pro Plan',
      value: 'tp-plan-secret',
      planId: 'plan-1'
    })
  })

  it('exposes the selected Token Plan and loads only its models', async () => {
    const { result } = renderHook(() => useAgentRouterSources())

    await waitFor(() =>
      expect(result.current.tokenPlanModels).toEqual([
        {
          id: 'aionly.plan-model',
          name: 'Plan model',
          modelTypes: []
        }
      ])
    )
    expect(selectTokenPlanModels).toHaveBeenCalledWith({ subscribeId: 'subscription-1', planId: 'plan-1' })
  })

  it('exposes each API model id only once', async () => {
    storeState.models = [{ id: 'plan-model', name: 'Wrong TokenPlan model', capabilities: [] }]
    apiModelResponse.rows = [
      { baseId: 'claude-haiku4.5', modelName: 'Claude Haiku', packageNum: '先用后付', capabilities: [] },
      {
        baseId: 'claude-haiku4.5',
        modelName: 'Claude Haiku duplicate',
        packageNum: '先用后付',
        capabilities: []
      },
      { baseId: 'glm-5.3', modelName: 'GLM 5.3', packageNum: '先用后付', capabilities: [] }
    ]
    apiModelResponse.total = 3

    const { result } = renderHook(() => useAgentRouterSources())

    await waitFor(() => expect(result.current.apiModels).toHaveLength(2))
    expect(result.current.apiModels.map((model) => model.id)).toEqual(['claude-haiku4.5', 'glm-5.3'])
    expect(result.current.apiModels[0].name).toBe('Claude Haiku')
    expect(result.current.apiModels.some((model) => model.id === 'plan-model')).toBe(false)
  })
})
