import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import HomeAnnouncements from '../HomeAnnouncements'
import type { HomePushItem } from '../homeContent'

const items: HomePushItem[] = [
  { id: 'one', pushType: 'top_loop', content: 'First update' },
  { id: 'two', pushType: 'top_loop', content: 'Second update' },
  { id: 'three', pushType: 'top_loop', content: 'Third update' }
]

describe('HomeAnnouncements', () => {
  it('renders every published item in the given order with a duplicate loop for seamless scrolling', () => {
    render(<HomeAnnouncements items={items} />)

    const region = screen.getByLabelText('homeLanding.announcements')
    expect(within(region).getAllByText('First update')).toHaveLength(2)
    expect(within(region).getAllByText('Second update')).toHaveLength(2)
    expect(within(region).getAllByText('Third update')).toHaveLength(2)
    expect(region.querySelector('.repeat')).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows one notice once and leaves no region for an empty list', () => {
    const { rerender } = render(<HomeAnnouncements items={items.slice(0, 1)} />)
    expect(screen.getAllByText('First update')).toHaveLength(1)

    rerender(<HomeAnnouncements items={[]} />)
    expect(screen.queryByLabelText('homeLanding.announcements')).not.toBeInTheDocument()
  })
})
