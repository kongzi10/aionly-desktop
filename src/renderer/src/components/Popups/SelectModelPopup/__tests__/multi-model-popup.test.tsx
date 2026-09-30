import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@renderer/components/TopView', () => ({
  TopView: { show: vi.fn(), hide: vi.fn() }
}))

vi.mock('@renderer/components/TopView/toast', () => ({
  warning: vi.fn()
}))

// 虚拟列表在 jsdom 中不便测量，直接平铺渲染以便断言
vi.mock('@renderer/components/VirtualList', () => ({
  DynamicVirtualList: ({ list, children }: { list: any[]; children: (item: any) => ReactNode }) => (
    <div data-testid="virtual-list">
      {list.map((item) => (
        <div key={item.key}>{children(item)}</div>
      ))}
    </div>
  ),
  DynamicVirtualListRef: null
}))

vi.mock('@renderer/api/billManagement', () => ({
  selectTokenPlanHourlyDayUsageApi: vi.fn().mockResolvedValue({ rows: [] })
}))

const { cannedModels, getModelUniqIdMock } = vi.hoisted(() => {
  const makeModel = (id: string, modelName: string, serviceName: string, extra: Record<string, unknown> = {}) => ({
    id,
    model: id,
    baseId: id,
    modelName,
    name: modelName,
    serviceName,
    group: 'chat',
    provider: 'aionly',
    ...extra
  })
  return {
    cannedModels: [
      makeModel('gpt-4.1', 'GPT-4.1', 'OpenAI'),
      makeModel('deepseek-v3.1', 'deepseek-v3.1', 'DeepSeek'),
      makeModel('deepseek-r1', 'deepseek-r1', 'DeepSeek', { memberSpecial: 1 })
    ],
    getModelUniqIdMock: (m: any) => (m ? JSON.stringify({ id: m.id, provider: m.provider }) : '')
  }
})

vi.mock('@renderer/hooks/useAiOnlyModels', () => ({
  transformToModel: (item: any) => ({ ...item, id: item.baseId || item.model, name: item.modelName }),
  useAiOnlyModels: vi.fn(() => ({
    models: [],
    loading: false,
    setLoading: vi.fn(),
    fetchNextPage: vi.fn(),
    hasMore: false,
    getFilteredModels: vi.fn(() => cannedModels)
  }))
}))

vi.mock('@renderer/hooks/useUserTokenPlan', () => ({
  default: () => ({ getUserEnabledPlan: vi.fn(() => null) })
}))

vi.mock('@renderer/store', () => ({
  useAppSelector: vi.fn(() => undefined)
}))

vi.mock('@renderer/store/user', () => ({
  selectUserInfo: (state: any) => state?.user?.userInfo
}))

vi.mock('@renderer/services/ModelService', () => ({
  getModelUniqId: getModelUniqIdMock
}))

vi.mock('@renderer/config/models', () => ({
  isNotSupportTextDeltaModel: vi.fn(() => false)
}))

vi.mock('@renderer/utils', () => ({
  classNames: (obj: Record<string, unknown>) =>
    Object.entries(obj)
      .filter(([, value]) => value)
      .map(([key]) => key)
      .join(' ')
}))

import { warning } from '@renderer/components/TopView/toast'

import SelectMultiModelsPopupView from '../multi-model-popup'

describe('SelectMultiModelsPopupView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom 不支持伪元素查询，antd Modal 挂载时会触发 jsdom 的 not-implemented 抛错
    const originalGetComputedStyle = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => originalGetComputedStyle(element))
    // antd 的响应式断点需要 matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })
    })
  })

  it('renders models grouped by serviceName', () => {
    render(<SelectMultiModelsPopupView resolve={() => {}} />)

    expect(screen.getByText('OpenAI')).toBeInTheDocument()
    expect(screen.getByText('DeepSeek')).toBeInTheDocument()
    expect(screen.getByText('GPT-4.1')).toBeInTheDocument()
    expect(screen.getByText('deepseek-v3.1')).toBeInTheDocument()
    expect(screen.getByText('deepseek-r1')).toBeInTheDocument()
  })

  it('applies modelFilter to the model list', () => {
    render(<SelectMultiModelsPopupView modelFilter={(m) => m.serviceName !== 'OpenAI'} resolve={() => {}} />)

    expect(screen.queryByText('GPT-4.1')).not.toBeInTheDocument()
    expect(screen.getByText('deepseek-v3.1')).toBeInTheDocument()
  })

  it('toggles selection on click and resolves selected models on confirm', async () => {
    const user = userEvent.setup()
    const resolve = vi.fn()
    render(<SelectMultiModelsPopupView resolve={resolve} />)

    await user.click(screen.getByText('GPT-4.1'))
    await user.click(screen.getByText('deepseek-r1'))
    await user.click(screen.getByText('common.confirm'))

    await waitFor(() => {
      // 确认后 afterClose 还会 resolve(undefined)，Promise 只取第一次结果
      expect(resolve.mock.calls[0][0]).not.toBeUndefined()
    })
    const resolved = resolve.mock.calls[0][0] as any[]
    expect(resolved.map((m) => m.name)).toEqual(['GPT-4.1', 'deepseek-r1'])
  })

  it('removes a selected model when clicking it again', async () => {
    const user = userEvent.setup()
    const resolve = vi.fn()
    render(
      <SelectMultiModelsPopupView selectedModels={[{ id: 'gpt-4.1', provider: 'aionly' } as any]} resolve={resolve} />
    )

    await user.click(screen.getByText('GPT-4.1'))
    await user.click(screen.getByText('common.confirm'))

    expect(resolve.mock.calls[0][0]).toEqual([])
  })

  it('enforces maxCount when selection exceeds the limit', async () => {
    const user = userEvent.setup()
    const resolve = vi.fn()
    // 非会员默认上限为 2，第三个模型应无法选中
    render(<SelectMultiModelsPopupView resolve={resolve} />)

    await user.click(screen.getByText('GPT-4.1'))
    await user.click(screen.getByText('deepseek-v3.1'))
    await user.click(screen.getByText('deepseek-r1'))
    await user.click(screen.getByText('common.confirm'))

    const resolved = resolve.mock.calls[0][0] as any[]
    expect(resolved.map((m) => m.name)).toEqual(['GPT-4.1', 'deepseek-v3.1'])
  })

  it('shows the roundtable model limit as a toast', async () => {
    const user = userEvent.setup()
    render(<SelectMultiModelsPopupView mode="roundtable" resolve={() => {}} />)

    await user.click(screen.getByText('GPT-4.1'))
    await user.click(screen.getByText('deepseek-v3.1'))
    await user.click(screen.getByText('deepseek-r1'))

    expect(warning).toHaveBeenCalledWith('roundtable.max_models_free')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('search filters models by serviceName and modelName', async () => {
    const user = userEvent.setup()
    render(<SelectMultiModelsPopupView resolve={() => {}} />)

    await user.type(screen.getByPlaceholderText('models.search.placeholder'), 'deepseek')

    expect(screen.getByText('deepseek-v3.1')).toBeInTheDocument()
    expect(screen.getByText('deepseek-r1')).toBeInTheDocument()
    expect(screen.queryByText('GPT-4.1')).not.toBeInTheDocument()
  })
})
