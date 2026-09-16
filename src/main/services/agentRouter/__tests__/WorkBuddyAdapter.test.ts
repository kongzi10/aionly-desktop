import type { AgentRouteModel } from '@shared/agentRouter'
import { AIONLY_LOGO_URL } from '@shared/config/constant'
import { describe, expect, it } from 'vitest'

import type { WorkBuddyEntry } from '../WorkBuddyAdapter'
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
  iconUrl: AIONLY_LOGO_URL,
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

  it('parses a WorkBuddy configuration when one entry is missing apiKey', () => {
    const content = JSON.stringify([
      {
        id: 'gpt-5.5',
        name: 'gpt-5.5',
        vendor: 'Custom',
        url: 'https://api.freemodel.dev/v1/chat/completions',
        apiKey: 'key',
        supportsToolCall: true,
        supportsImages: true,
        supportsReasoning: true,
        useCustomProtocol: true,
        reasoning: { defaultEffort: 'xhigh', canDisableThinking: false },
        maxInputTokens: 262144,
        maxOutputTokens: 65536
      },
      {
        id: 'deepseek-v4-flash-free',
        name: 'deepseek-v4-flash-free',
        vendor: 'Custom',
        url: 'https://opencode.ai/zen/v1/chat/completions',
        apiKey: 'sk-key',
        supportsToolCall: true,
        supportsImages: false,
        supportsReasoning: true,
        useCustomProtocol: false,
        reasoning: { defaultEffort: 'high', supportedEfforts: ['low', 'medium', 'high'] },
        maxInputTokens: 1024000,
        maxOutputTokens: 384000
      },
      {
        id: 'gemini-3.1-flash-lite',
        name: 'gemini-3.1-flash-lite',
        vendor: 'Ollama',
        url: 'http://localhost:11434/api/chat',
        supportsToolCall: true,
        supportsImages: false,
        supportsReasoning: false,
        useCustomProtocol: true
      },
      {
        id: 'gemini-2.5-pro',
        name: 'gemini-2.5-pro',
        vendor: 'Custom',
        url: 'https://api.aionly.com/v1/chat/completions',
        apiKey: 'sk-key',
        supportsToolCall: true,
        supportsImages: false,
        supportsReasoning: false,
        useCustomProtocol: false
      },
      {
        id: 'deepseek-v4-flash',
        name: 'deepseek-v4-flash',
        vendor: 'Custom',
        url: 'https://llm.aiionly.com/v1/chat/completions',
        apiKey: 'tk-key',
        supportsToolCall: true,
        supportsImages: false,
        supportsReasoning: true,
        useCustomProtocol: false,
        reasoning: { defaultEffort: 'max', supportedEfforts: ['max', 'xhigh', 'low', 'medium', 'high'] }
      },
      {
        id: 'kimi-k3',
        name: 'kimi-k3',
        vendor: 'Custom',
        url: 'https://llm.aiionly.com/v1/chat/completions',
        apiKey: 'tk-key',
        supportsToolCall: true,
        supportsImages: false,
        supportsReasoning: true,
        useCustomProtocol: false,
        reasoning: { supportedEfforts: ['low', 'xhigh', 'max', 'medium', 'high'] }
      },
      {
        id: 'deepseek-v4-pro-0813',
        name: 'deepseek-v4-pro-0813',
        vendor: 'Custom',
        url: 'https://api.aionly.com/v1/chat/completions',
        apiKey: 'sk-key',
        supportsToolCall: true,
        supportsImages: true,
        supportsReasoning: true,
        useCustomProtocol: false,
        maxInputTokens: 65536,
        maxOutputTokens: 65536
      }
    ])

    const parsed = adapter.parse(content)
    const incomplete = parsed.entries.find(({ value }) => value.id === 'gemini-3.1-flash-lite')
    const extended = parsed.entries.find(({ value }) => value.id === 'gpt-5.5')

    expect(parsed.entries).toHaveLength(7)
    expect(incomplete?.value).toMatchObject({
      id: 'gemini-3.1-flash-lite',
      vendor: 'Ollama',
      apiKey: '',
      useCustomProtocol: true
    })
    expect(extended?.unknownFields).toEqual({
      reasoning: { defaultEffort: 'xhigh', canDisableThinking: false },
      maxInputTokens: 262144,
      maxOutputTokens: 65536
    })
  })

  it('builds an AiOnly-named WorkBuddy entry regardless of the route display name', () => {
    expect(adapter.buildEntry(model, 'sk-sentinel-secret', 'https://api.aionly.com/v1/chat/completions')).toEqual({
      id: 'gpt-5',
      name: 'AiOnly',
      vendor: 'Custom',
      url: 'https://api.aionly.com/v1/chat/completions',
      apiKey: 'sk-sentinel-secret',
      supportsToolCall: true,
      supportsImages: false,
      supportsReasoning: true,
      useCustomProtocol: false,
      iconUrl: AIONLY_LOGO_URL
    })
  })

  it('places generated entries first while preserving non-Aionly entries and their order', () => {
    const first = entry('https://manual.example/v1', { id: 'first', extra: { keep: true } })
    const oldManaged = entry('https://api.aionly.com/v1', { apiKey: 'old' })
    const second = entry('https://other.example/v1', { id: 'second' })
    const generated = entry('https://api.aionly.com/v1', { apiKey: 'new' })

    expect(adapter.merge([first, oldManaged, second], [generated])).toEqual([generated, first, second])
  })

  it('prepends a generated entry without replacing a non-Aionly entry with the same model id', () => {
    const external = entry('https://api.deepseek.com/chat/completions', {
      name: 'DeepSeek-V4 Flash',
      vendor: 'DeepSeek'
    })
    const oldManaged = entry('https://api.aionly.com/v1', { apiKey: 'old' })
    const generated = entry('https://api.aionly.com/v1')

    const merged = adapter.merge([oldManaged, external], [generated])

    expect(merged).toEqual([generated, external])
    expect(() => adapter.serialize(merged)).not.toThrow()
  })

  it('replaces an external entry when its model id and URL match a generated entry', () => {
    const external = entry('https://api.aionly.com/v1', {
      name: 'External',
      vendor: 'OpenAI',
      apiKey: 'external-key'
    })
    const generated = entry('https://api.aionly.com/v1', { name: 'AiOnly', apiKey: 'aionly-key' })

    expect(adapter.merge([external], [generated])).toEqual([generated])
  })
})
