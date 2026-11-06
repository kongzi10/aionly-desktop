import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { HomePushItem } from '../homeContent'
import HomeMascot, { resetCartoonPushDismissed } from '../HomeMascot'

const promotion: HomePushItem = {
  id: 'gift',
  pushType: 'cartoon',
  title: 'New user gift',
  description: 'Open a model to claim it',
  buttonText: 'View now',
  buttonUrl: '/settings/model'
}

const second: HomePushItem = {
  id: 'sale',
  pushType: 'cartoon',
  title: 'Mid-autumn sale',
  description: 'DeepSeek series 20% off',
  buttonText: 'Join now',
  buttonUrl: '/tokenPlan'
}

describe('HomeMascot', () => {
  beforeEach(() => {
    resetCartoonPushDismissed()
  })

  it('opens when content arrives, closes permanently for that item, and runs its configured action', () => {
    const onAction = vi.fn()
    const { rerender } = render(<HomeMascot items={[]} onAction={onAction} />)
    rerender(<HomeMascot items={[promotion]} onAction={onAction} />)

    expect(screen.getByText('Open a model to claim it')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'View now' }))
    expect(onAction).toHaveBeenCalledWith({ type: 'route', target: '/settings/model' }, promotion)

    fireEvent.click(screen.getByRole('button', { name: 'homeLanding.closeCartoonPush' }))
    expect(screen.queryByText('Open a model to claim it')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('stays closed across remounts within the session, simulating route switches', () => {
    const first = render(<HomeMascot items={[promotion]} onAction={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'homeLanding.closeCartoonPush' }))
    first.unmount()

    // 模拟切换菜单后回到首页：组件重挂载且推送数据重新到达，气泡不应再弹出
    render(<HomeMascot items={[promotion]} onAction={vi.fn()} />)
    expect(screen.queryByText('Open a model to claim it')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('keeps the mascot without a promotion when the API returns nothing', () => {
    render(<HomeMascot items={[]} onAction={vi.fn()} />)
    expect(screen.getByRole('img', { name: 'AiOnly' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('switches slides by dot and auto carousel', () => {
    vi.useFakeTimers()
    render(<HomeMascot items={[promotion, second]} onAction={vi.fn()} />)

    const firstDot = screen.getByRole('button', { name: promotion.title })
    const secondDot = screen.getByRole('button', { name: second.title })
    expect(firstDot).toHaveClass('active')
    expect(screen.getByRole('button', { name: 'View now' })).toBeInTheDocument()

    // 自动轮播：4s 后切到第二条，行动按钮文案同步更新
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(secondDot).toHaveClass('active')
    expect(firstDot).not.toHaveClass('active')
    expect(screen.getByRole('button', { name: 'Join now' })).toBeInTheDocument()

    // 圆点手动切回第一条
    fireEvent.click(firstDot)
    expect(firstDot).toHaveClass('active')
    expect(secondDot).not.toHaveClass('active')
    vi.useRealTimers()
  })
})
