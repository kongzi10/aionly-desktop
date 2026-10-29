import { describe, expect, it } from 'vitest'

import { normalizePushList, resolveHomeContentAction } from '../homeContent'

describe('normalizePushList', () => {
  it('keeps API order and reads top_loop content rather than title', () => {
    const result = normalizePushList(
      {
        code: 200,
        data: [
          { id: '1234567890123456789', pushType: 'top_loop', content: 'First' },
          { id: '2', pushType: 'top_loop', content: 'Second' },
          { id: '3', pushType: 'cartoon', title: 'Wrong type' }
        ]
      },
      'top_loop'
    )
    expect(result.map((item) => item.content)).toEqual(['First', 'Second'])
    expect(result[0].id).toBe('1234567890123456789')
  })

  it('ignores malformed or unsuccessful responses', () => {
    expect(normalizePushList({ code: 500, data: [] }, 'cartoon')).toEqual([])
    expect(normalizePushList({ code: 200, data: [{ id: '1', pushType: 'cartoon' }] }, 'cartoon')).toEqual([])
  })
})

describe('resolveHomeContentAction', () => {
  it('accepts known app routes and secure web links', () => {
    expect(resolveHomeContentAction('/tokenPlan')).toEqual({ type: 'route', target: '/tokenPlan' })
    expect(resolveHomeContentAction('https://example.com/offer')).toEqual({
      type: 'url',
      target: 'https://example.com/offer'
    })
  })

  it('rejects untrusted routes and URL schemes', () => {
    expect(resolveHomeContentAction('/settings/secret')).toBeNull()
    expect(resolveHomeContentAction('javascript:alert(1)')).toBeNull()
    expect(resolveHomeContentAction('http://example.com')).toBeNull()
  })
})
