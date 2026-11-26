import { formatQuotaNumber } from '@renderer/hooks/useModelQuota'
import React from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

/**
 * 选择模型弹窗双页签头部（V3 卡片环形额度样式）：
 * - 胶囊页签：按量付费 / 免费体验；右侧「已开通 n / 共 m」统计；
 * - 绿色汇总条：免费额度总剩余，仅「免费体验」页签展示（按量付费页签无额度区）。
 * 视觉参数对齐 docs/选择模型弹窗免费体验改造/样式方案V3-卡片环形额度.html。
 */

export type ModelTabKey = 'pay' | 'free'

interface QuotaTabHeaderProps {
  activeTab: ModelTabKey
  onTabChange: (tab: ModelTabKey) => void
  /** 免费额度总剩余（仅免费页签汇总条展示；undefined 时隐藏汇总条） */
  totalRest?: number
  /** 汇总条单位：tokens（文本模型，默认）/ times（交互次数） */
  totalRestUnit?: 'tokens' | 'times'
  /** 已开通模型数 */
  openedCount: number
  /** 模型总数（已开通 ∪ 未开通 ∪ 免费体验；undefined 时隐藏统计） */
  totalCount?: number
}

const QuotaTabHeader: React.FC<QuotaTabHeaderProps> = ({
  activeTab,
  onTabChange,
  totalRest,
  totalRestUnit = 'tokens',
  openedCount,
  totalCount
}) => {
  const { t } = useTranslation()
  const showSumbar = activeTab === 'free' && totalRest !== undefined

  return (
    <Wrap>
      <TabRow>
        <Pills>
          <Pill className={activeTab === 'pay' ? 'on' : ''} onClick={() => onTabChange('pay')}>
            {t('selectModel.tab.payLater')}
          </Pill>
          <Pill className={activeTab === 'free' ? 'on' : ''} onClick={() => onTabChange('free')}>
            {t('selectModel.tab.freeTrial')}
          </Pill>
        </Pills>
        {totalCount !== undefined && <Stats>{t('selectModel.openedStats', { n: openedCount, m: totalCount })}</Stats>}
      </TabRow>
      {showSumbar && (
        <SumBar>
          <span className="dot" />
          {t(totalRestUnit === 'times' ? 'selectModel.sumbar.freeRestTimes' : 'selectModel.sumbar.freeRestTokens', {
            total: formatQuotaNumber(totalRest)
          })}
        </SumBar>
      )}
    </Wrap>
  )
}

const Wrap = styled.div`
  position: relative;
  z-index: 2;
`

const TabRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 2px 12px 8px;
`

const Pills = styled.div`
  display: inline-flex;
  background: var(--color-background-mute);
  border-radius: 999px;
  padding: 3px;
`

const Pill = styled.div`
  padding: 5px 14px;
  border-radius: 999px;
  font-size: 13px;
  color: var(--color-text-2);
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
  white-space: nowrap;

  &:hover {
    color: var(--color-text);
  }

  &.on {
    background: var(--color-primary-soft);
    color: var(--color-white);
    font-weight: 600;
  }
`

const Stats = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
  white-space: nowrap;
`

const SumBar = styled.div`
  --sum-bg: rgba(34, 197, 94, 0.09);

  body.dark &,
  body[theme-mode='dark'] & {
    --sum-bg: rgba(34, 197, 94, 0.12);
  }

  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 12px 8px;
  padding: 8px 12px;
  font-size: 12.5px;
  color: var(--color-text-2);
  background: var(--sum-bg);
  border-radius: 10px;

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22c55e;
    flex-shrink: 0;
  }
`

export default QuotaTabHeader
