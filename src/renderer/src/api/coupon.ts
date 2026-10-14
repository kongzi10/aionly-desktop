import http from '@renderer/utils/request'

export interface NewcomerGiftVoucher {
  code: string
  voucherName: string
  parValue: string
  useThresholdType: string
  useThreshold: string
}

export const getNewcomerGift = () =>
  http.get('/bus/voucher/getNewcomerGift', null, { cancel: false, loading: false, showError: false }) as Promise<{
    data: NewcomerGiftVoucher | null
  }>

export const updateSelectStatus = (voucher: NewcomerGiftVoucher) =>
  http.post('/bus/voucher/updateSelectStatus', voucher, { cancel: false, loading: false })
