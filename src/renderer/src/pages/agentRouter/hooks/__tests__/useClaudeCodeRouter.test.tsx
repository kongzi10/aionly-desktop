import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useClaudeCodeRouter } from '../useClaudeCodeRouter'

vi.mock('../useAgentRouterSources', () => ({
  useAgentRouterSources: () => ({
    accountId: 'account-a',
    apiHost: 'https://api.aionly.com',
    apiCredentials: [],
    tokenPlanCredentials: [],
    apiModels: []
  })
}))

describe('useClaudeCodeRouter', () => {
  beforeEach(() => {
    const agentRouter = {
      inspectTarget: vi.fn().mockResolvedValue({
        targetId: 'claude-code',
        detectionState: 'detected',
        revision: 'revision-a',
        issues: []
      }),
      listClaudeCodeProfiles: vi.fn().mockResolvedValue({ version: 2, profiles: [{ id: 'profile-a' }] }),
      onTargetChanged: vi.fn().mockReturnValue(() => undefined),
      deleteClaudeCodeProfile: vi.fn().mockResolvedValue(undefined),
      previewClaudeCodeRoute: vi.fn().mockResolvedValue({
        previewToken: 'preview-a',
        expectedRevision: 'revision-a',
        entries: [],
        warnings: []
      }),
      apply: vi.fn().mockResolvedValue(undefined)
    }
    Object.defineProperty(window, 'api', { configurable: true, value: { agentRouter } })
  })

  it('applies a profile switch directly as a plain overwrite', async () => {
    const { result } = renderHook(() => useClaudeCodeRouter())
    await waitFor(() => expect(result.current.target?.revision).toBe('revision-a'))

    await act(() => result.current.applyProfile('profile-a'))

    expect(window.api.agentRouter.previewClaudeCodeRoute).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: 'profile-a' })
    )
    expect(window.api.agentRouter.apply).toHaveBeenCalledWith({
      accountId: 'account-a',
      previewToken: 'preview-a',
      expectedRevision: 'revision-a'
    })
    expect(result.current.busy).toBe(false)
  })

  it('deletes a profile without previewing local configuration changes', async () => {
    const agentRouter = window.api.agentRouter
    vi.mocked(agentRouter.listClaudeCodeProfiles).mockResolvedValueOnce({
      version: 2,
      profiles: [{ id: 'profile-a' }],
      activeProfileId: 'profile-a'
    })
    const { result } = renderHook(() => useClaudeCodeRouter())
    await waitFor(() => expect(result.current.library.activeProfileId).toBe('profile-a'))

    await act(() => result.current.removeSelected('profile-a'))

    expect(agentRouter.deleteClaudeCodeProfile).toHaveBeenCalledWith({ accountId: 'account-a', profileId: 'profile-a' })
  })

  it('reports apply failures through onError instead of crashing', async () => {
    const onError = vi.fn()
    const agentRouter = window.api.agentRouter
    vi.mocked(agentRouter.previewClaudeCodeRoute).mockRejectedValueOnce(new Error('conflict'))
    const { result } = renderHook(() => useClaudeCodeRouter({ onError }))
    await waitFor(() => expect(result.current.target?.revision).toBe('revision-a'))

    await act(() => result.current.applyProfile('profile-a'))

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'conflict' }))
    expect(agentRouter.apply).not.toHaveBeenCalled()
    expect(result.current.busy).toBe(false)
  })
})
