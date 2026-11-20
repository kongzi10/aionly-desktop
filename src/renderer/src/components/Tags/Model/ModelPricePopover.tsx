import './ModelPricePopover.css'

import { useTheme } from '@renderer/context/ThemeProvider'
import { useModelPrice } from '@renderer/hooks/useModelPrice'
import {
  formatDiscountLabel,
  isActivityDisplayable,
  usePublishPriceDiscount
} from '@renderer/hooks/usePublishPriceDiscount'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { buildPriceViewModel, PriceGroup, PriceLine, PriceViewModel } from './priceViewModel'

interface ModelPricePopoverProps {
  model: any
  moneyType?: '1' | '2'
  /** Popover 是否打开（打开时懒加载价格主数据） */
  active: boolean
}

const renderLines = (lines: PriceLine[]) => (
  <ul className="mpp__list">
    {lines.map((line, i) => (
      <li className="mpp__item" key={`${line.label}-${i}`}>
        <span className="mpp__item-label">{line.label}</span>
        <span className="mpp__item-value">{line.value || '--'}</span>
      </li>
    ))}
  </ul>
)

const renderGroups = (groups: PriceGroup[], t: (key: string) => string) =>
  groups.map((group, gi) => (
    <div key={gi}>
      {group.titleKey && <div className="mpp__group-title">{t(group.titleKey)}</div>}
      {renderLines(group.lines)}
    </div>
  ))

/**
 * 模型收费浮窗内容（V1 分层卡片版）
 * 数据口径与控制台「模型价格」页同源：/ai/modelChargeConfig/*
 */
const ModelPricePopover = ({ model, moneyType = '1', active }: ModelPricePopoverProps) => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { status, row, isSnapshot, load } = useModelPrice(model, moneyType)
  const { getDiscount } = usePublishPriceDiscount(model ? [model] : [], (m: any) => m?.modelId ?? m?.id)

  useEffect(() => {
    if (active && status === 'idle') void load()
  }, [active, status, load])

  const vm: PriceViewModel | null = useMemo(() => {
    if (!row) return null
    const activity = isActivityDisplayable(row.priceDiscount) ? row.priceDiscount : getDiscount(model)
    return buildPriceViewModel(row, {
      moneyType,
      discount: activity?.discount ?? null,
      isSnapshot,
      t: (key: string) => t(key)
    })
  }, [row, moneyType, isSnapshot, getDiscount, model, t])

  const rootClass = ['mpp', 'mpp-v1', theme === 'dark' ? 'mpp--dark' : ''].filter(Boolean).join(' ')

  return (
    <div className={rootClass}>
      <div className="mpp__header">
        <div className="mpp__heading">
          {/* 与模型列表名称口径一致：优先取展示名 model.name，缺失时再回退价格配置字段 */}
          <span className="mpp__model">{model?.name || model?.modelName || vm?.modelName || '--'}</span>
          {(vm?.providerName || model?.serviceName) && (
            <span className="mpp__provider">{vm?.providerName || model?.serviceName}</span>
          )}
        </div>
        <span className={['mpp__charge-badge', vm?.isFree ? 'mpp__charge-badge--free' : ''].filter(Boolean).join(' ')}>
          {vm?.isFree ? t('models.type.free') : vm ? t(vm.chargeTypeKey) : ''}
        </span>
      </div>

      <div className="mpp__body">
        {status === 'loading' && (
          <div className="mpp__section">
            <div className="mpp__skeleton mpp__skeleton--w40" />
            <div className="mpp__skeleton mpp__skeleton--w80" />
            <div className="mpp__skeleton mpp__skeleton--w60" />
          </div>
        )}

        {status !== 'loading' && vm && (
          <>
            <section className="mpp__section">
              <header className="mpp__section-head">
                <span className="mpp__section-title">{t(vm.standardTitleKey)}</span>
                {vm.discount !== null && (
                  <span className="mpp__section-extra">{formatDiscountLabel(vm.discount, t)}</span>
                )}
              </header>
              {vm.isFree ? (
                <span className="mpp__free">{t('models.type.free')}</span>
              ) : vm.standardGroups.length ? (
                renderGroups(vm.standardGroups, (key) => t(key))
              ) : (
                <span className="mpp__empty">--</span>
              )}
            </section>

            {/* 高峰时段为空（未开启或无时段）时整栏隐藏，避免无效占位 */}
            {vm.peak.enabled && (vm.peak.periods.length > 0 || !!vm.peak.scheduing) && (
              <section className="mpp__section">
                <header className="mpp__section-head">
                  <span className="mpp__section-title">{t('models.type.price.peak_period')}</span>
                  <span className="mpp__section-extra">{t('models.type.price.peak_on')}</span>
                </header>
                {vm.peak.scheduing && <div className="mpp__peak-scheduing">{vm.peak.scheduing}</div>}
                {vm.peak.periods.length ? (
                  <div className="mpp__peaks">
                    {vm.peak.periods.map((p) => (
                      <span className="mpp__peak-chip" key={p}>
                        {p}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="mpp__empty">--</span>
                )}
              </section>
            )}

            {/* 缓存/思考价格为空时整栏隐藏，避免无效 "--" 占位 */}
            {vm.showCache && vm.cacheGroups.some((g) => g.lines.length > 0) && (
              <section className="mpp__section">
                <header className="mpp__section-head">
                  <span className="mpp__section-title">{t('models.type.price.cache_think_price')}</span>
                </header>
                {renderGroups(vm.cacheGroups, (key) => t(key))}
              </section>
            )}
          </>
        )}

        {status === 'ready' && !vm && (
          <section className="mpp__section">
            <header className="mpp__section-head">
              <span className="mpp__section-title">{t('models.type.price.standard')}</span>
            </header>
            <span className="mpp__empty">--</span>
          </section>
        )}
      </div>

      <footer className="mpp__footer">
        <span className="mpp__footer-note">
          {isSnapshot && vm ? t('models.type.price.snapshot_note') : t('models.type.price.sync_note')}
        </span>
      </footer>
    </div>
  )
}

export default ModelPricePopover
