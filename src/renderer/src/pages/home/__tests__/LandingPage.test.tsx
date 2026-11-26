import { configureStore } from '@reduxjs/toolkit'
import type { Assistant, Topic } from '@renderer/types'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import LandingPage from '../LandingPage'

const {
  getPushListMock,
  ensureModelsMock,
  openSmartMinappMock,
  isReusableEmptyTopicMock,
  dbTopicsAddMock,
  addTopicMock,
  setModelMock
} = vi.hoisted(() => ({
  getPushListMock: vi.fn(),
  ensureModelsMock: vi.fn(),
  openSmartMinappMock: vi.fn(),
  isReusableEmptyTopicMock: vi.fn(),
  dbTopicsAddMock: vi.fn(),
  addTopicMock: vi.fn(),
  setModelMock: vi.fn()
}))
vi.mock('../homeContentApi', () => ({ getHomePushList: getPushListMock }))
vi.mock('@renderer/hooks/useAiOnlyModels', () => ({ ensureAiOnlyModelsLoaded: ensureModelsMock }))
vi.mock('@renderer/hooks/useMinappPopup', () => ({
  useMinappPopup: () => ({ openSmartMinapp: openSmartMinappMock })
}))
vi.mock('@renderer/hooks/useTopic', () => ({ isReusableEmptyTopic: isReusableEmptyTopicMock }))
vi.mock('@renderer/hooks/useAssistant', () => ({
  useAssistant: () => ({ addTopic: addTopicMock, setModel: setModelMock })
}))
vi.mock('@renderer/databases', () => ({
  default: { topics: { add: dbTopicsAddMock } },
  db: { topics: { add: dbTopicsAddMock } }
}))
vi.mock('@renderer/services/AssistantService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@renderer/services/AssistantService')>()
  return {
    ...actual,
    // 固定新话题 id，便于断言跳转与入库参数
    getDefaultTopic: (assistantId: string): Topic => ({
      id: 'fresh-topic',
      assistantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: 'Default Topic',
      messages: [],
      isNameManuallyEdited: false
    })
  }
})

// 模拟真实 Inputbar 的发送链路：先解析发送话题，再回传给 onMessageAccepted
vi.mock('../Inputbar/Inputbar', () => ({
  default: ({
    onMessageAccepted,
    resolveTopicBeforeSend,
    showOpenModelButton,
    topic
  }: {
    onMessageAccepted?: (topic: Topic) => void
    resolveTopicBeforeSend?: () => Promise<Topic>
    showOpenModelButton?: boolean
    topic: Topic
  }) => (
    <>
      <button
        type="button"
        onClick={async () => {
          const sendTopic = resolveTopicBeforeSend ? await resolveTopicBeforeSend() : topic
          onMessageAccepted?.(sendTopic)
        }}>
        Send from home
      </button>
      {showOpenModelButton && (
        <button type="button" data-testid="open-model-entry">
          Open models
        </button>
      )}
    </>
  )
}))

const topic = { id: 'first-topic', name: 'First topic' } as Topic
const assistant = { id: 'main-assistant', topics: [topic] } as Assistant
const testStore = configureStore({ reducer: () => ({ user: { aiOnlyModels: [] } }) })
const withStore = (children: ReactNode) => <Provider store={testStore}>{children}</Provider>

beforeEach(() => {
  getPushListMock.mockReset()
  getPushListMock.mockResolvedValue([])
  ensureModelsMock.mockReset()
  ensureModelsMock.mockResolvedValue(undefined)
  openSmartMinappMock.mockReset()
  isReusableEmptyTopicMock.mockReset()
  isReusableEmptyTopicMock.mockResolvedValue(true)
  dbTopicsAddMock.mockReset()
  dbTopicsAddMock.mockResolvedValue(undefined)
  addTopicMock.mockReset()
  setModelMock.mockReset()
})

const ChatRoute = () => {
  const { state } = useLocation()
  return (
    <div data-testid="chat-route">
      {state.assistant.id}/{state.topic.id}
    </div>
  )
}

describe('LandingPage', () => {
  it('queries top_loop and cartoon without inventing content for empty responses', async () => {
    render(
      withStore(
        <MemoryRouter initialEntries={['/']}>
          <LandingPage assistant={assistant} activeTopic={topic} setActiveTopic={vi.fn()} />
        </MemoryRouter>
      )
    )

    expect(getPushListMock).toHaveBeenCalledWith('top_loop')
    expect(getPushListMock).toHaveBeenCalledWith('cartoon')
    expect(screen.queryByLabelText('Home announcements')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'homeLanding.closeCartoonPush' })).not.toBeInTheDocument()
  })

  it('opens the conversation with the same assistant and topic when the active topic is a reusable empty topic', async () => {
    render(
      withStore(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route
              path="/"
              element={<LandingPage assistant={assistant} activeTopic={topic} setActiveTopic={vi.fn()} />}
            />
            <Route path="/chat" element={<ChatRoute />} />
          </Routes>
        </MemoryRouter>
      )
    )

    fireEvent.click(screen.getByRole('button', { name: 'Send from home' }))
    await waitFor(() => expect(screen.getByTestId('chat-route')).toHaveTextContent('main-assistant/first-topic'))
    expect(dbTopicsAddMock).not.toHaveBeenCalled()
    expect(addTopicMock).not.toHaveBeenCalled()
  })

  it('creates a fresh topic and opens it instead of appending to the latest history topic', async () => {
    isReusableEmptyTopicMock.mockResolvedValue(false)
    const setActiveTopicMock = vi.fn()

    render(
      withStore(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route
              path="/"
              element={<LandingPage assistant={assistant} activeTopic={topic} setActiveTopic={setActiveTopicMock} />}
            />
            <Route path="/chat" element={<ChatRoute />} />
          </Routes>
        </MemoryRouter>
      )
    )

    fireEvent.click(screen.getByRole('button', { name: 'Send from home' }))

    // 新建话题：先落库，再入 Redux（addTopic），随后设为激活话题
    await waitFor(() => expect(screen.getByTestId('chat-route')).toHaveTextContent('main-assistant/fresh-topic'))
    expect(dbTopicsAddMock).toHaveBeenCalledWith({ id: 'fresh-topic', messages: [] })
    expect(addTopicMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'fresh-topic', assistantId: 'main-assistant' })
    )
    expect(setActiveTopicMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'fresh-topic' }))
  })

  it('renders top_loop content and opens the cartoon action', async () => {
    getPushListMock.mockImplementation((pushType: string) =>
      Promise.resolve(
        pushType === 'top_loop'
          ? [{ id: 'ticker', pushType, content: 'New feature' }]
          : [
              {
                id: 'cartoon',
                pushType,
                title: 'Open model',
                buttonText: 'View now',
                buttonUrl: '/settings/model'
              }
            ]
      )
    )

    render(
      withStore(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route
              path="/"
              element={<LandingPage assistant={assistant} activeTopic={topic} setActiveTopic={vi.fn()} />}
            />
            <Route path="/settings/model" element={<div>Model settings route</div>} />
          </Routes>
        </MemoryRouter>
      )
    )

    expect(await screen.findByText('New feature')).toBeInTheDocument()
    expect(await screen.findByText('Open model')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'View now' }))
    expect(screen.getByText('Model settings route')).toBeInTheDocument()
  })

  it('opens cartoon https actions in the internal minapp popup instead of the system browser', async () => {
    getPushListMock.mockImplementation((pushType: string) =>
      Promise.resolve(
        pushType === 'cartoon'
          ? [
              {
                id: 'gift',
                pushType,
                title: 'New user gift',
                buttonText: 'Top up',
                buttonUrl: 'https://example.com/recharge'
              }
            ]
          : []
      )
    )

    render(
      withStore(
        <MemoryRouter initialEntries={['/']}>
          <LandingPage assistant={assistant} activeTopic={topic} setActiveTopic={vi.fn()} />
        </MemoryRouter>
      )
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Top up' }))
    expect(openSmartMinappMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'home-push-gift', url: 'https://example.com/recharge' }),
      true
    )
  })

  it('directs a user without models to the model setup page', async () => {
    render(
      withStore(
        <MemoryRouter initialEntries={['/']}>
          <LandingPage assistant={assistant} activeTopic={topic} setActiveTopic={vi.fn()} />
        </MemoryRouter>
      )
    )

    // 首页始终向 Inputbar 透传 showOpenModelButton：无可用模型时在发送位置展示「开通模型」入口
    expect(await screen.findByTestId('open-model-entry')).toBeInTheDocument()
  })
})
