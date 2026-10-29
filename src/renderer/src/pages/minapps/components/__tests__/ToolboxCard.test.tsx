import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ToolboxCard from '../ToolboxCard'
import ToolboxSection from '../ToolboxSection'

describe('ToolboxCard', () => {
  it('keeps the whole card as a single button named by its title', () => {
    const onClick = vi.fn()

    render(
      <ToolboxCard icon={<span aria-hidden="true">icon</span>} title="绘画" description="文生图" onClick={onClick} />
    )

    const button = screen.getByRole('button', { name: '绘画' })
    expect(screen.getByText('文生图')).toBeInTheDocument()
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders only the title when no description is supplied', () => {
    render(<ToolboxCard icon={<span />} title="VeryClaw" onClick={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'VeryClaw' }).textContent).toBe('VeryClaw')
  })

  it('shows the trailing arrow on every card, matching the built-in tools', () => {
    render(<ToolboxCard icon={<span />} title="智能体" description="配置专属智能体" />)

    const button = screen.getByRole('button', { name: '智能体' })
    expect(button.querySelector('svg')).not.toBeNull()
    expect(screen.getByText('配置专属智能体')).toBeInTheDocument()
  })

  it('keeps the same arrow layout for cards without a description', () => {
    render(<ToolboxCard icon={<span />} title="小程序" />)

    expect(screen.getByRole('button', { name: '小程序' }).querySelector('svg')).not.toBeNull()
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

  it('uses the same column width for every section so all cards share one size', () => {
    render(
      <>
        <ToolboxSection title="小程序">
          <div>entry</div>
        </ToolboxSection>
        <ToolboxSection title="内置工具">
          <div>entry</div>
          <div>entry-2</div>
        </ToolboxSection>
      </>
    )

    for (const name of ['小程序', '内置工具']) {
      expect(screen.getByRole('list', { name })).toHaveStyle({
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'
      })
    }
  })

  it('exposes the entry count next to the heading', () => {
    render(
      <ToolboxSection title="扩展应用">
        <div>one</div>
        <div>two</div>
      </ToolboxSection>
    )

    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('falls back to the given placeholder when the section has no entries', () => {
    render(
      <ToolboxSection title="小程序" emptyText="暂无可用的小程序">
        {[]}
      </ToolboxSection>
    )

    expect(screen.getByRole('list', { name: '小程序' })).toBeInTheDocument()
    expect(screen.getByText('暂无可用的小程序')).toBeInTheDocument()
  })
})
