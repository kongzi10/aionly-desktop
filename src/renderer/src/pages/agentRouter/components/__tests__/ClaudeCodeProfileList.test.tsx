import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ClaudeCodeProfileList } from '../ClaudeCodeProfileList'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

const baseProfile = {
  targetId: 'claude-code' as const,
  credentialId: 'cred-1',
  accessMode: 'api' as const,
  managedAt: '2026-09-18T00:00:00.000Z'
}

describe('ClaudeCodeProfileList', () => {
  beforeEach(() => {
    const getComputedStyle = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => getComputedStyle(element))
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })
    })
  })

  it('renders one row per profile and opens edit modal on click', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(
      <ClaudeCodeProfileList
        profiles={[
          { ...baseProfile, id: 'p1', name: 'Profile One', models: { opus: 'o', sonnet: 's', haiku: 'h' } },
          {
            ...baseProfile,
            id: 'p2',
            name: 'Profile Two',
            credentialName: 'Key B',
            models: { opus: 'o2', sonnet: 's2', haiku: 'h2' }
          }
        ]}
        activeProfileId="p1"
        onEdit={onEdit}
        onToggle={vi.fn()}
        onNew={vi.fn()}
      />
    )

    expect(screen.getByTestId('claude-code-profile-cards')).toBeInTheDocument()
    expect(screen.getByTestId('claude-code-profile-cards').querySelector('.ant-table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'agentRouter.routeName' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'agentRouter.accessMode' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'agentRouter.apiKey' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'agentRouter.actions' })).toBeInTheDocument()
    expect(screen.getByText('Profile One')).toBeInTheDocument()
    expect(screen.getByText('Profile Two')).toBeInTheDocument()

    // The active row's switch stays on and cannot be toggled; inactive rows start off.
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(2)
    expect(switches[0]).toBeChecked()
    expect(switches[0]).toBeDisabled()
    expect(switches[1]).not.toBeChecked()

    await user.click(screen.getByText('Profile Two'))
    expect(onEdit).toHaveBeenCalledWith('p2')

    await user.click(screen.getAllByRole('button', { name: /agentRouter.edit$/ })[0])
    expect(onEdit).toHaveBeenCalledWith('p1')
  })

  it('only toggles from inactive rows without any text label on the active one', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(
      <ClaudeCodeProfileList
        profiles={[
          { ...baseProfile, id: 'p1', name: 'Profile One', models: { opus: 'o', sonnet: 's', haiku: 'h' } },
          { ...baseProfile, id: 'p2', name: 'Profile Two', models: { opus: 'o2', sonnet: 's2', haiku: 'h2' } }
        ]}
        activeProfileId="p1"
        onEdit={vi.fn()}
        onToggle={onToggle}
        onNew={vi.fn()}
      />
    )

    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(2)
    expect(switches[0]).toBeChecked()
    expect(switches[0]).toBeDisabled()
    await user.click(switches[0])
    expect(onToggle).not.toHaveBeenCalled()
    await user.click(switches[1])
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'p2' }), true)
  })

  it('uses a Claude Code-specific confirmation when removing a profile', async () => {
    const user = userEvent.setup()
    render(
      <ClaudeCodeProfileList
        profiles={[{ ...baseProfile, id: 'p1', name: 'Profile One', models: { opus: 'o', sonnet: 's', haiku: 'h' } }]}
        onEdit={vi.fn()}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
        onNew={vi.fn()}
      />
    )

    await user.click(screen.getByText('agentRouter.remove'))
    const confirmation = screen.getByRole('dialog')
    expect(confirmation).toHaveTextContent('agentRouter.claudeCode.confirmRemoveProfile')
    expect(confirmation).not.toHaveTextContent('Profile One')
  })

  it('renders empty state with new profile action', async () => {
    const user = userEvent.setup()
    const onNew = vi.fn()
    render(<ClaudeCodeProfileList profiles={[]} onEdit={vi.fn()} onToggle={vi.fn()} onNew={onNew} />)

    expect(screen.getByText('agentRouter.claudeCode.profilesEmpty')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'agentRouter.claudeCode.newProfile' }))
    expect(onNew).toHaveBeenCalled()
  })
})
