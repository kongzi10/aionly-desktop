import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { AgentRouteModel, PreviewWorkBuddyRoutesRequest } from '@shared/agentRouter'
import { LOGO_URL } from '@shared/config/constant'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { AgentRouterService } from '../AgentRouterService'
import { RouteRecordStore } from '../RouteRecordStore'

const model: AgentRouteModel = {
  modelId: 'gpt-5',
  accessMode: 'api',
  credentialId: 'credential-1',
  enabled: true,
  modelTypes: ['function_calling', 'reasoning'],
  routedAt: '2026-08-27T00:00:00.000Z'
}

describe('AgentRouterService WorkBuddy routes', () => {
  let root: string
  let configPath: string
  let service: AgentRouterService

  beforeEach(async () => {
    root = join(process.cwd(), '.tmp', `agent-router-service-${crypto.randomUUID()}`)
    configPath = join(root, 'models.json')
    await mkdir(root, { recursive: true })
    await writeFile(configPath, '[]\n', 'utf8')
    service = new AgentRouterService({ dataRoot: join(root, 'data') })
  })

  afterEach(async () => rm(root, { recursive: true, force: true }))

  it('lists every WorkBuddy model for overwrite detection', async () => {
    await writeFile(
      configPath,
      JSON.stringify([
        { id: 'local-model', name: 'Local', vendor: 'OpenAI', url: 'https://local.example/v1', apiKey: 'local-key' },
        { id: 'aionly-model', name: 'AiOnly', vendor: 'Custom', url: 'https://api.aionly.com/v1', apiKey: 'aionly-key' }
      ])
    )

    const entries = await service.listAppliedWorkBuddyRoutes(configPath)

    expect(entries.map((entry) => entry.id)).toEqual(['local-model', 'aionly-model'])
    expect(JSON.stringify(entries)).not.toContain('local-key')
    expect(JSON.stringify(entries)).not.toContain('aionly-key')
  })

  it('applies the transient enabled route set without persisting enabled state', async () => {
    await service.saveRouteModels('account-a', 'workbuddy', [{ ...model, enabled: false }])
    const snapshot = await service.inspectTarget('workbuddy', configPath)
    const preview = await service.previewWorkBuddyRoutes(configPath, {
      accountId: 'account-a',
      expectedRevision: snapshot.revision!,
      apiUrl: 'https://api.aionly.com/v1/chat/completions',
      enabledRoutes: [{ modelId: model.modelId, credentialId: model.credentialId }],
      resolvedCredentials: [{ credentialId: 'credential-1', value: 'sk-sentinel-secret' }]
    })

    expect(preview.counts).toEqual({ added: 1, updated: 0, removed: 0, unchanged: 0 })
    expect(JSON.stringify(preview)).not.toContain('sk-sentinel-secret')
    await service.apply({
      accountId: 'account-a',
      previewToken: preview.previewToken,
      expectedRevision: preview.expectedRevision
    })
    expect(JSON.stringify(await service.getRouteConfig('account-a', 'workbuddy'))).not.toContain('"enabled":true')
    const routeFile = new RouteRecordStore(join(root, 'data')).getFilePath('account-a', 'workbuddy')
    expect(await readFile(routeFile, 'utf8')).not.toContain('enabled')
    expect(await readFile(configPath, 'utf8')).toContain('sk-sentinel-secret')
  })

  it('removes disabled Aionly models while preserving non-Aionly entries unchanged', async () => {
    const external = {
      id: 'manual',
      name: 'Manual',
      vendor: 'Custom',
      url: 'https://internal.example/v1',
      apiKey: 'manual-secret',
      supportsToolCall: false,
      supportsImages: false,
      supportsReasoning: false,
      useCustomProtocol: false,
      extra: { preserve: true }
    }
    const managed = {
      id: 'old',
      name: 'Old',
      vendor: 'Custom',
      url: 'https://api.aiionly.com/v1',
      apiKey: 'old-secret',
      supportsToolCall: true,
      supportsImages: false,
      supportsReasoning: false,
      useCustomProtocol: false
    }
    await service.createAgentRoute('account-a', 'workbuddy', {
      modelId: 'old',
      accessMode: 'api',
      apiKey: 'old-secret',
      modelTypes: []
    })
    await writeFile(configPath, `${JSON.stringify([external, managed], null, 2)}\n`, 'utf8')
    await service.saveRouteModels('account-a', 'workbuddy', [{ ...model, enabled: false }])
    const snapshot = await service.inspectTarget('workbuddy', configPath)
    const preview = await service.previewWorkBuddyRoutes(configPath, {
      accountId: 'account-a',
      expectedRevision: snapshot.revision!,
      apiUrl: 'https://api.aionly.com/v1/chat/completions',
      enabledRoutes: [],
      resolvedCredentials: []
    })
    expect(preview.counts.removed).toBe(1)
    await service.apply({
      accountId: 'account-a',
      previewToken: preview.previewToken,
      expectedRevision: preview.expectedRevision
    })
    expect(JSON.parse(await readFile(configPath, 'utf8'))).toEqual([external])
  })

  it('preserves unregistered AiOnly entries when applying managed routes', async () => {
    const external = {
      id: 'manual-aionly',
      name: 'Manual',
      vendor: 'Custom',
      url: 'https://api.aionly.com/v1',
      apiKey: 'sk-manual',
      supportsToolCall: false,
      supportsImages: false,
      supportsReasoning: false,
      useCustomProtocol: false
    }
    await writeFile(configPath, JSON.stringify([external]))
    const snapshot = await service.inspectTarget('workbuddy', configPath, 'account-a')
    const preview = await service.previewWorkBuddyRoutes(configPath, {
      accountId: 'account-a',
      expectedRevision: snapshot.revision!,
      apiUrl: 'https://api.aionly.com/v1',
      enabledRoutes: [],
      resolvedCredentials: []
    })
    expect(preview.counts.removed).toBe(0)
    await service.apply({
      accountId: 'account-a',
      previewToken: preview.previewToken,
      expectedRevision: preview.expectedRevision
    })
    expect(JSON.parse(await readFile(configPath, 'utf8'))).toEqual([external])
  })

  it('resolves names of legacy credential snapshots by exact key', async () => {
    await service.createAgentRoute('account-a', 'workbuddy', {
      modelId: 'gpt-5',
      accessMode: 'api',
      apiKey: 'sk-legacy',
      modelTypes: []
    })
    expect(
      await service.listAgentCredentialSummaries('account-a', 'workbuddy', [
        { value: 'sk-unrelated', label: 'Other' },
        { value: 'sk-legacy', label: 'Legacy key name' }
      ])
    ).toEqual([expect.objectContaining({ label: 'Legacy key name', maskedValue: 'sk-l••••gacy' })])
  })

  it('replaces a Custom route with the same model id even when its URL differs', async () => {
    await writeFile(
      configPath,
      `${JSON.stringify([{ id: 'gpt-5', name: 'Manual', vendor: 'Custom', url: 'https://other.example/v1', apiKey: 'manual', supportsToolCall: false, supportsImages: false, supportsReasoning: false, useCustomProtocol: false }], null, 2)}\n`,
      'utf8'
    )
    await service.saveRouteModels('account-a', 'workbuddy', [model])
    const snapshot = await service.inspectTarget('workbuddy', configPath)
    const preview = await service.previewWorkBuddyRoutes(configPath, {
      accountId: 'account-a',
      expectedRevision: snapshot.revision!,
      apiUrl: 'https://api.aionly.com/v1',
      enabledRoutes: [{ modelId: model.modelId, credentialId: model.credentialId }],
      resolvedCredentials: [{ credentialId: 'credential-1', value: 'secret' }]
    })
    await service.apply({
      accountId: 'account-a',
      previewToken: preview.previewToken,
      expectedRevision: preview.expectedRevision
    })

    const entries = JSON.parse(await readFile(configPath, 'utf8'))
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ id: 'gpt-5', name: 'AiOnly', url: 'https://api.aionly.com/v1' })
  })

  it('incrementally prepends new routes, replaces same-id Custom entries, and only refreshes matched icons', async () => {
    const existingRoute = await service.createAgentRoute('account-a', 'workbuddy', {
      modelId: 'existing-model',
      accessMode: 'api',
      apiKey: 'existing-secret',
      modelTypes: ['reasoning']
    })
    const newRoute = await service.createAgentRoute('account-a', 'workbuddy', {
      modelId: 'new-model',
      accessMode: 'api',
      apiKey: 'new-secret',
      modelTypes: ['function_calling']
    })
    const existing = {
      id: 'existing-model',
      name: 'Keep this name',
      vendor: 'Custom',
      url: 'https://api.aionly.com/original',
      apiKey: 'existing-secret',
      supportsToolCall: false,
      supportsImages: true,
      supportsReasoning: false,
      useCustomProtocol: true,
      iconUrl: 'https://old.example/icon.png',
      reasoning: { defaultEffort: 'xhigh' },
      maxInputTokens: 123456
    }
    const unrelated = {
      id: 'unrelated-model',
      name: 'Untouched',
      vendor: 'OpenAI',
      url: 'https://unrelated.example/v1',
      iconUrl: 'https://unrelated.example/icon.png',
      extra: { preserve: true }
    }
    const replaced = {
      id: 'new-model',
      name: 'Remove me',
      vendor: 'OpenAI',
      url: 'https://old.example/v1',
      apiKey: 'old-secret',
      supportsToolCall: false,
      supportsImages: false,
      supportsReasoning: false,
      useCustomProtocol: true,
      extra: { remove: true }
    }
    await writeFile(configPath, `${JSON.stringify([existing, unrelated, replaced], null, 2)}\n`, 'utf8')
    const snapshot = await service.inspectTarget('workbuddy', configPath)
    const request = {
      accountId: 'account-a',
      expectedRevision: snapshot.revision!,
      apiUrl: 'https://api.aionly.com/v1',
      enabledRoutes: [
        { modelId: existingRoute.modelId, credentialId: existingRoute.credentialId },
        { modelId: newRoute.modelId, credentialId: newRoute.credentialId }
      ],
      resolvedCredentials: [
        { credentialId: existingRoute.credentialId, value: 'existing-secret' },
        { credentialId: newRoute.credentialId, value: 'new-secret' }
      ],
      incrementalModelIds: ['new-model']
    } as PreviewWorkBuddyRoutesRequest
    const preview = await service.previewWorkBuddyRoutes(configPath, request)
    await service.apply({
      accountId: 'account-a',
      previewToken: preview.previewToken,
      expectedRevision: preview.expectedRevision
    })

    const entries = JSON.parse(await readFile(configPath, 'utf8'))
    expect(entries).toHaveLength(3)
    expect(entries[0]).toMatchObject({ id: 'new-model', apiKey: 'new-secret', iconUrl: LOGO_URL })
    expect(entries[1]).toEqual({ ...existing, iconUrl: LOGO_URL })
    expect(entries[2]).toEqual(unrelated)
  })

  it('binds a preview token to its account and revision', async () => {
    await service.saveRouteModels('account-a', 'workbuddy', [model])
    const snapshot = await service.inspectTarget('workbuddy', configPath)
    const preview = await service.previewWorkBuddyRoutes(configPath, {
      accountId: 'account-a',
      expectedRevision: snapshot.revision!,
      apiUrl: 'https://api.aionly.com/v1',
      enabledRoutes: [{ modelId: model.modelId, credentialId: model.credentialId }],
      resolvedCredentials: [{ credentialId: 'credential-1', value: 'secret' }]
    })
    await expect(
      service.apply({
        accountId: 'account-b',
        previewToken: preview.previewToken,
        expectedRevision: preview.expectedRevision
      })
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  })

  it('copies a global template into an independent Agent route credential', async () => {
    const template = await service.createGlobalTemplate('account-a', {
      modelId: 'claude-sonnet',
      accessMode: 'api',
      apiKey: 'sk-copied-secret',
      modelTypes: ['function_calling']
    })

    await service.copyTemplatesToAgent('account-a', 'workbuddy', [template.templateId])
    await service.deleteGlobalTemplate('account-a', template.templateId)

    const route = (await service.getRouteConfig('account-a', 'workbuddy')).models[0]
    expect(route).not.toHaveProperty('templateId')
    expect(JSON.stringify(route)).not.toContain('sk-copied-secret')
    expect(await service.listAgentCredentialSummaries('account-a', 'workbuddy')).toEqual([
      expect.objectContaining({ id: route.credentialId, maskedValue: 'sk-c••••cret', available: true })
    ])
    const snapshot = await service.inspectTarget('workbuddy', configPath)
    const preview = await service.previewWorkBuddyRoutes(configPath, {
      accountId: 'account-a',
      expectedRevision: snapshot.revision!,
      apiUrl: 'https://api.aionly.com/v1',
      enabledRoutes: [],
      resolvedCredentials: []
    })
    expect(preview.counts.added).toBe(0)
  })

  it('skips an exact duplicate and fixes direct and copied names to AiOnly', async () => {
    const request = {
      modelId: 'gpt-5',
      accessMode: 'api' as const,
      apiKey: 'sk-direct',
      credentialName: 'Production',
      modelTypes: ['reasoning'] as const
    }
    const created = await service.createAgentRoute('account-a', 'workbuddy', request)
    const duplicate = await service.createAgentRoute('account-a', 'workbuddy', request)
    expect(duplicate.credentialId).toBe(created.credentialId)
    expect(created).toMatchObject({ enabled: true })
    expect(created).not.toHaveProperty('displayName')
    expect((await service.getRouteConfig('account-a', 'workbuddy')).models).toHaveLength(1)
    expect(await service.listAgentCredentialSummaries('account-a', 'workbuddy')).toEqual([
      expect.objectContaining({ label: 'Production' })
    ])
    const template = await service.createGlobalTemplate('account-a', { ...request, modelId: 'claude-sonnet' })
    await service.copyTemplatesToAgent('account-a', 'workbuddy', [template.templateId, template.templateId])
    await service.deleteGlobalTemplate('account-a', template.templateId)
    const routes = (await service.getRouteConfig('account-a', 'workbuddy')).models
    expect(routes).toHaveLength(2)
    expect(routes.every((route) => !Object.hasOwn(route, 'displayName'))).toBe(true)
    expect(await service.listAgentCredentialSummaries('account-a', 'workbuddy')).toEqual([
      expect.objectContaining({ label: 'Production' }),
      expect.objectContaining({ label: 'Production' })
    ])
  })

  it('counts only exact registered model and key matches as managed', async () => {
    await service.createAgentRoute('account-a', 'workbuddy', {
      modelId: 'gpt-5',
      accessMode: 'api',
      apiKey: 'sk-owned',
      modelTypes: []
    })
    const entry = {
      id: 'gpt-5',
      name: 'AiOnly',
      vendor: 'Custom',
      url: 'https://api.aionly.com/v1',
      apiKey: 'sk-owned',
      supportsToolCall: false,
      supportsImages: false,
      supportsReasoning: false,
      useCustomProtocol: false
    }
    await writeFile(configPath, JSON.stringify([entry, { ...entry, id: 'unregistered' }]))
    expect(await service.inspectTarget('workbuddy', configPath, 'account-a')).toMatchObject({
      managedEntryCount: 1,
      externalEntryCount: 1
    })
    expect(await service.inspectTarget('workbuddy', configPath, 'account-b')).toMatchObject({
      managedEntryCount: 0,
      externalEntryCount: 2
    })
    await writeFile(configPath, JSON.stringify([{ ...entry, apiKey: 'sk-other' }]))
    expect(await service.inspectTarget('workbuddy', configPath, 'account-a')).toMatchObject({
      managedEntryCount: 0,
      externalEntryCount: 1
    })
  })

  it('reveals the plaintext credential only for an existing Agent route', async () => {
    const route = await service.createAgentRoute('account-a', 'workbuddy', {
      modelId: 'gpt-5',
      accessMode: 'api',
      apiKey: 'sk-plaintext-secret',
      modelTypes: ['function_calling']
    })

    await expect(
      service.resolveAgentRouteCredential('account-a', 'workbuddy', {
        modelId: route.modelId,
        credentialId: route.credentialId
      })
    ).resolves.toBe('sk-plaintext-secret')
    await expect(
      service.resolveAgentRouteCredential('account-a', 'workbuddy', {
        modelId: 'missing-model',
        credentialId: route.credentialId
      })
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  })

  it('derives state from WorkBuddy and only marks an exact model-and-key match as joined', async () => {
    const first = await service.createGlobalTemplate('account-a', {
      modelId: 'gpt-5',
      accessMode: 'api',
      apiKey: 'sk-key-a',
      modelTypes: ['function_calling']
    })
    const second = await service.createGlobalTemplate('account-a', {
      modelId: 'gpt-5',
      accessMode: 'api',
      apiKey: 'sk-key-b',
      modelTypes: ['function_calling']
    })

    await service.copyTemplatesToAgent('account-a', 'workbuddy', [first.templateId, second.templateId])
    await service.createAgentRoute('account-a', 'workbuddy', {
      modelId: 'claude-sonnet',
      accessMode: 'api',
      apiKey: 'sk-direct',
      modelTypes: ['function_calling']
    })

    const routes = (await service.getRouteConfig('account-a', 'workbuddy')).models
    expect(routes).toHaveLength(3)
    expect(routes.every((route) => route.enabled === false)).toBe(true)
    expect(routes.filter((route) => route.modelId === 'gpt-5')).toHaveLength(2)
    expect(await service.listGlobalTemplates('account-a', 'workbuddy')).toEqual([
      expect.objectContaining({ templateId: first.templateId, joined: true }),
      expect.objectContaining({ templateId: second.templateId, joined: true })
    ])
  })

  it('retains both same-model routes when applying a different key', async () => {
    const first = await service.createAgentRoute('account-a', 'workbuddy', {
      modelId: 'gpt-5',
      accessMode: 'api',
      apiKey: 'sk-first',
      modelTypes: []
    })
    const second = await service.createAgentRoute('account-a', 'workbuddy', {
      modelId: 'gpt-5',
      accessMode: 'api',
      apiKey: 'sk-second',
      modelTypes: []
    })
    const snapshot = await service.inspectTarget('workbuddy', configPath, 'account-a')
    const preview = await service.previewWorkBuddyRoutes(configPath, {
      accountId: 'account-a',
      expectedRevision: snapshot.revision!,
      enabledRoutes: [second],
      resolvedCredentials: [],
      apiUrl: 'https://api.aionly.com/v1'
    })
    await service.apply({
      accountId: 'account-a',
      previewToken: preview.previewToken,
      expectedRevision: preview.expectedRevision
    })
    expect((await service.getRouteConfig('account-a', 'workbuddy', configPath)).models).toEqual([
      expect.objectContaining({ credentialId: first.credentialId, enabled: false }),
      expect.objectContaining({ credentialId: second.credentialId, enabled: true })
    ])
  })

  it('synchronizes enabled state from exact model id and key matches in WorkBuddy', async () => {
    const first = await service.createAgentRoute('account-a', 'workbuddy', {
      modelId: 'gpt-5',
      accessMode: 'api',
      apiKey: 'sk-key-a',
      modelTypes: ['function_calling']
    })
    const second = await service.createAgentRoute('account-a', 'workbuddy', {
      modelId: 'gpt-5',
      accessMode: 'api',
      apiKey: 'sk-key-b',
      modelTypes: ['function_calling']
    })
    await writeFile(
      configPath,
      `${JSON.stringify([{ id: 'gpt-5', name: 'GPT-5 B', vendor: 'Custom', url: 'https://api.aionly.com/v1', apiKey: 'sk-key-b', supportsToolCall: true, supportsImages: false, supportsReasoning: false, useCustomProtocol: false }], null, 2)}\n`,
      'utf8'
    )

    const synced = await service.getRouteConfig('account-a', 'workbuddy', configPath)
    expect(synced.models.find((route) => route.credentialId === first.credentialId)?.enabled).toBe(false)
    expect(synced.models.find((route) => route.credentialId === second.credentialId)?.enabled).toBe(true)

    await writeFile(configPath, '[]\n', 'utf8')
    const afterDelete = await service.getRouteConfig('account-a', 'workbuddy', configPath)
    expect(afterDelete.models.every((route) => route.enabled === false)).toBe(true)
  })

  it('updates a route credential and mutable metadata without changing its model id', async () => {
    const route = await service.createAgentRoute('account-a', 'workbuddy', {
      modelId: 'gpt-5',
      accessMode: 'api',
      apiKey: 'sk-old',
      modelTypes: ['function_calling']
    })

    const updated = await service.updateAgentRoute(
      'account-a',
      'workbuddy',
      { modelId: route.modelId, credentialId: route.credentialId },
      {
        accessMode: 'tokenPlan',
        tokenPlanId: 'plan-pro',
        apiKey: 'tk-new',
        modelTypes: ['vision', 'reasoning', 'function_calling']
      }
    )

    expect(updated).toMatchObject({
      modelId: 'gpt-5',
      accessMode: 'tokenPlan',
      tokenPlanId: 'plan-pro',
      modelTypes: ['vision', 'reasoning', 'function_calling']
    })
    expect(updated.credentialId).not.toBe(route.credentialId)
    expect((await service.getRouteConfig('account-a', 'workbuddy')).models).toEqual([
      expect.objectContaining({ modelId: 'gpt-5', credentialId: updated.credentialId })
    ])
  })
})

describe('AgentRouterService Claude Code routes', () => {
  let root: string
  let configPath: string
  let service: AgentRouterService

  beforeEach(async () => {
    root = join(process.cwd(), '.tmp', `claude-code-router-${crypto.randomUUID()}`)
    configPath = join(root, '.claude', 'settings.json')
    await mkdir(join(root, '.claude'), { recursive: true })
    service = new AgentRouterService({ dataRoot: join(root, 'data') })
  })

  afterEach(async () => rm(root, { recursive: true, force: true }))

  it('creates and applies a three-model profile to a missing settings file', async () => {
    const saved = await service.saveClaudeCodeProfile('account-a', {
      name: 'API profile',
      accessMode: 'api',
      apiKey: 'sk-claude-secret',
      models: { opus: 'opus-route', sonnet: 'sonnet-route', haiku: 'haiku-route' }
    })
    const snapshot = await service.inspectClaudeCodeTarget(configPath, 'account-a')
    expect(snapshot).toMatchObject({ targetId: 'claude-code', exists: false, detectionState: 'notFound' })

    const preview = await service.previewClaudeCodeRoute(configPath, {
      accountId: 'account-a',
      profileId: saved.id,
      expectedRevision: snapshot.revision!,
      apiUrl: 'https://api.aionly.com'
    })
    expect(JSON.stringify(preview)).not.toContain('sk-claude-secret')
    await service.apply({
      accountId: 'account-a',
      previewToken: preview.previewToken,
      expectedRevision: preview.expectedRevision
    })

    expect(JSON.parse(await readFile(configPath, 'utf8'))).toMatchObject({
      env: {
        ANTHROPIC_BASE_URL: 'https://api.aionly.com',
        ANTHROPIC_AUTH_TOKEN: 'sk-claude-secret',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'opus-route',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'sonnet-route',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'haiku-route',
        CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1'
      }
    })
    expect(await service.inspectClaudeCodeTarget(configPath, 'account-a')).toMatchObject({
      managedEntryCount: 0,
      issues: []
    })
  })

  it('overwrites existing routing fields without a takeover prompt', async () => {
    await writeFile(configPath, '{"env":{"ANTHROPIC_BASE_URL":"https://elsewhere.example","DEBUG":"1"}}\n', 'utf8')
    const saved = await service.saveClaudeCodeProfile('account-a', {
      name: 'API profile',
      accessMode: 'api',
      apiKey: 'secret',
      models: { opus: 'opus-route', sonnet: 'sonnet-route', haiku: 'haiku-route' }
    })
    const snapshot = await service.inspectClaudeCodeTarget(configPath, 'account-a')
    expect(snapshot.issues).toEqual([])

    const preview = await service.previewClaudeCodeRoute(configPath, {
      accountId: 'account-a',
      profileId: saved.id,
      expectedRevision: snapshot.revision!,
      apiUrl: 'https://api.aionly.com'
    })
    await service.apply({
      accountId: 'account-a',
      previewToken: preview.previewToken,
      expectedRevision: preview.expectedRevision
    })

    expect(JSON.parse(await readFile(configPath, 'utf8'))).toMatchObject({
      env: { ANTHROPIC_BASE_URL: 'https://api.aionly.com', DEBUG: '1' }
    })
  })

  it('deleting the active profile leaves the Claude Code configuration untouched', async () => {
    await writeFile(configPath, '{"env":{"DEBUG":"1"}}\n', 'utf8')
    const saved = await service.saveClaudeCodeProfile('account-a', {
      name: 'API profile',
      accessMode: 'api',
      apiKey: 'secret',
      models: { opus: 'opus-route', sonnet: 'sonnet-route', haiku: 'haiku-route' }
    })
    const initial = await service.inspectClaudeCodeTarget(configPath, 'account-a')
    const preview = await service.previewClaudeCodeRoute(configPath, {
      accountId: 'account-a',
      profileId: saved.id,
      expectedRevision: initial.revision!,
      apiUrl: 'https://api.aionly.com'
    })
    await service.apply({
      accountId: 'account-a',
      previewToken: preview.previewToken,
      expectedRevision: preview.expectedRevision
    })

    const contentBeforeRemoval = await readFile(configPath, 'utf8')
    await service.deleteClaudeCodeProfile(configPath, 'account-a', saved.id)

    expect(await readFile(configPath, 'utf8')).toBe(contentBeforeRemoval)
    await expect(service.listClaudeCodeProfiles('account-a')).resolves.toEqual({ version: 2, profiles: [] })
  })

  it('retains a Claude Code credential snapshot while another profile references it', async () => {
    const first = await service.saveClaudeCodeProfile('account-a', {
      name: 'First',
      accessMode: 'api',
      apiKey: 'shared-secret',
      models: { sonnet: 's1' }
    })
    const second = await service.saveClaudeCodeProfile('account-a', {
      name: 'Second',
      accessMode: 'api',
      apiKey: 'different-secret',
      models: { sonnet: 's2' }
    })
    const library = await service.listClaudeCodeProfiles('account-a')
    await service['claudeCodeProfiles'].save('account-a', {
      ...library,
      profiles: [library.profiles[0], { ...library.profiles[1], credentialId: first.credentialId }]
    })

    await service.deleteClaudeCodeProfile(configPath, 'account-a', second.id)

    await expect(service['credentialSnapshots'].resolve('account-a', 'claude-code', first.credentialId)).resolves.toBe(
      'shared-secret'
    )
  })

  it('deleting a non-active profile leaves the Claude Code configuration untouched', async () => {
    const first = await service.saveClaudeCodeProfile('account-a', {
      name: 'API profile',
      accessMode: 'api',
      apiKey: 'secret',
      models: { opus: 'opus-route', sonnet: 'sonnet-route', haiku: 'haiku-route' }
    })
    const second = await service.saveClaudeCodeProfile('account-a', {
      name: 'Plan profile',
      accessMode: 'api',
      apiKey: 'secret-2',
      models: { opus: 'plan-opus' }
    })
    const initial = await service.inspectClaudeCodeTarget(configPath, 'account-a')
    const preview = await service.previewClaudeCodeRoute(configPath, {
      accountId: 'account-a',
      profileId: first.id,
      expectedRevision: initial.revision!,
      apiUrl: 'https://api.aionly.com'
    })
    await service.apply({
      accountId: 'account-a',
      previewToken: preview.previewToken,
      expectedRevision: preview.expectedRevision
    })
    const contentBeforeRemoval = await readFile(configPath, 'utf8')

    await service.deleteClaudeCodeProfile(configPath, 'account-a', second.id)

    expect(await readFile(configPath, 'utf8')).toBe(contentBeforeRemoval)
    await expect(service.listClaudeCodeProfiles('account-a')).resolves.toMatchObject({
      profiles: [expect.objectContaining({ id: first.id })]
    })
  })

  it('stores multiple profiles without applying and switches the active profile on apply', async () => {
    const first = await service.saveClaudeCodeProfile('account-a', {
      name: 'API profile',
      accessMode: 'api',
      apiKey: 'sk-api',
      models: { opus: 'api-opus', sonnet: 'api-sonnet', haiku: 'api-haiku' }
    })
    const second = await service.saveClaudeCodeProfile('account-a', {
      name: 'Plan profile',
      accessMode: 'tokenPlan',
      tokenPlanId: 'plan-a',
      apiKey: 'sk-plan',
      models: { opus: 'plan-opus', sonnet: 'plan-sonnet', haiku: 'plan-haiku' }
    })

    expect((await service.listClaudeCodeProfiles('account-a')).profiles.map(({ id }) => id)).toEqual([
      first.id,
      second.id
    ])
    await expect(readFile(configPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })

    const snapshot = await service.inspectClaudeCodeTarget(configPath, 'account-a')
    const preview = await service.previewClaudeCodeRoute(configPath, {
      accountId: 'account-a',
      profileId: second.id,
      expectedRevision: snapshot.revision!,
      apiUrl: 'https://api.aionly.com'
    })
    await service.apply({
      accountId: 'account-a',
      previewToken: preview.previewToken,
      expectedRevision: preview.expectedRevision
    })

    expect((await service.listClaudeCodeProfiles('account-a')).activeProfileId).toBe(second.id)
    expect(JSON.parse(await readFile(configPath, 'utf8')).env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe('plan-opus')
  })

  it('rolls back the target when persisting active profile state fails after write', async () => {
    await writeFile(configPath, '{"env":{"DEBUG":"1"}}\n', 'utf8')
    const saved = await service.saveClaudeCodeProfile('account-a', {
      name: 'API profile',
      accessMode: 'api',
      apiKey: 'secret',
      models: { opus: 'opus-route', sonnet: 'sonnet-route', haiku: 'haiku-route' }
    })
    const snapshot = await service.inspectClaudeCodeTarget(configPath, 'account-a')
    const preview = await service.previewClaudeCodeRoute(configPath, {
      accountId: 'account-a',
      profileId: saved.id,
      expectedRevision: snapshot.revision!,
      apiUrl: 'https://api.aionly.com'
    })
    vi.spyOn((service as any).claudeCodeProfiles, 'save').mockRejectedValueOnce(new Error('disk full'))

    await expect(
      service.apply({
        accountId: 'account-a',
        previewToken: preview.previewToken,
        expectedRevision: preview.expectedRevision
      })
    ).rejects.toThrow('disk full')
    expect(JSON.parse(await readFile(configPath, 'utf8'))).toEqual({ env: { DEBUG: '1' } })
  })

  it('keeps an updated profile usable when obsolete credential cleanup fails', async () => {
    const first = await service.saveClaudeCodeProfile('account-a', {
      name: 'API profile',
      accessMode: 'api',
      apiKey: 'old-secret',
      models: { opus: 'old-opus', sonnet: 'old-sonnet', haiku: 'old-haiku' }
    })
    vi.spyOn((service as any).credentialSnapshots, 'remove').mockRejectedValueOnce(new Error('locked'))

    const updated = await service.saveClaudeCodeProfile('account-a', {
      profileId: first.id,
      name: 'API profile',
      accessMode: 'api',
      apiKey: 'new-secret',
      models: { opus: 'new-opus', sonnet: 'new-sonnet', haiku: 'new-haiku' }
    })
    const snapshot = await service.inspectClaudeCodeTarget(configPath, 'account-a')
    await expect(
      service.previewClaudeCodeRoute(configPath, {
        accountId: 'account-a',
        profileId: updated.id,
        expectedRevision: snapshot.revision!,
        apiUrl: 'https://api.aionly.com'
      })
    ).resolves.toMatchObject({ targetId: 'claude-code' })
  })
})

describe('AgentRouterService Codex routes', () => {
  let root: string
  let configPath: string
  let authPath: string
  let service: AgentRouterService

  beforeEach(async () => {
    root = join(process.cwd(), '.tmp', `codex-router-${crypto.randomUUID()}`)
    configPath = join(root, '.codex', 'config.toml')
    authPath = join(root, '.codex', 'auth.json')
    await mkdir(join(root, '.codex'), { recursive: true })
    await writeFile(configPath, '', 'utf8')
    await writeFile(authPath, '{}\n', 'utf8')
    service = new AgentRouterService({ dataRoot: join(root, 'data') })
  })

  afterEach(async () => rm(root, { recursive: true, force: true }))

  it('deleting the active profile leaves Codex configuration files untouched', async () => {
    const saved = await service.saveCodexProfile('account-a', {
      name: 'API profile',
      accessMode: 'api',
      apiKey: 'secret',
      model: 'gpt-5-codex'
    })
    const initial = await service.inspectCodexTarget(configPath, authPath, 'account-a')
    const preview = await service.previewCodexRoute(configPath, authPath, {
      accountId: 'account-a',
      profileId: saved.id,
      expectedRevision: initial.revision!,
      apiUrl: 'https://api.aionly.com/v1'
    })
    await service.apply({
      accountId: 'account-a',
      previewToken: preview.previewToken,
      expectedRevision: preview.expectedRevision
    })

    const beforeRemoval = await Promise.all([readFile(configPath, 'utf8'), readFile(authPath, 'utf8')])
    await service.deleteCodexProfile(configPath, authPath, 'account-a', saved.id)

    await expect(Promise.all([readFile(configPath, 'utf8'), readFile(authPath, 'utf8')])).resolves.toEqual(
      beforeRemoval
    )
    await expect(service.listCodexProfiles('account-a')).resolves.toEqual({ version: 1, profiles: [] })
  })

  it('restores both Codex files when persisting active profile state fails after apply', async () => {
    const originalConfig = 'approval_policy = "on-request"\n'
    const originalAuth = '{"OPENAI_API_KEY":"old-key"}\n'
    await writeFile(configPath, originalConfig, 'utf8')
    await writeFile(authPath, originalAuth, 'utf8')
    const saved = await service.saveCodexProfile('account-a', {
      name: 'API profile',
      accessMode: 'api',
      apiKey: 'new-key',
      model: 'gpt-5-codex'
    })
    const snapshot = await service.inspectCodexTarget(configPath, authPath, 'account-a')
    const preview = await service.previewCodexRoute(configPath, authPath, {
      accountId: 'account-a',
      profileId: saved.id,
      expectedRevision: snapshot.revision!,
      apiUrl: 'https://api.aionly.com/v1'
    })
    vi.spyOn((service as any).codexProfiles, 'save').mockRejectedValueOnce(new Error('disk full'))

    await expect(
      service.apply({
        accountId: 'account-a',
        previewToken: preview.previewToken,
        expectedRevision: preview.expectedRevision
      })
    ).rejects.toThrow('disk full')

    await expect(Promise.all([readFile(configPath, 'utf8'), readFile(authPath, 'utf8')])).resolves.toEqual([
      originalConfig,
      originalAuth
    ])
  })

  it('retains a Codex credential snapshot while another profile references it', async () => {
    const first = await service.saveCodexProfile('account-a', {
      name: 'First',
      accessMode: 'api',
      apiKey: 'shared-secret',
      model: 'model-a'
    })
    const second = await service.saveCodexProfile('account-a', {
      name: 'Second',
      accessMode: 'api',
      apiKey: 'different-secret',
      model: 'model-b'
    })
    const library = await service.listCodexProfiles('account-a')
    await service['codexProfiles'].save('account-a', {
      ...library,
      profiles: [library.profiles[0], { ...library.profiles[1], credentialId: first.credentialId }]
    })

    await service.deleteCodexProfile(configPath, authPath, 'account-a', second.id)

    await expect(service['credentialSnapshots'].resolve('account-a', 'codex', first.credentialId)).resolves.toBe(
      'shared-secret'
    )
  })

  it('deleting a non-active profile leaves Codex configuration files untouched', async () => {
    const first = await service.saveCodexProfile('account-a', {
      name: 'API profile',
      accessMode: 'api',
      apiKey: 'secret',
      model: 'gpt-5-codex'
    })
    const second = await service.saveCodexProfile('account-a', {
      name: 'Plan profile',
      accessMode: 'api',
      apiKey: 'secret-2',
      model: 'qwen3-max'
    })
    const initial = await service.inspectCodexTarget(configPath, authPath, 'account-a')
    const preview = await service.previewCodexRoute(configPath, authPath, {
      accountId: 'account-a',
      profileId: first.id,
      expectedRevision: initial.revision!,
      apiUrl: 'https://api.aionly.com/v1'
    })
    await service.apply({
      accountId: 'account-a',
      previewToken: preview.previewToken,
      expectedRevision: preview.expectedRevision
    })
    const [configBeforeRemoval, authBeforeRemoval] = await Promise.all([
      readFile(configPath, 'utf8'),
      readFile(authPath, 'utf8')
    ])

    await service.deleteCodexProfile(configPath, authPath, 'account-a', second.id)

    await expect(Promise.all([readFile(configPath, 'utf8'), readFile(authPath, 'utf8')])).resolves.toEqual([
      configBeforeRemoval,
      authBeforeRemoval
    ])
    await expect(service.listCodexProfiles('account-a')).resolves.toMatchObject({
      profiles: [expect.objectContaining({ id: first.id })]
    })
  })
})
