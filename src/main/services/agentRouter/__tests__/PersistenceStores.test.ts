import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { AgentRouteModel, ClaudeCodeRouteProfile } from '@shared/agentRouter'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ClaudeCodeProfileStore } from '../ClaudeCodeProfileStore'
import { RouteRecordStore } from '../RouteRecordStore'

const createModel = (modelId: string): AgentRouteModel => ({
  modelId,
  accessMode: 'api',
  credentialId: 'credential-a',
  enabled: true,
  modelTypes: ['function_calling'],
  routedAt: '2026-08-27T10:00:00+08:00'
})

describe('ClaudeCodeProfileStore', () => {
  let root: string

  beforeEach(async () => {
    root = join(process.cwd(), '.tmp', `claude-code-profile-${crypto.randomUUID()}`)
    await mkdir(root, { recursive: true })
  })

  afterEach(async () => rm(root, { recursive: true, force: true }))

  const profile: ClaudeCodeRouteProfile = {
    id: 'profile-a',
    targetId: 'claude-code',
    name: 'API profile',
    credentialId: 'credential-a',
    accessMode: 'api',
    models: { opus: 'opus-route', sonnet: 'sonnet-route', haiku: 'haiku-route' },
    managedAt: '2026-09-18T08:00:00.000Z'
  }

  it('migrates the legacy single profile into one active default profile', async () => {
    const store = new ClaudeCodeProfileStore(root)
    const filePath = store.getFilePath('account-a')
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(
      filePath,
      `${JSON.stringify({ profile, ownership: { signatures: { model: 'digest' } } })}\n`,
      'utf8'
    )

    const library = await store.get('account-a')

    expect(library).toEqual({
      version: 2,
      profiles: [
        expect.objectContaining({
          id: expect.any(String),
          name: 'Default',
          credentialId: 'credential-a'
        })
      ],
      activeProfileId: library?.profiles[0].id
    })
  })

  it('persists multiple profiles and validates the active profile reference', async () => {
    const store = new ClaudeCodeProfileStore(root)
    const apiProfile = { ...profile, id: 'profile-api', name: 'API' }
    const tokenPlanProfile = {
      ...profile,
      id: 'profile-plan',
      name: 'Plan',
      accessMode: 'tokenPlan' as const,
      tokenPlanId: 'plan-a'
    }

    await store.save('account-a', {
      version: 2,
      profiles: [apiProfile, tokenPlanProfile],
      activeProfileId: apiProfile.id
    } as never)

    expect(((await store.get('account-a')) as any)?.profiles).toEqual([apiProfile, tokenPlanProfile])
    await expect(
      store.save('account-a', {
        version: 2,
        profiles: [apiProfile],
        activeProfileId: 'missing'
      } as never)
    ).rejects.toThrow('active profile')
  })

  it('persists profiles without plaintext credentials and drops legacy ownership on read', async () => {
    const store = new ClaudeCodeProfileStore(root)
    await store.save('account-a', {
      version: 2,
      profiles: [profile],
      activeProfileId: profile.id
    })

    await expect(store.get('account-a')).resolves.toEqual({
      version: 2,
      profiles: [profile],
      activeProfileId: profile.id
    })
    expect(await readFile(store.getFilePath('account-a'), 'utf8')).not.toContain('apiKey')
  })

  it('persists optional model mappings with the default fallback model', async () => {
    const store = new ClaudeCodeProfileStore(root)
    const minimal = { ...profile, models: { default: 'glm-5.3' } }

    await store.save('account-a', { version: 2, profiles: [minimal] })
    await expect(store.get('account-a')).resolves.toEqual({ version: 2, profiles: [minimal] })
  })

  it('persists a profile without any model mapping', async () => {
    const store = new ClaudeCodeProfileStore(root)
    const minimal = { ...profile, models: {} }

    await store.save('account-a', { version: 2, profiles: [minimal] })
    await expect(store.get('account-a')).resolves.toEqual({ version: 2, profiles: [minimal] })
  })

  it('removes the persisted profile', async () => {
    const store = new ClaudeCodeProfileStore(root)
    await store.save('account-a', { version: 2, profiles: [profile] })
    await store.remove('account-a')

    await expect(store.get('account-a')).resolves.toBeUndefined()
  })
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

  it('drops the obsolete displayName field from legacy route records', async () => {
    const store = new RouteRecordStore(root)
    const filePath = store.getFilePath('account-a', 'workbuddy')
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(
      filePath,
      `${JSON.stringify({ targetId: 'workbuddy', models: [{ ...createModel('gpt-5'), displayName: 'AiOnly' }] })}\n`,
      'utf8'
    )

    const config = await store.getRouteConfig('account-a', 'workbuddy')

    expect(config.models[0]).not.toHaveProperty('displayName')
    await store.saveRouteModels('account-a', 'workbuddy', config.models)
    expect(JSON.parse(await readFile(filePath, 'utf8')).models[0]).not.toHaveProperty('displayName')
  })

  it('stores same-model routes independently by credential id', async () => {
    const store = new RouteRecordStore(root)
    const first = { ...createModel('gpt-5'), credentialId: 'credential-a' }
    const second = { ...createModel('gpt-5'), credentialId: 'credential-b', enabled: false }
    await store.saveRouteModels('account-a', 'workbuddy', [first, second])
    await store.saveRouteModels('account-a', 'workbuddy', [second])

    expect((await store.getRouteConfig('account-a', 'workbuddy')).models).toEqual([
      expect.objectContaining({ modelId: 'gpt-5', credentialId: 'credential-a' }),
      expect.objectContaining({ modelId: 'gpt-5', credentialId: 'credential-b' })
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
