import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { AgentRouteModel } from '@shared/agentRouter'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { AgentRouterService } from '../AgentRouterService'
import { RouteRecordStore } from '../RouteRecordStore'

const model: AgentRouteModel = {
  modelId: 'gpt-5',
  displayName: 'GPT-5',
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

  it('rejects a non-Aionly duplicate model id', async () => {
    await writeFile(
      configPath,
      `${JSON.stringify([{ id: 'gpt-5', name: 'Manual', vendor: 'Custom', url: 'https://other.example/v1', apiKey: 'manual', supportsToolCall: false, supportsImages: false, supportsReasoning: false, useCustomProtocol: false }], null, 2)}\n`,
      'utf8'
    )
    await service.saveRouteModels('account-a', 'workbuddy', [model])
    const snapshot = await service.inspectTarget('workbuddy', configPath)
    await expect(
      service.previewWorkBuddyRoutes(configPath, {
        accountId: 'account-a',
        expectedRevision: snapshot.revision!,
        apiUrl: 'https://api.aionly.com/v1',
        enabledRoutes: [{ modelId: model.modelId, credentialId: model.credentialId }],
        resolvedCredentials: [{ credentialId: 'credential-1', value: 'secret' }]
      })
    ).rejects.toMatchObject({ code: 'ENTRY_OWNERSHIP_CONFLICT' })
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

  it('reveals the plaintext credential only for an existing Agent route', async () => {
    const route = await service.createAgentRoute('account-a', 'workbuddy', {
      modelId: 'gpt-5',
      displayName: 'GPT-5',
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

  it('creates direct and global-copy routes disabled and only marks an exact model-and-key match as joined', async () => {
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
      displayName: 'Claude Sonnet',
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

  it('synchronizes enabled state from exact model id and key matches in WorkBuddy', async () => {
    const first = await service.createAgentRoute('account-a', 'workbuddy', {
      modelId: 'gpt-5',
      displayName: 'GPT-5 A',
      accessMode: 'api',
      apiKey: 'sk-key-a',
      modelTypes: ['function_calling']
    })
    const second = await service.createAgentRoute('account-a', 'workbuddy', {
      modelId: 'gpt-5',
      displayName: 'GPT-5 B',
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
      displayName: 'GPT-5',
      accessMode: 'api',
      apiKey: 'sk-old',
      modelTypes: ['function_calling']
    })

    const updated = await service.updateAgentRoute(
      'account-a',
      'workbuddy',
      { modelId: route.modelId, credentialId: route.credentialId },
      {
        displayName: '',
        accessMode: 'tokenPlan',
        tokenPlanId: 'plan-pro',
        apiKey: 'tk-new',
        modelTypes: ['vision', 'reasoning', 'function_calling']
      }
    )

    expect(updated).toMatchObject({
      modelId: 'gpt-5',
      displayName: 'gpt-5',
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
