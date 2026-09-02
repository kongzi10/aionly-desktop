import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { AgentRouteModel } from '@shared/agentRouter'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { RouteRecordStore } from '../RouteRecordStore'

const createModel = (modelId: string): AgentRouteModel => ({
  modelId,
  displayName: modelId,
  accessMode: 'api',
  credentialId: 'credential-a',
  enabled: true,
  modelTypes: ['function_calling'],
  routedAt: '2026-08-27T10:00:00+08:00'
})

describe('RouteRecordStore', () => {
  let root: string

  beforeEach(async () => {
    root = join(process.cwd(), '.tmp', `agent-router-store-${crypto.randomUUID()}`)
    await mkdir(root, { recursive: true })
  })

  afterEach(async () => rm(root, { recursive: true, force: true }))

  it('stores one target document per account without plaintext keys', async () => {
    const store = new RouteRecordStore(root)
    const malicious = { ...createModel('gpt-5'), apiKey: 'sk-sentinel-secret' }

    await expect(store.saveRouteModels('account-a', 'workbuddy', [malicious as AgentRouteModel])).rejects.toThrow(
      'secret field'
    )
    await expect(store.getRouteConfig('account-a', 'workbuddy')).resolves.toEqual({ targetId: 'workbuddy', models: [] })
  })

  it('isolates WorkBuddy routes by account', async () => {
    const store = new RouteRecordStore(root)
    await store.saveRouteModels('account-a', 'workbuddy', [createModel('gpt-5')])
    await store.saveRouteModels('account-b', 'workbuddy', [createModel('deepseek-v4')])

    expect((await store.getRouteConfig('account-a', 'workbuddy')).models[0].modelId).toBe('gpt-5')
    expect((await store.getRouteConfig('account-b', 'workbuddy')).models[0].modelId).toBe('deepseek-v4')
  })

  it('does not read the obsolete global routes file', async () => {
    await writeFile(join(root, 'routes.json'), JSON.stringify({ version: 2, routes: [createModel('legacy')] }), 'utf8')
    const store = new RouteRecordStore(root)

    await expect(store.getRouteConfig('account-a', 'workbuddy')).resolves.toEqual({ targetId: 'workbuddy', models: [] })
  })

  it('stores same-model routes independently by credential id', async () => {
    const store = new RouteRecordStore(root)
    const first = { ...createModel('gpt-5'), credentialId: 'credential-a' }
    const second = { ...createModel('gpt-5'), credentialId: 'credential-b', enabled: false }
    await store.saveRouteModels('account-a', 'workbuddy', [first, second])
    await store.saveRouteModels('account-a', 'workbuddy', [{ ...second, displayName: 'GPT-5 alternate' }])

    expect((await store.getRouteConfig('account-a', 'workbuddy')).models).toEqual([
      expect.objectContaining({ modelId: 'gpt-5', credentialId: 'credential-a' }),
      expect.objectContaining({ modelId: 'gpt-5', credentialId: 'credential-b', displayName: 'GPT-5 alternate' })
    ])
    await store.removeRouteModels('account-a', 'workbuddy', [{ modelId: 'gpt-5', credentialId: 'credential-a' }])
    expect((await store.getRouteConfig('account-a', 'workbuddy')).models).toEqual([
      expect.objectContaining({ modelId: 'gpt-5', credentialId: 'credential-b' })
    ])
  })

  it('uses an account-safe directory and writes the required document shape', async () => {
    const store = new RouteRecordStore(root)
    await store.saveRouteModels('../account-a', 'workbuddy', [createModel('gpt-5')])

    const filePath = store.getFilePath('../account-a', 'workbuddy')
    expect(filePath.startsWith(join(root, 'routes'))).toBe(true)
    expect(filePath).not.toContain('..')
    const persisted = JSON.parse(await readFile(filePath, 'utf8'))
    expect(persisted).toEqual({
      targetId: 'workbuddy',
      models: [
        {
          modelId: 'gpt-5',
          displayName: 'gpt-5',
          accessMode: 'api',
          credentialId: 'credential-a',
          modelTypes: ['function_calling'],
          routedAt: '2026-08-27T10:00:00+08:00'
        }
      ]
    })
    expect(JSON.stringify(persisted)).not.toContain('enabled')
  })
})
