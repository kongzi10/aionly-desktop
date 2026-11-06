import type { HomePushItem } from '@renderer/pages/home/homeContent'
import { getHomePushList } from '@renderer/pages/home/homeContentApi'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import UserAvatar from '..'

vi.mock('@renderer/pages/home/homeContentApi', () => ({ getHomePushList: vi.fn() }))
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
