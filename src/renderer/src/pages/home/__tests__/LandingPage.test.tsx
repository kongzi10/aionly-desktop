import { configureStore } from '@reduxjs/toolkit'
import type { Assistant, Topic } from '@renderer/types'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import LandingPage from '../LandingPage'

const { getPushListMock, ensureModelsMock } = vi.hoisted(() => ({
  getPushListMock: vi.fn(),
  ensureModelsMock: vi.fn()
}))
vi.mock('../homeContentApi', () => ({ getHomePushList: getPushListMock }))
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
  getPushListMock.mockReset()
  getPushListMock.mockResolvedValue([])
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

    fireEvent.click(await screen.findByRole('button', { name: 'Open models' }))
    expect(screen.getByText('Model settings route')).toBeInTheDocument()
  })
})
