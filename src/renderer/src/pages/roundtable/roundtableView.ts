import type { MultiModelMessageStyle } from '@renderer/store/settings'

export const getRoundtableMessageStyle = (
  _preferredStyle: MultiModelMessageStyle,
  messageCount: number
): MultiModelMessageStyle => (messageCount > 1 ? 'horizontal' : 'fold')

export const getRoundtableWelcomeKey = () => 'roundtable.welcome' as const

export const getRoundtableCardClassName = (_style: MultiModelMessageStyle, messageCount: number) =>
  messageCount > 1 ? 'roundtable-response-card' : undefined
