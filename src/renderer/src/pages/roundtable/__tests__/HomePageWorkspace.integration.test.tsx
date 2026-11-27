import { configureStore } from '@reduxjs/toolkit'
import type { Assistant, Topic } from '@renderer/types'
import { cleanup, render, screen } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HomePage from '../../home/HomePage'

const { useAssistantsMock, navbarPositionMock, navbarMock } = vi.hoisted(() => ({
  useAssistantsMock: vi.fn(),
  navbarPositionMock: vi.fn(),
  navbarMock: vi.fn()
}))

const chatTopic = { id: 'chat-topic', name: 'Chat topic' } as Topic
const roundtableTopic = { id: 'roundtable-topic', name: 'Roundtable topic' } as Topic
const chatAssistant = {
  id: 'chat-assistant',
  name: 'Chat assistant',
  prompt: '',
  topics: [chatTopic],
  type: 'assistant',
  workspace: 'chat'
} as Assistant
const roundtableAssistant = {
  id: 'roundtable-assistant',
  name: 'Roundtable assistant',
  prompt: '',
  topics: [roundtableTopic],
  type: 'assistant',
  workspace: 'roundtable'
} as Assistant
/** 每个测试重建 store，并内置最小 settings reducer（承接 HomePage 的载体 id 回写/恢复标记） */
const createTestStore = () =>
  configureStore({
    reducer: {
      settings: (
        state: { roundtableAssistantId?: string; roundtableTopicRecoveryDone?: boolean } = {
          roundtableAssistantId: undefined,
          roundtableTopicRecoveryDone: false
        },
        action: { type: string; payload?: unknown }
      ) => {
        switch (action.type) {
          case 'settings/setRoundtableAssistantId':
            return { ...state, roundtableAssistantId: action.payload as string }
          case 'settings/setRoundtableTopicRecoveryDone':
            return { ...state, roundtableTopicRecoveryDone: action.payload as boolean }
          default:
            return state
        }
      }
    }
  })

let testStore: ReturnType<typeof createTestStore>

vi.mock('@renderer/hooks/useAssistant', () => ({
  useAssistants: useAssistantsMock,
  useDefaultAssistant: () => ({ defaultAssistant: chatAssistant })
}))
vi.mock('@renderer/utils', () => ({ uuid: () => 'workspace-default' }))

vi.mock('@renderer/hooks/useSettings', () => ({
  useNavbarPosition: navbarPositionMock,
  useSettings: () => ({ showAssistants: true, showTopics: true, topicPosition: 'left' })
}))

vi.mock('@renderer/hooks/useShortcuts', () => ({ useShortcut: vi.fn() }))
vi.mock('@renderer/hooks/useStore', () => ({
  useShowAssistants: () => ({ setShowAssistants: vi.fn(), toggleShowAssistants: vi.fn() }),
  useShowTopics: () => ({ toggleShowTopics: vi.fn() })
}))
vi.mock('@renderer/hooks/useTopic', () => ({
  useActiveTopic: (assistantId: string) => ({
    activeTopic: assistantId === roundtableAssistant.id ? roundtableTopic : chatTopic,
    setActiveTopic: vi.fn()
  })
}))
vi.mock('@renderer/services/AssistantService', () => ({
  getDefaultAssistant: () => ({ id: 'default', name: 'Default', prompt: '', topics: [], type: 'assistant' }),
  getDefaultTopic: (assistantId: string) => ({ id: `${assistantId}-topic`, name: 'Default topic' })
}))
vi.mock('@renderer/services/NavigationService', () => ({ default: { setNavigate: vi.fn() } }))
// settings slice 模块顶层依赖较重（config/sidebar 等），测试中仅 mock 用到的 action creators
vi.mock('@renderer/store/settings', () => ({
  setRoundtableAssistantId: (id: string) => ({ type: 'settings/setRoundtableAssistantId', payload: id }),
  setRoundtableTopicRecoveryDone: (done: boolean) => ({
    type: 'settings/setRoundtableTopicRecoveryDone',
    payload: done
  })
}))
vi.mock('@renderer/services/EventService', () => ({
  EVENT_NAMES: {
    SHOW_ASSISTANTS: 'show-assistants',
    SHOW_TOPIC_SIDEBAR: 'show-topic-sidebar',
    START_ONBOARDING_TOUR: 'start-onboarding-tour'
  },
  EventEmitter: { emit: vi.fn(), on: vi.fn(() => Promise.resolve(() => undefined)) }
}))
vi.mock('@renderer/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: PropsWithChildren) => children
}))

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: PropsWithChildren) => children,
  motion: { div: ({ children }: PropsWithChildren) => <div>{children}</div> }
}))

vi.mock('../../home/Panel', () => ({
  default: ({ workspace, activeAssistant }: { workspace: string; activeAssistant: Assistant }) => (
    <div data-testid="workspace-panel" data-workspace={workspace} data-assistant={activeAssistant.id} />
  )
}))
vi.mock('../../home/Navbar', () => ({
  default: (props: unknown) => {
    navbarMock(props)
    return <div data-testid="home-navbar" />
  }
}))
vi.mock('../../home/Chat', () => ({
  default: ({ assistant, activeTopic }: { assistant: Assistant; activeTopic: Topic }) => (
    <div data-testid="chat-content" data-assistant={assistant.id} data-topic={activeTopic.id} />
  )
}))
vi.mock('../../home/LandingPage', () => ({ default: () => <div data-testid="landing-content" /> }))
vi.mock('../RoundtableChat', () => ({
  default: ({ assistant, activeTopic }: { assistant: Assistant; activeTopic: Topic }) => (
    <div data-testid="roundtable-content" data-assistant={assistant.id} data-topic={activeTopic.id} />
  )
}))

beforeEach(() => {
  testStore = createTestStore()
  useAssistantsMock.mockReturnValue({ assistants: [chatAssistant, roundtableAssistant], addAssistant: vi.fn() })
  navbarPositionMock.mockReturnValue({ isLeftNavbar: false })
  navbarMock.mockClear()
  Object.assign(window.api, {
    window: { setMinimumSize: vi.fn(), resetMinimumSize: vi.fn() }
  })
})

afterEach(cleanup)

describe('HomePage workspace integration', () => {
  it('retains the standard top toolbar on the landing page in left navigation mode', () => {
    navbarPositionMock.mockReturnValue({ isLeftNavbar: true })
    render(
      <Provider store={testStore}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <HomePage mode="landing" />
        </MemoryRouter>
      </Provider>
    )

    expect(screen.getByTestId('home-navbar')).toBeInTheDocument()
    expect(navbarMock).toHaveBeenCalledWith(
      expect.objectContaining({ titleKey: 'title.home', showAssistantToggle: false })
    )
  })

  it('shows the landing page without the conversation panel on the home route', () => {
    render(
      <Provider store={testStore}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <HomePage mode="landing" />
        </MemoryRouter>
      </Provider>
    )

    expect(screen.getByTestId('landing-content')).toBeInTheDocument()
    expect(screen.queryByTestId('workspace-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('chat-content')).not.toBeInTheDocument()
  })

  it('selects the current profile default assistant after the profile changes', () => {
    const previousProfileView = render(
      <Provider store={testStore}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <HomePage />
        </MemoryRouter>
      </Provider>
    )

    expect(screen.getByTestId('workspace-panel')).toHaveAttribute('data-assistant', chatAssistant.id)
    previousProfileView.unmount()

    const currentProfileAssistant = {
      ...chatAssistant,
      id: 'current-profile-assistant',
      name: 'Current profile assistant'
    }
    useAssistantsMock.mockReturnValue({ assistants: [currentProfileAssistant], addAssistant: vi.fn() })

    render(
      <Provider store={testStore}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <HomePage />
        </MemoryRouter>
      </Provider>
    )

    expect(screen.getByTestId('workspace-panel')).toHaveAttribute('data-assistant', currentProfileAssistant.id)
  })

  it('keeps the active assistant and topic isolated between chat and roundtable', () => {
    const chatView = render(
      <Provider store={testStore}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <HomePage />
        </MemoryRouter>
      </Provider>
    )

    expect(screen.getByTestId('workspace-panel')).toHaveAttribute('data-workspace', 'chat')
    expect(screen.getByTestId('workspace-panel')).toHaveAttribute('data-assistant', chatAssistant.id)
    expect(screen.getByTestId('chat-content')).toHaveAttribute('data-topic', chatTopic.id)

    chatView.unmount()

    render(
      <Provider store={testStore}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <HomePage mode="roundtable" />
        </MemoryRouter>
      </Provider>
    )

    expect(screen.getByTestId('workspace-panel')).toHaveAttribute('data-workspace', 'roundtable')
    expect(screen.getByTestId('workspace-panel')).toHaveAttribute('data-assistant', roundtableAssistant.id)
    expect(screen.getByTestId('roundtable-content')).toHaveAttribute('data-topic', roundtableTopic.id)
  })

  // ===== 群聊会话载体持久化选取（切换身份后对话列表不丢失）回归用例 =====

  const roundtableCarrier = {
    id: 'rt-carrier',
    name: 'RT carrier',
    prompt: '',
    topics: [{ id: 'rt-topic-1', name: '旧对话 1' } as Topic, { id: 'rt-topic-2', name: '旧对话 2' } as Topic],
    type: 'assistant',
    workspace: 'roundtable'
  } as Assistant
  // addAssistant 头插 ⇒ 最新创建的角色位于数组头部（复现线上数据形态）
  const roundtableRole = {
    id: 'rt-role',
    name: 'RT role',
    prompt: '',
    topics: [{ id: 'rt-role-topic', name: '新对话' } as Topic],
    type: 'assistant',
    workspace: 'roundtable'
  } as Assistant

  const renderRoundtable = () =>
    render(
      <Provider store={testStore}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <HomePage mode="roundtable" />
        </MemoryRouter>
      </Provider>
    )

  it('重挂载后仍选中会话载体而非最新角色（数组头部），并持久化载体 id', () => {
    useAssistantsMock.mockReturnValue({ assistants: [roundtableRole, roundtableCarrier], addAssistant: vi.fn() })

    const view = renderRoundtable()
    expect(screen.getByTestId('workspace-panel')).toHaveAttribute('data-assistant', roundtableCarrier.id)
    // 载体 id 已回写到 settings（模拟随 redux-persist 持久化）
    expect(testStore.getState().settings.roundtableAssistantId).toBe(roundtableCarrier.id)
    expect(testStore.getState().settings.roundtableTopicRecoveryDone).toBe(true)
    view.unmount()

    // 模拟切换身份后回到本身份：组件重挂载、模块缓存失效，凭持久化 id 精确命中载体
    const remounted = renderRoundtable()
    expect(screen.getByTestId('workspace-panel')).toHaveAttribute('data-assistant', roundtableCarrier.id)
    remounted.unmount()
  })

  it('持久化 id 失效时回退到最旧 roundtable assistant（会话载体）', () => {
    useAssistantsMock.mockReturnValue({ assistants: [roundtableRole, roundtableCarrier], addAssistant: vi.fn() })
    testStore.dispatch({ type: 'settings/setRoundtableAssistantId', payload: 'deleted-assistant' } as never)

    renderRoundtable()
    expect(screen.getByTestId('workspace-panel')).toHaveAttribute('data-assistant', roundtableCarrier.id)
    expect(testStore.getState().settings.roundtableAssistantId).toBe(roundtableCarrier.id)
  })

  it('存量恢复：把误挂到角色下的已用话题搬回会话载体，角色保留空默认话题', () => {
    const usedTopic = { id: 'rt-role-used', name: '误建对话', messages: [{ id: 'm1' }] } as unknown as Topic
    const untouchedTopic = { id: 'rt-role-topic', name: '新对话', messages: [] } as unknown as Topic
    const roleWithUsedTopics = { ...roundtableRole, topics: [untouchedTopic, usedTopic] }
    useAssistantsMock.mockReturnValue({ assistants: [roleWithUsedTopics, roundtableCarrier], addAssistant: vi.fn() })
    const dispatchSpy = vi.spyOn(testStore, 'dispatch')

    renderRoundtable()

    const updateCalls = dispatchSpy.mock.calls
      .map(([action]) => action as { type: string; payload?: { id: string; topics?: Topic[] } })
      .filter((action) => action.type === 'assistants/updateAssistant')
    // 载体补丁：原 topics + 搬回的话题（assistantId 重写为载体）
    const carrierPatch = updateCalls.find((action) => action.payload?.id === roundtableCarrier.id)
    expect(carrierPatch?.payload?.topics?.map(({ id }) => id)).toEqual(['rt-topic-1', 'rt-topic-2', 'rt-role-used'])
    expect(carrierPatch?.payload?.topics?.[2]).toMatchObject({ assistantId: roundtableCarrier.id })
    // 角色补丁：仅剩未使用的默认话题
    const rolePatch = updateCalls.find((action) => action.payload?.id === roundtableRole.id)
    expect(rolePatch?.payload?.topics?.map(({ id }) => id)).toEqual(['rt-role-topic'])
    // 幂等标记已置位
    expect(testStore.getState().settings.roundtableTopicRecoveryDone).toBe(true)
  })

  it('chat 模式不受群聊载体选取与恢复逻辑影响', () => {
    useAssistantsMock.mockReturnValue({ assistants: [roundtableRole, chatAssistant], addAssistant: vi.fn() })
    render(
      <Provider store={testStore}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <HomePage />
        </MemoryRouter>
      </Provider>
    )
    // chat 模式按 workspace 过滤后仍走原有选取逻辑（不受 roundtable 角色影响）
    expect(screen.getByTestId('workspace-panel')).toHaveAttribute('data-assistant', chatAssistant.id)
    // 不写群聊持久化字段、不触发恢复
    expect(testStore.getState().settings.roundtableAssistantId).toBeUndefined()
    expect(testStore.getState().settings.roundtableTopicRecoveryDone).toBe(false)
  })
})
