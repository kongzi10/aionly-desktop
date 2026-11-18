import { batchAddModelPayLaterApi } from '@renderer/api/balance'
import { type NewModelPushItem, useNewShelfModelPush } from '@renderer/hooks/useNewShelfModelPush'
import type { HomePushItem } from '@renderer/pages/home/homeContent'
import { getHomePushList } from '@renderer/pages/home/homeContentApi'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import UserAvatar from '..'

vi.mock('@renderer/pages/home/homeContentApi', () => ({ getHomePushList: vi.fn() }))
// 默认规则 hook mock：候选池数据由用例逐个注入
const mockRemoveActivated = vi.hoisted(() => vi.fn())
// window.modal / window.toast 桩：测试环境无 AntdProvider 注入
const mockModalWarning = vi.hoisted(() => vi.fn())
const mockToastSuccess = vi.hoisted(() => vi.fn())
vi.mock('@renderer/hooks/useNewShelfModelPush', () => ({
  NEW_MODEL_PUSH_MAX: 3,
  useNewShelfModelPush: vi.fn(() => ({
    items: [],
    poolSize: 0,
    loaded: true,
    removeActivated: mockRemoveActivated,
    refresh: vi.fn()
  }))
}))
// 批量开通接口 mock：直连开通流程的断言对象
vi.mock('@renderer/api/balance', () => ({ batchAddModelPayLaterApi: vi.fn() }))
// 测试环境未初始化 i18n：t 返回 key，保证 aria-label 等断言稳定
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))
vi.mock('@renderer/store', () => ({
  useAppSelector: vi.fn(() => ({})),
  useAppDispatch: vi.fn(() => vi.fn())
}))
vi.mock('@renderer/store/user', () => ({
  selectUserInfo: (state: unknown) => state,
  clearToken: vi.fn()
}))
vi.mock('@renderer/context/ThemeProvider', () => ({ useTheme: () => ({ theme: 'light' }) }))
vi.mock('@renderer/hooks/useMinappPopup', () => ({
  useMinappPopup: () => ({ hideMinappPopup: vi.fn(), closeAllMinapps: vi.fn() })
}))
vi.mock('@renderer/hooks/useRuntime', () => ({
  useRuntime: () => ({ minappShow: false }),
  modelGenerating: vi.fn()
}))
vi.mock('@renderer/services/ProfileLifecycleService', () => ({ applyProfileSwitch: vi.fn() }))
vi.mock('@renderer/config/sidebar', () => ({ SHOW_IN_USER_MENUS: [] }))
vi.mock('@renderer/i18n/label', () => ({ getSidebarIconLabel: (name: string) => name }))

const first: HomePushItem = {
  id: 'a1',
  pushType: 'avatar_overlay',
  title: 'AI 模型体验',
  description: '注册即得体验金',
  buttonText: '立即前往',
  buttonUrl: '/tokenPlan'
}

const second: HomePushItem = {
  id: 'a2',
  pushType: 'avatar_overlay',
  title: '邀请好友',
  description: '双方都得奖励',
  buttonText: '去邀请',
  buttonUrl: '/tokenPlan'
}

const third: HomePushItem = {
  id: 'a3',
  pushType: 'avatar_overlay',
  title: '活动三',
  description: '第三条运营推送',
  buttonText: '立即前往',
  buttonUrl: '/tokenPlan'
}

const fourth: HomePushItem = {
  id: 'a4',
  pushType: 'avatar_overlay',
  title: '活动四',
  description: '第四条运营推送（应被运营名额上限 2 条截断）',
  buttonText: '立即前往',
  buttonUrl: '/tokenPlan'
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
  Object.assign(window, {
    modal: { warning: mockModalWarning, confirm: vi.fn() },
    toast: { success: mockToastSuccess, error: vi.fn() }
  })
})

const renderAvatar = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<UserAvatar />} />
        <Route path="/tokenPlan" element={<div>token-plan-page</div>} />
      </Routes>
    </MemoryRouter>
  )

const buildNewModelItem = (modelId: string, name: string): NewModelPushItem => ({
  kind: 'new_model',
  id: `new-model-${modelId}`,
  modelId,
  title: `${name} 已上架`,
  description: `服务商${modelId} 新模型，开通后即可在对话中使用`,
  buttonText: '立即开通'
})

// 最新上架的 3 个模型（固定窗口：第 4 名不入池、不补位）
const newModelItems = [
  buildNewModelItem('4', '模型四'),
  buildNewModelItem('3', '模型三'),
  buildNewModelItem('2', '模型二')
]

const mockNewShelfPush = (items: NewModelPushItem[], poolSize = items.length, loaded = true) =>
  vi.mocked(useNewShelfModelPush).mockReturnValue({
    items,
    poolSize,
    loaded,
    removeActivated: mockRemoveActivated,
    refresh: vi.fn()
  })

describe('UserAvatar overlay', () => {
  it('shows by default on home and switches slide when a dot is clicked', async () => {
    vi.mocked(getHomePushList).mockResolvedValue([first, second])
    renderAvatar()

    await waitFor(() => expect(screen.getByText('AI 模型体验')).toBeInTheDocument())

    const firstDot = screen.getByRole('button', { name: first.title })
    const secondDot = screen.getByRole('button', { name: second.title })
    expect(firstDot).toHaveClass('active')

    fireEvent.click(secondDot)
    expect(secondDot).toHaveClass('active')
    expect(firstDot).not.toHaveClass('active')
  })

  it('runs the configured route action when the carousel action button is clicked', async () => {
    vi.mocked(getHomePushList).mockResolvedValue([first, second])
    renderAvatar()

    const action = await screen.findByRole('button', { name: '立即前往' })
    fireEvent.click(action)

    expect(await screen.findByText('token-plan-page')).toBeInTheDocument()
  })
})

describe('UserAvatar 新上架模型推送（与运营推送合并轮播）', () => {
  beforeEach(() => {
    vi.mocked(getHomePushList).mockReset()
    vi.mocked(batchAddModelPayLaterApi).mockReset()
    mockModalWarning.mockReset()
    mockToastSuccess.mockReset()
    mockRemoveActivated.mockReset()
    mockNewShelfPush([])
  })

  it('无运营推送时展示最新上架的 3 个模型', async () => {
    vi.mocked(getHomePushList).mockResolvedValue([])
    mockNewShelfPush(newModelItems)
    renderAvatar()

    await waitFor(() => expect(screen.getByText('模型四 已上架')).toBeInTheDocument())
    expect(useNewShelfModelPush).toHaveBeenLastCalledWith(true)
    expect(screen.getByRole('button', { name: '立即开通' })).toBeInTheDocument()
    // 3 条轮播圆点（aria-label 为条目标题）
    expect(screen.getAllByRole('button', { name: /已上架$/ })).toHaveLength(3)
  })

  it('合并轮播：3 个待开通模型 + 2 条运营推送（前 3 名额新模型、后 2 名额运营，总量 ≤5）', async () => {
    vi.mocked(getHomePushList).mockResolvedValue([first, second, third])
    mockNewShelfPush(newModelItems)
    renderAvatar()

    await waitFor(() => expect(screen.getByText('模型四 已上架')).toBeInTheDocument())
    expect(useNewShelfModelPush).toHaveBeenLastCalledWith(true)
    expect(screen.getByText('AI 模型体验')).toBeInTheDocument()
    expect(screen.getByText('邀请好友')).toBeInTheDocument()
    // 第 3 条运营推送被运营名额上限（2 条）截断
    expect(screen.queryByText('活动三')).not.toBeInTheDocument()
    // 5 个轮播圆点：3 新模型 + 2 运营
    expect(screen.getAllByRole('button', { name: /已上架$|AI 模型体验|邀请好友/ })).toHaveLength(5)
    // 首个圆点对应新模型条目（前 3 名额）
    expect(screen.getByRole('button', { name: '模型四 已上架' })).toHaveClass('active')
  })

  it('合并轮播：1 个待开通模型时与 2 条运营推送合并（总量 3）', async () => {
    vi.mocked(getHomePushList).mockResolvedValue([first, second])
    mockNewShelfPush([newModelItems[0]], 1)
    renderAvatar()

    await waitFor(() => expect(screen.getByText('模型四 已上架')).toBeInTheDocument())
    expect(screen.getByText('AI 模型体验')).toBeInTheDocument()
    expect(screen.getByText('邀请好友')).toBeInTheDocument()
    // 轮播圆点 aria-label = 条目标题，共 3 个
    expect(screen.getAllByRole('button', { name: /已上架$|AI 模型体验|邀请好友/ })).toHaveLength(3)
    // 首个圆点对应新模型条目（优先占位）
    expect(screen.getByRole('button', { name: '模型四 已上架' })).toHaveClass('active')
  })

  it('无新模型时运营推送最多展示 2 条', async () => {
    vi.mocked(getHomePushList).mockResolvedValue([first, second, third, fourth])
    mockNewShelfPush([], 0)
    renderAvatar()

    await waitFor(() => expect(screen.getByText('AI 模型体验')).toBeInTheDocument())
    expect(screen.getByText('邀请好友')).toBeInTheDocument()
    // 第 3、4 条被运营名额上限（2 条）截断
    expect(screen.queryByText('活动三')).not.toBeInTheDocument()
    expect(screen.queryByText('活动四')).not.toBeInTheDocument()
  })

  it('新模型列表就绪前不渲染浮窗（防止条目跳变）', async () => {
    vi.mocked(getHomePushList).mockResolvedValue([first, second])
    mockNewShelfPush([], 0, false)
    renderAvatar()

    await waitFor(() => expect(getHomePushList).toHaveBeenCalledWith('avatar_overlay'))
    await act(async () => {
      await Promise.resolve()
    })
    // 运营列表已就绪但新模型列表未就绪：整体暂不显示
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('点击「立即开通」弹出开通确认框，确认前不调用开通接口', async () => {
    vi.mocked(getHomePushList).mockResolvedValue([])
    mockNewShelfPush(newModelItems)
    renderAvatar()

    const action = await screen.findByRole('button', { name: '立即开通' })
    fireEvent.click(action)

    expect(mockModalWarning).toHaveBeenCalledTimes(1)
    const config = mockModalWarning.mock.calls[0][0]
    expect(config.title).toBe('homeLanding.newModelActivateTitle')
    expect(config.okText).toBe('settings.models.add.activate_model')
    expect(batchAddModelPayLaterApi).not.toHaveBeenCalled()
    expect(mockRemoveActivated).not.toHaveBeenCalled()
  })

  it('确认开通后直连接口开通对应模型，成功则移除对应条目并广播事件', async () => {
    vi.mocked(getHomePushList).mockResolvedValue([])
    mockNewShelfPush(newModelItems)
    vi.mocked(batchAddModelPayLaterApi).mockResolvedValue({ code: 200 })
    const events: unknown[] = []
    const unsubscribe = EventEmitter.on(EVENT_NAMES.MODEL_PAY_LATER_ACTIVATED, (event: unknown) => {
      events.push(event)
    })
    renderAvatar()

    const action = await screen.findByRole('button', { name: '立即开通' })
    fireEvent.click(action)
    const config = mockModalWarning.mock.calls[0][0]
    await config.onOk()

    expect(batchAddModelPayLaterApi).toHaveBeenCalledWith({ modelIds: ['4'], autoOpenNewModel: false })
    expect(mockToastSuccess).toHaveBeenCalledWith('homeLanding.newModelActivateSuccess')
    expect(events).toEqual([{ modelIds: ['4'] }])
    expect(mockRemoveActivated).toHaveBeenCalledWith(['4'])
    unsubscribe()
  })

  it('开通失败时确认框保持打开（onOk 抛错）且不做移除', async () => {
    vi.mocked(getHomePushList).mockResolvedValue([])
    mockNewShelfPush(newModelItems)
    vi.mocked(batchAddModelPayLaterApi).mockRejectedValue(new Error('biz error'))
    const events: unknown[] = []
    const unsubscribe = EventEmitter.on(EVENT_NAMES.MODEL_PAY_LATER_ACTIVATED, (event: unknown) => {
      events.push(event)
    })
    renderAvatar()

    const action = await screen.findByRole('button', { name: '立即开通' })
    fireEvent.click(action)
    const config = mockModalWarning.mock.calls[0][0]
    await expect(config.onOk()).rejects.toThrow('biz error')

    expect(mockRemoveActivated).not.toHaveBeenCalled()
    expect(events).toEqual([])
    unsubscribe()
  })

  it('最新 3 个模型均开通且无运营推送时浮窗不显示', async () => {
    vi.mocked(getHomePushList).mockResolvedValue([])
    mockNewShelfPush([], 0)
    renderAvatar()

    await waitFor(() => expect(useNewShelfModelPush).toHaveBeenLastCalledWith(true))
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('最新 3 个模型均开通后不再显示新模型条目，有运营推送则仅展示运营内容', async () => {
    vi.mocked(getHomePushList).mockResolvedValue([first, second])
    mockNewShelfPush([], 0)
    renderAvatar()

    await waitFor(() => expect(screen.getByText('AI 模型体验')).toBeInTheDocument())
    expect(screen.getByText('邀请好友')).toBeInTheDocument()
    expect(screen.queryByText('模型四 已上架')).not.toBeInTheDocument()
  })

  it('手动关闭后本次会话内不再显示默认条目', async () => {
    vi.mocked(getHomePushList).mockResolvedValue([])
    mockNewShelfPush(newModelItems)
    renderAvatar()

    await waitFor(() => expect(screen.getByText('模型四 已上架')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'homeLanding.closeAvatarPush' }))

    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    // 关闭后默认规则同步停用，避免残留候选池
    expect(useNewShelfModelPush).toHaveBeenLastCalledWith(false)
  })

  it('运营推送接口失败时视为无运营推送，正常展示新模型条目', async () => {
    vi.mocked(getHomePushList).mockRejectedValue(new Error('network'))
    mockNewShelfPush(newModelItems)
    renderAvatar()

    await waitFor(() => expect(screen.getByText('模型四 已上架')).toBeInTheDocument())
    expect(useNewShelfModelPush).toHaveBeenLastCalledWith(true)
  })
})
