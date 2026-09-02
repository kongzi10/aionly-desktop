import { access, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

import type {
  AgentRouteConfig,
  AgentRouteModel,
  AgentRouterApplyRequest,
  AgentRouteRef,
  AgentRouterTargetId,
  ApplyCounts,
  ApplyPreview,
  ApplyResult,
  CreateAgentRouteTemplateRequest,
  PreviewWorkBuddyRoutesRequest,
  RedactedCredentialSummary,
  RedactedTargetEntry,
  TargetSnapshot,
  UpdateAgentRouteRequest
} from '@shared/agentRouter'

import { AgentCredentialSnapshotStore } from './AgentCredentialSnapshotStore'
import { ConfigTransactionService } from './ConfigTransactionService'
import { GlobalRouteTemplateStore } from './GlobalRouteTemplateStore'
import { PreviewTokenStore } from './PreviewTokenStore'
import { RouteRecordStore } from './RouteRecordStore'
import { AgentRouterError, WorkBuddyAdapter, type WorkBuddyEntry } from './WorkBuddyAdapter'

interface PendingWorkBuddyApply {
  accountId: string
  configPath: string
  serializedContent: string
  counts: ApplyCounts
}

const maskSecret = (value: string): string => `${value.slice(0, 4)}••••${value.slice(-4)}`

export class AgentRouterService {
  private readonly routes: RouteRecordStore
  private readonly transaction = new ConfigTransactionService()
  private readonly previews = new PreviewTokenStore<PendingWorkBuddyApply>()
  private readonly adapter = new WorkBuddyAdapter()
  private readonly templates: GlobalRouteTemplateStore
  private readonly credentialSnapshots: AgentCredentialSnapshotStore

  constructor(options: { dataRoot: string }) {
    this.routes = new RouteRecordStore(options.dataRoot)
    this.templates = new GlobalRouteTemplateStore(options.dataRoot)
    this.credentialSnapshots = new AgentCredentialSnapshotStore(options.dataRoot)
  }

  async listGlobalTemplates(accountId: string, targetId: AgentRouterTargetId = 'workbuddy') {
    const [templates, config] = await Promise.all([
      this.templates.list(accountId),
      this.routes.getRouteConfig(accountId, targetId)
    ])
    const routesWithKeys = await Promise.all(
      config.models.map(async (route) => ({
        modelId: route.modelId,
        key: await this.credentialSnapshots.resolve(accountId, targetId, route.credentialId).catch(() => undefined)
      }))
    )
    return Promise.all(
      templates.map(async (template) => {
        const key = await this.templates.resolveKey(accountId, template.templateId).catch(() => undefined)
        return {
          ...template,
          joined: routesWithKeys.some((route) => route.modelId === template.modelId && route.key === key)
        }
      })
    )
  }

  createGlobalTemplate(accountId: string, request: CreateAgentRouteTemplateRequest) {
    return this.templates.create(accountId, request)
  }

  deleteGlobalTemplate(accountId: string, templateId: string) {
    return this.templates.remove(accountId, templateId)
  }

  async listAgentCredentialSummaries(
    accountId: string,
    targetId: AgentRouterTargetId
  ): Promise<RedactedCredentialSummary[]> {
    const config = await this.routes.getRouteConfig(accountId, targetId)
    return Promise.all(
      config.models.map(async (route) => {
        try {
          const value = await this.credentialSnapshots.resolve(accountId, targetId, route.credentialId)
          return {
            id: route.credentialId,
            accessMode: route.accessMode,
            label: route.accessMode === 'api' ? 'API' : 'TokenPlan',
            maskedValue: maskSecret(value),
            available: true,
            tokenPlanId: route.tokenPlanId
          }
        } catch {
          return {
            id: route.credentialId,
            accessMode: route.accessMode,
            label: route.accessMode === 'api' ? 'API' : 'TokenPlan',
            maskedValue: '',
            available: false,
            reason: 'credentialInvalid' as const,
            tokenPlanId: route.tokenPlanId
          }
        }
      })
    )
  }

  async resolveAgentRouteCredential(
    accountId: string,
    targetId: AgentRouterTargetId,
    routeRef: AgentRouteRef
  ): Promise<string> {
    const config = await this.routes.getRouteConfig(accountId, targetId)
    const route = config.models.find(
      (model) => model.modelId === routeRef.modelId && model.credentialId === routeRef.credentialId
    )
    if (!route) throw new AgentRouterError('INVALID_REQUEST', 'Agent route does not exist')
    return this.credentialSnapshots.resolve(accountId, targetId, route.credentialId)
  }

  async copyTemplatesToAgent(accountId: string, targetId: AgentRouterTargetId, templateIds: string[]): Promise<void> {
    if (targetId !== 'workbuddy') throw new AgentRouterError('TARGET_NOT_FOUND', 'Target is not available')
    const templates = await this.templates.list(accountId)
    const byId = new Map(templates.map((template) => [template.templateId, template]))
    const current = await this.routes.getRouteConfig(accountId, targetId)
    const existing = await Promise.all(
      current.models.map(async (route) => ({
        modelId: route.modelId,
        key: await this.credentialSnapshots.resolve(accountId, targetId, route.credentialId).catch(() => undefined)
      }))
    )
    const createdCredentialIds: string[] = []
    const copied: AgentRouteModel[] = []
    try {
      for (const templateId of templateIds) {
        const template = byId.get(templateId)
        if (!template) throw new AgentRouterError('INVALID_REQUEST', 'Global route template does not exist')
        const key = await this.templates.resolveKey(accountId, templateId)
        if (existing.some((route) => route.modelId === template.modelId && route.key === key)) continue
        const credentialId = await this.credentialSnapshots.create(accountId, targetId, key)
        createdCredentialIds.push(credentialId)
        copied.push({
          modelId: template.modelId,
          displayName: template.displayName,
          accessMode: template.accessMode,
          credentialId,
          tokenPlanId: template.tokenPlanId,
          enabled: false,
          modelTypes: template.modelTypes,
          routedAt: new Date().toISOString()
        })
        existing.push({ modelId: template.modelId, key })
      }
      await this.routes.saveRouteModels(accountId, targetId, copied)
    } catch (error) {
      await Promise.all(createdCredentialIds.map((id) => this.credentialSnapshots.remove(accountId, targetId, id)))
      throw error
    }
  }

  async createAgentRoute(
    accountId: string,
    targetId: AgentRouterTargetId,
    request: CreateAgentRouteTemplateRequest
  ): Promise<AgentRouteModel> {
    if (targetId !== 'workbuddy') throw new AgentRouterError('TARGET_NOT_FOUND', 'Target is not available')
    if (!request.modelId || !request.apiKey || (request.accessMode === 'tokenPlan') !== Boolean(request.tokenPlanId)) {
      throw new AgentRouterError('INVALID_REQUEST', 'Invalid Agent route')
    }
    const current = await this.routes.getRouteConfig(accountId, targetId)
    for (const route of current.models) {
      const key = await this.credentialSnapshots.resolve(accountId, targetId, route.credentialId).catch(() => undefined)
      if (route.modelId === request.modelId && key === request.apiKey) {
        throw new AgentRouterError('INVALID_REQUEST', 'Duplicate Agent route')
      }
    }
    const credentialId = await this.credentialSnapshots.create(accountId, targetId, request.apiKey)
    const route: AgentRouteModel = {
      modelId: request.modelId,
      displayName: request.displayName || request.modelId,
      accessMode: request.accessMode,
      credentialId,
      tokenPlanId: request.tokenPlanId,
      enabled: false,
      modelTypes: request.modelTypes,
      routedAt: new Date().toISOString()
    }
    try {
      await this.routes.saveRouteModels(accountId, targetId, [route])
      return route
    } catch (error) {
      await this.credentialSnapshots.remove(accountId, targetId, credentialId)
      throw error
    }
  }

  async updateAgentRoute(
    accountId: string,
    targetId: AgentRouterTargetId,
    routeRef: AgentRouteRef,
    request: UpdateAgentRouteRequest
  ): Promise<AgentRouteModel> {
    if (targetId !== 'workbuddy') throw new AgentRouterError('TARGET_NOT_FOUND', 'Target is not available')
    const current = await this.routes.getRouteConfig(accountId, targetId)
    const route = current.models.find(
      (model) => model.modelId === routeRef.modelId && model.credentialId === routeRef.credentialId
    )
    if (!route) throw new AgentRouterError('INVALID_REQUEST', 'Agent route does not exist')
    if ((request.accessMode === 'tokenPlan') !== Boolean(request.tokenPlanId)) {
      throw new AgentRouterError('INVALID_REQUEST', 'Invalid Agent route credential mode')
    }
    if (request.accessMode !== route.accessMode && !request.apiKey) {
      throw new AgentRouterError('INVALID_REQUEST', 'A new credential is required when changing access mode')
    }

    let credentialId = route.credentialId
    if (request.apiKey) {
      for (const candidate of current.models) {
        if (candidate.credentialId === route.credentialId || candidate.modelId !== route.modelId) continue
        const key = await this.credentialSnapshots
          .resolve(accountId, targetId, candidate.credentialId)
          .catch(() => undefined)
        if (key === request.apiKey) throw new AgentRouterError('INVALID_REQUEST', 'Duplicate Agent route')
      }
      credentialId = await this.credentialSnapshots.create(accountId, targetId, request.apiKey)
    }

    const updated: AgentRouteModel = {
      ...route,
      displayName: request.displayName?.trim() || route.modelId,
      accessMode: request.accessMode,
      credentialId,
      tokenPlanId: request.accessMode === 'tokenPlan' ? request.tokenPlanId : undefined,
      modelTypes: request.modelTypes
    }
    try {
      await this.routes.replaceRouteModel(accountId, targetId, routeRef, updated)
      if (credentialId !== route.credentialId) {
        await this.credentialSnapshots.remove(accountId, targetId, route.credentialId)
      }
      return updated
    } catch (error) {
      if (credentialId !== route.credentialId) {
        await this.credentialSnapshots.remove(accountId, targetId, credentialId)
      }
      throw error
    }
  }

  async inspectTarget(targetId: 'workbuddy', configPath: string): Promise<TargetSnapshot> {
    if (targetId !== 'workbuddy') throw new AgentRouterError('TARGET_NOT_FOUND', 'Target is not available')
    const normalizedPath = resolve(configPath)
    try {
      const [snapshot, details] = await Promise.all([
        this.transaction.readSnapshot(normalizedPath),
        stat(normalizedPath)
      ])
      const parsed = this.adapter.parse(snapshot.content)
      const managedEntryCount = parsed.entries.filter(({ value }) => this.adapter.isAionlyEntry(value)).length
      await access(normalizedPath)
      return {
        targetId: 'workbuddy',
        configPath: normalizedPath,
        exists: true,
        readable: true,
        writable: true,
        detectionState: 'detected',
        formatVersion: 'workbuddy-models-v1',
        revision: snapshot.revision,
        lastModifiedAt: details.mtime.toISOString(),
        managedEntryCount,
        externalEntryCount: parsed.entries.length - managedEntryCount,
        issues: []
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT') {
        return {
          targetId: 'workbuddy',
          configPath: normalizedPath,
          exists: false,
          readable: false,
          writable: false,
          detectionState: 'notFound',
          managedEntryCount: 0,
          externalEntryCount: 0,
          issues: ['targetNotWritable']
        }
      }
      if (error instanceof AgentRouterError) {
        return {
          targetId: 'workbuddy',
          configPath: normalizedPath,
          exists: true,
          readable: true,
          writable: false,
          detectionState: 'needsAttention',
          managedEntryCount: 0,
          externalEntryCount: 0,
          issues: ['unsupportedFormat']
        }
      }
      throw new AgentRouterError('CONFIG_NOT_READABLE', 'WorkBuddy configuration cannot be inspected')
    }
  }

  async identifyConfig(filePath: string): Promise<'workbuddy' | null> {
    try {
      this.adapter.parse(await readFile(resolve(filePath), 'utf8'))
      return 'workbuddy'
    } catch {
      return null
    }
  }

  async getRouteConfig(accountId: string, targetId: 'workbuddy', configPath?: string): Promise<AgentRouteConfig> {
    const config = await this.routes.getRouteConfig(accountId, targetId)
    if (!configPath) return config
    let applied: WorkBuddyEntry[]
    try {
      applied = this.adapter
        .parse(await readFile(resolve(configPath), 'utf8'))
        .entries.map(({ value }) => value)
        .filter((entry) => this.adapter.isAionlyEntry(entry))
    } catch {
      applied = []
    }
    const models = await Promise.all(
      config.models.map(async (route) => {
        const key = await this.credentialSnapshots
          .resolve(accountId, targetId, route.credentialId)
          .catch(() => undefined)
        const enabled = Boolean(key && applied.some((entry) => entry.id === route.modelId && entry.apiKey === key))
        return route.enabled === enabled ? route : { ...route, enabled }
      })
    )
    return { ...config, models }
  }

  saveRouteModels(accountId: string, targetId: 'workbuddy', models: AgentRouteModel[]): Promise<void> {
    return this.routes.saveRouteModels(accountId, targetId, models)
  }

  removeRouteModels(accountId: string, targetId: 'workbuddy', routes: AgentRouteRef[]): Promise<void> {
    return this.routes.removeRouteModels(accountId, targetId, routes)
  }

  async listAppliedWorkBuddyRoutes(configPath: string): Promise<RedactedTargetEntry[]> {
    const snapshot = await this.transaction.readSnapshot(resolve(configPath))
    return this.adapter
      .parse(snapshot.content)
      .entries.map(({ value }) => value)
      .filter((entry) => this.adapter.isAionlyEntry(entry))
      .map((entry) => this.redact(entry))
  }

  async previewWorkBuddyRoutes(configPath: string, request: PreviewWorkBuddyRoutesRequest): Promise<ApplyPreview> {
    if (!request.accountId || request.resolvedCredentials.length > 100) {
      throw new AgentRouterError('INVALID_REQUEST', 'Invalid WorkBuddy preview request')
    }
    const normalizedPath = resolve(configPath)
    const snapshot = await this.transaction.readSnapshot(normalizedPath)
    if (snapshot.revision !== request.expectedRevision)
      throw new AgentRouterError('REVISION_CONFLICT', 'Target changed')
    const config = await this.routes.getRouteConfig(request.accountId, 'workbuddy')
    const current = this.adapter.parse(snapshot.content).entries.map(({ value }) => value)
    const credentials = new Map(request.resolvedCredentials.map((item) => [item.credentialId, item.value]))
    const enabledRoutes = new Set(request.enabledRoutes.map((route) => `${route.modelId}\u0000${route.credentialId}`))
    const generated = await Promise.all(
      config.models
        .filter((model) => enabledRoutes.has(`${model.modelId}\u0000${model.credentialId}`))
        .map(async (model) => {
          let credential = credentials.get(model.credentialId)
          if (!credential) {
            try {
              credential = await this.credentialSnapshots.resolve(request.accountId, 'workbuddy', model.credentialId)
            } catch {
              credential = undefined
            }
          }
          if (!credential)
            throw new AgentRouterError('CREDENTIAL_UNAVAILABLE', `Credential is unavailable for ${model.modelId}`)
          return this.adapter.buildEntry(model, credential, request.apiUrl)
        })
    )
    const managedIds = new Set(current.filter((entry) => this.adapter.isAionlyEntry(entry)).map((entry) => entry.id))
    const entries = this.adapter.merge(current, generated)
    const counts = this.countChanges(current, generated, managedIds)
    const pending: PendingWorkBuddyApply = {
      accountId: request.accountId,
      configPath: normalizedPath,
      serializedContent: this.adapter.serialize(entries),
      counts
    }
    const issued = this.previews.create(request.accountId, request.expectedRevision, pending)
    return {
      previewToken: issued.token,
      targetId: 'workbuddy',
      expectedRevision: request.expectedRevision,
      counts,
      entries: generated.map((entry) => this.redact(entry)),
      warnings: [],
      expiresAt: issued.expiresAt
    }
  }

  async apply(request: AgentRouterApplyRequest): Promise<ApplyResult> {
    const pending = this.previews.take(request.previewToken, request.accountId, request.expectedRevision)
    const result = await this.transaction.apply({
      configPath: pending.configPath,
      expectedRevision: request.expectedRevision,
      serializedContent: pending.serializedContent,
      verify: (content) => this.adapter.parse(content)
    })
    return {
      targetId: 'workbuddy',
      revision: result.revision,
      backupId: result.backupId,
      counts: pending.counts,
      restartRequired: true
    }
  }

  listBackups(configPath: string) {
    return this.transaction.listBackups(configPath)
  }

  rollback(configPath: string, backupId: string, expectedRevision: string) {
    return this.transaction.rollback({
      configPath,
      backupId,
      expectedRevision,
      verify: (content) => this.adapter.parse(content)
    })
  }

  private redact(entry: WorkBuddyEntry): RedactedTargetEntry {
    return {
      id: entry.id,
      name: entry.name,
      url: entry.url,
      apiKey: maskSecret(entry.apiKey),
      modelTypes: [
        ...(entry.supportsImages ? (['vision'] as const) : []),
        ...(entry.supportsReasoning ? (['reasoning'] as const) : []),
        ...(entry.supportsToolCall ? (['function_calling'] as const) : [])
      ]
    }
  }

  private countChanges(current: WorkBuddyEntry[], generated: WorkBuddyEntry[], managedIds: Set<string>): ApplyCounts {
    const currentById = new Map(current.map((entry) => [entry.id, entry]))
    const generatedIds = new Set(generated.map((entry) => entry.id))
    let added = 0
    let updated = 0
    let unchanged = 0
    for (const entry of generated) {
      const previous = currentById.get(entry.id)
      if (!previous) added++
      else if (JSON.stringify(previous) === JSON.stringify(entry)) unchanged++
      else updated++
    }
    const removed = [...managedIds].filter((id) => !generatedIds.has(id)).length
    return { added, updated, removed, unchanged }
  }
}
