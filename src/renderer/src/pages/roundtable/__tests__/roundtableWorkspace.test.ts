import type { Assistant } from '@renderer/types'
import { describe, expect, it } from 'vitest'

import {
  filterAssistantsByWorkspace,
  getAssistantWorkspace,
  pickRoundtableCarrier,
  replaceWorkspaceAssistants
} from '../roundtableWorkspace'

const assistant = (id: string, workspace?: Assistant['workspace']): Assistant =>
  ({ id, name: id, prompt: '', topics: [], type: 'assistant', workspace }) as Assistant

describe('roundtable workspace isolation', () => {
  it('treats legacy assistants as normal chat assistants', () => {
    expect(getAssistantWorkspace(assistant('legacy'))).toBe('chat')
  })

  it('filters assistants by workspace', () => {
    const assistants = [assistant('legacy'), assistant('chat', 'chat'), assistant('roundtable', 'roundtable')]

    expect(filterAssistantsByWorkspace(assistants, 'chat').map(({ id }) => id)).toEqual(['legacy', 'chat'])
    expect(filterAssistantsByWorkspace(assistants, 'roundtable').map(({ id }) => id)).toEqual(['roundtable'])
  })

  it('reorders one workspace without changing assistants from the other workspace', () => {
    const chatA = assistant('chat-a')
    const roundtableA = assistant('roundtable-a', 'roundtable')
    const chatB = assistant('chat-b', 'chat')
    const roundtableB = assistant('roundtable-b', 'roundtable')

    const result = replaceWorkspaceAssistants(
      [chatA, roundtableA, chatB, roundtableB],
      [roundtableB, roundtableA],
      'roundtable'
    )

    expect(result).toEqual([chatA, roundtableB, chatB, roundtableA])
  })
})

describe('pickRoundtableCarrier', () => {
  it('returns undefined for empty list', () => {
    expect(pickRoundtableCarrier([], 'any')).toBeUndefined()
  })

  it('prefers the persisted id when present', () => {
    // addAssistant 头插 ⇒ 数组头部是最新角色，持久化 id 必须优先于顺序兜底
    const carrier = assistant('carrier', 'roundtable')
    const role = assistant('role', 'roundtable')
    expect(pickRoundtableCarrier([role, carrier], 'carrier')).toBe(carrier)
  })

  it('falls back to the oldest (last) assistant when persisted id is missing or stale', () => {
    const carrier = assistant('carrier', 'roundtable')
    const roleNew = assistant('role-new', 'roundtable')
    const roleOld = assistant('role-old', 'roundtable')
    expect(pickRoundtableCarrier([roleNew, roleOld, carrier], undefined)).toBe(carrier)
    expect(pickRoundtableCarrier([roleNew, roleOld, carrier], 'deleted')).toBe(carrier)
  })

  it('returns the only assistant when list has one item', () => {
    const carrier = assistant('carrier', 'roundtable')
    expect(pickRoundtableCarrier([carrier], undefined)).toBe(carrier)
  })
})
