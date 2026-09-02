import { selectTokenPlanHourlyDayUsageApi } from '@renderer/api/billManagement'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AddRouteModal } from '../AddRouteModal'

vi.mock('@renderer/api/billManagement', () => ({ selectTokenPlanHourlyDayUsageApi: vi.fn() }))
vi.mock('../../utils/modelCapabilities', () => ({ resolveAgentRouteModelTypes: () => [] }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; modelIds?: string }) =>
      options?.modelIds !== undefined
        ? `${key}:${options.modelIds}`
        : options?.count === undefined
          ? key
          : `${key}:${options.count}`
  })
}))

const templates = [
  {
    templateId: 'template-1',
    modelId: 'gpt-5',
    accessMode: 'api' as const,
    modelTypes: ['function_calling', 'reasoning'] as const,
    createdAt: '2026-08-31T00:00:00.000Z',
    maskedKey: '••••1234'
  },
  {
    templateId: 'template-2',
    modelId: 'joined-model',
    accessMode: 'tokenPlan' as const,
    tokenPlanId: 'plan-pro',
    modelTypes: ['function_calling'] as const,
    createdAt: '2026-08-31T00:00:00.000Z',
    maskedKey: '••••5678',
    joined: true
  },
  {
    templateId: 'template-3',
    modelId: 'unknown-capabilities',
    accessMode: 'api' as const,
    modelTypes: [] as const,
    createdAt: '2026-08-31T00:00:00.000Z',
    maskedKey: '••••9999'
  }
]

beforeEach(() => {
  const originalGetComputedStyle = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => originalGetComputedStyle(element))
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })
  })
})
afterEach(() => vi.restoreAllMocks())

describe('AddRouteModal', () => {
  const commonProps = {
    open: true,
    templates,
    apiCredentials: [{ id: 'credential-1', kind: 'api' as const, label: 'Key', value: 'sk-secret' }],
    tokenPlanCredentials: [],
    apiModels: [
      {
        id: 'gpt-5',
        name: 'GPT Five',
        modelTypes: ['function_calling', 'web_search', 'reasoning'] as const
      }
    ],
    onCancel: vi.fn(),
    onCreate: vi.fn().mockResolvedValue(undefined)
  }

  it('selects exact unmatched global templates and submits template ids', () => {
    const onAdd = vi.fn()
    render(<AddRouteModal {...commonProps} onAdd={onAdd} />)
    fireEvent.click(screen.getByRole('tab', { name: 'agentRouter.useGlobalConfiguration' }))
    expect(screen.getByText(/••••1234/)).toBeInTheDocument()
    expect(screen.queryByText('models.type.function_calling')).not.toBeInTheDocument()
    expect(screen.queryByText('models.type.reasoning')).not.toBeInTheDocument()
    expect(screen.queryByText('models.type.vision')).not.toBeInTheDocument()
    expect(screen.queryByText('agentRouter.modelTypesUnavailable')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /joined-model/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /gpt-5/ }))
    fireEvent.click(screen.getByRole('button', { name: 'agentRouter.addSelectedModels:1' }))
    expect(onAdd).toHaveBeenCalledWith(['template-1'])
  })

  it('creates a direct Agent route through the first path', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<AddRouteModal {...commonProps} onAdd={vi.fn()} onCreate={onCreate} />)
    expect(screen.queryByLabelText('agentRouter.displayName')).not.toBeInTheDocument()
    expect(screen.queryByText('agentRouter.createOverwriteHint')).not.toBeInTheDocument()
    fireEvent.mouseDown(screen.getByLabelText('agentRouter.apiKey'))
    fireEvent.click(await screen.findByText('Key'))
    expect(screen.getByText('••••••••••••••••••••••••')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('agentRouter.toggleApiKeyVisibility'))
    expect(screen.getByText('sk-secret')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('agentRouter.modelId'))
    fireEvent.click((await screen.findAllByText('gpt-5')).at(-1)!)
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }))
    expect(screen.queryByText('GPT Five')).not.toBeInTheDocument()
    expect(screen.queryByText('agentRouter.modelTypes')).not.toBeInTheDocument()
    expect(screen.queryByText('models.type.websearch')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'models.type.websearch' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'agentRouter.createRoute' }))
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith([
        expect.objectContaining({ modelId: 'gpt-5', displayName: 'AiOnly', apiKey: 'sk-secret', credentialName: 'Key' })
      ])
    )
  })

  it('submits all selected models with their own capabilities in one batch', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(
      <AddRouteModal
        {...commonProps}
        onAdd={vi.fn()}
        onCreate={onCreate}
        apiModels={[...commonProps.apiModels, { id: 'claude-sonnet', name: 'Claude', modelTypes: ['vision'] }]}
      />
    )
    fireEvent.mouseDown(screen.getByLabelText('agentRouter.apiKey'))
    fireEvent.click(await screen.findByText('Key'))
    fireEvent.click(screen.getByLabelText('agentRouter.modelId'))
    fireEvent.click((await screen.findAllByText('gpt-5')).at(-1)!)
    fireEvent.click((await screen.findAllByText('claude-sonnet')).at(-1)!)
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }))
    fireEvent.click(screen.getByRole('button', { name: 'agentRouter.createRoute' }))
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith([
        expect.objectContaining({ modelId: 'gpt-5', modelTypes: ['function_calling', 'web_search', 'reasoning'] }),
        expect.objectContaining({ modelId: 'claude-sonnet', modelTypes: ['vision'] })
      ])
    )
  })

  it('searches model IDs in the picker without clearing previous selections', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(
      <AddRouteModal
        {...commonProps}
        onAdd={vi.fn()}
        onCreate={onCreate}
        apiModels={[...commonProps.apiModels, { id: 'claude-sonnet', name: 'Claude', modelTypes: [] }]}
      />
    )
    fireEvent.mouseDown(screen.getByLabelText('agentRouter.apiKey'))
    fireEvent.click(await screen.findByText('Key'))
    fireEvent.click(screen.getByLabelText('agentRouter.modelId'))
    fireEvent.click((await screen.findAllByText('gpt-5')).at(-1)!)
    await userEvent.click(screen.getByPlaceholderText('agentRouter.searchModelId'))
    await userEvent.type(screen.getByPlaceholderText('agentRouter.searchModelId'), 'CLAUDE')
    expect(screen.queryByRole('checkbox', { name: 'gpt-5' })).not.toBeInTheDocument()
    fireEvent.click((await screen.findAllByText('claude-sonnet')).at(-1)!)
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }))
    fireEvent.click(screen.getByRole('button', { name: 'agentRouter.createRoute' }))
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith([
        expect.objectContaining({ modelId: 'gpt-5' }),
        expect.objectContaining({ modelId: 'claude-sonnet' })
      ])
    )
  })

  it.each(['create', 'global'])('confirms a conflicting %s addition only after clicking add', async (path) => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const onAdd = vi.fn().mockResolvedValue(undefined)
    const onCancel = vi.fn()
    render(
      <AddRouteModal
        {...commonProps}
        onCreate={onCreate}
        onAdd={onAdd}
        onCancel={onCancel}
        routes={[
          {
            modelId: 'gpt-5',
            displayName: 'AiOnly',
            accessMode: 'api',
            credentialId: 'old-key',
            enabled: true,
            modelTypes: [],
            routedAt: ''
          }
        ]}
        onRevealCredential={vi.fn().mockResolvedValue('sk-other')}
      />
    )
    expect(screen.queryByText(/^agentRouter.confirmCloseSameModel/)).not.toBeInTheDocument()
    if (path === 'global') {
      fireEvent.click(screen.getByRole('tab', { name: 'agentRouter.useGlobalConfiguration' }))
      fireEvent.click(screen.getByRole('checkbox', { name: /gpt-5/ }))
    } else {
      fireEvent.mouseDown(screen.getByLabelText('agentRouter.apiKey'))
      fireEvent.click(await screen.findByText('Key'))
      fireEvent.click(screen.getByLabelText('agentRouter.modelId'))
      fireEvent.click((await screen.findAllByText('gpt-5')).at(-1)!)
      fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }))
    }
    const addLabel = path === 'global' ? 'agentRouter.addSelectedModels:1' : 'agentRouter.createRoute'
    fireEvent.click(screen.getByRole('button', { name: addLabel }))
    expect(await screen.findByText('agentRouter.confirmCloseSameModel:gpt-5')).toBeInTheDocument()
    expect(onAdd).not.toHaveBeenCalled()
    expect(onCreate).not.toHaveBeenCalled()
    fireEvent.click(screen.getAllByRole('button', { name: 'common.cancel' }).at(-1)!)
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: addLabel }))
    await screen.findByText('agentRouter.confirmCloseSameModel:gpt-5')
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }))
    await waitFor(() => expect(path === 'global' ? onAdd : onCreate).toHaveBeenCalledTimes(1))
  })

  it('lists only the selected model IDs whose routes are currently enabled', async () => {
    render(
      <AddRouteModal
        {...commonProps}
        onAdd={vi.fn()}
        templates={[
          { ...templates[0], modelId: 'gpt-5' },
          { ...templates[0], templateId: 'second', modelId: 'claude-sonnet' },
          { ...templates[0], templateId: 'third', modelId: 'disabled-model' }
        ]}
        routes={['gpt-5', 'claude-sonnet', 'disabled-model', 'unselected-model'].map((modelId) => ({
          modelId,
          credentialId: modelId,
          displayName: 'AiOnly',
          accessMode: 'api',
          enabled: modelId !== 'disabled-model',
          modelTypes: [],
          routedAt: ''
        }))}
      />
    )
    fireEvent.click(screen.getByRole('tab', { name: 'agentRouter.useGlobalConfiguration' }))
    for (const checkbox of screen.getAllByRole('checkbox')) fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole('button', { name: 'agentRouter.addSelectedModels:3' }))
    expect(await screen.findByText('agentRouter.confirmCloseSameModel:gpt-5、claude-sonnet')).toBeInTheDocument()
  })

  it('adds two new same-ID templates without warning when no existing route is active', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(
      <AddRouteModal
        {...commonProps}
        onAdd={onAdd}
        templates={[templates[0], { ...templates[0], templateId: 'another-key', maskedKey: '••••5678' }]}
      />
    )
    fireEvent.click(screen.getByRole('tab', { name: 'agentRouter.useGlobalConfiguration' }))
    for (const checkbox of screen.getAllByRole('checkbox')) fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole('button', { name: 'agentRouter.addSelectedModels:2' }))
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith(['template-1', 'another-key']))
    expect(screen.queryByText(/^agentRouter.confirmCloseSameModel/)).not.toBeInTheDocument()
  })

  it('does not warn for an exact duplicate even if a different key is currently active', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(
      <AddRouteModal
        {...commonProps}
        onAdd={vi.fn()}
        onCreate={onCreate}
        routes={[
          {
            modelId: 'gpt-5',
            displayName: 'AiOnly',
            accessMode: 'api',
            credentialId: 'same-key',
            enabled: false,
            modelTypes: [],
            routedAt: ''
          },
          {
            modelId: 'gpt-5',
            displayName: 'AiOnly',
            accessMode: 'api',
            credentialId: 'other-key',
            enabled: true,
            modelTypes: [],
            routedAt: ''
          }
        ]}
        onRevealCredential={async (route) => (route.credentialId === 'same-key' ? 'sk-secret' : 'sk-other')}
      />
    )
    fireEvent.mouseDown(screen.getByLabelText('agentRouter.apiKey'))
    fireEvent.click(await screen.findByText('Key'))
    fireEvent.click(screen.getByLabelText('agentRouter.modelId'))
    fireEvent.click((await screen.findAllByText('gpt-5')).at(-1)!)
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }))
    fireEvent.click(screen.getByRole('button', { name: 'agentRouter.createRoute' }))
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/^agentRouter.confirmCloseSameModel/)).not.toBeInTheDocument()
  })

  it('loads models for the selected TokenPlan key and clears the model when switching keys', async () => {
    vi.mocked(selectTokenPlanHourlyDayUsageApi)
      .mockResolvedValueOnce({ rows: [{ model: 'plan-one-model', modelName: 'One' }] })
      .mockResolvedValueOnce({ rows: [{ model: 'plan-two-model', modelName: 'Two' }] })
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(
      <AddRouteModal
        {...commonProps}
        onAdd={vi.fn()}
        onCreate={onCreate}
        tokenPlanCredentials={[
          { id: 'tk-1', kind: 'tokenPlan', label: 'Plan One', value: 'secret-one', planId: 'p1', subscriptionId: 's1' },
          { id: 'tk-2', kind: 'tokenPlan', label: 'Plan Two', value: 'secret-two', planId: 'p2', subscriptionId: 's2' }
        ]}
      />
    )
    fireEvent.mouseDown(screen.getByLabelText('agentRouter.accessMode'))
    fireEvent.click(await screen.findByText('TokenPlan'))
    fireEvent.mouseDown(screen.getByLabelText('agentRouter.apiKey'))
    fireEvent.click(await screen.findByText('Plan One'))
    await waitFor(() =>
      expect(selectTokenPlanHourlyDayUsageApi).toHaveBeenCalledWith({ subscribeId: 's1', planId: 'p1' })
    )
    await waitFor(() => expect(screen.getByLabelText('agentRouter.modelId')).not.toBeDisabled())
    fireEvent.click(screen.getByLabelText('agentRouter.modelId'))
    fireEvent.click((await screen.findAllByText('plan-one-model')).at(-1)!)
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }))
    fireEvent.mouseDown(screen.getByLabelText('agentRouter.apiKey'))
    fireEvent.click(await screen.findByText('Plan Two'))
    await waitFor(() =>
      expect(selectTokenPlanHourlyDayUsageApi).toHaveBeenCalledWith({ subscribeId: 's2', planId: 'p2' })
    )
    expect(screen.getByLabelText('agentRouter.modelId').parentElement).not.toHaveTextContent('plan-one-model')
    await waitFor(() => expect(screen.getByLabelText('agentRouter.modelId')).not.toBeDisabled())
    fireEvent.click(screen.getByLabelText('agentRouter.modelId'))
    fireEvent.click((await screen.findAllByText('plan-two-model')).at(-1)!)
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }))
    fireEvent.click(screen.getByRole('button', { name: 'agentRouter.createRoute' }))
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith([
        expect.objectContaining({
          modelId: 'plan-two-model',
          tokenPlanId: 'p2',
          apiKey: 'secret-two'
        })
      ])
    )
  })

  it('keeps the dialog open and reports a failed batch', async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error('WRITE_FAILED'))
    render(<AddRouteModal {...commonProps} onAdd={vi.fn()} onCreate={onCreate} />)
    fireEvent.mouseDown(screen.getByLabelText('agentRouter.apiKey'))
    fireEvent.click(await screen.findByText('Key'))
    fireEvent.click(screen.getByLabelText('agentRouter.modelId'))
    fireEvent.click((await screen.findAllByText('gpt-5')).at(-1)!)
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }))
    fireEvent.click(screen.getByRole('button', { name: 'agentRouter.createRoute' }))

    expect(await screen.findByText('agentRouter.createFailed')).toBeInTheDocument()
  })
})
