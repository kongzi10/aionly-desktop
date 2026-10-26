import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ModelGuidance from '../ModelGuidance'

describe('ModelGuidance', () => {
  it('guides a checked user with no usable model to model setup', () => {
    const onOpenModels = vi.fn()
    render(<ModelGuidance modelsReady hasModel={false} onOpenModels={onOpenModels} />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    expect(onOpenModels).toHaveBeenCalledOnce()
  })

  it('does not interrupt loading or a user with models', () => {
    const { rerender } = render(<ModelGuidance modelsReady={false} hasModel={false} onOpenModels={vi.fn()} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    rerender(<ModelGuidance modelsReady hasModel onOpenModels={vi.fn()} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
