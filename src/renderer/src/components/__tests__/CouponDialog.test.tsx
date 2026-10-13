import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CouponDialog } from '../CouponDialog'

const { getNewcomerGift, activeByCode } = vi.hoisted(() => ({
  getNewcomerGift: vi.fn(),
  activeByCode: vi.fn()
}))

vi.mock('@renderer/api/coupon', () => ({ getNewcomerGift, activeByCode }))
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
  activeByCode.mockResolvedValue({ data: 1 })
  Object.assign(window, { toast: { success: vi.fn(), error: vi.fn() } })
})

describe('CouponDialog', () => {
  it('only submits the newcomer gift code after the user clicks accept', async () => {
    render(<CouponDialog />)
    const accept = await screen.findByRole('button', { name: 'coupon.accept' })
    expect(activeByCode).not.toHaveBeenCalled()

    fireEvent.click(accept)

    await waitFor(() => expect(activeByCode).toHaveBeenCalledWith({ code: 'GIFT-123', takeAll: 1 }))
    await waitFor(() => expect(window.toast.success).toHaveBeenCalledWith('coupon.claimSuccess'))
    expect(screen.queryByRole('button', { name: 'coupon.accept' })).not.toBeInTheDocument()
  })

  it('keeps the dialog open when the claim limit is reached', async () => {
    activeByCode.mockResolvedValue({ data: -2 })
    render(<CouponDialog />)

    fireEvent.click(await screen.findByRole('button', { name: 'coupon.accept' }))

    await waitFor(() => expect(window.toast.error).toHaveBeenCalledWith('coupon.limitExceeded'))
    expect(screen.getByRole('button', { name: 'coupon.accept' })).toBeInTheDocument()
    expect(window.toast.success).not.toHaveBeenCalled()
  })

  it('does not show a dialog when no newcomer gift is available', async () => {
    getNewcomerGift.mockResolvedValue({ data: null })
    render(<CouponDialog />)

    await waitFor(() => expect(getNewcomerGift).toHaveBeenCalledOnce())
    expect(screen.queryByRole('button', { name: 'coupon.accept' })).not.toBeInTheDocument()
  })
})
