import { describe, expect, it } from 'vitest'

import { getRoundtableMessageStyle, getRoundtableWelcomeKey } from '../roundtableView'

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
})
