import type { Painting } from '@renderer/types'
import { render } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { describe, expect, it, vi } from 'vitest'

import PaintingsList from '../PaintingsList'

vi.mock('@renderer/components/DraggableList', () => ({
  DraggableList: ({ list, children }: { list: Painting[]; children: (item: Painting) => React.ReactNode }) => (
    <div>
      {list.map((item) => (
        <div key={item.id}>{children(item)}</div>
      ))}
    </div>
  )
}))

vi.mock('@renderer/components/Scrollbar', () => ({
  default: ({ children, ...props }: PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
    <div {...props}>{children}</div>
  )
}))

vi.mock('@renderer/hooks/usePaintings', () => ({
  usePaintings: () => ({ updatePaintings: vi.fn() })
}))

vi.mock('@renderer/services/FileManager', () => ({
  default: { getFileUrl: () => 'file:///generated.png' }
}))

describe('PaintingsList', () => {
  it('shows generated paintings without rendering empty drafts as placeholders', () => {
    const draft: Painting = { id: 'draft', files: [], urls: [] }
    const generated: Painting = {
      id: 'generated',
      files: [{ id: 'file', name: 'generated.png', ext: '.png' } as Painting['files'][number]],
      urls: ['https://example.com/generated.png']
    }

    const { container } = render(
      <PaintingsList
        paintings={[draft, generated]}
        selectedPainting={draft}
        onSelectPainting={vi.fn()}
        onDeletePainting={vi.fn()}
        onNewPainting={vi.fn()}
        namespace="openai_image_generate"
      />
    )

    expect(container.querySelectorAll('.anticon-delete')).toHaveLength(1)
    expect(container.querySelectorAll('img')).toHaveLength(1)
  })
})
