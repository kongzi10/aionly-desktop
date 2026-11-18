import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isActivatableModel,
  NEW_MODEL_PUSH_MAX,
  sortModelsByShelfDesc,
  type UnopenedPayLaterModel,
  useNewShelfModelPush
} from '../useNewShelfModelPush'

// 未开通模型接口可变 mock
const mockApi = vi.hoisted(() => ({ listUnopenedPayLaterModelsApi: vi.fn() }))
vi.mock('@renderer/api/openManagement', () => mockApi)

// 测试环境未初始化 i18n：t 返回 key(+插值参数)，足够做结构断言
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key}|${JSON.stringify(options)}` : key)
  })
}))

/** createTime 用 2026-11-{id}，id 越大越新，便于断言倒序 */
const buildModel = (id: number, over: Partial<UnopenedPayLaterModel> = {}): UnopenedPayLaterModel => ({
  id,
  modelName: `模型${id}`,
  modelAttribute: 'text_model',
  memberSpecial: '0',
  serviceName: `服务商${id}`,
  hasVipPermission: true,
  hasCallPermission: true,
  createTime: new Date(2026, 10, id, 12, 0, 0).getTime(),
  ...over
})

const modelIds = (items: { modelId: string }[]) => items.map((item) => item.modelId)

beforeEach(() => {
  mockApi.listUnopenedPayLaterModelsApi.mockReset()
})

describe('产品指标常量', () => {
  it('仅展示最新上架的 3 个模型（固定窗口；运营推送另占 2 个名额，合并总量 ≤5）', () => {
    expect(NEW_MODEL_PUSH_MAX).toBe(3)
  })
})

describe('isActivatableModel 候选池过滤', () => {
  it('text_model / image_generation 可入池', () => {
    expect(isActivatableModel(buildModel(1))).toBe(true)
    expect(isActivatableModel(buildModel(1, { modelAttribute: 'image_generation' }))).toBe(true)
  })

  it('开通弹窗不支持的属性（语音等）被剔除', () => {
    expect(isActivatableModel(buildModel(1, { modelAttribute: 'voice_model' }))).toBe(false)
    expect(isActivatableModel(buildModel(1, { modelAttribute: null }))).toBe(false)
  })

  it('全模态（omniModality=1）/决策模型（omniModality=2）被屏蔽剔除，大语言模型（0/缺省）保留', () => {
    expect(isActivatableModel(buildModel(1, { omniModality: '1' }))).toBe(false)
    expect(isActivatableModel(buildModel(1, { omniModality: '2' }))).toBe(false)
    expect(isActivatableModel(buildModel(1, { omniModality: '0' }))).toBe(true)
    expect(isActivatableModel(buildModel(1, { omniModality: null }))).toBe(true)
  })

  it('子账号被禁用调用权限的模型被剔除', () => {
    expect(isActivatableModel(buildModel(1, { hasCallPermission: false }))).toBe(false)
  })

  it('VIP 专享且无 VIP 权限被剔除，有 VIP 权限保留', () => {
    expect(isActivatableModel(buildModel(1, { memberSpecial: '1', hasVipPermission: false }))).toBe(false)
    expect(isActivatableModel(buildModel(1, { memberSpecial: '1', hasVipPermission: true }))).toBe(true)
  })

  it('缺 id / modelName 的脏数据被剔除', () => {
    expect(isActivatableModel(buildModel(1, { modelName: null }))).toBe(false)
    expect(isActivatableModel({ id: '' } as UnopenedPayLaterModel)).toBe(false)
    expect(isActivatableModel(null as unknown as UnopenedPayLaterModel)).toBe(false)
  })
})

describe('sortModelsByShelfDesc 上架时间倒序', () => {
  it('按 createTime 倒序（最新在前）', () => {
    const sorted = sortModelsByShelfDesc([buildModel(1), buildModel(3), buildModel(2)])
    expect(sorted.map((m) => m.id)).toEqual([3, 2, 1])
  })

  it('createTime 缺失（老后端未透传）按 id 倒序回退，且排在有时间条目之后', () => {
    const sorted = sortModelsByShelfDesc([
      buildModel(5, { createTime: null }),
      buildModel(2),
      buildModel(9, { createTime: undefined }),
      buildModel(3)
    ])
    expect(sorted.map((m) => m.id)).toEqual([3, 2, 9, 5])
  })

  it('兼容时间戳数字、数字字符串与日期字符串', () => {
    const sorted = sortModelsByShelfDesc([
      buildModel(1, { createTime: String(new Date(2026, 10, 5, 12).getTime()) }), // 数字字符串（最新）
      buildModel(2, { createTime: new Date(2026, 10, 1, 12).getTime() }), // 时间戳数字（最旧）
      buildModel(3, { createTime: '2026-11-03 12:00:00' }) // 日期字符串（居中）
    ])
    expect(sorted.map((m) => m.id)).toEqual([1, 3, 2])
  })

  it('不修改原数组', () => {
    const origin = [buildModel(1), buildModel(2)]
    sortModelsByShelfDesc(origin)
    expect(origin.map((m) => m.id)).toEqual([1, 2])
  })
})

describe('useNewShelfModelPush', () => {
  it('enabled 时拉取候选池，仅保留最新上架的 3 个模型（第 4 名不入池）', async () => {
    mockApi.listUnopenedPayLaterModelsApi.mockResolvedValue({
      code: 200,
      data: [buildModel(1), buildModel(2), buildModel(3), buildModel(4)]
    })
    const { result } = renderHook(() => useNewShelfModelPush(true))

    await waitFor(() => expect(result.current.items).toHaveLength(NEW_MODEL_PUSH_MAX))
    expect(modelIds(result.current.items)).toEqual(['4', '3', '2'])
    expect(result.current.poolSize).toBe(NEW_MODEL_PUSH_MAX)
    expect(result.current.items[0].kind).toBe('new_model')
    expect(result.current.items[0].id).toBe('new-model-4')
    expect(result.current.items[0].title).toContain('模型4')
    expect(result.current.items[0].description).toContain('服务商4')
    expect(result.current.items[0].buttonText).toBe('homeLanding.announcementActivate')
  })

  it('enabled=false 时不发起请求且条目为空', () => {
    const { result } = renderHook(() => useNewShelfModelPush(false))
    expect(mockApi.listUnopenedPayLaterModelsApi).not.toHaveBeenCalled()
    expect(result.current.items).toEqual([])
    expect(result.current.loaded).toBe(false)
  })

  it('loaded：首次拉取完成前置 false，完成（含失败降级）后置 true', async () => {
    mockApi.listUnopenedPayLaterModelsApi.mockResolvedValue({ code: 200, data: [buildModel(1)] })
    const { result, unmount } = renderHook(() => useNewShelfModelPush(true))
    expect(result.current.loaded).toBe(false)
    await waitFor(() => expect(result.current.loaded).toBe(true))
    unmount()

    mockApi.listUnopenedPayLaterModelsApi.mockRejectedValue(new Error('network'))
    const { result: failed } = renderHook(() => useNewShelfModelPush(true))
    await waitFor(() => expect(failed.current.loaded).toBe(true))
    expect(failed.current.items).toEqual([])
  })

  it('enabled 由 true 转 false 时 loaded 复位（重新启用后需再次就绪）', async () => {
    mockApi.listUnopenedPayLaterModelsApi.mockResolvedValue({ code: 200, data: [buildModel(1)] })
    const { result, rerender } = renderHook(({ enabled }) => useNewShelfModelPush(enabled), {
      initialProps: { enabled: true }
    })
    await waitFor(() => expect(result.current.loaded).toBe(true))

    rerender({ enabled: false })
    expect(result.current.loaded).toBe(false)
  })

  it('removeActivated 移除已开通模型后，第 4 名不补位（固定窗口）', async () => {
    mockApi.listUnopenedPayLaterModelsApi.mockResolvedValue({
      code: 200,
      data: [buildModel(1), buildModel(2), buildModel(3), buildModel(4)]
    })
    const { result } = renderHook(() => useNewShelfModelPush(true))
    await waitFor(() => expect(result.current.items).toHaveLength(3))

    act(() => result.current.removeActivated(['4']))
    // 窗口仅含最新 3 个（4/3/2），移除 4 后剩 2 条，模型 1 不顶上
    expect(modelIds(result.current.items)).toEqual(['3', '2'])
    expect(result.current.poolSize).toBe(2)
  })

  it('最新 3 个模型全部开通后 items 为空（不再显示新模型条目）', async () => {
    mockApi.listUnopenedPayLaterModelsApi.mockResolvedValue({
      code: 200,
      data: [buildModel(1), buildModel(2), buildModel(3), buildModel(4)]
    })
    const { result } = renderHook(() => useNewShelfModelPush(true))
    await waitFor(() => expect(result.current.items).toHaveLength(3))

    act(() => result.current.removeActivated(['4', '3', '2']))
    expect(result.current.items).toEqual([])
    expect(result.current.poolSize).toBe(0)
  })

  it('任一入口开通成功（MODEL_PAY_LATER_ACTIVATED 事件）后移除对应条目，不补位', async () => {
    mockApi.listUnopenedPayLaterModelsApi.mockResolvedValue({
      code: 200,
      data: [buildModel(1), buildModel(2), buildModel(3), buildModel(4)]
    })
    const { result } = renderHook(() => useNewShelfModelPush(true))
    await waitFor(() => expect(result.current.items).toHaveLength(3))

    await EventEmitter.emit(EVENT_NAMES.MODEL_PAY_LATER_ACTIVATED, { modelIds: [4, 3] })
    await waitFor(() => expect(modelIds(result.current.items)).toEqual(['2']))
  })

  it('事件负载非法（modelIds 缺失/非数组）时候选池不变', async () => {
    mockApi.listUnopenedPayLaterModelsApi.mockResolvedValue({ code: 200, data: [buildModel(1), buildModel(2)] })
    const { result } = renderHook(() => useNewShelfModelPush(true))
    await waitFor(() => expect(result.current.items).toHaveLength(2))

    await EventEmitter.emit(EVENT_NAMES.MODEL_PAY_LATER_ACTIVATED, {})
    await EventEmitter.emit(EVENT_NAMES.MODEL_PAY_LATER_ACTIVATED, { modelIds: 'oops' })
    expect(modelIds(result.current.items)).toEqual(['2', '1'])
  })

  it('接口异常静默降级为空条目，不抛错', async () => {
    mockApi.listUnopenedPayLaterModelsApi.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useNewShelfModelPush(true))

    await waitFor(() => expect(mockApi.listUnopenedPayLaterModelsApi).toHaveBeenCalled())
    await waitFor(() => expect(result.current.items).toEqual([]))
  })

  it('返回体 data 非数组时降级为空条目', async () => {
    mockApi.listUnopenedPayLaterModelsApi.mockResolvedValue({ code: 200, data: null })
    const { result } = renderHook(() => useNewShelfModelPush(true))

    await waitFor(() => expect(mockApi.listUnopenedPayLaterModelsApi).toHaveBeenCalled())
    expect(result.current.items).toEqual([])
  })

  it('enabled 由 true 转 false（开关关闭/手动关闭浮窗）时清空候选池', async () => {
    mockApi.listUnopenedPayLaterModelsApi.mockResolvedValue({ code: 200, data: [buildModel(1), buildModel(2)] })
    const { result, rerender } = renderHook(({ enabled }) => useNewShelfModelPush(enabled), {
      initialProps: { enabled: true }
    })
    await waitFor(() => expect(result.current.items).toHaveLength(2))

    rerender({ enabled: false })
    expect(result.current.items).toEqual([])
  })

  it('serviceName 缺失时描述使用通用文案', async () => {
    mockApi.listUnopenedPayLaterModelsApi.mockResolvedValue({
      code: 200,
      data: [buildModel(1, { serviceName: null })]
    })
    const { result } = renderHook(() => useNewShelfModelPush(true))

    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(result.current.items[0].description).toBe('homeLanding.newModelPushDescGeneric')
  })
})
