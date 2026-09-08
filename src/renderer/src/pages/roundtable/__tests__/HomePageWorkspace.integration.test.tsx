import { configureStore } from '@reduxjs/toolkit'
import type { Assistant, Topic } from '@renderer/types'
import { cleanup, render, screen } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HomePage from '../../home/HomePage'

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
const testStore = configureStore({ reducer: () => ({}) })

vi.mock('@renderer/hooks/useAssistant', () => ({
  useAssistants: () => ({ assistants: [chatAssistant, roundtableAssistant], addAssistant: vi.fn() }),
  useDefaultAssistant: () => ({ defaultAssistant: chatAssistant })
}))
vi.mock('@renderer/utils', () => ({ uuid: () => 'workspace-default' }))

vi.mock('@renderer/hooks/useSettings', () => ({
  useNavbarPosition: () => ({ isLeftNavbar: false }),
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
vi.mock('@renderer/services/EventService', () => ({
  EVENT_NAMES: { SHOW_ASSISTANTS: 'show-assistants', SHOW_TOPIC_SIDEBAR: 'show-topic-sidebar' },
  EventEmitter: { emit: vi.fn() }
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
vi.mock('../../home/Navbar', () => ({ default: () => null }))
vi.mock('../../home/Chat', () => ({
  default: ({ assistant, activeTopic }: { assistant: Assistant; activeTopic: Topic }) => (
    <div data-testid="chat-content" data-assistant={assistant.id} data-topic={activeTopic.id} />
  )
}))
vi.mock('../RoundtableChat', () => ({
  default: ({ assistant, activeTopic }: { assistant: Assistant; activeTopic: Topic }) => (
    <div data-testid="roundtable-content" data-assistant={assistant.id} data-topic={activeTopic.id} />
  )
}))

beforeEach(() => {
  Object.assign(window.api, {
    window: { setMinimumSize: vi.fn(), resetMinimumSize: vi.fn() }
  })
})

afterEach(cleanup)

describe('HomePage workspace integration', () => {
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
})
