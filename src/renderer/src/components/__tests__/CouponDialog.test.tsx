import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CouponDialog } from '../CouponDialog'

const { getNewcomerGift, updateSelectStatus } = vi.hoisted(() => ({
  getNewcomerGift: vi.fn(),
  updateSelectStatus: vi.fn()
}))

vi.mock('@renderer/api/coupon', () => ({ getNewcomerGift, updateSelectStatus }))
vi.mock('@renderer/store', () => ({ useAppSelector: () => ({ userId: 'user-1' }) }))
vi.mock('@renderer/store/user', () => ({ selectUserInfo: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('antd', () => ({
  Modal: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? children : null)
}))

const voucher = {
  code: 'GIFT-123',
  voucherName: 'Welcome gift',
  parValue: '5.00',
  useThresholdType: '0',
  useThreshold: '0.00'
}

beforeEach(() => {
  vi.clearAllMocks()
  getNewcomerGift.mockResolvedValue({ data: voucher })
  updateSelectStatus.mockResolvedValue({})
  Object.assign(window, { toast: { success: vi.fn(), error: vi.fn() } })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('CouponDialog', () => {
  it('updates the newcomer gift display status after five seconds, even if accepted earlier', async () => {
    vi.useFakeTimers()
    await act(async () => {
      render(<CouponDialog />)
    })
    expect(updateSelectStatus).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'coupon.accept' }))
    expect(window.toast.success).toHaveBeenCalledWith('coupon.claimSuccess')
    expect(screen.queryByRole('button', { name: 'coupon.accept' })).not.toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(updateSelectStatus).toHaveBeenCalledWith(voucher)
    expect(updateSelectStatus).toHaveBeenCalledOnce()
  })

  it('does not show a dialog when no newcomer gift is available', async () => {
    getNewcomerGift.mockResolvedValue({ data: null })
    render(<CouponDialog />)

    await waitFor(() => expect(getNewcomerGift).toHaveBeenCalledOnce())
    expect(screen.queryByRole('button', { name: 'coupon.accept' })).not.toBeInTheDocument()
    expect(updateSelectStatus).not.toHaveBeenCalled()
  })
})
