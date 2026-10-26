import { configureStore } from '@reduxjs/toolkit'
import type { Assistant, Topic } from '@renderer/types'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import LandingPage from '../LandingPage'

const { getContentMock, ensureModelsMock } = vi.hoisted(() => ({ getContentMock: vi.fn(), ensureModelsMock: vi.fn() }))
vi.mock('../homeContentApi', () => ({ getPublishedHomeContent: getContentMock }))
vi.mock('@renderer/hooks/useAiOnlyModels', () => ({ ensureAiOnlyModelsLoaded: ensureModelsMock }))

vi.mock('../Inputbar/Inputbar', () => ({
  default: ({ onMessageAccepted }: { onMessageAccepted?: () => void }) => (
    <button type="button" onClick={onMessageAccepted}>
      Send from home
    </button>
  )
}))

const topic = { id: 'first-topic', name: 'First topic' } as Topic
const assistant = { id: 'main-assistant', topics: [topic] } as Assistant
const testStore = configureStore({ reducer: () => ({ user: { aiOnlyModels: [] } }) })
const withStore = (children: ReactNode) => <Provider store={testStore}>{children}</Provider>

beforeEach(() => {
  getContentMock.mockReset()
  getContentMock.mockResolvedValue({ ticker: [], announcements: [], avatarPromotion: null })
  ensureModelsMock.mockReset()
  ensureModelsMock.mockResolvedValue(undefined)
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
  it('shows useful built-in notices and a mascot card while publishing is unconfigured', async () => {
    render(
      withStore(
        <MemoryRouter initialEntries={['/']}>
          <LandingPage assistant={assistant} activeTopic={topic} setActiveTopic={vi.fn()} />
        </MemoryRouter>
      )
    )

    expect(await screen.findByLabelText('Home announcements')).toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Home announcements')).getByRole('button', { name: /Open models/ })
    ).toBeInTheDocument()
  })

  it('opens the conversation with the same assistant and topic after an accepted send', () => {
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
    expect(screen.getByTestId('chat-route')).toHaveTextContent('main-assistant/first-topic')
  })

  it('renders configured announcements and routes their actions', async () => {
    getContentMock.mockResolvedValue({
      ticker: [{ id: 'ticker', slot: 'ticker', title: 'New feature' }],
      announcements: [
        {
          id: 'notice',
          slot: 'announcement',
          title: 'Open model',
          action: { type: 'route', target: '/settings/model' }
        }
      ],
      avatarPromotion: null
    })

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
    fireEvent.click(screen.getByRole('button', { name: 'Open model' }))
    expect(screen.getByText('Model settings route')).toBeInTheDocument()
  })

  it('directs a user without models to the model setup page', async () => {
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

    const notices = await screen.findByLabelText('Home announcements')
    fireEvent.click(within(notices).getByRole('button', { name: /Open models/ }))
    expect(screen.getByText('Model settings route')).toBeInTheDocument()
  })
})
