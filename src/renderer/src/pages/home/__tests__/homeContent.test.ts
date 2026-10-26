import { describe, expect, it } from 'vitest'

import { normalizePublishedHomeContent, resolveHomeContentAction } from '../homeContent'

describe('normalizePublishedHomeContent', () => {
  it('keeps active notices in priority order and drops expired content', () => {
    const content = normalizePublishedHomeContent(
      {
        items: [
          { id: 'later', slot: 'announcement', title: 'Later', priority: 2 },
          { id: 'expired', slot: 'announcement', title: 'Expired', endsAt: '2026-10-25T00:00:00Z' },
          { id: 'first', slot: 'announcement', title: 'First', priority: 10 },
          { id: 'avatar', slot: 'avatar', title: 'Avatar offer' },
          { id: 'blank', slot: 'ticker', title: '   ' }
        ]
      },
      Date.parse('2026-10-26T00:00:00Z')
    )

    expect(content.announcements.map((item) => item.id)).toEqual(['first', 'later'])
    expect(content.avatarPromotion?.title).toBe('Avatar offer')
    expect(content.ticker).toEqual([])
  })

  it('returns empty content for malformed or unavailable responses', () => {
    expect(normalizePublishedHomeContent(null)).toEqual({ ticker: [], announcements: [], avatarPromotion: null })
    expect(normalizePublishedHomeContent({ items: 'bad' })).toEqual({
      ticker: [],
      announcements: [],
      avatarPromotion: null
    })
  })
})

describe('resolveHomeContentAction', () => {
  it('accepts known app routes and secure web links', () => {
    expect(resolveHomeContentAction({ type: 'route', target: '/tokenPlan' })).toEqual({
      type: 'route',
      target: '/tokenPlan'
    })
    expect(resolveHomeContentAction({ type: 'url', target: 'https://example.com/offer' })).toEqual({
      type: 'url',
      target: 'https://example.com/offer'
    })
  })

  it('rejects untrusted routes and URL schemes', () => {
    expect(resolveHomeContentAction({ type: 'route', target: '/settings/secret' })).toBeNull()
    expect(resolveHomeContentAction({ type: 'url', target: 'javascript:alert(1)' })).toBeNull()
    expect(resolveHomeContentAction({ type: 'url', target: 'http://example.com' })).toBeNull()
  })
})
