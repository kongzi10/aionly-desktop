import { FEATURE_LIMITED_DISCOUNT_TAG } from '@renderer/config/featureFlags'
import { formatDiscountLabel, isActivityDisplayable } from '@renderer/hooks/usePublishPriceDiscount'
import type { PublishPriceDiscountActivity } from '@renderer/types/publishDiscount'
import React, { memo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface DiscountTagProps {
  /** 当前生效的刊例价折扣活动；为 null/undefined 或活动已过期时不渲染 */
  activity?: PublishPriceDiscountActivity | null
  style?: React.CSSProperties
}

/**
 * 「限时折扣」pill 标签：模型名称后、VIP 标签之后展示。
 * 尺寸语言与 VIP pill 一致（20px 高 / 10px 圆角 / 12px 字重 600），
 * 配色按产品原型为绿色系（限时免费/限时X折）。
 */
const DiscountTag = ({ activity, style }: DiscountTagProps) => {
  const { t } = useTranslation()
  if (!FEATURE_LIMITED_DISCOUNT_TAG || !isActivityDisplayable(activity)) return null
  return <Pill style={style}>{formatDiscountLabel(Number(activity.discount), t)}</Pill>
}

const Pill = styled.span`
  flex-shrink: 0;
  height: 20px;
  padding: 0 8px;
  border: 1px solid #b7eb8f;
  border-radius: 10px;
  background: #f6ffed;
  color: #389e0d;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  white-space: nowrap;
`

export default memo(DiscountTag)
