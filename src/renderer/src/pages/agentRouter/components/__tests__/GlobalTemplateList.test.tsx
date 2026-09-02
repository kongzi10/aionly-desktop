import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { GlobalTemplateList } from '../GlobalTemplateList'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

describe('GlobalTemplateList', () => {
  it('shows redacted templates with delete but no edit action', () => {
    const onDelete = vi.fn()
    render(
      <GlobalTemplateList
        templates={[
          {
            templateId: 'one',
            modelId: 'gpt-5',
            displayName: 'Custom display name',
            accessMode: 'api',
            modelTypes: ['function_calling'],
            createdAt: 'now',
            maskedKey: '••••1234'
          }
        ]}
        onDelete={onDelete}
      />
    )
    expect(screen.getByText('••••1234')).toBeInTheDocument()
    expect(screen.getByText('gpt-5')).toBeInTheDocument()
    expect(screen.queryByText('Custom display name')).not.toBeInTheDocument()
    expect(screen.getByText('models.type.function_calling')).toBeInTheDocument()
    expect(screen.queryByText('agentRouter.modelTypes')).not.toBeInTheDocument()
    expect(screen.queryByText('agentRouter.edit')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'agentRouter.deleteGlobalTemplate' }))
    expect(onDelete).toHaveBeenCalledWith('one')
  })
})
