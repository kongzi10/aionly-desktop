import { randomUUID } from 'node:crypto'
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
  ClaudeCodeApplyPreview,
  ClaudeCodeProfileLibrary,
  ClaudeCodeRouteProfile,
  CodexApplyPreview,
  CodexProfileLibrary,
  CodexRouteProfile,
  CreateAgentRouteRequest,
  CreateAgentRouteTemplateRequest,
  NamedAgentRouterCredential,
  PreviewClaudeCodeRouteRequest,
  PreviewCodexRouteRequest,
  PreviewWorkBuddyRoutesRequest,
  RedactedCredentialSummary,
  RedactedTargetEntry,
  SaveClaudeCodeProfileRequest,
  SaveCodexProfileRequest,
  TargetSnapshot,
  UpdateAgentRouteRequest,
  WorkBuddyEdition
} from '@shared/agentRouter'

import { AgentCredentialSnapshotStore } from './AgentCredentialSnapshotStore'
import { ClaudeCodeAdapter } from './ClaudeCodeAdapter'
import { ClaudeCodeProfileStore } from './ClaudeCodeProfileStore'
import { CodexAdapter } from './CodexAdapter'
import { CodexProfileStore } from './CodexProfileStore'
import { ConfigTransactionService } from './ConfigTransactionService'
import { GlobalRouteTemplateStore } from './GlobalRouteTemplateStore'
import { PreviewTokenStore } from './PreviewTokenStore'
import { RouteRecordStore } from './RouteRecordStore'
import { AgentRouterError, WorkBuddyAdapter, type WorkBuddyEntry } from './WorkBuddyAdapter'

interface PendingAgentRouterApply {
  accountId: string
  targetId: AgentRouterTargetId
  configPath: string
  serializedContent: string
  /** Optional companion file write (e.g. Codex auth.json alongside config.toml). */
  authPath?: string
  serializedAuthContent?: string
  expectedAuthRevision?: string
  counts: ApplyCounts
  allowMissing?: boolean
  verify: (content: string, authContent?: string) => void
  afterApply?: () => Promise<void>
}

const maskSecret = (value: string): string => `${value.slice(0, 4)}••••${value.slice(-4)}`

export class AgentRouterService {
  private readonly routes: RouteRecordStore
  private readonly transaction = new ConfigTransactionService()
  private readonly previews = new PreviewTokenStore<PendingAgentRouterApply>()
  private readonly adapter = new WorkBuddyAdapter()
  private readonly claudeCodeAdapter = new ClaudeCodeAdapter()
  private readonly claudeCodeProfiles: ClaudeCodeProfileStore
  private readonly codexAdapter = new CodexAdapter()
  private readonly codexProfiles: CodexProfileStore
  private readonly templates: GlobalRouteTemplateStore
  private readonly credentialSnapshots: AgentCredentialSnapshotStore

  constructor(options: { dataRoot: string }) {
    this.routes = new RouteRecordStore(options.dataRoot)
    this.templates = new GlobalRouteTemplateStore(options.dataRoot)
    this.credentialSnapshots = new AgentCredentialSnapshotStore(options.dataRoot)
    this.claudeCodeProfiles = new ClaudeCodeProfileStore(options.dataRoot)
    this.codexProfiles = new CodexProfileStore(options.dataRoot)
  }

  async listCodexProfiles(accountId: string): Promise<CodexProfileLibrary> {
    return (await this.codexProfiles.get(accountId)) ?? { version: 1, profiles: [] }
  }

  async saveCodexProfile(accountId: string, request: SaveCodexProfileRequest): Promise<CodexRouteProfile> {
    if (
      !accountId ||
      !request.name.trim() ||
      !request.model.trim() ||
      !request.apiKey ||
      (request.accessMode === 'tokenPlan') !== Boolean(request.tokenPlanId)
    ) {
      throw new AgentRouterError('INVALID_REQUEST', 'Invalid Codex route profile')
    }
    const library = await this.listCodexProfiles(accountId)
    const previous = request.profileId ? library.profiles.find(({ id }) => id === request.profileId) : undefined
    if (request.profileId && !previous)
      throw new AgentRouterError('INVALID_REQUEST', 'Codex route profile does not exist')
    const credentialId = await this.credentialSnapshots.create(accountId, 'codex', request.apiKey)
    const profile: CodexRouteProfile = {
      id: previous?.id ?? randomUUID(),
      targetId: 'codex',
      name: request.name.trim(),
      credentialId,
      credentialName: request.credentialName,
      accessMode: request.accessMode,
      tokenPlanId: request.tokenPlanId,
      model: request.model.trim(),
      reasoningEffort: 'medium',
      managedAt: new Date().toISOString()
    }
    try {
      const profiles = previous
        ? library.profiles.map((item) => (item.id === previous.id ? profile : item))
        : [...library.profiles, profile]
      await this.codexProfiles.save(accountId, { ...library, version: 1, profiles })
    } catch (error) {
      await this.credentialSnapshots.remove(accountId, 'codex', credentialId).catch(() => undefined)
      throw error
    }
    if (previous && previous.credentialId !== credentialId) {
      await this.credentialSnapshots.remove(accountId, 'codex', previous.credentialId).catch(() => undefined)
    }
    return profile
  }

  async deleteCodexProfile(
    _configPath: string,
    _authPath: string,
    accountId: string,
    profileId: string
  ): Promise<void> {
    const library = await this.listCodexProfiles(accountId)
    const profile = library.profiles.find(({ id }) => id === profileId)
    if (!profile) throw new AgentRouterError('INVALID_REQUEST', 'Codex route profile does not exist')
    const remainingProfiles = library.profiles.filter(({ id }) => id !== profileId)
    await this.codexProfiles.save(accountId, {
      ...library,
      profiles: remainingProfiles,
      ...(library.activeProfileId === profileId ? { activeProfileId: undefined } : {})
    })
    if (!remainingProfiles.some(({ credentialId }) => credentialId === profile.credentialId)) {
      await this.credentialSnapshots.remove(accountId, 'codex', profile.credentialId).catch(() => undefined)
    }
  }

  async inspectCodexTarget(configPath: string, authPath: string, _accountId?: string): Promise<TargetSnapshot> {
    const normalizedPath = resolve(configPath)
    const normalizedAuthPath = resolve(authPath)
    const [snapshot, authSnapshot] = await Promise.all([
      this.transaction.readSnapshot(normalizedPath, { allowMissing: true }),
      this.transaction.readSnapshot(normalizedAuthPath, { allowMissing: true })
    ])
    const exists = await stat(normalizedPath)
      .then(() => true)
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return false
        throw error
      })
    try {
      // Parse both documents so unreadable or malformed configs surface as unsupportedFormat.
      this.codexAdapter.parseConfigToml(snapshot.content)
      this.codexAdapter.parseAuthJson(authSnapshot.content)
      return {
        targetId: 'codex',
        configPath: normalizedPath,
        authPath: normalizedAuthPath,
        exists,
        readable: exists,
        writable: true,
        detectionState: exists ? 'detected' : 'notFound',
        formatVersion: 'codex-config-v1',
        revision: snapshot.revision,
        lastModifiedAt: exists ? (await stat(normalizedPath)).mtime.toISOString() : undefined,
        managedEntryCount: 0,
        externalEntryCount: 0,
        issues: []
      }
    } catch (error) {
      if (error instanceof AgentRouterError) {
        return {
          targetId: 'codex',
          configPath: normalizedPath,
          authPath: normalizedAuthPath,
          exists,
          readable: exists,
          writable: false,
          detectionState: 'needsAttention',
          revision: snapshot.revision,
          managedEntryCount: 0,
          externalEntryCount: 0,
          issues: ['unsupportedFormat']
        }
      }
      throw error
    }
  }

  async previewCodexRoute(
    configPath: string,
    authPath: string,
    request: PreviewCodexRouteRequest
  ): Promise<CodexApplyPreview> {
    const normalizedPath = resolve(configPath)
    const normalizedAuthPath = resolve(authPath)
    const [snapshot, authSnapshot] = await Promise.all([
      this.transaction.readSnapshot(normalizedPath, { allowMissing: true }),
      this.transaction.readSnapshot(normalizedAuthPath, { allowMissing: true })
    ])
    if (snapshot.revision !== request.expectedRevision)
      throw new AgentRouterError('REVISION_CONFLICT', 'Target changed')
    const library = await this.listCodexProfiles(request.accountId)
    const profile = library.profiles.find(({ id }) => id === request.profileId)
    if (!profile) throw new AgentRouterError('INVALID_REQUEST', 'Codex route profile does not exist')
    const currentToml = this.codexAdapter.parseConfigToml(snapshot.content)
    const currentAuth = this.codexAdapter.parseAuthJson(authSnapshot.content)
    const credential = await this.credentialSnapshots
      .resolve(request.accountId, 'codex', profile.credentialId)
      .catch(() => {
        throw new AgentRouterError('CREDENTIAL_UNAVAILABLE', 'Codex credential is unavailable')
      })
    const merged = this.codexAdapter.buildManagedPlan(currentToml, profile, credential, request.apiUrl)
    const entries = this.codexAdapter.createPreview(currentToml, currentAuth, profile, credential, request.apiUrl)
    const counts = this.countCodexChanges(entries)
    const pending: PendingAgentRouterApply = {
      accountId: request.accountId,
      targetId: 'codex',
      configPath: normalizedPath,
      serializedContent: this.codexAdapter.serializeConfigToml(merged.configToml),
      authPath: normalizedAuthPath,
      serializedAuthContent: this.codexAdapter.serializeAuthJson(merged.authJson),
      expectedAuthRevision: authSnapshot.revision,
      counts,
      allowMissing: true,
      verify: (content, authContent) =>
        this.codexAdapter.verify(content, authContent ?? '', merged.configToml, merged.authJson),
      afterApply: () =>
        this.codexProfiles.save(request.accountId, {
          ...library,
          activeProfileId: profile.id
        })
    }
    const issued = this.previews.create(request.accountId, request.expectedRevision, pending)
    return {
      previewToken: issued.token,
      targetId: 'codex',
      expectedRevision: request.expectedRevision,
      counts,
      entries,
      warnings: [],
      expiresAt: issued.expiresAt
    }
  }

  private countCodexChanges(entries: CodexApplyPreview['entries']): ApplyCounts {
    return entries.reduce<ApplyCounts>(
      (counts, entry) => {
        if (entry.previous === undefined) counts.added++
        else if (entry.next === undefined) counts.removed++
        else counts.updated++
        return counts
      },
      { added: 0, updated: 0, removed: 0, unchanged: 0 }
    )
  }

  async listClaudeCodeProfiles(accountId: string): Promise<ClaudeCodeProfileLibrary> {
    return (await this.claudeCodeProfiles.get(accountId)) ?? { version: 2, profiles: [] }
  }

  async saveClaudeCodeProfile(
    accountId: string,
    request: SaveClaudeCodeProfileRequest
  ): Promise<ClaudeCodeRouteProfile> {
    if (
      !accountId ||
      !request.name.trim() ||
      !request.apiKey ||
      (request.accessMode === 'tokenPlan') !== Boolean(request.tokenPlanId)
    ) {
      throw new AgentRouterError('INVALID_REQUEST', 'Invalid Claude Code route profile')
    }
    const library = await this.listClaudeCodeProfiles(accountId)
    const previous = request.profileId ? library.profiles.find(({ id }) => id === request.profileId) : undefined
    if (request.profileId && !previous)
      throw new AgentRouterError('INVALID_REQUEST', 'Claude Code route profile does not exist')
    const credentialId = await this.credentialSnapshots.create(accountId, 'claude-code', request.apiKey)
    const profile: ClaudeCodeRouteProfile = {
      id: previous?.id ?? randomUUID(),
      targetId: 'claude-code',
      name: request.name.trim(),
      credentialId,
      credentialName: request.credentialName,
      accessMode: request.accessMode,
      tokenPlanId: request.tokenPlanId,
      models: request.models,
      managedAt: new Date().toISOString()
    }
    try {
      const profiles = previous
        ? library.profiles.map((item) => (item.id === previous.id ? profile : item))
        : [...library.profiles, profile]
      await this.claudeCodeProfiles.save(accountId, { ...library, version: 2, profiles })
    } catch (error) {
      await this.credentialSnapshots.remove(accountId, 'claude-code', credentialId).catch(() => undefined)
      throw error
    }
    if (previous && previous.credentialId !== credentialId) {
      await this.credentialSnapshots.remove(accountId, 'claude-code', previous.credentialId).catch(() => undefined)
    }
    return profile
  }

  async deleteClaudeCodeProfile(_configPath: string, accountId: string, profileId: string): Promise<void> {
    const library = await this.listClaudeCodeProfiles(accountId)
    const profile = library.profiles.find(({ id }) => id === profileId)
    if (!profile) throw new AgentRouterError('INVALID_REQUEST', 'Claude Code route profile does not exist')
    const remainingProfiles = library.profiles.filter(({ id }) => id !== profileId)
    await this.claudeCodeProfiles.save(accountId, {
      ...library,
      profiles: remainingProfiles,
      ...(library.activeProfileId === profileId ? { activeProfileId: undefined } : {})
    })
    if (!remainingProfiles.some(({ credentialId }) => credentialId === profile.credentialId)) {
      await this.credentialSnapshots.remove(accountId, 'claude-code', profile.credentialId).catch(() => undefined)
    }
  }

  async inspectClaudeCodeTarget(configPath: string, _accountId?: string): Promise<TargetSnapshot> {
    const normalizedPath = resolve(configPath)
    const snapshot = await this.transaction.readSnapshot(normalizedPath, { allowMissing: true })
    const exists = await stat(normalizedPath)
      .then(() => true)
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return false
        throw error
      })
    try {
      // Parse the document so unreadable or malformed configs surface as unsupportedFormat.
      this.claudeCodeAdapter.parse(snapshot.content)
      return {
        targetId: 'claude-code',
        configPath: normalizedPath,
        exists,
        readable: exists,
        writable: true,
        detectionState: exists ? 'detected' : 'notFound',
        formatVersion: 'claude-code-settings-v1',
        revision: snapshot.revision,
        lastModifiedAt: exists ? (await stat(normalizedPath)).mtime.toISOString() : undefined,
        managedEntryCount: 0,
        externalEntryCount: 0,
        issues: []
      }
    } catch (error) {
      if (error instanceof AgentRouterError) {
        return {
          targetId: 'claude-code',
          configPath: normalizedPath,
          exists,
          readable: exists,
          writable: false,
          detectionState: 'needsAttention',
          revision: snapshot.revision,
          managedEntryCount: 0,
          externalEntryCount: 0,
          issues: ['unsupportedFormat']
        }
      }
      throw error
    }
  }

  async previewClaudeCodeRoute(
    configPath: string,
    request: PreviewClaudeCodeRouteRequest
  ): Promise<ClaudeCodeApplyPreview> {
    const normalizedPath = resolve(configPath)
    const snapshot = await this.transaction.readSnapshot(normalizedPath, { allowMissing: true })
    if (snapshot.revision !== request.expectedRevision)
      throw new AgentRouterError('REVISION_CONFLICT', 'Target changed')
    const library = await this.listClaudeCodeProfiles(request.accountId)
    const profile = library.profiles.find(({ id }) => id === request.profileId)
    if (!profile) throw new AgentRouterError('INVALID_REQUEST', 'Claude Code route profile does not exist')
    const current = this.claudeCodeAdapter.parse(snapshot.content)
    const credential = await this.credentialSnapshots
      .resolve(request.accountId, 'claude-code', profile.credentialId)
      .catch(() => {
        throw new AgentRouterError('CREDENTIAL_UNAVAILABLE', 'Claude Code credential is unavailable')
      })
    const merged = this.claudeCodeAdapter.merge(current, profile, credential, request.apiUrl)
    const entries = this.claudeCodeAdapter.createPreview(current, profile, credential, request.apiUrl)
    const counts = this.countClaudeCodeChanges(entries)
    const pending: PendingAgentRouterApply = {
      accountId: request.accountId,
      targetId: 'claude-code',
      configPath: normalizedPath,
      serializedContent: this.claudeCodeAdapter.serialize(merged),
      counts,
      allowMissing: true,
      verify: (content) => this.claudeCodeAdapter.verify(content, merged),
      afterApply: () =>
        this.claudeCodeProfiles.save(request.accountId, {
          ...library,
          activeProfileId: profile.id
        })
    }
    const issued = this.previews.create(request.accountId, request.expectedRevision, pending)
    return {
      previewToken: issued.token,
      targetId: 'claude-code',
      expectedRevision: request.expectedRevision,
      counts,
      entries,
      warnings: [],
      expiresAt: issued.expiresAt
    }
  }

  async listGlobalTemplates(
    accountId: string,
    targetId: AgentRouterTargetId = 'workbuddy',
    knownCredentials: NamedAgentRouterCredential[] = [],
    edition: WorkBuddyEdition = 'domestic'
  ) {
    const [templates, config] = await Promise.all([
      this.templates.list(accountId, edition),
      this.routes.getRouteConfig(accountId, targetId, edition)
    ])
    const routesWithKeys = await Promise.all(
      config.models.map(async (route) => ({
        modelId: route.modelId,
        key: await this.credentialSnapshots.resolve(accountId, targetId, route.credentialId).catch(() => undefined)
      }))
    )
    return Promise.all(
      templates.map(async (template) => {
        const key = await this.templates.resolveKey(accountId, template.templateId, edition).catch(() => undefined)
        return {
          ...template,
          credentialName:
            knownCredentials.find((credential) => credential.value === key)?.label || template.credentialName,
          joined: routesWithKeys.some((route) => route.modelId === template.modelId && route.key === key)
        }
      })
    )
  }

  createGlobalTemplate(
    accountId: string,
    request: CreateAgentRouteTemplateRequest,
    edition: WorkBuddyEdition = 'domestic'
  ) {
    return this.templates.create(accountId, request, edition)
  }

  deleteGlobalTemplate(accountId: string, templateId: string, edition: WorkBuddyEdition = 'domestic') {
    return this.templates.remove(accountId, templateId, edition)
  }

  async listAgentCredentialSummaries(
    accountId: string,
    targetId: AgentRouterTargetId,
    knownCredentials: NamedAgentRouterCredential[] = [],
    edition: WorkBuddyEdition = 'domestic'
  ): Promise<RedactedCredentialSummary[]> {
    const config = await this.routes.getRouteConfig(accountId, targetId, edition)
    return Promise.all(
      config.models.map(async (route) => {
        try {
          const value = await this.credentialSnapshots.resolve(accountId, targetId, route.credentialId)
          return {
            id: route.credentialId,
            accessMode: route.accessMode,
            label:
              knownCredentials.find((credential) => credential.value === value)?.label ||
              route.credentialName ||
              (route.accessMode === 'api' ? 'API' : 'TokenPlan'),
            maskedValue: maskSecret(value),
            available: true,
            tokenPlanId: route.tokenPlanId
          }
        } catch {
          return {
            id: route.credentialId,
            accessMode: route.accessMode,
            label: route.credentialName || (route.accessMode === 'api' ? 'API' : 'TokenPlan'),
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
    routeRef: AgentRouteRef,
    edition: WorkBuddyEdition = 'domestic'
  ): Promise<string> {
    const config = await this.routes.getRouteConfig(accountId, targetId, edition)
    const route = config.models.find(
      (model) => model.modelId === routeRef.modelId && model.credentialId === routeRef.credentialId
    )
    if (!route) throw new AgentRouterError('INVALID_REQUEST', 'Agent route does not exist')
    return this.credentialSnapshots.resolve(accountId, targetId, route.credentialId)
  }

  async copyTemplatesToAgent(
    accountId: string,
    targetId: AgentRouterTargetId,
    templateIds: string[],
    edition: WorkBuddyEdition = 'domestic'
  ): Promise<AgentRouteModel[]> {
    if (targetId !== 'workbuddy') throw new AgentRouterError('TARGET_NOT_FOUND', 'Target is not available')
    const templates = await this.templates.list(accountId, edition)
    const byId = new Map(templates.map((template) => [template.templateId, template]))
    const current = await this.routes.getRouteConfig(accountId, targetId, edition)
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
        const key = await this.templates.resolveKey(accountId, templateId, edition)
        if (existing.some((route) => route.modelId === template.modelId && route.key === key)) continue
        const credentialId = await this.credentialSnapshots.create(accountId, targetId, key)
        createdCredentialIds.push(credentialId)
        copied.push({
          modelId: template.modelId,
          credentialName: template.credentialName,
          accessMode: template.accessMode,
          credentialId,
          tokenPlanId: template.tokenPlanId,
          enabled: true,
          modelTypes: template.modelTypes,
          routedAt: new Date().toISOString()
        })
        existing.push({ modelId: template.modelId, key })
      }
      await this.routes.saveRouteModels(accountId, targetId, copied, edition)
      return copied
    } catch (error) {
      await Promise.all(createdCredentialIds.map((id) => this.credentialSnapshots.remove(accountId, targetId, id)))
      throw error
    }
  }

  async createAgentRoute(
    accountId: string,
    targetId: AgentRouterTargetId,
    request: CreateAgentRouteRequest,
    edition: WorkBuddyEdition = 'domestic'
  ): Promise<AgentRouteModel> {
    if (targetId !== 'workbuddy') throw new AgentRouterError('TARGET_NOT_FOUND', 'Target is not available')
    if (!request.modelId || !request.apiKey || (request.accessMode === 'tokenPlan') !== Boolean(request.tokenPlanId)) {
      throw new AgentRouterError('INVALID_REQUEST', 'Invalid Agent route')
    }
    const current = await this.routes.getRouteConfig(accountId, targetId, edition)
    for (const route of current.models) {
      const key = await this.credentialSnapshots.resolve(accountId, targetId, route.credentialId).catch(() => undefined)
      if (route.modelId === request.modelId && key === request.apiKey) {
        return route
      }
    }
    const credentialId = await this.credentialSnapshots.create(accountId, targetId, request.apiKey)
    const route: AgentRouteModel = {
      modelId: request.modelId,
      credentialName: request.credentialName,
      accessMode: request.accessMode,
      credentialId,
      tokenPlanId: request.tokenPlanId,
      enabled: true,
      modelTypes: request.modelTypes,
      routedAt: new Date().toISOString()
    }
    try {
      await this.routes.saveRouteModels(accountId, targetId, [route], edition)
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
    request: UpdateAgentRouteRequest,
    edition: WorkBuddyEdition = 'domestic'
  ): Promise<AgentRouteModel> {
    if (targetId !== 'workbuddy') throw new AgentRouterError('TARGET_NOT_FOUND', 'Target is not available')
    const current = await this.routes.getRouteConfig(accountId, targetId, edition)
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
      credentialName: request.apiKey ? request.credentialName : route.credentialName,
      accessMode: request.accessMode,
      credentialId,
      tokenPlanId: request.accessMode === 'tokenPlan' ? request.tokenPlanId : undefined,
      modelTypes: request.modelTypes
    }
    try {
      await this.routes.replaceRouteModel(accountId, targetId, routeRef, updated, edition)
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

  async inspectTarget(
    targetId: 'workbuddy',
    configPath: string,
    accountId?: string,
    edition: WorkBuddyEdition = 'domestic'
  ): Promise<TargetSnapshot> {
    if (targetId !== 'workbuddy') throw new AgentRouterError('TARGET_NOT_FOUND', 'Target is not available')
    const normalizedPath = resolve(configPath)
    try {
      const [snapshot, details] = await Promise.all([
        this.transaction.readSnapshot(normalizedPath),
        stat(normalizedPath)
      ])
      const parsed = this.adapter.parse(snapshot.content)
      const config = accountId ? await this.routes.getRouteConfig(accountId, targetId, edition) : { models: [] }
      const managedIds = accountId
        ? await this.findManagedEntryIds(
            accountId,
            parsed.entries.map(({ value }) => value),
            config.models
          )
        : new Set<string>()
      const managedEntryCount = managedIds.size
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
      const content = await readFile(resolve(filePath), 'utf8')
      this.adapter.parse(content)
      return 'workbuddy'
    } catch {
      return null
    }
  }

  async getRouteConfig(
    accountId: string,
    targetId: 'workbuddy',
    configPath?: string,
    edition: WorkBuddyEdition = 'domestic'
  ): Promise<AgentRouteConfig> {
    const config = await this.routes.getRouteConfig(accountId, targetId, edition)
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

  saveRouteModels(
    accountId: string,
    targetId: 'workbuddy',
    models: AgentRouteModel[],
    edition: WorkBuddyEdition = 'domestic'
  ): Promise<void> {
    return this.routes.saveRouteModels(accountId, targetId, models, edition)
  }

  removeRouteModels(
    accountId: string,
    targetId: 'workbuddy',
    routes: AgentRouteRef[],
    edition: WorkBuddyEdition = 'domestic'
  ): Promise<void> {
    return this.routes.removeRouteModels(accountId, targetId, routes, edition)
  }

  async listAppliedWorkBuddyRoutes(configPath: string): Promise<RedactedTargetEntry[]> {
    const snapshot = await this.transaction.readSnapshot(resolve(configPath))
    return this.adapter
      .parse(snapshot.content)
      .entries.map(({ value }) => value)
      .map((entry) => this.redact(entry))
  }

  async previewWorkBuddyRoutes(
    configPath: string,
    request: PreviewWorkBuddyRoutesRequest,
    edition: WorkBuddyEdition = 'domestic'
  ): Promise<ApplyPreview> {
    if (
      !request.accountId ||
      request.resolvedCredentials.length > 100 ||
      (request.incrementalModelIds?.length ?? 0) > 100
    ) {
      throw new AgentRouterError('INVALID_REQUEST', 'Invalid WorkBuddy preview request')
    }
    const normalizedPath = resolve(configPath)
    const snapshot = await this.transaction.readSnapshot(normalizedPath)
    if (snapshot.revision !== request.expectedRevision)
      throw new AgentRouterError('REVISION_CONFLICT', 'Target changed')
    const config = await this.routes.getRouteConfig(request.accountId, 'workbuddy', edition)
    const current = this.adapter.parse(snapshot.content).entries.map(({ value }) => value)
    const credentials = new Map(request.resolvedCredentials.map((item) => [item.credentialId, item.value]))
    const enabledRoutes = new Set(request.enabledRoutes.map((route) => `${route.modelId}\u0000${route.credentialId}`))
    const incrementalModelIds = request.incrementalModelIds ? new Set(request.incrementalModelIds) : undefined
    const generated = await Promise.all(
      config.models
        .filter(
          (model) =>
            enabledRoutes.has(`${model.modelId}\u0000${model.credentialId}`) &&
            (!incrementalModelIds || incrementalModelIds.has(model.modelId))
        )
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
    const managedIds = await this.findManagedEntryIds(request.accountId, current, config.models, credentials)
    const appliedManagedIds = incrementalModelIds
      ? new Set([...managedIds].filter((modelId) => incrementalModelIds.has(modelId)))
      : managedIds
    const iconRefreshKeys = await this.findManagedEntryKeys(request.accountId, current, config.models, credentials)
    const entries = this.adapter.merge(current, generated, appliedManagedIds, iconRefreshKeys)
    const counts = this.countChanges(current, generated, appliedManagedIds)
    const pending: PendingAgentRouterApply = {
      accountId: request.accountId,
      targetId: 'workbuddy',
      configPath: normalizedPath,
      serializedContent: this.adapter.serialize(entries),
      counts,
      verify: (content) => this.adapter.parse(content)
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
      authPath: pending.authPath,
      serializedAuthContent: pending.serializedAuthContent,
      expectedAuthRevision: pending.expectedAuthRevision,
      allowMissing: pending.allowMissing,
      verify: pending.verify
    })
    try {
      await pending.afterApply?.()
    } catch (error) {
      await this.transaction.rollback({
        configPath: pending.configPath,
        backupId: result.backupId,
        expectedRevision: result.revision,
        expectedAuthRevision: result.authRevision,
        verify: () => undefined
      })
      throw error
    }
    return {
      targetId: pending.targetId,
      revision: result.revision,
      backupId: result.backupId,
      counts: pending.counts,
      restartRequired: true
    }
  }

  private countClaudeCodeChanges(entries: ClaudeCodeApplyPreview['entries']): ApplyCounts {
    return entries.reduce<ApplyCounts>(
      (counts, entry) => {
        if (entry.previous === undefined) counts.added++
        else if (entry.next === undefined) counts.removed++
        else counts.updated++
        return counts
      },
      { added: 0, updated: 0, removed: 0, unchanged: 0 }
    )
  }

  listBackups(configPath: string) {
    return this.transaction.listBackups(configPath)
  }

  rollback(targetId: AgentRouterTargetId, configPath: string, backupId: string, expectedRevision: string) {
    return this.transaction.rollback({
      configPath,
      backupId,
      expectedRevision,
      verify: (content, authContent) => {
        if (targetId === 'codex') {
          this.codexAdapter.parseConfigToml(content)
          this.codexAdapter.parseAuthJson(authContent ?? '')
          return
        }
        if (targetId === 'claude-code') {
          this.claudeCodeAdapter.parse(content)
          return
        }
        this.adapter.parse(content)
      }
    })
  }

  private async findManagedEntryIds(
    accountId: string,
    entries: WorkBuddyEntry[],
    models: AgentRouteModel[],
    credentials = new Map<string, string>()
  ): Promise<Set<string>> {
    const managedKeys = await this.findManagedEntryKeys(accountId, entries, models, credentials)
    return new Set(
      entries.filter((entry) => managedKeys.has(JSON.stringify([entry.id, entry.apiKey]))).map((entry) => entry.id)
    )
  }

  private async findManagedEntryKeys(
    accountId: string,
    entries: WorkBuddyEntry[],
    models: AgentRouteModel[],
    credentials = new Map<string, string>()
  ): Promise<Set<string>> {
    const managedKeys = new Set(
      await Promise.all(
        models.map(async (route) => {
          const key =
            credentials.get(route.credentialId) ??
            (await this.credentialSnapshots.resolve(accountId, 'workbuddy', route.credentialId).catch(() => undefined))
          return key ? JSON.stringify([route.modelId, key]) : undefined
        })
      )
    )
    return new Set(
      entries
        .filter(
          (entry) => this.adapter.isAionlyEntry(entry) && managedKeys.has(JSON.stringify([entry.id, entry.apiKey]))
        )
        .map((entry) => JSON.stringify([entry.id, entry.apiKey]))
    )
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
