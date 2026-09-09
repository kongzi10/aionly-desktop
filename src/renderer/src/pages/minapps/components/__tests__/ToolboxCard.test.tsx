import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ToolboxCard from '../ToolboxCard'
import ToolboxSection from '../ToolboxSection'

describe('ToolboxCard', () => {
  it('exposes the whole card as a named button without secondary copy', () => {
    const onClick = vi.fn()

    render(
      <ToolboxCard
        icon={<span aria-hidden="true">icon</span>}
        title="绘画"
        onClick={onClick}
        {...({ description: 'AI 图像创作' } as Record<string, string>)}
      />
    )

    const button = screen.getByRole('button', { name: '绘画' })
    expect(screen.queryByText('AI 图像创作')).not.toBeInTheDocument()
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('prevents interaction while busy', () => {
    const onClick = vi.fn()

    render(<ToolboxCard icon={<span />} title="VeryClaw" onClick={onClick} busy />)

    const button = screen.getByRole('button', { name: 'VeryClaw' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('ToolboxSection', () => {
  it('labels its card grid with the visible section heading', () => {
    render(
      <ToolboxSection title="内置工具">
        <div>entry</div>
      </ToolboxSection>
    )

    const heading = screen.getByRole('heading', { name: '内置工具' })
    expect(screen.getByRole('list', { name: '内置工具' })).toHaveAttribute('aria-labelledby', heading.id)
  })

  it('keeps card columns at a stable width when the container grows', () => {
    render(
      <ToolboxSection title="小程序">
        <div>entry</div>
      </ToolboxSection>
    )

    expect(screen.getByRole('list', { name: '小程序' })).toHaveStyle({
      gridTemplateColumns: 'repeat(auto-fill, 280px)'
    })
  })
})
