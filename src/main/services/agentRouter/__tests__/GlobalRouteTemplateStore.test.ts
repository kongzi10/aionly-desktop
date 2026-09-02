import { mkdtemp, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { AgentCredentialSnapshotStore } from '../AgentCredentialSnapshotStore'
import { GlobalRouteTemplateStore } from '../GlobalRouteTemplateStore'

describe('global route template persistence', () => {
  it('returns redacted metadata while storing the key locally without encryption', async () => {
    const root = await mkdtemp(join(process.env.TEMP ?? process.cwd(), 'agent-router-template-'))
    const store = new GlobalRouteTemplateStore(root)

    const created = await store.create('account-1', {
      modelId: 'gpt-5',
      accessMode: 'api',
      apiKey: 'sk-plaintext-sentinel',
      modelTypes: ['function_calling', 'reasoning'] as const
    })

    expect(created).toMatchObject({ modelId: 'gpt-5', maskedKey: 'sk-p••••inel' })
    expect(created).not.toHaveProperty('apiKey')
    expect(await store.resolveKey('account-1', created.templateId)).toBe('sk-plaintext-sentinel')
    const credentialDirectory = join(store.getFilePath('account-1'), '..', 'credentials')
    const [credentialFile] = await readdir(credentialDirectory)
    expect(await readFile(join(credentialDirectory, credentialFile), 'utf8')).toContain('sk-plaintext-sentinel')
  })

  it('deleting a template does not delete an independent Agent credential snapshot', async () => {
    const root = await mkdtemp(join(process.env.TEMP ?? process.cwd(), 'agent-router-template-'))
    const templates = new GlobalRouteTemplateStore(root)
    const snapshots = new AgentCredentialSnapshotStore(root)
    const template = await templates.create('account-1', {
      modelId: 'claude-sonnet',
      accessMode: 'tokenPlan',
      tokenPlanId: 'plan-pro',
      apiKey: 'tp-independent-secret',
      modelTypes: ['function_calling']
    })
    const credentialId = await snapshots.create('account-1', 'workbuddy', 'tp-independent-secret')

    await templates.remove('account-1', template.templateId)

    expect(await templates.list('account-1')).toEqual([])
    expect(await snapshots.resolve('account-1', 'workbuddy', credentialId)).toBe('tp-independent-secret')
  })

  it('rejects the same model id with the same key but allows a different key', async () => {
    const root = await mkdtemp(join(process.env.TEMP ?? process.cwd(), 'agent-router-template-'))
    const store = new GlobalRouteTemplateStore(root)
    const request = {
      modelId: 'gpt-5',
      accessMode: 'api' as const,
      apiKey: 'sk-same-key',
      modelTypes: ['function_calling', 'reasoning'] as const
    }

    await store.create('account-1', request)
    await expect(store.create('account-1', request)).rejects.toThrow('Duplicate global route template')
    await expect(store.create('account-1', { ...request, apiKey: 'sk-different-key' })).resolves.toBeDefined()
  })
})
