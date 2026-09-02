import type { AgentRouteModel } from '@shared/agentRouter'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RouteList } from '../RouteList'

vi.mock('@renderer/api/billManagement', () => ({ selectTokenPlanHourlyDayUsageApi: vi.fn() }))
vi.mock('../../utils/modelCapabilities', () => ({ resolveAgentRouteModelTypes: () => [] }))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const route: AgentRouteModel = {
  modelId: 'gpt-5',
  displayName: 'GPT-5',
  accessMode: 'api' as const,
  credentialId: 'credential-1',
  enabled: true,
  modelTypes: ['function_calling', 'reasoning'],
  routedAt: '2026-08-31T00:00:00Z'
}

describe('RouteList', () => {
  beforeEach(() => {
    const getComputedStyle = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => getComputedStyle(element))
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })
    })
  })

  it('keeps the name fixed while editing credentials and exposes the enabled switch', async () => {
    const onUpdateRoute = vi.fn()
    const onEnabledChange = vi.fn()
    const onRevealCredential = vi.fn().mockResolvedValue('sk-secret')
    render(
      <RouteList
        routes={[route]}
        credentials={[{ id: 'credential-1', label: 'Key', maskedValue: '••••secret' }]}
        onRemove={vi.fn()}
        onUpdateRoute={onUpdateRoute}
        onRevealCredential={onRevealCredential}
        onEnabledChange={onEnabledChange}
        busy={false}
      />
    )
    expect(screen.getByText('GPT-5')).toBeInTheDocument()
    expect(screen.getByText('gpt-5').tagName).toBe('STRONG')
    expect(screen.getByText('Key')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch'))
    expect(onEnabledChange).toHaveBeenCalledWith(route, false)
    fireEvent.click(screen.getByRole('button', { name: /agentRouter.edit/ }))
    expect(screen.queryByRole('textbox', { name: 'agentRouter.displayName' })).not.toBeInTheDocument()
    expect(screen.queryByText('agentRouter.modelTypes')).not.toBeInTheDocument()
    expect(screen.queryByText('agentRouter.modelTypesUnavailable')).not.toBeInTheDocument()
    expect(screen.getAllByLabelText('agentRouter.accessMode')[0]).not.toBeDisabled()
    expect(screen.getAllByLabelText('agentRouter.apiKey')[0]).not.toBeDisabled()
    expect(screen.getByText('••••••••••••••••••••••••')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('agentRouter.toggleApiKeyVisibility'))
    await waitFor(() => expect(screen.getByText('sk-secret')).toBeInTheDocument())
    expect(onRevealCredential).toHaveBeenCalledWith(route)
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))
    await waitFor(() =>
      expect(onUpdateRoute).toHaveBeenCalledWith(
        route,
        expect.objectContaining({ displayName: 'AiOnly', accessMode: 'api', apiKey: undefined })
      )
    )
  })

  it('fits the route table without forcing horizontal scrolling', () => {
    const { container } = render(
      <RouteList
        routes={[route]}
        credentials={[{ id: 'credential-1', label: 'Key', maskedValue: '••••secret' }]}
        onRemove={vi.fn()}
        onUpdateRoute={vi.fn()}
        onEnabledChange={vi.fn()}
        busy={false}
      />
    )

    expect(container.querySelector('table')).not.toHaveStyle({ width: '760px' })
  })

  it('forces route switches off and disables them when the target config is not detected', () => {
    render(
      <RouteList
        routes={[route]}
        credentials={[{ id: 'credential-1', label: 'Key', maskedValue: '••••secret' }]}
        onRemove={vi.fn()}
        onUpdateRoute={vi.fn()}
        onEnabledChange={vi.fn()}
        busy={false}
        routeTogglesDisabled
      />
    )

    expect(screen.getByRole('switch')).not.toBeChecked()
    expect(screen.getByRole('switch')).toBeDisabled()
  })

  it('asks before enabling a second route with the same model id', () => {
    const onEnabledChange = vi.fn()
    const alternate = { ...route, credentialId: 'credential-2', displayName: 'GPT-5 alternate', enabled: false }
    render(
      <RouteList
        routes={[route, alternate]}
        credentials={[
          { id: 'credential-1', label: 'Key A', maskedValue: 'sk-a••••cret' },
          { id: 'credential-2', label: 'Key B', maskedValue: 'sk-b••••cret' }
        ]}
        onRemove={vi.fn()}
        onUpdateRoute={vi.fn()}
        onEnabledChange={onEnabledChange}
        busy={false}
      />
    )

    fireEvent.click(screen.getAllByRole('switch')[1])
    expect(screen.getByText('agentRouter.confirmOverwriteModelId')).toBeInTheDocument()
    expect(onEnabledChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'agentRouter.overwrite' }))
    expect(onEnabledChange).toHaveBeenCalledWith(alternate, true)
  })

  it('warns when an edited route duplicates an existing model and key', async () => {
    const onUpdateRoute = vi.fn().mockRejectedValue(new Error('Duplicate Agent route'))
    render(
      <RouteList
        routes={[route]}
        credentials={[{ id: 'credential-1', label: 'Key', maskedValue: '••••secret' }]}
        onRemove={vi.fn()}
        onUpdateRoute={onUpdateRoute}
        onEnabledChange={vi.fn()}
        busy={false}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /agentRouter.edit/ }))
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    expect(await screen.findByText('agentRouter.routeAlreadyExists')).toBeInTheDocument()
  })
})
