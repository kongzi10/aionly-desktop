import type { Assistant } from '@renderer/types'
import { describe, expect, it } from 'vitest'

import { filterAssistantsByWorkspace, getAssistantWorkspace, replaceWorkspaceAssistants } from '../roundtableWorkspace'

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
