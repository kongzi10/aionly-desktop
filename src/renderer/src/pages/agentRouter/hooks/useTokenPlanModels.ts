import { loggerService } from '@logger'
import { selectTokenPlanHourlyDayUsageApi } from '@renderer/api/billManagement'
import type { Model } from '@renderer/types'
import { useEffect, useState } from 'react'

import { resolveAgentRouteModelTypes } from '../utils/modelCapabilities'
import type { AgentRouterCredential, RouteModel } from './useAgentRouterSources'

const logger = loggerService.withContext('AgentRouterTokenPlanModels')
const EMPTY_MODELS: RouteModel[] = []

export const useTokenPlanModels = (credential?: AgentRouterCredential) => {
  const subscriptionId = credential?.kind === 'tokenPlan' ? credential.subscriptionId : undefined
  const planId = credential?.kind === 'tokenPlan' ? credential.planId : undefined
  const requestKey = subscriptionId && planId ? JSON.stringify([credential?.id, subscriptionId, planId]) : ''
  const [result, setResult] = useState({ key: '', models: EMPTY_MODELS, loading: false })

  useEffect(() => {
    if (!requestKey) return
    let active = true
    setResult({ key: requestKey, models: EMPTY_MODELS, loading: true })
    void selectTokenPlanHourlyDayUsageApi({ subscribeId: subscriptionId, planId })
      .then((response: { rows?: Record<string, unknown>[] }) => {
        if (!active) return
        const models = new Map<string, RouteModel>()
        for (const item of response.rows ?? []) {
          const id = String(item.model ?? item.baseId ?? '')
          if (!id || models.has(id)) continue
          const model = {
            ...item,
            id,
            name: String(item.modelName ?? item.baseId ?? item.model ?? ''),
            provider: 'aionly',
            group: String(item.serviceName ?? ''),
            capabilities: Array.isArray(item.capabilities) ? item.capabilities : undefined
          } as Model
          models.set(id, { id, name: model.name, modelTypes: resolveAgentRouteModelTypes(model) })
        }
        setResult({ key: requestKey, models: [...models.values()], loading: false })
      })
      .catch(() => {
        if (!active) return
        logger.warn('Failed to load models for the selected TokenPlan subscription')
        setResult({ key: requestKey, models: EMPTY_MODELS, loading: false })
      })
    return () => {
      active = false
    }
  }, [requestKey, subscriptionId, planId])

  return {
    models: requestKey && result.key === requestKey ? result.models : EMPTY_MODELS,
    loading: Boolean(requestKey) && (result.key !== requestKey || result.loading)
  }
}
