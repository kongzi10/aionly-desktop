import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HomeAnnouncements from '../HomeAnnouncements'
import type { HomeContentItem } from '../homeContent'

const ticker: HomeContentItem[] = [
  { id: 'one', slot: 'ticker', title: 'First update' },
  { id: 'two', slot: 'ticker', title: 'Second update' }
]
const announcements: HomeContentItem[] = [
  {
    id: 'notice',
    slot: 'announcement',
    title: 'Model launch',
    action: { type: 'route', target: '/settings/model' }
  }
]

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('HomeAnnouncements', () => {
  it('rotates ticker content while keeping announcements available', () => {
    render(<HomeAnnouncements ticker={ticker} announcements={announcements} onAction={vi.fn()} />)

    expect(screen.getByText('First update')).toBeInTheDocument()
    expect(screen.getByText('Model launch')).toBeInTheDocument()
    void act(() => vi.advanceTimersByTime(5000))
    expect(screen.getByText('Second update')).toBeInTheDocument()
  })

  it('opens a configured announcement action', () => {
    const onAction = vi.fn()
    render(<HomeAnnouncements ticker={[]} announcements={announcements} onAction={onAction} />)

    fireEvent.click(screen.getByRole('button', { name: 'Model launch' }))
    expect(onAction).toHaveBeenCalledWith({ type: 'route', target: '/settings/model' })
  })

  it('leaves no empty notice region when nothing is published', () => {
    const { container } = render(<HomeAnnouncements ticker={[]} announcements={[]} onAction={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('rotates published announcements in the second row', () => {
    render(
      <HomeAnnouncements
        ticker={ticker.slice(0, 1)}
        announcements={[...announcements, { id: 'next', slot: 'announcement', title: 'Second notice' }]}
        onAction={vi.fn()}
      />
    )

    expect(screen.getByText('Model launch')).toBeInTheDocument()
    void act(() => vi.advanceTimersByTime(6000))
    expect(screen.getByText('Second notice')).toBeInTheDocument()
    expect(screen.queryByText('Model launch')).not.toBeInTheDocument()
  })
})
