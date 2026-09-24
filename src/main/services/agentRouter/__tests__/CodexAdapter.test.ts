import { describe, expect, it } from 'vitest'

import { CODEX_MANAGED_PROVIDER_ID, CodexAdapter } from '../CodexAdapter'

describe('CodexAdapter', () => {
  const adapter = new CodexAdapter()
  const profile = {
    id: 'profile-1',
    targetId: 'codex' as const,
    name: 'Aionly Router',
    credentialId: 'cred-1',
    accessMode: 'tokenPlan' as const,
    tokenPlanId: 'plan-1',
    model: 'qwen3-max',
    managedAt: '2026-01-01T00:00:00.000Z'
  }

  it('parses empty documents', () => {
    expect(adapter.parseConfigToml('')).toEqual({})
    expect(adapter.parseConfigToml('# only a comment\n')).toEqual({})
    expect(adapter.serializeConfigToml({}).trim()).toBe('')
    expect(adapter.parseAuthJson('')).toEqual({})
    expect(adapter.parseAuthJson('   ')).toEqual({})
  })

  it('round-trips config.toml and auth.json', () => {
    const toml = adapter.serializeConfigToml({
      model_provider: CODEX_MANAGED_PROVIDER_ID,
      model: 'qwen3-max',
      model_providers: { [CODEX_MANAGED_PROVIDER_ID]: { name: 'AiOnly', base_url: 'https://example.com/v1' } }
    })
    const document = adapter.parseConfigToml(toml)
    expect(document.model_provider).toBe(CODEX_MANAGED_PROVIDER_ID)
    expect(document.model).toBe('qwen3-max')
    expect(adapter.parseConfigToml(adapter.serializeConfigToml(document))).toEqual(document)
    const auth = adapter.serializeAuthJson({ OPENAI_API_KEY: 'sk-test' })
    expect(adapter.parseAuthJson(auth)).toEqual({ OPENAI_API_KEY: 'sk-test' })
  })

  it('rejects non-object auth documents', () => {
    expect(() => adapter.parseAuthJson('[1, 2, 3]')).toThrow()
    expect(() => adapter.parseAuthJson('null')).toThrow()
  })

  it('writes the managed provider with requires_openai_auth and points model_provider at it', () => {
    const plan = adapter.buildManagedPlan({}, profile, 'sk-live-key', 'https://api.aionly.com/v1')
    const providers = plan.configToml.model_providers as Record<string, Record<string, unknown>>
    const provider = providers[CODEX_MANAGED_PROVIDER_ID]
    expect(provider).toMatchObject({
      name: CODEX_MANAGED_PROVIDER_ID,
      base_url: 'https://api.aionly.com/v1',
      wire_api: 'responses',
      requires_openai_auth: true
    })
    expect(provider).not.toHaveProperty('env_key')
    expect(plan.configToml.model_provider).toBe(CODEX_MANAGED_PROVIDER_ID)
    expect(plan.configToml.model).toBe('qwen3-max')
    expect(plan.configToml.disable_response_storage).toBe(true)
    expect(plan.authJson.OPENAI_API_KEY).toBe('sk-live-key')
  })

  it('keeps unrelated user keys and managed values update in place', () => {
    const currentToml = adapter.parseConfigToml(
      adapter.serializeConfigToml({
        model: 'gpt-5.1-codex',
        approval_policy: 'on-request',
        model_providers: {
          custom: { name: 'Custom', base_url: 'https://custom.example/v1' },
          [CODEX_MANAGED_PROVIDER_ID]: {
            name: 'stale',
            base_url: 'https://old.example/v1',
            env_key: 'OPENAI_API_KEY',
            wire_api: 'chat'
          }
        }
      })
    )
    const plan = adapter.buildManagedPlan(currentToml, profile, 'sk-new', 'https://api.aionly.com/v1')
    expect(plan.configToml.approval_policy).toBe('on-request')
    expect(Object.keys(plan.configToml.model_providers as Record<string, unknown>)).toContain('custom')
    const managed = (plan.configToml.model_providers as Record<string, Record<string, unknown>>)[
      CODEX_MANAGED_PROVIDER_ID
    ]
    expect(managed.env_key).toBeUndefined()
    expect(managed.wire_api).toBe('responses')
    expect((plan.authJson as Record<string, unknown>).OPENAI_API_KEY).toBe('sk-new')
    expect(plan.configToml.model).toBe('qwen3-max')
  })

  it('previews only changed fields and masks the credential', () => {
    const currentToml = adapter.parseConfigToml('')
    const currentAuth = adapter.parseAuthJson('')
    const entries = adapter.createPreview(
      currentToml,
      currentAuth,
      profile,
      'sk-secret-value',
      'https://api.aionly.com/v1'
    )
    const fields = entries.map(({ field }) => field)
    expect(fields).toContain('model')
    expect(fields).toContain('model_provider')
    expect(fields).toContain('OPENAI_API_KEY')
    const key = entries.find(({ field }) => field === 'OPENAI_API_KEY')
    expect(key?.next).not.toContain('sk-secret-value')
    expect(key?.sensitive).toBe(true)
    // unchanged fields are skipped
    const stable = adapter.createPreview(
      planTomlFor(adapter, profile, 'https://api.aionly.com/v1'),
      { OPENAI_API_KEY: 'sk-secret-value' },
      profile,
      'sk-secret-value',
      'https://api.aionly.com/v1'
    )
    expect(stable.find(({ field }) => field === 'OPENAI_API_KEY')).toBeUndefined()
  })

  it('removes managed fields while keeping user content and unmanaged providers', () => {
    const currentToml = adapter.parseConfigToml(
      adapter.serializeConfigToml({
        model: 'qwen3-max',
        model_provider: CODEX_MANAGED_PROVIDER_ID,
        model_reasoning_effort: 'high',
        disable_response_storage: true,
        approval_policy: 'on-request',
        model_providers: {
          custom: { name: 'Custom', base_url: 'https://custom.example/v1' },
          [CODEX_MANAGED_PROVIDER_ID]: {
            name: 'AiOnly',
            base_url: 'https://api.aionly.com/v1',
            requires_openai_auth: true
          }
        }
      })
    )
    const currentAuth = adapter.parseAuthJson(adapter.serializeAuthJson({ OPENAI_API_KEY: 'sk-old' }))
    const removed = adapter.removeManagedFields(currentToml, currentAuth)
    expect(removed.configToml.model).toBeUndefined()
    expect(removed.configToml.model_provider).toBeUndefined()
    expect(removed.configToml.model_reasoning_effort).toBeUndefined()
    expect(removed.configToml.disable_response_storage).toBeUndefined()
    expect(removed.configToml.approval_policy).toBe('on-request')
    expect(Object.keys(removed.configToml.model_providers as Record<string, unknown>)).toEqual(['custom'])
    expect(removed.authJson.OPENAI_API_KEY).toBeUndefined()
  })

  it('detects managed fields and clears reasoning effort when unset', () => {
    const currentToml = adapter.parseConfigToml(
      adapter.serializeConfigToml({
        model: 'qwen3-max',
        model_provider: CODEX_MANAGED_PROVIDER_ID,
        approval_policy: 'on-request'
      })
    )
    expect(adapter.hasManagedFields(currentToml, { OPENAI_API_KEY: 'sk-1' })).toBe(true)
    expect(adapter.hasManagedFields(currentToml, {})).toBe(true)
    expect(adapter.hasManagedFields(adapter.parseConfigToml(''), {})).toBe(false)
    expect(adapter.hasManagedFields(adapter.parseConfigToml(''), { OPENAI_API_KEY: 'sk-1' })).toBe(true)
    // A profile without reasoningEffort removes the stale field instead of leaving it behind.
    const plan = adapter.buildManagedPlan(
      adapter.parseConfigToml(adapter.serializeConfigToml({ model_reasoning_effort: 'high' })),
      profile,
      'sk-1',
      'https://api.aionly.com/v1'
    )
    expect(plan.configToml.model_reasoning_effort).toBeUndefined()
    const withEffort = adapter.buildManagedPlan(
      {},
      { ...profile, reasoningEffort: 'high' as const },
      'sk-1',
      'https://api.aionly.com/v1'
    )
    expect(withEffort.configToml.model_reasoning_effort).toBe('high')
  })

  it('verifies written documents and fails on drift', () => {
    const plan = adapter.buildManagedPlan({}, profile, 'sk-live', 'https://api.aionly.com/v1')
    const tomlContent = adapter.serializeConfigToml(plan.configToml)
    const authContent = adapter.serializeAuthJson(plan.authJson)
    adapter.verify(tomlContent, authContent, plan.configToml, plan.authJson)
    const drifted = adapter.serializeConfigToml({ ...plan.configToml, model: 'other' })
    expect(() => adapter.verify(drifted, authContent, plan.configToml, plan.authJson)).toThrow()
  })
})

function planTomlFor(adapter: CodexAdapter, profile: Parameters<CodexAdapter['buildManagedPlan']>[1], apiUrl: string) {
  return adapter.buildManagedPlan({}, profile, 'sk-secret-value', apiUrl).configToml
}
