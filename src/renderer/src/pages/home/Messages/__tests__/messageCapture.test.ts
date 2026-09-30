import type { Message } from '@renderer/types/newMessage'
import { describe, expect, it } from 'vitest'

import { getAllMessagesForCapture, hasMultiModelMessageGroup } from '../messageCapture'

describe('getAllMessagesForCapture', () => {
  it('includes all messages in the same newest-first order used by the conversation view', () => {
    const messages = Array.from({ length: 30 }, (_, index) => ({ id: `message-${index}` }) as Message)

    const capturedMessages = getAllMessagesForCapture(messages)

    expect(capturedMessages).toHaveLength(messages.length)
    expect(capturedMessages[0]).toBe(messages.at(-1))
    expect(capturedMessages.at(-1)).toBe(messages[0])
  })

  it('detects multiple assistant responses to the same message', () => {
    const messages = [
      { id: 'response-a', role: 'assistant', askId: 'request-1' },
      { id: 'response-b', role: 'assistant', askId: 'request-1' },
      { id: 'response-c', role: 'assistant', askId: 'request-2' }
    ] as Message[]

    expect(hasMultiModelMessageGroup(messages)).toBe(true)
    expect(hasMultiModelMessageGroup([messages[0]])).toBe(false)
  })
})
