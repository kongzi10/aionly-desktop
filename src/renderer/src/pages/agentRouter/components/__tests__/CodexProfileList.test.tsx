import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CodexProfileList } from '../CodexProfileList'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

const profile = {
  id: 'profile-1',
  targetId: 'codex' as const,
  name: 'Codex Main',
  credentialId: 'cred-1',
  credentialName: 'Primary key',
  accessMode: 'api' as const,
  model: 'gpt-5-codex',
  reasoningEffort: 'high' as const,
  managedAt: '2026-09-18T00:00:00.000Z'
}

describe('CodexProfileList', () => {
  beforeEach(() => {
    const getComputedStyle = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => getComputedStyle(element))
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })
    })
  })

  it('uses the WorkBuddy table layout while preserving profile actions', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const onToggle = vi.fn()
    const onRemove = vi.fn()
    render(
      <CodexProfileList
        profiles={[profile]}
        activeProfileId={profile.id}
        onEdit={onEdit}
        onToggle={onToggle}
        onRemove={onRemove}
        onNew={vi.fn()}
        credentials={[{ id: 'key-1', kind: 'api', label: 'Primary key', value: 'sk-secret-value' }]}
      />
    )

    const table = screen.getByTestId('codex-profile-cards').querySelector('.ant-table')
    expect(table).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'agentRouter.routeName' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'agentRouter.accessMode' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'agentRouter.apiKey' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'agentRouter.actions' })).toBeInTheDocument()
    expect(screen.getByText('Codex Main')).toBeInTheDocument()
    expect(screen.getByText('Primary key')).toBeInTheDocument()
    expect(screen.getByText('sk-s••••alue')).toBeInTheDocument()

    // The active row's switch stays on and cannot be toggled again.
    expect(screen.getByRole('switch')).toBeChecked()
    expect(screen.getByRole('switch')).toBeDisabled()
    await user.click(screen.getByRole('switch'))
    expect(onToggle).not.toHaveBeenCalled()

    await user.click(screen.getByText('agentRouter.edit'))
    expect(onEdit).toHaveBeenCalledWith(profile.id)

    await user.click(screen.getByText('agentRouter.remove'))
    const confirmation = screen.getByRole('dialog')
    expect(confirmation).toHaveTextContent('agentRouter.codex.confirmRemoveProfile')
    expect(confirmation).not.toHaveTextContent('Codex Main')
    await user.click(screen.getByRole('button', { name: 'agentRouter.remove' }))
    expect(onRemove).toHaveBeenCalledWith(profile)
  })
})
