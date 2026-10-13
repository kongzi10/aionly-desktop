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

export const activeByCode = (params: { code: string; takeAll: 1 }) =>
  http.post('/bus/voucherDetail/activeByCode', params, { cancel: false, loading: false }) as Promise<{ data: number }>
