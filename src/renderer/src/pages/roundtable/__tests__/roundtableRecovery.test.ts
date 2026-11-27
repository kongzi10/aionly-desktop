import type { Assistant, Topic } from '@renderer/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    })
  }
}))

vi.mock('@renderer/services/AssistantService', () => ({
  getDefaultTopic: (assistantId: string) => ({ id: `${assistantId}-default-topic`, name: '新对话', messages: [] })
}))

import { computeRoundtableTopicRecovery, isUsedTopic } from '../roundtableRecovery'

const topic = (id: string, overrides: Partial<Topic> = {}): Topic =>
  ({ id, name: id, messages: [], ...overrides }) as Topic

const assistantWith = (id: string, topics: Topic[]): Assistant =>
  ({ id, name: id, prompt: '', topics, type: 'assistant', workspace: 'roundtable' }) as Assistant

describe('isUsedTopic', () => {
  it('treats topics with messages / renamed / pinned / prompted as used', () => {
    expect(isUsedTopic(topic('t1', { messages: [{ id: 'm' }] as unknown as Topic['messages'] }))).toBe(true)
    expect(isUsedTopic(topic('t2', { isNameManuallyEdited: true }))).toBe(true)
    expect(isUsedTopic(topic('t3', { pinned: true }))).toBe(true)
    expect(isUsedTopic(topic('t4', { prompt: 'p' }))).toBe(true)
  })

  it('treats untouched default topics as unused', () => {
    expect(isUsedTopic(topic('t5'))).toBe(false)
  })
})

describe('computeRoundtableTopicRecovery', () => {
  let carrier: Assistant

  beforeEach(() => {
    carrier = assistantWith('carrier', [topic('carrier-topic')])
  })

  it('returns no patches when roles only hold untouched default topics', () => {
    const role = assistantWith('role', [topic('role-default')])
    const result = computeRoundtableTopicRecovery(carrier, [role])
    expect(result.patches).toEqual([])
    expect(result.movedCount).toBe(0)
  })

  it('moves used topics to the carrier and rewrites assistantId', () => {
    const used = topic('used', { messages: [{ id: 'm1' }] as unknown as Topic['messages'] })
    const role = assistantWith('role', [topic('role-default'), used])
    const result = computeRoundtableTopicRecovery(carrier, [role])

    expect(result.movedCount).toBe(1)
    const carrierPatch = result.patches.find((p) => p.assistantId === 'carrier')
    expect(carrierPatch?.topics.map((t) => t.id)).toEqual(['carrier-topic', 'used'])
    expect(carrierPatch?.topics[1].assistantId).toBe('carrier')
    const rolePatch = result.patches.find((p) => p.assistantId === 'role')
    expect(rolePatch?.topics.map((t) => t.id)).toEqual(['role-default'])
  })

  it('resets role topics to a fresh default when all topics were moved', () => {
    const role = assistantWith('role', [topic('used', { isNameManuallyEdited: true })])
    const result = computeRoundtableTopicRecovery(carrier, [role])

    expect(result.movedCount).toBe(1)
    const rolePatch = result.patches.find((p) => p.assistantId === 'role')
    expect(rolePatch?.topics.map((t) => t.id)).toEqual(['role-default-topic'])
  })

  it('aggregates moved topics from multiple roles into a single carrier patch', () => {
    const roleA = assistantWith('role-a', [topic('used-a', { pinned: true })])
    const roleB = assistantWith('role-b', [topic('used-b', { prompt: 'x' }), topic('kept-b')])
    const result = computeRoundtableTopicRecovery(carrier, [roleA, roleB])

    expect(result.movedCount).toBe(2)
    const carrierPatch = result.patches.find((p) => p.assistantId === 'carrier')
    expect(carrierPatch?.topics.map((t) => t.id)).toEqual(['carrier-topic', 'used-a', 'used-b'])
    const roleAPatch = result.patches.find((p) => p.assistantId === 'role-a')
    expect(roleAPatch?.topics.map((t) => t.id)).toEqual(['role-a-default-topic'])
    const roleBPatch = result.patches.find((p) => p.assistantId === 'role-b')
    expect(roleBPatch?.topics.map((t) => t.id)).toEqual(['kept-b'])
  })

  it('does not mutate input assistants', () => {
    const used = topic('used', { messages: [{ id: 'm1' }] as unknown as Topic['messages'] })
    const role = assistantWith('role', [used])
    computeRoundtableTopicRecovery(carrier, [role])
    expect(role.topics.map((t) => t.id)).toEqual(['used'])
    expect(carrier.topics.map((t) => t.id)).toEqual(['carrier-topic'])
  })
})
