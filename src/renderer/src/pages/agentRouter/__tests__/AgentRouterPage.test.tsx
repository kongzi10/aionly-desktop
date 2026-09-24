import type { TargetSnapshot } from '@shared/agentRouter'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
const claudeCode = {
  target: {
    targetId: 'claude-code',
    configPath: 'C:\\Users\\kongz\\.claude\\settings.json',
    exists: false,
    readable: false,
    writable: false,
    detectionState: 'notFound',
    issues: [],
    managedEntryCount: 0,
    externalEntryCount: 0
  } as TargetSnapshot,
  library: { version: 2 as const, profiles: [] as unknown[], activeProfileId: undefined as string | undefined },
  selectedProfileId: undefined,
  profile: undefined,
  apiCredentials: [],
  tokenPlanCredentials: [],
  apiModels: [],
  busy: false,
  refreshing: false,
  refresh: vi.fn(),
  selectConfig: vi.fn(),
  selectProfile: vi.fn(),
  newProfile: vi.fn(),
  saveDraft: vi.fn(),
  applyProfile: vi.fn(),
  removeSelected: vi.fn()
}
vi.mock('../hooks/useClaudeCodeRouter', () => ({
  useClaudeCodeRouter: () => claudeCode
}))
const codex = {
  target: { targetId: 'codex', detectionState: 'notFound', issues: [], managedEntryCount: 0 },
  library: { version: 1 as const, profiles: [] as unknown[], activeProfileId: undefined as string | undefined },
  selectedProfileId: undefined,
  profile: undefined,
  apiCredentials: [],
  tokenPlanCredentials: [],
  apiModels: [],
  busy: false,
  refreshing: false,
  refresh: vi.fn(),
  selectConfig: vi.fn(),
  selectProfile: vi.fn(),
  newProfile: vi.fn(),
  saveDraft: vi.fn(),
  applyProfile: vi.fn(),
  removeSelected: vi.fn()
}
vi.mock('../hooks/useCodexRouter', () => ({
  useCodexRouter: () => codex
}))

describe('AgentRouterPage', () => {
  beforeEach(() => {
    const getComputedStyle = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => getComputedStyle(element))
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })
    })
  })

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
    expect(screen.getByRole('img', { name: 'agentRouter.target.workbuddy.label' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'agentRouter.target.codex.label' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'agentRouter.target.claudeCode.label' })).toBeInTheDocument()
    const codexPill = screen.getByRole('button', { name: /agentRouter.target.codex.label/ })
    const claudeCodePill = screen.getByRole('button', { name: /agentRouter.target.claudeCode.label/ })
    expect(codexPill.compareDocumentPosition(claudeCodePill)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(codexPill).toBeEnabled()
    fireEvent.click(codexPill)
    expect(screen.getByTestId('codex-target-page')).toBeInTheDocument()
    expect(codexPill).toHaveTextContent('agentRouter.notDetected')

    expect(claudeCodePill).toBeEnabled()
    fireEvent.click(claudeCodePill)
    expect(screen.getByTestId('claude-code-target-page')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'agentRouter.globalTemplatesTab' }))
    expect(screen.queryByRole('button', { name: /agentRouter.refresh/ })).not.toBeInTheDocument()
    expect(screen.getByTestId('global-template-page')).toBeInTheDocument()
    expect(screen.getByTestId('global-template-page')).toHaveStyle({ overflow: 'auto' })
    expect(screen.queryByTestId('workbuddy-target-page')).not.toBeInTheDocument()
    expect(screen.getByText('agentRouter.globalTemplates')).toBeInTheDocument()
    expect(screen.queryByText('agentRouter.targetNote')).not.toBeInTheDocument()
  })

  it('opens the claude code profile modal from the list and new profile action', () => {
    render(<AgentRouterPage />)

    fireEvent.click(screen.getByRole('button', { name: /agentRouter.target.claudeCode.label/ }))
    expect(screen.getByTestId('claude-code-profile-cards')).toBeInTheDocument()
    expect(screen.queryByText('agentRouter.claudeCode.profileName')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'agentRouter.claudeCode.newProfile' }))
    expect(claudeCode.newProfile).toHaveBeenCalled()
    expect(document.querySelector('.ant-modal-title')).toHaveTextContent('agentRouter.claudeCode.newProfile')
    expect(screen.getByTestId('claude-code-route-form')).toBeInTheDocument()
  })

  it('shows profile-based target status as recognized or unrecognized only', () => {
    claudeCode.target = {
      targetId: 'claude-code',
      configPath: 'C:\\Users\\kongz\\.claude\\settings.json',
      exists: true,
      readable: true,
      writable: true,
      detectionState: 'needsAttention',
      issues: [],
      managedEntryCount: 0,
      externalEntryCount: 0
    }
    const { unmount } = render(<AgentRouterPage />)

    const target = screen.getByRole('button', { name: /agentRouter.target.claudeCode.label/ })
    expect(target).toHaveTextContent('agentRouter.detected')
    expect(target).not.toHaveTextContent('agentRouter.detection.needsAttention')

    unmount()
    claudeCode.target = {
      targetId: 'claude-code',
      configPath: 'C:\\Users\\kongz\\.claude\\settings.json',
      exists: false,
      readable: false,
      writable: false,
      detectionState: 'notFound',
      issues: [],
      managedEntryCount: 0,
      externalEntryCount: 0
    }
  })

  it('keeps a switch on every row, disables the active one, and applies after the overwrite reminder', () => {
    const profile = {
      id: 'p1',
      targetId: 'claude-code' as const,
      name: 'P1',
      credentialId: 'cred-1',
      accessMode: 'api' as const,
      models: { opus: 'o', sonnet: 's', haiku: 'h' },
      managedAt: '2026-09-18T00:00:00.000Z'
    }
    const other = { ...profile, id: 'p2', name: 'P2' }
    claudeCode.library = { version: 2, profiles: [profile, other], activeProfileId: 'p1' }
    render(<AgentRouterPage />)
    fireEvent.click(screen.getByRole('button', { name: /agentRouter.target.claudeCode.label/ }))

    // The active row keeps its switch in the on state and it cannot be toggled again.
    const [activeToggle, inactiveToggle] = screen.getAllByRole('switch')
    expect(activeToggle).toBeChecked()
    expect(activeToggle).toBeDisabled()
    fireEvent.click(activeToggle)
    expect(claudeCode.applyProfile).not.toHaveBeenCalled()

    // Switching an inactive row only reminds that applying overwrites the configuration.
    fireEvent.click(inactiveToggle)
    expect(claudeCode.selectProfile).toHaveBeenCalledWith('p2')
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('agentRouter.overwriteWarning')
    fireEvent.click(within(dialog).getByRole('button', { name: 'agentRouter.apply' }))
    expect(claudeCode.applyProfile).toHaveBeenCalledWith('p2')

    claudeCode.library = { version: 2, profiles: [], activeProfileId: undefined }
  })

  it('opens the codex profile modal from the new profile action', () => {
    render(<AgentRouterPage />)

    fireEvent.click(screen.getByRole('button', { name: /agentRouter.target.codex.label/ }))
    expect(screen.getByTestId('codex-profile-cards')).toBeInTheDocument()
    expect(screen.queryByText('agentRouter.codex.profileName')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'agentRouter.codex.newProfile' }))
    expect(codex.newProfile).toHaveBeenCalled()
    expect(document.querySelector('.ant-modal-title')).toHaveTextContent('agentRouter.codex.newProfile')
    expect(screen.getByTestId('codex-profile-form')).toBeInTheDocument()
  })
})
