import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { RouteModelTypes } from '../RouteCapabilities'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

describe('RouteModelTypes', () => {
  it('shows all model types in the editor and marks unavailable types inactive', () => {
    render(<RouteModelTypes modelTypes={['function_calling', 'web_search']} />)

    expect(screen.getByText('agentRouter.modelTypes')).toBeInTheDocument()
    expect(screen.getByText('models.type.vision').closest('[data-inactive]')).toHaveAttribute('data-inactive', 'true')
    expect(screen.getByText('models.type.websearch').closest('[data-inactive]')).toHaveAttribute(
      'data-inactive',
      'false'
    )
    expect(screen.getByText('models.type.reasoning')).toBeInTheDocument()
    expect(screen.getByText('models.type.function_calling')).toBeInTheDocument()
    expect(screen.getByText('models.type.rerank')).toBeInTheDocument()
    expect(screen.getByText('models.type.embedding')).toBeInTheDocument()
  })

  it('does not show a warning icon beside the model types heading', () => {
    render(<RouteModelTypes modelTypes={[]} />)

    expect(screen.queryByTestId('model-type-warning')).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Information' })).not.toBeInTheDocument()
  })

  it('shows every model type inactive when the API returned no model types', () => {
    render(<RouteModelTypes modelTypes={[]} />)

    expect(screen.getAllByTestId('model-type-tag')).toHaveLength(6)
    expect(screen.getAllByTestId('model-type-tag').every((tag) => tag.dataset.inactive === 'true')).toBe(true)
    expect(screen.queryByText('agentRouter.modelTypesUnavailable')).not.toBeInTheDocument()
  })

  it('shows only active tags without a heading in compact lists', () => {
    render(<RouteModelTypes compact modelTypes={['vision', 'reasoning']} />)

    expect(screen.queryByText('agentRouter.modelTypes')).not.toBeInTheDocument()
    expect(screen.getByText('models.type.vision')).toBeInTheDocument()
    expect(screen.getByText('models.type.reasoning')).toBeInTheDocument()
    expect(screen.queryByText('models.type.websearch')).not.toBeInTheDocument()
  })
})
