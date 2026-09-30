import type { Message } from '@renderer/types/newMessage'

export const getAllMessagesForCapture = (messages: Message[]): Message[] => messages.toReversed()

export const hasMultiModelMessageGroup = (messages: Message[]): boolean => {
  const assistantCountsByAskId = new Map<string, number>()

  for (const message of messages) {
    if (message.role !== 'assistant' || !message.askId) continue
    assistantCountsByAskId.set(message.askId, (assistantCountsByAskId.get(message.askId) ?? 0) + 1)
  }

  return [...assistantCountsByAskId.values()].some((count) => count > 1)
}
