import type {
  AgentRouteModel,
  AgentRouteTemplate,
  CreateAgentRouteRequest,
  CreateAgentRouteTemplateRequest,
  RedactedCredentialSummary,
  TargetSnapshot,
  UpdateAgentRouteRequest
} from '@shared/agentRouter'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { type AgentRouterCredential, useAgentRouterSources } from './useAgentRouterSources'

export const useAgentRouter = () => {
  const sources = useAgentRouterSources()
  const [target, setTarget] = useState<TargetSnapshot | null>(null)
  const [routes, setRoutes] = useState<AgentRouteModel[]>([])
  const [globalTemplates, setGlobalTemplates] = useState<AgentRouteTemplate[]>([])
  const [agentCredentialSummaries, setAgentCredentialSummaries] = useState<RedactedCredentialSummary[]>([])
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const refreshCount = useRef(0)

  const refresh = useCallback(async () => {
    if (!sources.accountId) return
    const startedAt = Date.now()
    refreshCount.current += 1
    setRefreshing(true)
    try {
      const [nextTarget, config, templates, credentialSummaries] = await Promise.all([
        window.api.agentRouter.inspectTarget('workbuddy'),
        window.api.agentRouter.getRouteConfig(sources.accountId),
        window.api.agentRouter.listGlobalTemplates(sources.accountId),
        window.api.agentRouter.listAgentCredentialSummaries(sources.accountId)
      ])
      setTarget(nextTarget)
      setRoutes(config.models)
      setGlobalTemplates(templates)
      setAgentCredentialSummaries(credentialSummaries)
    } finally {
      const remaining = 500 - (Date.now() - startedAt)
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
      refreshCount.current -= 1
      if (refreshCount.current === 0) setRefreshing(false)
    }
  }, [sources.accountId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(
    () =>
      window.api.agentRouter.onTargetChanged((targetId) => {
        if (targetId === 'workbuddy') void refresh()
      }),
    [refresh]
  )

  const allCredentials = useMemo(() => {
    const credentials: AgentRouterCredential[] = [
      ...sources.apiCredentials,
      ...sources.tokenPlanCredentials,
      ...sources.credentialAliases
    ]
    return [...new Map(credentials.map((credential) => [credential.id, credential])).values()]
  }, [sources.apiCredentials, sources.credentialAliases, sources.tokenPlanCredentials])

  const findCredential = useCallback(
    (credentialId: string) => allCredentials.find((credential) => credential.id === credentialId),
    [allCredentials]
  )

  const applyRoutes = async (nextRoutes: AgentRouteModel[]) => {
    if (!target?.revision) throw Object.assign(new Error('Target is not configured'), { code: 'TARGET_NOT_FOUND' })
    const resolvedCredentials = nextRoutes
      .filter((route) => route.enabled)
      .flatMap((route) => {
        const credential = findCredential(route.credentialId)
        return credential ? [{ credentialId: route.credentialId, value: credential.value }] : []
      })
    const preview = await window.api.agentRouter.previewWorkBuddyRoutes({
      accountId: sources.accountId,
      expectedRevision: target.revision,
      enabledRoutes: nextRoutes
        .filter((route) => route.enabled)
        .map(({ modelId, credentialId }) => ({ modelId, credentialId })),
      resolvedCredentials,
      apiUrl: sources.apiUrl
    })
    await window.api.agentRouter.apply({
      accountId: sources.accountId,
      previewToken: preview.previewToken,
      expectedRevision: preview.expectedRevision
    })
  }

  const saveAndApplyRoutes = async (next: AgentRouteModel[]) => {
    setBusy(true)
    try {
      await window.api.agentRouter.saveRouteModels(sources.accountId, next)
      setRoutes(next)
      await applyRoutes(next)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const createAgentRoute = async (request: CreateAgentRouteRequest) => {
    setBusy(true)
    try {
      await window.api.agentRouter.createAgentRoute(sources.accountId, request)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const removeRoute = async (route: AgentRouteModel) => {
    const next = routes.filter((item) => item.modelId !== route.modelId || item.credentialId !== route.credentialId)
    setBusy(true)
    try {
      await window.api.agentRouter.removeRouteModels(sources.accountId, [
        { modelId: route.modelId, credentialId: route.credentialId }
      ])
      setRoutes(next)
      await applyRoutes(next)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const createGlobalTemplate = async (request: CreateAgentRouteTemplateRequest) => {
    await window.api.agentRouter.createGlobalTemplate(sources.accountId, request)
    await refresh()
  }

  const deleteGlobalTemplate = async (templateId: string) => {
    await window.api.agentRouter.deleteGlobalTemplate(sources.accountId, templateId)
    await refresh()
  }

  const copyTemplatesToAgent = async (templateIds: string[]) => {
    setBusy(true)
    try {
      await window.api.agentRouter.copyTemplatesToAgent(sources.accountId, 'workbuddy', templateIds)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const updateAgentRoute = async (route: AgentRouteModel, request: UpdateAgentRouteRequest) => {
    setBusy(true)
    try {
      const updated = await window.api.agentRouter.updateAgentRoute(
        sources.accountId,
        { modelId: route.modelId, credentialId: route.credentialId },
        request
      )
      const next = routes.map((item) =>
        item.modelId === route.modelId && item.credentialId === route.credentialId
          ? { ...updated, enabled: route.enabled }
          : item
      )
      setRoutes(next)
      await applyRoutes(next)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const revealAgentRouteCredential = (route: AgentRouteModel): Promise<string> =>
    window.api.agentRouter.resolveAgentRouteCredential(sources.accountId, {
      modelId: route.modelId,
      credentialId: route.credentialId
    })

  const setRouteEnabled = async (route: AgentRouteModel, enabled: boolean) => {
    await saveAndApplyRoutes(
      routes.map((item) => {
        if (item.modelId !== route.modelId) return item
        if (item.credentialId === route.credentialId) return { ...item, enabled }
        return enabled ? { ...item, enabled: false } : item
      })
    )
  }

  const selectConfig = async () => {
    if (await window.api.agentRouter.selectConfig('workbuddy')) await refresh()
  }

  return {
    ...sources,
    target,
    routes,
    globalTemplates,
    busy,
    refreshing,
    credentialSummaries: [
      ...allCredentials.map((credential) => ({
        id: credential.id,
        label: credential.label,
        maskedValue: `${credential.value.slice(0, 4)}••••${credential.value.slice(-4)}`
      })),
      ...agentCredentialSummaries
        .filter((credential) => credential.available)
        .map((credential) => ({
          id: credential.id,
          label: credential.label,
          maskedValue: credential.maskedValue
        }))
    ],
    createAgentRoute,
    createGlobalTemplate,
    deleteGlobalTemplate,
    copyTemplatesToAgent,
    removeRoute,
    updateAgentRoute,
    revealAgentRouteCredential,
    setRouteEnabled,
    selectConfig,
    refresh
  }
}
