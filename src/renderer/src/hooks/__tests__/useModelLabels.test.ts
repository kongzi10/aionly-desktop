import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getModelLabelItems, invalidateModelLabelDictCache, useModelLabels } from '../useModelLabels'

// 功能开关可变 mock：默认开启，个别用例临时关闭验证一键回滚
const mockFlags = vi.hoisted(() => ({ FEATURE_MODEL_LABEL_TAGS: true }))
vi.mock('@renderer/config/featureFlags', () => mockFlags)

// 标签字典接口可变 mock：默认返回 undefined（remoteDict 不生效，走静态兜底字典）
const mockApi = vi.hoisted(() => ({ listModelLabelsApi: vi.fn() }))
vi.mock('@renderer/api/openManagement', () => mockApi)

beforeEach(() => {
  invalidateModelLabelDictCache()
  mockApi.listModelLabelsApi.mockReset()
})

afterEach(() => {
  mockFlags.FEATURE_MODEL_LABEL_TAGS = true
})

describe('getModelLabelItems', () => {
  it('字典命中的单个 labelId 映射为标签名', () => {
    expect(getModelLabelItems({ recommendLabel: '1' })).toEqual([{ id: '1', name: '人气模型' }])
    expect(getModelLabelItems({ recommendLabel: '2' })).toEqual([{ id: '2', name: '最新推荐' }])
  })

  it('逗号分隔多值 "1,2" 解析为双标签', () => {
    expect(getModelLabelItems({ recommendLabel: '1,2' })).toEqual([
      { id: '1', name: '人气模型' },
      { id: '2', name: '最新推荐' }
    ])
  })

  it('兼容中文逗号/分号/中文分号/顿号分隔与空白', () => {
    expect(getModelLabelItems({ recommendLabel: ' 1 ，2；1;2、1 ' })).toEqual([
      { id: '1', name: '人气模型' },
      { id: '2', name: '最新推荐' }
    ])
  })

  it('兼容数组与数字类型入参', () => {
    expect(getModelLabelItems({ recommendLabel: [1, '2'] })).toEqual([
      { id: '1', name: '人气模型' },
      { id: '2', name: '最新推荐' }
    ])
  })

  it('同时读取 recommendLabel 与 modelLabel 并按名称去重', () => {
    expect(getModelLabelItems({ recommendLabel: '1', modelLabel: '1,2' })).toEqual([
      { id: '1', name: '人气模型' },
      { id: '2', name: '最新推荐' }
    ])
  })

  it('字典缺失的纯数字 ID 不展示，避免露出裸 ID', () => {
    expect(getModelLabelItems({ recommendLabel: '9' })).toEqual([])
    expect(getModelLabelItems({ recommendLabel: '1,9' })).toEqual([{ id: '1', name: '人气模型' }])
  })

  it('非数字 token（后端未来直接透传名称）原样展示', () => {
    expect(getModelLabelItems({ recommendLabel: '最新上架' })).toEqual([{ id: '最新上架', name: '最新上架' }])
  })

  it('空值/非法入参返回空数组', () => {
    expect(getModelLabelItems(null)).toEqual([])
    expect(getModelLabelItems(undefined)).toEqual([])
    expect(getModelLabelItems('not-an-object')).toEqual([])
    expect(getModelLabelItems({})).toEqual([])
    expect(getModelLabelItems({ recommendLabel: '' })).toEqual([])
    expect(getModelLabelItems({ recommendLabel: null, modelLabel: undefined })).toEqual([])
  })

  it('功能开关关闭时返回空数组（一键回滚）', () => {
    mockFlags.FEATURE_MODEL_LABEL_TAGS = false
    expect(getModelLabelItems({ recommendLabel: '1,2' })).toEqual([])
  })
})

describe('useModelLabels', () => {
  it('getLabelItems 与 getModelLabelItems 行为一致且引用稳定', () => {
    const { result, rerender } = renderHook(() => useModelLabels())
    const first = result.current.getLabelItems
    rerender()
    expect(result.current.getLabelItems).toBe(first)
    expect(result.current.getLabelItems({ recommendLabel: '2' })).toEqual([{ id: '2', name: '最新推荐' }])
  })

  it('字典就绪前静态兜底可用，就绪后 getLabelItems 引用变化', async () => {
    mockApi.listModelLabelsApi.mockResolvedValue({ code: 200, data: [{ labelId: 3, labelName: '旗舰模型' }] })
    const { result } = renderHook(() => useModelLabels())
    const before = result.current.getLabelItems
    expect(before({ recommendLabel: '3' })).toEqual([])
    await waitFor(() => {
      expect(result.current.getLabelItems).not.toBe(before)
    })
    expect(result.current.getLabelItems({ recommendLabel: '3' })).toEqual([{ id: '3', name: '旗舰模型' }])
  })
})

describe('远端标签字典（/ai/modelLabel/getList）', () => {
  it('运营配置的 labelId 映射为标签名（旗舰模型/最新上架/已弃用/未发布等）', async () => {
    mockApi.listModelLabelsApi.mockResolvedValue({
      code: 200,
      data: [
        { labelId: 3, labelName: '旗舰模型' },
        { labelId: 4, labelName: '最新上架' },
        { labelId: 5, labelName: '已弃用' },
        { labelId: 6, labelName: '未发布' }
      ]
    })
    const { result } = renderHook(() => useModelLabels())
    await waitFor(() => {
      expect(result.current.getLabelItems({ recommendLabel: '3,5,6' })).toEqual([
        { id: '3', name: '旗舰模型' },
        { id: '5', name: '已弃用' },
        { id: '6', name: '未发布' }
      ])
    })
  })

  it('与静态兜底同 ID 时以远端字典为准，未覆盖的 ID 仍走静态兜底', async () => {
    mockApi.listModelLabelsApi.mockResolvedValue({ code: 200, data: [{ labelId: 1, labelName: '热门优选' }] })
    const { result } = renderHook(() => useModelLabels())
    await waitFor(() => {
      expect(result.current.getLabelItems({ recommendLabel: '1' })).toEqual([{ id: '1', name: '热门优选' }])
    })
    expect(result.current.getLabelItems({ recommendLabel: '2' })).toEqual([{ id: '2', name: '最新推荐' }])
  })

  it('接口异常静默降级为静态兜底字典', async () => {
    mockApi.listModelLabelsApi.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useModelLabels())
    await waitFor(() => expect(mockApi.listModelLabelsApi).toHaveBeenCalled())
    expect(result.current.getLabelItems({ recommendLabel: '1' })).toEqual([{ id: '1', name: '人气模型' }])
    expect(result.current.getLabelItems({ recommendLabel: '3' })).toEqual([])
  })

  it('缓存有效期内多个组件挂载复用缓存，不重复请求', async () => {
    mockApi.listModelLabelsApi.mockResolvedValue({ code: 200, data: [{ labelId: 3, labelName: '旗舰模型' }] })
    const first = renderHook(() => useModelLabels())
    await waitFor(() => {
      expect(first.result.current.getLabelItems({ recommendLabel: '3' })).toEqual([{ id: '3', name: '旗舰模型' }])
    })
    renderHook(() => useModelLabels())
    expect(mockApi.listModelLabelsApi).toHaveBeenCalledTimes(1)
  })
})
