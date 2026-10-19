import './CouponDialog.css'

import type { NewcomerGiftVoucher } from '@renderer/api/coupon'
import { getNewcomerGift, updateSelectStatus } from '@renderer/api/coupon'
import haloImage from '@renderer/assets/images/couponDialog/couponIcon.png'
import { useAppSelector } from '@renderer/store'
import { selectUserInfo } from '@renderer/store/user'
import { Modal } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export function CouponDialog({ deferUntilTourEnds = false }: { deferUntilTourEnds?: boolean }) {
  const { t } = useTranslation()
  const userInfo = useAppSelector(selectUserInfo)
  const userId = userInfo.userId
  const [voucher, setVoucher] = useState<NewcomerGiftVoucher | null>(null)

  useEffect(() => {
    if (!userId || deferUntilTourEnds) return
    let active = true
    let statusTimer: number | undefined
    void getNewcomerGift()
      .then(({ data }) => {
        if (active && data) {
          setVoucher(data)
          statusTimer = window.setTimeout(() => {
            void updateSelectStatus(data)
          }, 5000)
        }
      })
      .catch(() => {
        if (active) setVoucher(null)
      })
    return () => {
      active = false
      if (statusTimer) clearTimeout(statusTimer)
    }
  }, [userId, deferUntilTourEnds])

  const dismiss = () => {
    setVoucher(null)
  }

  const claim = () => {
    window.toast.success(t('coupon.claimSuccess'))
    dismiss()
  }

  return (
    <Modal
      className="coupon-dialog-modal"
      open={!!voucher && !deferUntilTourEnds}
      onCancel={dismiss}
      footer={null}
      closable={false}
      maskClosable={false}
      destroyOnHidden
      centered
      width={460}>
      {voucher && (
        <div className="coupon-dialog-shell">
          <div className="coupon-dialog">
            <img className="coupon-dialog__halo" src={haloImage} alt="" />
            <h2 className="coupon-dialog__header">
              <span className="coupon-dialog__heading-text">{t('coupon.congratulations')}</span>
              <span className="coupon-dialog__heading-count">1 {t('coupon.unit')}</span>
              <span className="coupon-dialog__heading-text">{t('coupon.voucher')}</span>
            </h2>
            <div className="coupon-dialog__main">
              <div className="coupon-dialog__item">
                <div className="coupon-dialog__count">
                  <span>1</span>
                  <span>{t('coupon.unit')}</span>
                </div>
                <div className="coupon-dialog__value">{voucher.parValue}</div>
                <div className="coupon-dialog__name">
                  <div>
                    {voucher.useThresholdType === '0'
                      ? t('coupon.noThreshold')
                      : t('coupon.threshold', { threshold: voucher.useThreshold, discount: voucher.parValue })}
                  </div>
                  <div className="coupon-dialog__gift">{t('coupon.newcomerGift')}</div>
                </div>
              </div>
              <button className="coupon-dialog__accept" type="button" onClick={claim}>
                {t('coupon.accept')}
              </button>
            </div>
          </div>
          <button className="coupon-dialog__close" type="button" aria-label={t('common.close')} onClick={dismiss}>
            ×
          </button>
        </div>
      )}
    </Modal>
  )
}
