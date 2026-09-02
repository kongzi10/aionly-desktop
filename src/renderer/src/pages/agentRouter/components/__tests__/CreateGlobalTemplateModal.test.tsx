import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CreateGlobalTemplateModal } from '../CreateGlobalTemplateModal'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

beforeEach(() => {
  const originalGetComputedStyle = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => originalGetComputedStyle(element))
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })
  })
})

describe('CreateGlobalTemplateModal', () => {
  it('copies model types from the selected queried model without editable controls', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(
      <CreateGlobalTemplateModal
        open
        apiCredentials={[{ id: 'key-1', kind: 'api', label: '生图', value: 'sk-secret-1234' }]}
        tokenPlanCredentials={[]}
        apiModels={[{ id: 'gpt-5', name: 'GPT-5', modelTypes: ['function_calling', 'reasoning'] }]}
        tokenPlanModels={[]}
        onCancel={vi.fn()}
        onCreate={onCreate}
      />
    )
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('agentRouter.displayName')).not.toBeInTheDocument()
    fireEvent.mouseDown(screen.getAllByRole('combobox')[1])
    fireEvent.click(await screen.findByText('生图'))
    expect(screen.getByText('••••••••••••••••••••••••')).toBeInTheDocument()
    expect(screen.queryByText('agentRouter.apiKeyStoredLocally')).not.toBeInTheDocument()
    fireEvent.mouseDown(screen.getAllByRole('combobox')[2])
    fireEvent.click((await screen.findAllByText('gpt-5')).at(-1)!)
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: 'gpt-5',
          apiKey: 'sk-secret-1234',
          modelTypes: ['function_calling', 'reasoning']
        })
      )
    )
  })
})
