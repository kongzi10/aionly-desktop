import { describe, expect, it } from 'vitest'

import { getRoundtableCardClassName, getRoundtableMessageStyle, getRoundtableWelcomeKey } from '../roundtableView'

describe('roundtable view policy', () => {
  it('always presents multi-model responses as horizontal cards', () => {
    expect(getRoundtableMessageStyle('fold', 4)).toBe('horizontal')
    expect(getRoundtableMessageStyle('grid', 2)).toBe('horizontal')
  })

  it('keeps single messages in the normal compact layout', () => {
    expect(getRoundtableMessageStyle('horizontal', 1)).toBe('fold')
  })

  it('uses the dedicated roundtable welcome copy', () => {
    expect(getRoundtableWelcomeKey()).toBe('roundtable.welcome')
  })

  it.each(['horizontal', 'vertical', 'grid', 'fold'] as const)(
    'marks %s multi-model responses as comparison cards',
    (style) => {
      expect(getRoundtableCardClassName(style, 2)).toBe('roundtable-response-card')
    }
  )

  it('keeps single-model responses in the normal message style', () => {
    expect(getRoundtableCardClassName('fold', 1)).toBeUndefined()
  })
})
