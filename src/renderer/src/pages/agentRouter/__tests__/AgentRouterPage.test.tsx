import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import AgentRouterPage from '../AgentRouterPage'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: vi.fn() }
}))
vi.mock('@renderer/components/app/Navbar', () => ({
  Navbar: ({ children }: { children: React.ReactNode }) => <nav>{children}</nav>,
  NavbarCenter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))
vi.mock('../hooks/useAgentRouter', () => ({
  useAgentRouter: () => ({
    target: {
      targetId: 'workbuddy',
      detectionState: 'detected',
      exists: true,
      readable: true,
      writable: true,
      managedEntryCount: 0,
      externalEntryCount: 0
    },
    routes: [],
    globalTemplates: [],
    credentialSummaries: [],
    apiCredentials: [],
    tokenPlanCredentials: [],
    apiModels: [],
    tokenPlanModels: [],
    tokenPlanModelsLoading: false,
    refreshTokenPlan: vi.fn(),
    busy: false,
    refreshing: true,
    refresh: vi.fn(),
    selectConfig: vi.fn(),
    addRoute: vi.fn(),
    createGlobalTemplate: vi.fn(),
    deleteGlobalTemplate: vi.fn(),
    copyTemplatesToAgent: vi.fn(),
    createAgentRoute: vi.fn(),
    removeRoute: vi.fn(),
    updateRouteDisplayName: vi.fn(),
    setRouteEnabled: vi.fn(),
    apply: vi.fn()
  })
}))

describe('AgentRouterPage', () => {
  it('separates Agent routes and global configuration into tabs', () => {
    render(<AgentRouterPage />)
    expect(screen.queryByRole('heading', { name: 'agentRouter.title' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'agentRouter.routesTab' })).toHaveAttribute('aria-selected', 'true')
    const targetList = screen.getByTestId('agent-router-targets')
    const refresh = screen.getByRole('button', { name: /agentRouter.refresh/ })
    expect(targetList).toContainElement(refresh)
    expect(refresh).not.toHaveTextContent('agentRouter.refresh')
    expect(refresh.querySelector('.anticon-spin')).toBeInTheDocument()
    expect(screen.getByTestId('workbuddy-target-page')).toBeInTheDocument()
    expect(screen.getByTestId('agent-router-content')).toHaveStyle({ overflow: 'hidden' })
    expect(screen.getByTestId('agent-router-shell')).toHaveStyle({ overflow: 'hidden' })
    expect(screen.getByTestId('agent-router-targets')).toHaveStyle({ overflow: 'hidden' })
    expect(screen.getByTestId('workbuddy-target-page')).toHaveStyle({ overflow: 'hidden' })
    expect(screen.getByTestId('routes-panel')).toHaveStyle({ overflow: 'auto' })
    expect(screen.getByText('agentRouter.detected')).toBeInTheDocument()
    expect(screen.queryByText('agentRouter.routeCount')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'agentRouter.apply' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('global-template-page')).not.toBeInTheDocument()
    const codex = screen.getByRole('button', { name: /agentRouter.target.codex.label/ })
    expect(codex).toBeDisabled()
    expect(codex).toHaveTextContent('agentRouter.inDevelopment')

    fireEvent.click(screen.getByRole('tab', { name: 'agentRouter.globalTemplatesTab' }))
    expect(screen.queryByRole('button', { name: /agentRouter.refresh/ })).not.toBeInTheDocument()
    expect(screen.getByTestId('global-template-page')).toBeInTheDocument()
    expect(screen.getByTestId('global-template-page')).toHaveStyle({ overflow: 'auto' })
    expect(screen.queryByTestId('workbuddy-target-page')).not.toBeInTheDocument()
    expect(screen.getByText('agentRouter.globalTemplates')).toBeInTheDocument()
    expect(screen.queryByText('agentRouter.targetNote')).not.toBeInTheDocument()
  })
})
