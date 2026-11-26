import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn()
    })
  }
}))

vi.mock('@renderer/api/experience', () => ({
  getChangeModelListApi: vi.fn()
}))

import { getChangeModelListApi } from '@renderer/api/experience'

import { useExperienceModels } from '../useExperienceModels'

const mockApi = vi.mocked(getChangeModelListApi)

const okResponse = (rows: unknown[]) => ({ code: 200, rows }) as never

const sampleRow = (over: Record<string, unknown> = {}) => ({
  id: '100',
  modelName: 'GLM-5.2',
  serviceName: 'zhipu',
  modelAttribute: 'text_model',
  modelFileUrl: 'https://cdn/x.png',
  userExperienceAll: 1000000,
  userExperienceRest: 160000,
  ...over
})

describe('useExperienceModels', () => {
  beforeEach(() => {
    mockApi.mockReset()
  })

  it('enabled 时自动拉取 office 免费体验模型，并归一化额度', async () => {
    mockApi.mockResolvedValue(okResponse([sampleRow()]))

    const { result } = renderHook(() => useExperienceModels({ enabled: true }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockApi).toHaveBeenCalledWith({ selectType: 'office' })
    expect(result.current.error).toBe(false)
    expect(result.current.models).toHaveLength(1)
    expect(result.current.models[0].quota).toMatchObject({ total: 1000000, rest: 840000, unit: 'tokens', tone: 'ok' })
  })

  it('透传 modelAttribute / modelType 过滤参数', async () => {
    mockApi.mockResolvedValue(okResponse([]))

    const { result } = renderHook(() =>
      useExperienceModels({ enabled: true, modelAttribute: 'image_generation', modelType: '3' })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockApi).toHaveBeenCalledWith({ selectType: 'office', modelAttribute: 'image_generation', type: '3' })
  })

  it('按 (baseId/id, serviceName) 去重，保留第一条', async () => {
    mockApi.mockResolvedValue(
      okResponse([sampleRow({ id: '100' }), sampleRow({ id: '100', modelName: 'dup' }), sampleRow({ id: '200' })])
    )

    const { result } = renderHook(() => useExperienceModels({ enabled: true }))

    await waitFor(() => expect(result.current.models).toHaveLength(2))
    expect(result.current.models.map((m) => m.id)).toEqual(['100', '200'])
  })

  it('无额度配置的行 quota 为 undefined（行内不展示额度区）', async () => {
    mockApi.mockResolvedValue(okResponse([sampleRow({ userExperienceAll: undefined, userExperienceRest: undefined })]))

    const { result } = renderHook(() => useExperienceModels({ enabled: true }))

    await waitFor(() => expect(result.current.models).toHaveLength(1))
    expect(result.current.models[0].quota).toBeUndefined()
  })

  it('code !== 200 时进入错误态', async () => {
    mockApi.mockResolvedValue({ code: 500 } as never)

    const { result } = renderHook(() => useExperienceModels({ enabled: true }))

    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.models).toEqual([])
  })

  it('请求异常（网络错误）时进入错误态且不抛出', async () => {
    mockApi.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useExperienceModels({ enabled: true }))

    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.models).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('enabled=false（开关回滚）时不发请求', async () => {
    const { result } = renderHook(() => useExperienceModels({ enabled: false }))

    // 等一个宏任务确认无请求发出
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockApi).not.toHaveBeenCalled()
    expect(result.current.models).toEqual([])
  })

  it('refetch 重新拉取并清除错误态', async () => {
    mockApi.mockResolvedValueOnce({ code: 500 } as never).mockResolvedValueOnce(okResponse([sampleRow()]))

    const { result } = renderHook(() => useExperienceModels({ enabled: true }))

    await waitFor(() => expect(result.current.error).toBe(true))

    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => expect(result.current.error).toBe(false))
    expect(result.current.models).toHaveLength(1)
    expect(mockApi).toHaveBeenCalledTimes(2)
  })
})
