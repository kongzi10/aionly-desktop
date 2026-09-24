import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CodexProfileForm } from '../CodexProfileForm'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))
vi.mock('../../hooks/useTokenPlanModels', () => ({
  useTokenPlanModels: () => ({ models: [], loading: false, error: false })
}))

describe('CodexProfileForm', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })
    })
  })

  it('uses the same corresponding field names as the WorkBuddy route form', () => {
    render(
      <CodexProfileForm
        apiCredentials={[]}
        tokenPlanCredentials={[]}
        apiModels={[]}
        busy={false}
        onSave={vi.fn()}
        onRemove={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('agentRouter.accessMode')).toBeInTheDocument()
    expect(screen.getByText('agentRouter.apiKey')).toBeInTheDocument()
    expect(screen.getByText('agentRouter.modelId')).toBeInTheDocument()
    expect(screen.queryByText('agentRouter.codex.accessMode')).not.toBeInTheDocument()
    expect(screen.queryByText('agentRouter.codex.credential')).not.toBeInTheDocument()
    expect(screen.queryByText('agentRouter.codex.model')).not.toBeInTheDocument()
    expect(screen.getByText('API').closest('label')).toHaveClass('ant-radio-wrapper')
    expect(screen.getByLabelText('agentRouter.toggleApiKeyVisibility')).toBeInTheDocument()
  })

  it('masks and reveals the selected API key like WorkBuddy', async () => {
    const user = userEvent.setup()
    render(
      <CodexProfileForm
        apiCredentials={[{ id: 'key-1', kind: 'api', label: 'Main key', value: 'sk-secret-value' }]}
        tokenPlanCredentials={[]}
        apiModels={[]}
        busy={false}
        onSave={vi.fn()}
        onRemove={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(screen.getByText('Main key'))
    expect(screen.getAllByText('••••••••••••••••••••••••').length).toBeGreaterThan(0)
    await user.click(screen.getByLabelText('agentRouter.toggleApiKeyVisibility'))
    expect(screen.getAllByText('sk-secret-value').length).toBeGreaterThan(0)
  })

  it('preselects the saved API key and existing model while editing', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const view = render(
      <CodexProfileForm
        profile={{
          id: 'profile-1',
          targetId: 'codex',
          name: 'Existing profile',
          credentialId: 'old-key',
          credentialName: 'New key',
          accessMode: 'api',
          model: 'gpt-5-codex',
          managedAt: '2026-09-18T00:00:00.000Z'
        }}
        apiCredentials={[]}
        tokenPlanCredentials={[]}
        apiModels={[{ id: 'gpt-5-codex', name: 'GPT-5 Codex', modelTypes: [] }]}
        busy={false}
        onSave={onSave}
        onRemove={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'agentRouter.codex.save' })).toBeDisabled()
    view.rerender(
      <CodexProfileForm
        profile={{
          id: 'profile-1',
          targetId: 'codex',
          name: 'Existing profile',
          credentialId: 'old-key',
          credentialName: 'New key',
          accessMode: 'api',
          model: 'gpt-5-codex',
          managedAt: '2026-09-18T00:00:00.000Z'
        }}
        apiCredentials={[{ id: 'new-key', kind: 'api', label: 'New key', value: 'sk-new-secret' }]}
        tokenPlanCredentials={[]}
        apiModels={[{ id: 'gpt-5-codex', name: 'GPT-5 Codex', modelTypes: [] }]}
        busy={false}
        onSave={onSave}
        onRemove={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'agentRouter.codex.save' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'agentRouter.codex.save' }))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'profile-1',
        credential: expect.objectContaining({ id: 'new-key' }),
        model: 'gpt-5-codex'
      })
    )
  })
})
