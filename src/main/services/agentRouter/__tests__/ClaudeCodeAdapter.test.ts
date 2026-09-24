import type { ClaudeCodeRouteProfile } from '@shared/agentRouter'
import { describe, expect, it } from 'vitest'

import { ClaudeCodeAdapter } from '../ClaudeCodeAdapter'
import { AgentRouterError } from '../WorkBuddyAdapter'

const adapter = new ClaudeCodeAdapter()
const profile: ClaudeCodeRouteProfile = {
  id: 'profile-a',
  targetId: 'claude-code',
  name: 'API profile',
  credentialId: 'credential-a',
  accessMode: 'api',
  models: { opus: 'opus-route', sonnet: 'sonnet-route', haiku: 'haiku-route' },
  managedAt: '2026-09-18T08:00:00.000Z'
}

describe('ClaudeCodeAdapter', () => {
  it('creates a settings document while preserving unrelated fields', () => {
    const current = adapter.parse('{"permissions":{"allow":["Bash(pnpm test)"]},"env":{"DEBUG":"1"}}')
    const merged = adapter.merge(current, profile, 'secret-token', 'https://api.aionly.com')

    expect(merged).toEqual({
      permissions: { allow: ['Bash(pnpm test)'] },
      env: {
        DEBUG: '1',
        ANTHROPIC_BASE_URL: 'https://api.aionly.com',
        ANTHROPIC_AUTH_TOKEN: 'secret-token',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'opus-route',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'sonnet-route',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'haiku-route',
        CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1'
      }
    })
  })

  it('writes the default fallback model and clears unset slots', () => {
    const current = adapter.parse(
      '{"model":"opus","env":{"ANTHROPIC_DEFAULT_OPUS_MODEL":"old-opus","ANTHROPIC_MODEL":"old-default"}}'
    )
    const merged = adapter.merge(
      current,
      { ...profile, models: { default: 'glm-5.3' } },
      'secret-token',
      'https://api.aionly.com'
    )

    expect(merged).toEqual({
      model: 'opus',
      env: {
        ANTHROPIC_MODEL: 'glm-5.3',
        ANTHROPIC_BASE_URL: 'https://api.aionly.com',
        ANTHROPIC_AUTH_TOKEN: 'secret-token',
        CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1'
      }
    })
  })

  it('treats missing content as an empty settings object', () => {
    expect(adapter.parse()).toEqual({})
  })

  it.each(['[]', 'null', '"text"', '{'])('rejects an unsupported settings document: %s', (content) => {
    expect(() => adapter.parse(content)).toThrow(AgentRouterError)
  })

  it('removes ANTHROPIC_API_KEY when applying bearer authentication', () => {
    const current = adapter.parse('{"env":{"ANTHROPIC_API_KEY":"old-key"}}')

    expect(adapter.merge(current, profile, 'new-token', 'https://api.aionly.com')).not.toHaveProperty(
      'env.ANTHROPIC_API_KEY'
    )
  })

  it('redacts credentials in previews', () => {
    const current = adapter.parse('{"env":{"ANTHROPIC_AUTH_TOKEN":"old-secret-token"}}')
    const preview = adapter.createPreview(current, profile, 'new-secret-token', 'https://api.aionly.com')
    const auth = preview.find((entry) => entry.field === 'ANTHROPIC_AUTH_TOKEN')

    expect(auth).toEqual({
      field: 'ANTHROPIC_AUTH_TOKEN',
      previous: 'old-••••oken',
      next: 'new-••••oken',
      sensitive: true
    })
    expect(JSON.stringify(preview)).not.toContain('secret')
  })

  it('removes managed env fields while keeping unrelated ones', () => {
    const applied = adapter.merge({ env: { DEBUG: '1' } }, profile, 'secret-token', 'https://api.aionly.com')

    const removed = adapter.removeManagedFields(applied)
    expect(removed).toEqual({ env: { DEBUG: '1' } })
  })

  it('removes env when no fields remain and detects managed fields', () => {
    const applied = adapter.merge({}, profile, 'secret-token', 'https://api.aionly.com')

    expect(adapter.removeManagedFields(applied)).toEqual({})
    expect(adapter.hasManagedFields(applied)).toBe(true)
    expect(adapter.hasManagedFields({ env: { DEBUG: '1' } })).toBe(false)
    expect(adapter.hasManagedFields({})).toBe(false)
  })
})
