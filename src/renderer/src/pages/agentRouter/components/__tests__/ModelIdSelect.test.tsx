import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ModelIdSelect } from '../ModelIdSelect'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })
  })
})
const models = [
  { id: 'gpt-5', name: 'GPT', modelTypes: [] },
  { id: 'claude-sonnet', name: 'Claude', modelTypes: [] }
]

describe('ModelIdSelect', () => {
  it('searches and selects in a separate dialog, committing only on confirm', async () => {
    const onChange = vi.fn()
    render(<ModelIdSelect models={models} value={['gpt-5']} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /agentRouter.selectedModels/ }))
    const picker = screen.getByRole('dialog', { name: 'agentRouter.selectModels' })
    expect(within(picker).getByRole('checkbox', { name: 'gpt-5' })).toBeChecked()
    fireEvent.change(within(picker).getByPlaceholderText('agentRouter.searchModelId'), { target: { value: 'CLAUDE' } })
    expect(within(picker).queryByRole('checkbox', { name: 'gpt-5' })).not.toBeInTheDocument()
    fireEvent.click(within(picker).getByRole('checkbox', { name: 'claude-sonnet' }))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(within(picker).getByRole('button', { name: 'common.confirm' }))
    expect(onChange).toHaveBeenCalledWith(['gpt-5', 'claude-sonnet'])
  })
  it('discards draft changes on cancel and restores committed choices on reopening', () => {
    const onChange = vi.fn()
    render(<ModelIdSelect models={models} value={['gpt-5']} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /agentRouter.selectedModels/ }))
    let picker = screen.getByRole('dialog', { name: 'agentRouter.selectModels' })
    fireEvent.click(within(picker).getByRole('checkbox', { name: 'claude-sonnet' }))
    fireEvent.click(within(picker).getByRole('button', { name: 'common.cancel' }))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /agentRouter.selectedModels/ }))
    picker = screen.getByRole('dialog', { name: 'agentRouter.selectModels' })
    expect(within(picker).getByRole('checkbox', { name: 'gpt-5' })).toBeChecked()
    expect(within(picker).getByRole('checkbox', { name: 'claude-sonnet' })).not.toBeChecked()
  })
})
