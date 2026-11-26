import { formatQuotaNumber, type ModelQuota } from '@renderer/hooks/useModelQuota'
import React from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

/**
 * 免费体验额度展示组件（V3 卡片环形样式，仅「免费体验」页签渲染）。
 *
 * 右侧两行文本（剩 x / 共 y 单位）+ 40px 环形进度，环中心为剩余百分比；
 * 三态色：正常绿 / 低余量橙（≤20%）/ 耗尽红（环填充 0、中心 0%）。
 * 视觉参数对齐 docs/选择模型弹窗免费体验改造/样式方案V3-卡片环形额度.html。
 */

interface ModelQuotaMeterProps {
  quota: ModelQuota
}

/** SVG 环半径/周长（viewBox 40，stroke 4） */
const R = 15.5
const C = 2 * Math.PI * R

const ModelQuotaMeter: React.FC<ModelQuotaMeterProps> = ({ quota }) => {
  const { t } = useTranslation()
  const dash = quota.tone === 'empty' ? 0 : (C * quota.percent) / 100
  const totalText =
    quota.unit === 'tokens'
      ? t('selectModel.quota.totalTokens', { total: formatQuotaNumber(quota.total) })
      : t('selectModel.quota.totalTimes', { total: formatQuotaNumber(quota.total) })

  return (
    <QuotaWrap className={`tone-${quota.tone}`} onClick={(e) => e.stopPropagation()}>
      <QuotaText>
        <div className="l1">{t('selectModel.quota.rest', { rest: formatQuotaNumber(quota.rest) })}</div>
        <div className="l2">{totalText}</div>
      </QuotaText>
      <svg className="quota-ring" viewBox="0 0 40 40" aria-hidden="true">
        <circle className="bgc" cx="20" cy="20" r={R} fill="none" strokeWidth="4" />
        <circle
          className="fgc"
          cx="20"
          cy="20"
          r={R}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
          transform="rotate(-90 20 20)"
        />
        <text x="20" y="24" textAnchor="middle" fontSize="10" fill="currentColor">
          {quota.tone === 'empty' ? 0 : Math.round(quota.percent)}
        </text>
      </svg>
    </QuotaWrap>
  )
}

const QuotaWrap = styled.div`
  --quota-track: rgba(127, 135, 148, 0.18);

  body.dark &,
  body[theme-mode='dark'] & {
    --quota-track: rgba(255, 255, 255, 0.12);
  }

  &.tone-ok {
    --quota-color: #22c55e;
  }

  &.tone-low {
    --quota-color: #f59e0b;
  }

  &.tone-empty {
    --quota-color: #ef4444;
  }

  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  color: var(--quota-color);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  cursor: default;

  .quota-ring {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }

  .quota-ring .bgc {
    stroke: var(--quota-track);
  }

  .quota-ring .fgc {
    stroke: var(--quota-color);
    transition: stroke-dasharray 0.25s ease;
  }
`

const QuotaText = styled.div`
  text-align: right;
  min-width: 92px;

  .l1 {
    color: var(--color-text);
    font-weight: 700;
    font-size: 13px;
    line-height: 1.3;
    white-space: nowrap;
  }

  .l2 {
    color: var(--color-text-3);
    font-size: 11.5px;
    line-height: 1.3;
    white-space: nowrap;
  }
`

export default ModelQuotaMeter
