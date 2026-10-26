import { afterEach, describe, expect, it } from 'vitest'

import { isOnHomePage } from '../window'

afterEach(() => {
  window.location.hash = ''
})

describe('isOnHomePage', () => {
  it('treats the conversation route as the visible chat page', () => {
    window.location.hash = '#/chat'
    expect(isOnHomePage()).toBe(true)
  })

  it('does not treat the new landing route as a visible conversation', () => {
    window.location.hash = '#/'
    expect(isOnHomePage()).toBe(false)
  })
})
