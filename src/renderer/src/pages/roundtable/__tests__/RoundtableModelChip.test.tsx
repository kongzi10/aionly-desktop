import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import RoundtableModelChip from '../RoundtableModelChip'

describe('RoundtableModelChip', () => {
  it('matches the roundtable selector structure and exposes both actions', () => {
    const onOpen = vi.fn()
    const onRemove = vi.fn()

    render(
      <RoundtableModelChip
        logo="model-logo.png"
        name="Qwen/Qwen3-8B"
        removeLabel="remove"
        onOpen={onOpen}
        onRemove={onRemove}
      />
    )

    expect(screen.getByRole('img')).toHaveAttribute('src', 'model-logo.png')
    expect(screen.getByText('Qwen/Qwen3-8B')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Qwen/Qwen3-8B' }))
    fireEvent.click(screen.getByRole('button', { name: 'remove' }))

    expect(onOpen).toHaveBeenCalledOnce()
    expect(onRemove).toHaveBeenCalledOnce()
  })
})
