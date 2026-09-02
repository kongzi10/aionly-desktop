import type { AgentRouteModel } from '@shared/agentRouter'
import { describe, expect, it } from 'vitest'

import type { AgentRouterError, WorkBuddyEntry } from '../WorkBuddyAdapter'
import { WorkBuddyAdapter } from '../WorkBuddyAdapter'

const adapter = new WorkBuddyAdapter()
const model: AgentRouteModel = {
  modelId: 'gpt-5',
  displayName: 'GPT-5',
  accessMode: 'api',
  credentialId: 'credential-a',
  enabled: true,
  modelTypes: ['function_calling', 'reasoning'],
  routedAt: '2026-08-27T10:00:00+08:00'
}

const entry = (url: string, overrides: Partial<WorkBuddyEntry> = {}): WorkBuddyEntry => ({
  id: 'gpt-5',
  name: 'GPT-5',
  vendor: 'Custom',
  url,
  apiKey: 'secret',
  supportsToolCall: true,
  supportsImages: false,
  supportsReasoning: false,
  useCustomProtocol: false,
  ...overrides
})

describe('WorkBuddyAdapter', () => {
  it.each([
    'https://aionly.com/v1',
    'https://api.aionly.com/v1',
    'HTTPS://API.AIIONLY.COM:443/v1',
    'http://aiionly.com/v1'
  ])('recognizes an Aionly HTTP(S) hostname: %s', (url) => {
    expect(adapter.isAionlyEntry(entry(url))).toBe(true)
  })

  it.each([
    'https://aionly.com.evil.example/v1',
    'https://fakeaionly.com/v1',
    'https://example.com/aionly.com/v1',
    'ftp://api.aionly.com/v1',
    'not-a-url'
  ])('rejects a non-Aionly hostname: %s', (url) => {
    expect(adapter.isAionlyEntry(entry(url))).toBe(false)
  })

  it('requires the Custom vendor', () => {
    expect(adapter.isAionlyEntry(entry('https://api.aionly.com/v1', { vendor: 'OpenAI' }))).toBe(false)
  })

  it('builds the documented WorkBuddy entry and falls back to modelId for an empty name', () => {
    expect(
      adapter.buildEntry(
        { ...model, displayName: '' },
        'sk-sentinel-secret',
        'https://api.aionly.com/v1/chat/completions'
      )
    ).toEqual({
      id: 'gpt-5',
      name: 'gpt-5',
      vendor: 'Custom',
      url: 'https://api.aionly.com/v1/chat/completions',
      apiKey: 'sk-sentinel-secret',
      supportsToolCall: true,
      supportsImages: false,
      supportsReasoning: true,
      useCustomProtocol: false
    })
  })

  it('replaces all Aionly entries while preserving non-Aionly entries and their order', () => {
    const first = entry('https://manual.example/v1', { id: 'first', extra: { keep: true } })
    const oldManaged = entry('https://api.aionly.com/v1', { apiKey: 'old' })
    const second = entry('https://other.example/v1', { id: 'second' })
    const generated = entry('https://api.aionly.com/v1', { apiKey: 'new' })

    expect(adapter.merge([first, oldManaged, second], [generated])).toEqual([first, second, generated])
  })

  it('rejects a generated model id owned by a non-Aionly entry', () => {
    expect(() =>
      adapter.merge([entry('https://manual.example/v1')], [entry('https://api.aionly.com/v1')])
    ).toThrowError(expect.objectContaining<Partial<AgentRouterError>>({ code: 'ENTRY_OWNERSHIP_CONFLICT' }))
  })
})
