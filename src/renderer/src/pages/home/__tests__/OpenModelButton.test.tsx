import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import OpenModelButton from '../Inputbar/OpenModelButton'

const mocks = vi.hoisted(() => ({
  show: vi.fn(),
  setupModels: vi.fn()
}))

vi.mock('@renderer/pages/settings/ProviderSettings/AiOnlyModel/add/AddModelPopup', () => ({
  default: { show: mocks.show }
}))

vi.mock('@renderer/hooks/useAiOnlyModels', () => ({
  useFetchAndSetupModels: () => mocks.setupModels
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

describe('OpenModelButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.show.mockResolvedValue({ success: true, modelIds: ['model-1'] })
    mocks.setupModels.mockResolvedValue(undefined)
  })

  it('opens the add-model popup and refreshes models after activation', async () => {
    render(<OpenModelButton />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'homeLanding.modelGuide.action' }))
    })

    expect(mocks.show).toHaveBeenCalledWith({})
    expect(mocks.setupModels).toHaveBeenCalledWith(10)
  })

  it('does not refresh models when the popup is dismissed', async () => {
    mocks.show.mockResolvedValue({})
    render(<OpenModelButton />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    expect(mocks.show).toHaveBeenCalledOnce()
    expect(mocks.setupModels).not.toHaveBeenCalled()
  })
})
