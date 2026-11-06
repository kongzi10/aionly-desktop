import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import HomeAnnouncements from '../HomeAnnouncements'
import type { HomePushItem } from '../homeContent'

const items: HomePushItem[] = [
  { id: 'one', pushType: 'top_loop', content: 'deepseek-V4-Flash-0731已上架，快去开通体验吧' },
  { id: 'two', pushType: 'top_loop', content: 'qwen3-max已上架，请至设置-模型服务开通体验哦!' },
  { id: 'three', pushType: 'top_loop', content: 'tokenplan 上架了，订阅套餐更灵活' }
]

const renderInRouter = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('HomeAnnouncements', () => {
  it('renders the full dynamic content of the current and next rows', () => {
    renderInRouter(<HomeAnnouncements items={items} />)

    expect(screen.getByText('deepseek-V4-Flash-0731已上架，快去开通体验吧')).toBeInTheDocument()
    expect(screen.getByText('qwen3-max已上架，请至设置-模型服务开通体验哦!')).toBeInTheDocument()
    expect(screen.queryByText('tokenplan 上架了，订阅套餐更灵活')).not.toBeInTheDocument()
    expect(screen.queryByText('homeLanding.announcementSuffix')).not.toBeInTheDocument()
    // 滚轮预渲染当前行与下一行，两行均命中开通关键词，各自携带 CTA（与文案同帧进出）
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('renders the CTA only on rows whose content matches the enable keywords', () => {
    renderInRouter(<HomeAnnouncements items={[items[0], items[2]]} />)
    // 当前行命中关键词带 CTA，下一行（订阅套餐类）仅展示文案
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('shows one static notice once and leaves no region for an empty list', () => {
    const { rerender } = renderInRouter(<HomeAnnouncements items={items.slice(0, 1)} />)
    expect(screen.getAllByText('deepseek-V4-Flash-0731已上架，快去开通体验吧')).toHaveLength(1)
    expect(screen.getByRole('button')).toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <HomeAnnouncements items={[]} />
      </MemoryRouter>
    )
    expect(screen.queryByText('deepseek-V4-Flash-0731已上架，快去开通体验吧')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('hides the activate CTA when the announcement is not about model launch/enablement', () => {
    renderInRouter(
      <HomeAnnouncements
        items={[{ id: 'm', pushType: 'top_loop', content: '系统维护通知：今晚 23:00 进行例行升级' }]}
      />
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('hides the activate CTA for subscription/plan announcements even if they mention a launch', () => {
    renderInRouter(
      <HomeAnnouncements items={[{ id: 's', pushType: 'top_loop', content: 'tokenplan 上架了，订阅套餐更灵活' }]} />
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
