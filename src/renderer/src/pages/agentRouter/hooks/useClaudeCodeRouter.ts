import { loggerService } from '@logger'
import type { ClaudeCodeProfileLibrary, TargetSnapshot } from '@shared/agentRouter'
import { useCallback, useEffect, useState } from 'react'

import type { ClaudeCodeFormValue } from '../components/ClaudeCodeRouteForm'
import { useAgentRouterSources } from './useAgentRouterSources'

const EMPTY_LIBRARY: ClaudeCodeProfileLibrary = { version: 2, profiles: [] }

export const useClaudeCodeRouter = ({ onError }: { onError?: (error: unknown) => void } = {}) => {
  const sources = useAgentRouterSources()
  const [target, setTarget] = useState<TargetSnapshot | null>(null)
  const [library, setLibrary] = useState<ClaudeCodeProfileLibrary>(EMPTY_LIBRARY)
  const [selectedProfileId, setSelectedProfileId] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    if (!sources.accountId) return
    setRefreshing(true)
    try {
      const [nextTarget, nextLibrary] = await Promise.all([
        window.api.agentRouter.inspectTarget('claude-code', sources.accountId),
        window.api.agentRouter.listClaudeCodeProfiles(sources.accountId)
      ])
      setTarget(nextTarget)
      setLibrary(nextLibrary)
      setSelectedProfileId((current) =>
        current && nextLibrary.profiles.some(({ id }) => id === current)
          ? current
          : (nextLibrary.activeProfileId ?? nextLibrary.profiles[0]?.id)
      )
    } catch (error) {
      loggerService.warn('useClaudeCodeRouter#refresh failed', { error })
    } finally {
      setRefreshing(false)
    }
  }, [sources.accountId])

  useEffect(() => void refresh(), [refresh])
  useEffect(
    () =>
      window.api.agentRouter.onTargetChanged((targetId) => {
        if (targetId === 'claude-code') void refresh()
      }),
    [refresh]
  )

  const saveDraft = async ({ profileId, name, credential, models }: ClaudeCodeFormValue) => {
    setBusy(true)
    try {
      const saved = await window.api.agentRouter.saveClaudeCodeProfile(sources.accountId, {
        profileId,
        name,
        credentialName: credential.label,
        accessMode: credential.kind,
        tokenPlanId: credential.planId,
        apiKey: credential.value,
        models
      })
      setSelectedProfileId(saved.id)
      await refresh()
      return saved.id
    } finally {
      setBusy(false)
    }
  }

  // Switching is a plain overwrite: issue a preview token then apply it immediately.
  const applyProfile = async (profileId: string) => {
    if (!target?.revision) return false
    setBusy(true)
    try {
      const issued = await window.api.agentRouter.previewClaudeCodeRoute({
        accountId: sources.accountId,
        profileId,
        expectedRevision: target.revision,
        apiUrl: sources.apiHost
      })
      await window.api.agentRouter.apply({
        accountId: sources.accountId,
        previewToken: issued.previewToken,
        expectedRevision: issued.expectedRevision
      })
      await refresh()
      return true
    } catch (error) {
      onError?.(error)
      return false
    } finally {
      setBusy(false)
    }
  }

  const removeSelected = async (profileId = selectedProfileId) => {
    if (!profileId) return
    setBusy(true)
    try {
      await window.api.agentRouter.deleteClaudeCodeProfile({
        accountId: sources.accountId,
        profileId
      })
      await refresh()
    } catch (error) {
      onError?.(error)
    } finally {
      setBusy(false)
    }
  }

  return {
    target,
    library,
    selectedProfileId,
    profile: library.profiles.find(({ id }) => id === selectedProfileId),
    busy,
    refreshing,
    apiCredentials: sources.apiCredentials,
    tokenPlanCredentials: sources.tokenPlanCredentials,
    apiModels: sources.apiModels,
    selectProfile: setSelectedProfileId,
    newProfile: () => setSelectedProfileId(undefined),
    refresh,
    selectConfig: () => window.api.agentRouter.selectConfig('claude-code').then(() => refresh()),
    saveDraft,
    applyProfile,
    removeSelected
  }
}
