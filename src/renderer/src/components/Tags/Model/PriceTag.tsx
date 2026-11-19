import { useAppSelector } from '@renderer/store'
import { Popover, Tooltip } from 'antd'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { CustomTagProps } from '../CustomTag'
import ModelPricePopover from './ModelPricePopover'

type Props = {
  size?: number
  showTooltip?: boolean
  showLabel?: boolean
  model?: any
  moneyType?: '1' | '2' // '1': 刊例价(金币), '2': 美元价
} & Omit<CustomTagProps, 'size' | 'tooltip' | 'icon' | 'color' | 'children'>

// 视频清晰度类型选项（模拟字典数据）
const VIDEO_DEFINITION_OPTIONS = [
  { dictValue: '1', dictLabel: '标清' },
  { dictValue: '2', dictLabel: '高清' },
  { dictValue: '3', dictLabel: '超清' },
  { dictValue: '4', dictLabel: '4K' }
]

// 获取视频时长范围字符串
const getDurationRangeString = (duration?: string[]): string => {
  if (!duration || duration.length === 0) return ''

  const numbers = duration
    .map((item) => {
      const match = item.match(/\d+/)
      return match ? parseInt(match[0], 10) : NaN
    })
    .filter((num) => !isNaN(num))

  if (numbers.length === 0) return ''
  if (numbers.length === 1) return numbers[0].toString()

  const min = Math.min(...numbers)
  const max = Math.max(...numbers)
  return `${min}~${max}`
}

export const PriceTag = ({ size, showTooltip, showLabel, model, moneyType = '1', ...restProps }: Props) => {
  const { t } = useTranslation()
  const [popoverOpen, setPopoverOpen] = useState(false)
  // 功能开关：新版收费浮窗（V1 分层卡片版），关闭时回退旧实现以便回滚
  const enableNewPricePopover = useAppSelector((state) => state.settings.enableNewPricePopover !== false)

  // 判断是否为刊例价或美元价
  const isRateCardPrice = moneyType === '1'
  const isUsdPrice = moneyType === '2'

  // 获取货币单位
  const getCurrencyUnit = () => (isUsdPrice ? '$' : '金币')

  // 获取配置数据(根据货币类型)
  const getConfig = (config: any) => {
    if (!config) return null

    // USD模式且未启用时，仍然返回基础数据而不是null
    // if (isUsdPrice && config.usdConfigStatus !== '1') {
    //   return null // USD配置未启用
    // }

    return {
      inputConfiguration: isUsdPrice ? config.inputConfigurationUsd : config.inputConfiguration,
      outputConfiguration: isUsdPrice ? config.outputConfigurationUsd : config.outputConfiguration,
      priceConfigList: isUsdPrice ? config.priceConfigUsdList : config.priceConfigList,
      tokens: config.tokens,
      interactiveNum: isUsdPrice ? config.usdInteractiveNum : config.interactiveNum,
      videoConfigurationList: config.videoConfigurationList,
      cachePriceConfigList: isUsdPrice ? config.cachePriceConfigUsdList : config.cachePriceConfigList,
      configurationList: isUsdPrice ? config.configurationUsdList : config.configurationList,
      thinkConfiguration: isUsdPrice ? config.thinkConfigurationUsd : config.thinkConfiguration,
      speechConfiguration: isUsdPrice ? config.speechConfigurationUsd : config.speechConfiguration,
      speechConfigurationOriginal: config.speechConfiguration // 保留原始配置用于模式判断
    }
  }

  // 收费方式渲染
  const chargeTypeRender = useMemo(() => {
    const { modelAttribute, modelChargeConfigVo } = model || {}
    if (!modelChargeConfigVo) return '--'

    const { chargeType } = modelChargeConfigVo

    // 按次/按时长收费
    if (chargeType == 2 || chargeType == 3) {
      if (modelAttribute === 'visual_model') {
        return chargeType == 2 ? t('models.type.price.per_count') : t('models.type.price.duration')
      }

      if (modelAttribute === 'image_generation') {
        return t('models.type.price.per_image')
      }

      if (modelAttribute === 'speech_model') {
        return t('models.type.price.per_character')
      }

      return t('models.type.price.per_count')
    }

    // 默认按tokens收费
    return t('models.type.price.per_tokens')
  }, [model, t])

  // 收费标准渲染 - 主要价格逻辑
  const priceStandardRender = useMemo(() => {
    const { modelAttribute, modelChargeConfigVo } = model || {}
    if (!modelChargeConfigVo) {
      // console.log('PriceTag: modelChargeConfigVo is null or undefined')
      return null
    }

    const config = getConfig(modelChargeConfigVo)
    if (!config) {
      // console.log('PriceTag: config is null, modelChargeConfigVo:', modelChargeConfigVo)
      return '--'
    }

    const { chargeType, freeFlag } = modelChargeConfigVo
    const currencyUnit = getCurrencyUnit()

    // console.log('PriceTag: chargeType:', chargeType, 'modelAttribute:', modelAttribute, 'config:', config)

    // 免费标识
    const FreeTag = () => <span style={{ color: '#45cb48' }}>免费</span>

    // chargeType 0: 按tokens收费(分输入输出)
    if (chargeType == 0) {
      if (freeFlag === '1') return <FreeTag />

      // 图片生成模型
      if (modelAttribute === 'image_generation') {
        const hasTooltip = config.priceConfigList && config.priceConfigList.length > 0

        const content = (
          <>
            <div>
              {config.inputConfiguration} {currencyUnit}
            </div>
            <div>
              {config.outputConfiguration} {currencyUnit}
            </div>
          </>
        )

        if (hasTooltip) {
          return (
            <Tooltip
              title={
                <div>
                  {config.priceConfigList.map((item: string, idx: number) => (
                    <div key={idx}>{item}</div>
                  ))}
                </div>
              }>
              {content}
            </Tooltip>
          )
        }

        return content
      }

      // 语音模型
      if (modelAttribute === 'speech_model' && config.speechConfiguration) {
        const { speechTokenMode } = config.speechConfigurationOriginal || {}
        const speech = config.speechConfiguration

        return (
          <>
            {['input', 'separate'].includes(speechTokenMode) && (
              <div>
                {t('common.input')}: {speech.speechInputTokensPriceUsd || speech.speechInputTokensPrice} {currencyUnit}
                /M tokens
              </div>
            )}
            {['output', 'separate'].includes(speechTokenMode) && (
              <div>
                {t('common.output')}: {speech.speechOutputTokensPriceUsd || speech.speechOutputTokensPrice}{' '}
                {currencyUnit}/M tokens
              </div>
            )}
            {['merged'].includes(speechTokenMode) && (
              <div>
                合并: {speech.speechTokensPriceUsd || speech.speechTokensPrice} {currencyUnit}/M tokens
              </div>
            )}
          </>
        )
      }

      // 其他文本模型
      return (
        <>
          <div>{config.inputConfiguration}</div>
          <div>{config.outputConfiguration}</div>
        </>
      )
    }

    // chargeType 1: 按tokens收费(合并价格)
    if (chargeType == 1) {
      if (config.tokens === '0') return <FreeTag />
      return (
        <>
          {config.tokens} {currencyUnit}/{t('models.type.price.million_tokens')}
        </>
      )
    }

    // chargeType 2: 按次/张/字符收费
    if (chargeType == 2) {
      if (config.interactiveNum === '0') return <FreeTag />

      // 视频模型
      if (modelAttribute === 'visual_model') {
        const { secondUnit } = modelChargeConfigVo
        if (secondUnit) {
          return (
            <>
              {config.interactiveNum} {currencyUnit}/{secondUnit}
              {t('models.type.price.second')}
            </>
          )
        }
        return (
          <>
            {config.interactiveNum} {currencyUnit}/{t('models.type.price.per_time')}
          </>
        )
      }

      // 图片生成
      if (modelAttribute === 'image_generation') {
        return (
          <>
            {config.interactiveNum} {currencyUnit}/{t('models.type.price.per_image')}（n×
            {config.interactiveNum}）
          </>
        )
      }

      // 语音模型
      if (modelAttribute === 'speech_model') {
        return (
          <>
            {config.interactiveNum} {currencyUnit}/{t('models.type.price.ten_thousand_chars')}
          </>
        )
      }

      // 默认按次
      return (
        <>
          {config.interactiveNum} {currencyUnit}/{t('models.type.price.per_time')}
        </>
      )
    }

    // chargeType 3: 按时长收费(视频)
    if (chargeType == 3) {
      return renderVideoConfiguration(config, modelChargeConfigVo, currencyUnit)
    }

    return null
  }, [model, moneyType, t, isUsdPrice, isRateCardPrice])

  // 视频配置渲染
  const renderVideoConfiguration = (config: any, originalConfig: any, currencyUnit: string) => {
    const { videoConfigurationList } = config
    const { videoMuteFlag } = originalConfig

    if (!videoConfigurationList || videoConfigurationList.length === 0) {
      return '--'
    }

    // 获取清晰度标签
    const getDefinitionLabel = (definitionValue: string) => {
      const option = VIDEO_DEFINITION_OPTIONS.find((opt) => opt.dictValue === definitionValue)
      return option?.dictLabel || definitionValue
    }

    // 渲染单个视频配置项
    const renderVideoItem = (video: any) => {
      const rate = isUsdPrice ? video.usdRateCardRate : video.rateCardRate
      const voicedRate = isUsdPrice ? video.usdRateCardVoicedRate : video.rateCardVoicedRate
      const definitionLabel = getDefinitionLabel(video.definition)
      const durationRange = getDurationRangeString(video.videoDuration)

      // 有声/无声分离模式
      if (videoMuteFlag === '1' && video.voicedFlag === '0') {
        return (
          <>
            <div>
              {definitionLabel}有声：
              {voicedRate && voicedRate > 0 ? (
                <>
                  {voicedRate}
                  {currencyUnit}/{durationRange}秒
                  {video.scoreRatio && video.scoreRatio.length > 0 && (
                    <>
                      （
                      {video.scoreRatio.map((ratio: string, idx: number) => (
                        <span key={idx}>
                          {ratio}
                          {idx < video.scoreRatio.length - 1 && '，'}
                        </span>
                      ))}
                      ）
                    </>
                  )}
                </>
              ) : null}
            </div>
            <div>
              {definitionLabel}无声：
              {rate && rate > 0 ? (
                <>
                  {rate}
                  {currencyUnit}/{durationRange}秒
                  {video.scoreRatio && video.scoreRatio.length > 0 && (
                    <>
                      （
                      {video.scoreRatio.map((ratio: string, idx: number) => (
                        <span key={idx}>
                          {ratio}
                          {idx < video.scoreRatio.length - 1 && '，'}
                        </span>
                      ))}
                      ）
                    </>
                  )}
                </>
              ) : null}
            </div>
          </>
        )
      }

      // 普通模式
      return (
        <div>
          {definitionLabel}：
          {rate && rate > 0 ? (
            <>
              {rate}
              {currencyUnit}/{durationRange}秒
              {video.scoreRatio && video.scoreRatio.length > 0 && (
                <>
                  （
                  {video.scoreRatio.map((ratio: string, idx: number) => (
                    <span key={idx}>
                      {ratio}
                      {idx < video.scoreRatio.length - 1 && '，'}
                    </span>
                  ))}
                  ）
                </>
              )}
            </>
          ) : (
            <span style={{ color: '#45cb48' }}>免费</span>
          )}
        </div>
      )
    }

    // tooltip内容和显示内容相同
    const videoContent = (
      <div>
        {videoConfigurationList.map((video: any, idx: number) => (
          <div key={idx}>{renderVideoItem(video)}</div>
        ))}
      </div>
    )

    return videoContent
  }

  // 视频输入价格渲染
  const videoInputPriceRender = useMemo(() => {
    const { modelAttribute, modelChargeConfigVo } = model || {}
    if (modelAttribute !== 'visual_model' || !modelChargeConfigVo) return null

    const config = getConfig(modelChargeConfigVo)
    if (!config) return '--' // 配置未启用或为空

    const { videoInputFlag, videoConfigurationList } = modelChargeConfigVo

    if (videoInputFlag !== '1' || !videoConfigurationList) return '--'

    const currencyUnit = getCurrencyUnit()

    // 获取清晰度标签
    const getDefinitionLabel = (definitionValue: string) => {
      const option = VIDEO_DEFINITION_OPTIONS.find((opt) => opt.dictValue === definitionValue)
      return option?.dictLabel || definitionValue
    }

    return videoConfigurationList.map((video: any, idx: number) => {
      const inputRate = isUsdPrice ? video.usdRateCardRateInput : video.rateCardRateInput
      const definitionLabel = getDefinitionLabel(video.definition)
      return (
        <div key={idx}>
          {definitionLabel}：{inputRate} {currencyUnit}/1秒
        </div>
      )
    })
  }, [model, moneyType, t, isUsdPrice])

  // 缓存价格/思考价格渲染
  const cachePriceRender = useMemo(() => {
    const { modelAttribute, modelChargeConfigVo } = model || {}

    // 只有文本模型和图片生成支持
    if (!['text_model', 'image_generation'].includes(modelAttribute) || !modelChargeConfigVo) {
      return null
    }

    const config: any = getConfig(modelChargeConfigVo)
    if (!config) return '--' // 配置未启用或为空

    const { outputStrategyThink } = modelChargeConfigVo
    const hasCacheConfig = config.cachePriceConfigList && config.cachePriceConfigList.length > 0
    const hasThinkConfig = outputStrategyThink === 1

    if (!hasCacheConfig && !hasThinkConfig) return '--'

    const displayContent = (
      <>
        {config.configurationList &&
          config.configurationList.map((item: string, idx: number) => <div key={idx}>{item}</div>)}
        {hasThinkConfig && <div>{config.thinkConfiguration}</div>}
      </>
    )

    return displayContent
  }, [model, moneyType, t, isUsdPrice])

  const content = (
    <ContentContainer>
      <PriceRow>
        <span className="label">{t('models.type.price.charge_type_label')}:</span>
        <span className="value">{chargeTypeRender}</span>
      </PriceRow>

      <PriceRow>
        <span className="label">
          {model?.modelAttribute === 'visual_model'
            ? t('models.type.price.output_price')
            : t('models.type.price.standard')}
          :
        </span>
        <div className="value">{priceStandardRender || '--'}</div>
      </PriceRow>

      {model?.modelAttribute === 'visual_model' && (
        <PriceRow>
          <span className="label">{t('models.type.price.video_input_price')}:</span>
          <span className="value">{videoInputPriceRender || '--'}</span>
        </PriceRow>
      )}

      {['text_model', 'image_generation'].includes(model?.modelAttribute) && (
        <PriceRow>
          <span className="label">{t('models.type.price.cache_price')}:</span>
          <span className="value">{cachePriceRender || '--'}</span>
        </PriceRow>
      )}
    </ContentContainer>
  )

  if (enableNewPricePopover) {
    return (
      <Popover
        content={<ModelPricePopover model={model} moneyType={moneyType} active={popoverOpen} />}
        trigger="hover"
        placement="topRight"
        mouseEnterDelay={0.15}
        mouseLeaveDelay={0.1}
        arrow={false}
        onOpenChange={setPopoverOpen}
        overlayInnerStyle={{ padding: 0, background: 'transparent', boxShadow: 'none' }}>
        <Tag {...restProps}>{t('models.type.price.title')}</Tag>
      </Popover>
    )
  }

  return (
    <Popover content={content} trigger="hover" placement="top" align={{ offset: [-100, -10] }}>
      <Tag {...restProps}>{t('models.type.price.title')}</Tag>
    </Popover>
  )
}

const ContentContainer = styled.div`
  border-radius: 4px;
`

const PriceRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  font-size: 13px;

  &:last-child {
    margin-bottom: 0;
  }

  .label {
    font-weight: 500;
    color: #ff9900;
    margin-right: 4px;
  }

  .value {

    div {
      margin-bottom: 2px;
      padding-left: 0;

      &:last-child {
        margin-bottom: 0;
      }
    }

    /* 当值是多行内容时，整个value块独立成行 */
    &.multi-line {
      display: block;
      padding-left: 12px;

      div {
        display: block;
      }
    }
  }
`

const Tag = styled.div`
  padding: 2px 10px;
  background-color: rgba(255, 153, 0, 0.1);
  color: #ff9900;
  font-size: 12px;
  font-weight: 400;
  border-radius: 10px;
  cursor: pointer;
  display: inline-block;
  transition: all 0.3s;

  &:hover {
    background-color: rgba(255, 153, 0, 0.2);
  }
`
