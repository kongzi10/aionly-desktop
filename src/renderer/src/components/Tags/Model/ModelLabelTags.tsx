import { FEATURE_MODEL_LABEL_TAGS } from '@renderer/config/featureFlags'
import type { ModelLabelItem } from '@renderer/hooks/useModelLabels'
import React, { memo } from 'react'
import styled from 'styled-components'

interface ModelLabelTagsProps {
  /** 推荐标签项列表；为空时不渲染 */
  items?: ModelLabelItem[] | null
  style?: React.CSSProperties
}

export interface LabelPalette {
  border: string
  background: string
  color: string
}

/** 语义配色（产品原型）：弃用/下线→红；未发布→橙；其余推荐类→紫，与限时折扣 pill 尺寸语言一致 */
const PALETTE_DANGER: LabelPalette = { border: '#ffccc7', background: '#fff1f0', color: '#cf1322' }
const PALETTE_WARNING: LabelPalette = { border: '#ffd591', background: '#fff7e6', color: '#d46b08' }
const PALETTE_PRIMARY: LabelPalette = { border: '#b37feb', background: '#f9f0ff', color: '#722ed1' }

/** 按标签名选取语义配色：已弃用等下线类→红，未发布等预告类→橙，旗舰模型/最新上架/人气模型/最新推荐等→紫 */
export function getLabelPalette(name: string): LabelPalette {
  if (/弃用|下线|下架/.test(name)) return PALETTE_DANGER
  if (/未发布|未上线/.test(name)) return PALETTE_WARNING
  return PALETTE_PRIMARY
}

/**
 * 「推荐标签」pill 标签组：模型名称后、VIP 标签之后展示（旗舰模型/最新上架/已弃用/人气模型等）。
 * 尺寸语言与 VIP / 限时折扣 pill 一致（20px 高 / 10px 圆角 / 12px 字号）；字重 400 不加粗
 * （需显式声明以覆盖父级 font-semibold 的继承），配色按标签语义区分。
 */
const ModelLabelTags = ({ items, style }: ModelLabelTagsProps) => {
  if (!FEATURE_MODEL_LABEL_TAGS || !items || items.length === 0) return null
  return (
    <>
      {items.map((item) => {
        const palette = getLabelPalette(item.name)
        return (
          <Pill
            key={item.id || item.name}
            $border={palette.border}
            $background={palette.background}
            $color={palette.color}
            style={style}>
            {item.name}
          </Pill>
        )
      })}
    </>
  )
}

const Pill = styled.span<{ $border: string; $background: string; $color: string }>`
  flex-shrink: 0;
  height: 20px;
  padding: 0 8px;
  border: 1px solid ${(p) => p.$border};
  border-radius: 10px;
  background: ${(p) => p.$background};
  color: ${(p) => p.$color};
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  white-space: nowrap;
`

export default memo(ModelLabelTags)
