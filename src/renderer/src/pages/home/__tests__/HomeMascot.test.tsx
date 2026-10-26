import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { HomeContentItem } from '../homeContent'
import HomeMascot from '../HomeMascot'

const promotion: HomeContentItem = {
  id: 'gift',
  slot: 'avatar',
  title: 'New user gift',
  description: 'Open a model to claim it',
  action: { type: 'route', target: '/settings/model' }
}

describe('HomeMascot', () => {
  it('reveals managed content beside the mascot and opens its action', () => {
    const onAction = vi.fn()
    render(<HomeMascot promotion={promotion} onAction={onAction} />)

    fireEvent.click(screen.getByRole('button', { name: 'New user gift' }))
    expect(screen.getByText('Open a model to claim it')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /New user gift .+/ }))
    expect(onAction).toHaveBeenCalledWith({ type: 'route', target: '/settings/model' })
  })

  it('keeps the mascot without a misleading promotion when nothing is published', () => {
    render(<HomeMascot promotion={null} onAction={vi.fn()} />)

    expect(screen.getByRole('img', { name: 'AiOnly' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('keeps an automatically opened promotion visible until the user dismisses it', () => {
    render(<HomeMascot promotion={promotion} onAction={vi.fn()} autoOpen />)

    fireEvent.mouseLeave(screen.getByRole('img', { name: 'AiOnly' }).parentElement!)
    expect(screen.getByText('Open a model to claim it')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'New user gift' }))
    expect(screen.queryByText('Open a model to claim it')).not.toBeInTheDocument()
  })
})
