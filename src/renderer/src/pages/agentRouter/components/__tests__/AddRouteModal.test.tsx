import zhCN from '@renderer/i18n/locales/zh-cn.json'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AddRouteModal } from '../AddRouteModal'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => (options?.count === undefined ? key : `${key}:${options.count}`)
  })
}))

const templates = [
  {
    templateId: 'template-1',
    modelId: 'gpt-5',
    displayName: 'GPT-5',
    accessMode: 'api' as const,
    modelTypes: ['function_calling', 'reasoning'] as const,
    createdAt: '2026-08-31T00:00:00.000Z',
    maskedKey: '••••1234'
  },
  {
    templateId: 'template-2',
    modelId: 'joined-model',
    displayName: 'Joined Model',
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
    displayName: 'Unknown capabilities',
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
    tokenPlanModels: [],
    onCancel: vi.fn(),
    onCreate: vi.fn().mockResolvedValue(undefined)
  }

  it('selects exact unmatched global templates and submits template ids', () => {
    const onAdd = vi.fn()
    render(<AddRouteModal {...commonProps} onAdd={onAdd} />)
    fireEvent.click(screen.getByRole('tab', { name: 'agentRouter.useGlobalConfiguration' }))
    expect(screen.getByText(/••••1234/)).toBeInTheDocument()
    expect(screen.getAllByText('models.type.function_calling')).toHaveLength(2)
    expect(screen.getByText('models.type.reasoning')).toBeInTheDocument()
    expect(screen.queryByText('models.type.vision')).not.toBeInTheDocument()
    expect(screen.queryByText('agentRouter.modelTypesUnavailable')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Joined Model/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /GPT-5/ }))
    fireEvent.click(screen.getByRole('button', { name: 'agentRouter.addSelectedModels:1' }))
    expect(onAdd).toHaveBeenCalledWith(['template-1'])
  })

  it('creates a direct Agent route through the first path', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<AddRouteModal {...commonProps} onAdd={vi.fn()} onCreate={onCreate} />)
    expect(screen.getByText('agentRouter.displayName').closest('.ant-form-item-label')).toHaveStyle({
      flex: '0 0 86px'
    })
    expect(zhCN.agentRouter.displayNameModelFallback).toBe('默认使用模型 ID')
    fireEvent.mouseDown(screen.getByLabelText('agentRouter.apiKey'))
    fireEvent.click(await screen.findByText('Key'))
    expect(screen.getByText('••••••••••••••••••••••••')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('agentRouter.toggleApiKeyVisibility'))
    expect(screen.getByText('sk-secret')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByLabelText('agentRouter.modelId'))
    fireEvent.click((await screen.findAllByText('gpt-5')).at(-1)!)
    expect(screen.queryByText('GPT Five')).not.toBeInTheDocument()
    expect(screen.getByText('agentRouter.modelTypes')).toBeInTheDocument()
    expect(screen.getByText('models.type.websearch')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'models.type.websearch' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'agentRouter.createRoute' }))
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ modelId: 'gpt-5', displayName: 'gpt-5', apiKey: 'sk-secret' })
      )
    )
  })

  it('warns when the selected model and key already exist', async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error('Duplicate Agent route'))
    render(<AddRouteModal {...commonProps} onAdd={vi.fn()} onCreate={onCreate} />)
    fireEvent.mouseDown(screen.getByLabelText('agentRouter.apiKey'))
    fireEvent.click(await screen.findByText('Key'))
    fireEvent.mouseDown(screen.getByLabelText('agentRouter.modelId'))
    fireEvent.click((await screen.findAllByText('gpt-5')).at(-1)!)
    fireEvent.click(screen.getByRole('button', { name: 'agentRouter.createRoute' }))

    expect(await screen.findByText('agentRouter.routeAlreadyExists')).toBeInTheDocument()
  })
})
