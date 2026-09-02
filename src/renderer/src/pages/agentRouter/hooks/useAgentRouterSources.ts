import { getApikeyList } from '@renderer/api/apikey'
import { getIndexTokenPlanPageListApi } from '@renderer/api/balance'
import { pageListApi } from '@renderer/api/openManagement'
import { useAppSelector } from '@renderer/store'
import { selectApiKey, selectUserInfo } from '@renderer/store/user'
import type { Model } from '@renderer/types'
import { maskApiKey } from '@renderer/utils/api'
import type { AgentRouteModelType } from '@shared/agentRouter'
import { APP_API_HOST } from '@shared/config/constant'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { resolveAgentRouteModelTypes } from '../utils/modelCapabilities'

export type RouteModel = { id: string; name: string; modelTypes: readonly AgentRouteModelType[] }

export type AgentRouterCredentialKind = 'api' | 'tokenPlan'

export interface AgentRouterCredential {
  id: string
  kind: AgentRouterCredentialKind
  /** 展示名：API 密钥为 appname，TokenPlan 为套餐名 */
  label: string
  value: string
  /** 仅 TokenPlan 凭证携带，对应 AgentRouteModel.tokenPlanId */
  planId?: string
  /** 套餐订阅 ID，用于查询该密钥对应的模型范围。 */
  subscriptionId?: string
}

const CREDENTIAL_LIST_PAGE_SIZE = 100

const uniqueRouteModels = (models: RouteModel[]): RouteModel[] => {
  const seen = new Set<string>()
  return models.filter((model) => {
    if (seen.has(model.id)) return false
    seen.add(model.id)
    return true
  })
}

export const useAgentRouterSources = () => {
  const [credentialsRevision, setCredentialsRevision] = useState(0)
  const [apiCredentials, setApiCredentials] = useState<AgentRouterCredential[]>([])
  const [apiModels, setApiModels] = useState<RouteModel[]>([])
  const [tokenPlanCredentials, setTokenPlanCredentials] = useState<AgentRouterCredential[]>([])
  const user = useAppSelector(selectUserInfo) as { userId?: string; id?: string }
  const fallbackApiKey = useAppSelector(selectApiKey)
  const accountId = String(user.userId ?? user.id ?? '')
  const refreshTokenPlan = useCallback(() => {
    setCredentialsRevision((revision) => revision + 1)
  }, [])

  useEffect(() => {
    if (!accountId) {
      setApiModels([])
      return
    }
    let active = true
    void pageListApi({
      type: '1',
      modelAttribute: 'text_model',
      pageNum: 1,
      pageSize: 1000,
      total: 0,
      orderByStatus: 1,
      orderByTime: 'desc',
      domain: window.location.hostname || 'localhost:5173'
    })
      .then((response: { rows?: Record<string, unknown>[] }) => {
        if (!active) return
        setApiModels(
          uniqueRouteModels(
            (response.rows ?? [])
              .filter((item) => item.packageNum === '先用后付')
              .map((item) => {
                const model = {
                  ...item,
                  id: String(item.baseId ?? item.model ?? ''),
                  name: String(item.modelName ?? item.baseId ?? item.model ?? ''),
                  provider: 'aionly',
                  group: String(item.serviceName ?? ''),
                  capabilities: Array.isArray(item.capabilities) ? item.capabilities : undefined
                } as Model
                return {
                  id: model.id,
                  name: model.name,
                  modelTypes: resolveAgentRouteModelTypes(model)
                }
              })
              .filter((model) => model.id)
          )
        )
      })
      .catch(() => {
        if (active) setApiModels([])
      })
    return () => {
      active = false
    }
  }, [accountId])

  useEffect(() => {
    if (!accountId) {
      setApiCredentials([])
      setTokenPlanCredentials([])
      return
    }
    let active = true
    // 账号 API 密钥列表（可能存在多个）
    getApikeyList({ pageNum: 1, pageSize: CREDENTIAL_LIST_PAGE_SIZE })
      .then((response: { rows?: { id?: string | number; appname?: string; apikey?: string }[] }) => {
        if (!active) return
        const list = (response.rows ?? [])
          .filter((row) => row.apikey)
          .map((row) => ({
            id: `api-key-${row.id}`,
            kind: 'api' as const,
            label: row.appname || maskApiKey(row.apikey!),
            value: row.apikey!
          }))
        setApiCredentials(list)
      })
      .catch(() => {
        if (active) setApiCredentials([])
      })
    // 生效中的 TokenPlan 套餐列表（每个套餐各有独立 apikey）
    getIndexTokenPlanPageListApi({ pageNum: 1, pageSize: CREDENTIAL_LIST_PAGE_SIZE, status: 2 })
      .then((response: { rows?: Record<string, unknown>[] }) => {
        if (!active) return
        const list = (response.rows ?? [])
          .filter((row) => typeof row.apikey === 'string' && row.apikey && row.id != null && row.planId != null)
          .map((row) => ({
            id: `token-plan-${row.id}`,
            kind: 'tokenPlan' as const,
            label: String(row.planName ?? row.id ?? ''),
            value: String(row.apikey),
            planId: String(row.planId),
            subscriptionId: String(row.id)
          }))
        setTokenPlanCredentials(list)
      })
      .catch(() => {
        if (active) setTokenPlanCredentials([])
      })
    return () => {
      active = false
    }
  }, [accountId, credentialsRevision])

  return useMemo(
    () => ({
      accountId,
      apiUrl: `${APP_API_HOST.replace(/\/$/, '')}/v1`,
      apiModels,
      // 列表为空时回退到 Redux 中的账号基础密钥，保证 API 类别始终可用
      apiCredentials: apiCredentials.length
        ? apiCredentials
        : fallbackApiKey
          ? [{ id: 'aionly-api', kind: 'api' as const, label: 'AiOnly', value: fallbackApiKey }]
          : [],
      credentialAliases: fallbackApiKey
        ? [{ id: 'aionly-api', kind: 'api' as const, label: 'AiOnly', value: fallbackApiKey }]
        : [],
      tokenPlanCredentials,
      refreshTokenPlan
    }),
    [accountId, apiCredentials, fallbackApiKey, apiModels, refreshTokenPlan, tokenPlanCredentials]
  )
}
