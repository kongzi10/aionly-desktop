import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ClaudeCodeRouteForm } from '../ClaudeCodeRouteForm'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))
vi.mock('../../hooks/useTokenPlanModels', () => ({
  useTokenPlanModels: (credential?: { id: string }) => ({
    models: credential ? [{ id: 'plan-model', name: 'Plan Model', modelTypes: [] }] : [],
    loading: false,
    error: false
  })
}))

const baseProps = {
  busy: false,
  onSave: vi.fn(),
  onApply: vi.fn(),
  onRemove: vi.fn(),
  onCancel: vi.fn()
}

const renderForm = (override?: { onSave?: ReturnType<typeof vi.fn> }) => {
  const onSave = override?.onSave ?? vi.fn()
  const view = render(
    <ClaudeCodeRouteForm
      {...baseProps}
      onSave={onSave}
      apiCredentials={[{ id: 'api-a', kind: 'api', label: 'API Key A', value: 'sk-api' }]}
      tokenPlanCredentials={[
        {
          id: 'plan-a',
          kind: 'tokenPlan',
          label: 'Plan A',
          value: 'sk-plan',
          planId: 'plan-a',
          subscriptionId: 'subscription-a'
        }
      ]}
      apiModels={[
        { id: 'api-model', name: 'API Model', modelTypes: [] },
        { id: 'glm-5.3', name: 'GLM 5.3', modelTypes: [] }
      ]}
    />
  )
  return { onSave, ...view }
}

describe('ClaudeCodeRouteForm', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })
    })
  })

  it('separates API and TokenPlan credentials and shows the mapping grid', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getAllByRole('combobox')[0])
    expect(screen.getByText('API Key A')).toBeInTheDocument()
    expect(screen.queryByText('Plan A')).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    await user.click(screen.getByText('TokenPlan'))
    await user.click(screen.getAllByRole('combobox')[0])
    expect(screen.getByText('Plan A')).toBeInTheDocument()
    expect(screen.getByText('agentRouter.accessMode')).toBeInTheDocument()
    expect(screen.getByText('agentRouter.apiKey')).toBeInTheDocument()
    expect(screen.getByText('agentRouter.claudeCode.modelMapping')).toBeInTheDocument()
    expect(screen.getByText('agentRouter.claudeCode.modelRole')).toBeInTheDocument()
    expect(screen.getByText('agentRouter.claudeCode.displayName')).toBeInTheDocument()
    expect(screen.getByText('agentRouter.modelId')).toBeInTheDocument()
    expect(screen.getByText('agentRouter.claudeCode.defaultFallbackModel')).toBeInTheDocument()
    expect(screen.getByText('Sonnet')).toBeInTheDocument()
    expect(screen.getByText('Opus')).toBeInTheDocument()
    expect(screen.getByText('Haiku')).toBeInTheDocument()
    expect(screen.getByText('API').closest('label')).toHaveClass('ant-radio-wrapper')
    expect(screen.getByLabelText('agentRouter.toggleApiKeyVisibility')).toBeInTheDocument()
  })

  it('saves without model mappings once name and credential are set', async () => {
    const user = userEvent.setup()
    const { onSave } = renderForm()

    expect(screen.getByRole('button', { name: 'agentRouter.claudeCode.save' })).toBeDisabled()

    await user.type(screen.getByLabelText('agentRouter.claudeCode.profileName'), 'My Profile')
    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(screen.getByText('API Key A'))
    await user.click(screen.getByRole('button', { name: 'agentRouter.claudeCode.save' }))

    expect(onSave).toHaveBeenCalledTimes(1)
    const value = onSave.mock.calls[0][0]
    expect(value.name).toBe('My Profile')
    expect(value.credential.id).toBe('api-a')
    expect(value.models).toEqual({
      opus: undefined,
      sonnet: undefined,
      haiku: undefined,
      default: undefined,
      opusName: undefined,
      sonnetName: undefined,
      haikuName: undefined
    })
  })

  it('accepts per-role display names and a default fallback model', async () => {
    const user = userEvent.setup()
    const { onSave } = renderForm()

    await user.type(screen.getByLabelText('agentRouter.claudeCode.profileName'), 'GLM Profile')
    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(screen.getByText('API Key A'))

    const displayNameInputs = screen.getAllByPlaceholderText('claude-sonnet-5')
    await user.type(displayNameInputs[0], 'glm-sonnet')
    await user.click(screen.getAllByRole('combobox')[1])
    await user.click(screen.getAllByText('glm-5.3').at(-1)!)
    await user.click(screen.getAllByRole('combobox')[4])
    const options = screen.getAllByText('glm-5.3')
    await user.click(options[options.length - 1])
    await user.click(screen.getByRole('button', { name: 'agentRouter.claudeCode.save' }))

    expect(onSave).toHaveBeenCalledTimes(1)
    const value = onSave.mock.calls[0][0]
    expect(value.models.sonnet).toBe('glm-5.3')
    expect(value.models.sonnetName).toBe('GLM 5.3')
    expect(value.models.default).toBe('glm-5.3')
    expect(value.models.opus).toBeUndefined()
  })

  it('replaces the display name whenever a model is selected', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('agentRouter.claudeCode.profileName'), 'Auto name')
    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(screen.getByText('API Key A'))
    await user.type(screen.getAllByPlaceholderText('claude-sonnet-5')[0], 'Custom name')
    await user.click(screen.getAllByRole('combobox')[1])
    await user.click(screen.getAllByText('api-model').at(-1)!)

    expect(screen.getAllByPlaceholderText('claude-sonnet-5')[0]).toHaveValue('API Model')
  })

  it('supports cancel and keeps saving disabled for an unsaved profile without credentials', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(
      <ClaudeCodeRouteForm
        {...baseProps}
        onCancel={onCancel}
        apiCredentials={[]}
        tokenPlanCredentials={[]}
        apiModels={[]}
      />
    )

    const save = screen.getByRole('button', { name: 'agentRouter.claudeCode.save' })
    expect(save).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'common.cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('preselects the saved API key when editing a Claude Code profile', async () => {
    const onSave = vi.fn()
    const view = render(
      <ClaudeCodeRouteForm
        {...baseProps}
        onSave={onSave}
        profile={{
          id: 'profile-a',
          targetId: 'claude-code',
          name: 'Existing profile',
          credentialId: 'stored-credential-id',
          credentialName: 'API Key A',
          accessMode: 'api',
          models: { opus: 'opus-model', sonnet: 'sonnet-model', haiku: 'haiku-model' },
          managedAt: '2026-09-18T00:00:00.000Z'
        }}
        apiCredentials={[]}
        tokenPlanCredentials={[]}
        apiModels={[]}
      />
    )

    const saveButton = screen.getByRole('button', { name: 'agentRouter.claudeCode.save' })
    expect(saveButton).toBeDisabled()
    view.rerender(
      <ClaudeCodeRouteForm
        {...baseProps}
        onSave={onSave}
        profile={{
          id: 'profile-a',
          targetId: 'claude-code',
          name: 'Existing profile',
          credentialId: 'stored-credential-id',
          credentialName: 'API Key A',
          accessMode: 'api',
          models: { opus: 'opus-model', sonnet: 'sonnet-model', haiku: 'haiku-model' },
          managedAt: '2026-09-18T00:00:00.000Z'
        }}
        apiCredentials={[{ id: 'api-a', kind: 'api', label: 'API Key A', value: 'sk-api' }]}
        tokenPlanCredentials={[]}
        apiModels={[]}
      />
    )
    expect(saveButton).toBeEnabled()
    await userEvent.setup().click(saveButton)
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: 'profile-a', credential: expect.objectContaining({ id: 'api-a' }) })
    )
  })
})
