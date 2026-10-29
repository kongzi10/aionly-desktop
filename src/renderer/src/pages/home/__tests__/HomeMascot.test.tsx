import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { HomePushItem } from '../homeContent'
import HomeMascot from '../HomeMascot'

const promotion: HomePushItem = {
  id: 'gift',
  pushType: 'cartoon',
  title: 'New user gift',
  description: 'Open a model to claim it',
  buttonText: 'View now',
  buttonUrl: '/settings/model'
}

describe('HomeMascot', () => {
  it('opens when content arrives, closes permanently for that item, and runs its configured action', () => {
    const onAction = vi.fn()
    const { rerender } = render(<HomeMascot promotion={null} onAction={onAction} />)
    rerender(<HomeMascot promotion={promotion} onAction={onAction} />)

    expect(screen.getByText('Open a model to claim it')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'View now' }))
    expect(onAction).toHaveBeenCalledWith({ type: 'route', target: '/settings/model' })

    fireEvent.click(screen.getByRole('button', { name: 'homeLanding.closeCartoonPush' }))
    expect(screen.queryByText('Open a model to claim it')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('keeps the mascot without a promotion when the API returns nothing', () => {
    render(<HomeMascot promotion={null} onAction={vi.fn()} />)
    expect(screen.getByRole('img', { name: 'AiOnly' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
