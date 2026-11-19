/**
 * 模型收费浮窗视图模型（纯函数映射，可单测）
 * 展示口径对齐控制台 qt `src/views/accounting/index.vue`：
 * 收费方式 / 高峰时段 / 收费标准（逐档明细 + 刊例折扣）/ 缓存价格·思考价格。
 */
import { applyPublishDiscount, discountPrice, isActiveDiscount } from '@renderer/utils/priceFormat'

export interface PriceLine {
  label: string
  value: string
}

export interface PriceGroup {
  /** 分组小标题 i18n key（高峰/空闲时段、输入等），null 表示无分组标题 */
  titleKey: string | null
  lines: PriceLine[]
}

export interface PricePeak {
  enabled: boolean
  scheduing: string
  periods: string[]
}

export interface PriceViewModel {
  modelName: string
  providerName: string
  /** 收费方式徽章 i18n key */
  chargeTypeKey: string
  isFree: boolean
  standardTitleKey: 'models.type.price.standard' | 'models.type.price.output_price'
  standardGroups: PriceGroup[]
  peak: PricePeak
  /** 仅 text_model / image_generation 展示缓存区块（与控制台列一致） */
  showCache: boolean
  cacheGroups: PriceGroup[]
  discount: number | null
  isSnapshot: boolean
  hasData: boolean
}

export interface BuildPriceOptions {
  moneyType: '1' | '2'
  /** 外部注入的折扣（usePublishPriceDiscount 活动），row.priceDiscount 优先 */
  discount?: number | null
  isSnapshot?: boolean
  /** 最小化 t 函数，便于单测注入 (key) => key */
  t: (key: string) => string
}

const VIDEO_DEFINITION_OPTIONS = [
  { value: '480P', label: '480P' },
  { value: '720P', label: '720P' },
  { value: '1080P', label: '1080P' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' }
]

const getDurationRangeString = (minDuration?: number, maxDuration?: number): string => {
  const min = Number(minDuration)
  const max = Number(maxDuration)
  const hasMin = minDuration !== undefined && minDuration !== null && !Number.isNaN(min)
  const hasMax = maxDuration !== undefined && maxDuration !== null && !Number.isNaN(max)
  if (hasMin && hasMax) {
    if (min === max) return `${min}`
    return `${min}-${max}`
  }
  if (hasMin) return `${min}`
  if (hasMax) return `${max}`
  return ''
}

/** 后端成形字符串（如 `文本输入: 10.5金币/M tokens`）拆为 label/value */
export const splitLine = (text: any): PriceLine => {
  const s = String(text ?? '')
  const idx = s.search(/[:：]/)
  if (idx <= 0) return { label: '', value: s }
  return { label: s.slice(0, idx).trim(), value: s.slice(idx + 1).trim() }
}

/** 后端成形字符串中输入/输出混排同一串（换行分隔）时，按换行拆为多行逐行展示 */
export const splitMultiLine = (text: any): PriceLine[] =>
  String(text ?? '')
    .split(/[\n\r]+|<br\s*\/?>/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => splitLine(part))

/** scoreRatio 后端可能返回数组（如 ["1K"]），数组/字符串均兼容，避免 .split 崩溃 */
const joinScoreRatio = (scoreRatio?: string | string[] | null): string => {
  if (scoreRatio === null || scoreRatio === undefined || scoreRatio === '') return ''
  if (Array.isArray(scoreRatio)) return scoreRatio.map((s) => String(s)).join('、')
  return String(scoreRatio).split(',').join('、')
}

/** 图片质量档位（对齐控制台字典 ai_img_quality）：low 取 rateCardRate，其余档位取 {dictValue}RateCardRate */
const AI_IMG_QUALITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' }
]

const getQualityRate = (item: any, dictValue: string, isUsd: boolean): any => {
  if (!item || !dictValue) return null
  if (dictValue === 'low') return isUsd ? item.usdRateCardRate : item.rateCardRate
  const cap = dictValue.charAt(0).toUpperCase() + dictValue.slice(1)
  return isUsd ? item[`usd${cap}RateCardRate`] : item[`${dictValue}RateCardRate`]
}

/** 已含单位关键词的价格文本（视为后端成形口径，不再补单位） */
const UNIT_KEYWORD = /金币|\$|tokens|张|次|秒/i

const definitionLabel = (definition?: string): string =>
  VIDEO_DEFINITION_OPTIONS.find((item) => item.value === definition)?.label ?? definition ?? ''

const hasLines = (groups: PriceGroup[]): boolean => groups.some((g) => g.lines.length > 0)

/**
 * 将价格主数据行（queryList/getOneByModelId 返回，或 pagePcList 的 modelChargeConfigVo 快照）
 * 映射为浮窗视图模型。
 */
export function buildPriceViewModel(row: any, options: BuildPriceOptions): PriceViewModel {
  const { moneyType, isSnapshot = false, t } = options
  const requestedUsd = moneyType === '2'
  // 合并：远端行本身即价格配置；快照场景价格字段位于 modelChargeConfigVo
  const cfg: any = {
    ...row,
    ...(row?.modelChargeConfigVo && typeof row.modelChargeConfigVo === 'object' ? row.modelChargeConfigVo : {})
  }
  // USD 开关显式关闭时回退金币价（修复 C6）
  const usdDisabled = cfg.usdConfigStatus === 0 || cfg.usdConfigStatus === '0' || cfg.usdConfigStatus === false
  const isUsd = requestedUsd && !usdDisabled
  const unit = isUsd ? '$' : t('models.type.price.gold_coin')

  const chargeType = Number(cfg.chargeType ?? row?.chargeType)
  const modelAttribute: string = cfg.modelAttribute ?? row?.modelAttribute ?? ''

  // 折扣：行内 priceDiscount 优先，其次外部注入活动折扣
  const rowDiscount = cfg.priceDiscount?.discount ?? row?.priceDiscount?.discount
  const discount = isActiveDiscount(rowDiscount)
    ? Number(rowDiscount)
    : isActiveDiscount(options.discount)
      ? Number(options.discount)
      : null
  /** 后端成形文本应用折扣 */
  const d = (v: any) => applyPublishDiscount(v, discount)
  /** 前端拼装数值应用折扣 */
  const dp = (v: any) => discountPrice(v, discount, isUsd)
  /** 按币种取字段（与旧版 getConfig 映射一致） */
  const pick = (goldKey: string) => (isUsd ? cfg[`${goldKey}Usd`] : cfg[goldKey])

  // 高峰/空闲分时计费：控制台以 periodBillFlag 为准；
  // 标志缺失但存在高峰定价字段时同样视为开启（兼容 getOne/快照等字段不全的数据形态）
  const hasPeakFields = [
    'peakInputConfiguration',
    'peakOutputConfiguration',
    'peakPriceConfigList',
    'peakConfigurationList',
    'peakCachePriceConfigList'
  ].some((key) => {
    const v = pick(key)
    if (v === null || v === undefined || v === '') return false
    if (Array.isArray(v)) return v.length > 0
    return true
  })
  const peakEnabled = String(cfg.periodBillFlag) === '1' || hasPeakFields

  // ---------- 收费方式 ----------
  let chargeTypeKey = 'models.type.price.per_count'
  if (chargeType === 0 || chargeType === 1) chargeTypeKey = 'models.type.price.per_tokens'
  else if (chargeType === 2) {
    if (modelAttribute === 'image_generation') chargeTypeKey = 'models.type.price.per_image'
    else if (modelAttribute === 'speech_model') chargeTypeKey = 'models.type.price.per_character'
    else chargeTypeKey = 'models.type.price.per_count'
  } else if (chargeType === 3) chargeTypeKey = 'models.type.price.duration'

  let isFree = false
  if (chargeType === 0) isFree = String(cfg.freeFlag) === '1'
  else if (chargeType === 1) isFree = String(cfg.tokens) === '0'
  else if (chargeType === 2) isFree = String(cfg.interactiveNum) === '0'

  // ---------- 收费标准 ----------
  const standardGroups: PriceGroup[] = []
  const pushGroup = (titleKey: PriceGroup['titleKey'], lines: PriceLine[]) => {
    if (lines.length) standardGroups.push({ titleKey, lines })
  }
  /** 原始数值补单位时的后缀（与控制台成形文本口径一致） */
  const rawUnitSuffix = () =>
    modelAttribute === 'image_generation'
      ? `${unit}/${t('models.type.price.unit_image')}`
      : `${unit}/${t('models.type.price.unit_m_tokens')}`
  /**
   * 后端成形文本（含冒号或单位，如 `输入: 12金币/M tokens`）直接拆分；
   * 原始数值（如 `12`）由前端补输入/输出标识与单位，避免裸数字展示。
   */
  const asLine = (raw: any, label: string, unitSuffix: string): PriceLine | null => {
    if (raw === null || raw === undefined || raw === '') return null
    const s = String(raw)
    if (/[:：]/.test(s)) return splitLine(d(s))
    if (UNIT_KEYWORD.test(s)) return { label, value: d(s) }
    return { label, value: `${d(s)} ${unitSuffix}`.trim() }
  }
  /** asLine 多行版：输入/输出混排同一串（换行分隔）时拆为多行，无冒号行回退传入 label */
  const asLines = (raw: any, label: string, unitSuffix: string): PriceLine[] => {
    if (raw === null || raw === undefined || raw === '') return []
    const s = String(raw)
    if (/[\n\r]+|<br\s*\/?>/i.test(s)) {
      return splitMultiLine(d(s)).map((line) => (line.label ? line : { ...line, label }))
    }
    const one = asLine(s, label, unitSuffix)
    return one ? [one] : []
  }
  const inputLines = (): PriceLine[] => asLines(pick('inputConfiguration'), t('common.input'), rawUnitSuffix())
  const outputLines = (): PriceLine[] => asLines(pick('outputConfiguration'), t('common.output'), rawUnitSuffix())

  if (chargeType === 0) {
    // 高峰/空闲分时计费优先于模型属性分支（与控制台标准列一致）：
    // 存在分时定价即按高峰/空闲分组，避免属性被标为 image_generation 等时仍平铺展示；
    // 分时价格字段缺失时回退下方属性分支
    const listLines = (list: any): PriceLine[] => (Array.isArray(list) ? list.flatMap((s) => splitMultiLine(d(s))) : [])
    if (peakEnabled) {
      const peakCfgLines = [
        ...asLines(pick('peakInputConfiguration'), t('common.input'), rawUnitSuffix()),
        ...asLines(pick('peakOutputConfiguration'), t('common.output'), rawUnitSuffix())
      ]
      pushGroup(
        'models.type.price.peak_period',
        peakCfgLines.length ? peakCfgLines : listLines(pick('peakPriceConfigList'))
      )
      const idleCfgLines = [
        ...asLines(pick('idleInputConfiguration'), t('common.input'), rawUnitSuffix()),
        ...asLines(pick('idleOutputConfiguration'), t('common.output'), rawUnitSuffix())
      ]
      pushGroup(
        'models.type.price.idle_period',
        idleCfgLines.length ? idleCfgLines : listLines(pick('idlePriceConfigList'))
      )
    }
    if (standardGroups.length) {
      // 分时分组已生成，跳过属性分支
    } else if (modelAttribute === 'image_generation') {
      const list: string[] = pick('priceConfigList') ?? []
      if (list.length)
        pushGroup(
          null,
          list.flatMap((s) => splitMultiLine(d(s)))
        )
      else pushGroup(null, [...inputLines(), ...outputLines()])
    } else if (modelAttribute === 'speech_model' && cfg.speechConfiguration) {
      const sc = cfg.speechConfiguration
      const mode = Number(row?.speechConfiguration?.speechTokenMode ?? cfg.speechTokenMode)
      const mUnit = `${unit}/${t('models.type.price.unit_m_tokens')}`
      if (mode === 2)
        pushGroup(null, [
          { label: t('models.type.price.group_input_merged'), value: `${dp(sc.speechTokensPrice)} ${mUnit}` }
        ])
      else
        pushGroup(null, [
          { label: t('models.type.price.input_price'), value: `${dp(sc.speechInputTokensPrice)} ${mUnit}` },
          { label: t('models.type.price.output_price'), value: `${dp(sc.speechOutputTokensPrice)} ${mUnit}` }
        ])
    } else if (modelAttribute === 'visual_model') {
      const lines: PriceLine[] = []
      if (String(cfg.resolutionFlag) === '1') {
        for (const item of cfg.videoConfigurationList ?? []) {
          const groupLabel = joinScoreRatio(item.scoreRatio)
          const mUnit = `${unit}/${t('models.type.price.unit_m_tokens')}`
          if (String(cfg.videoInputFlag) === '1' && String(item.videoInput) === '0') {
            lines.push({
              label: `${groupLabel} ${t('models.type.price.group_with_input')}`,
              value: `${dp(item.rateCardVideoRate)} ${mUnit}`
            })
            lines.push({
              label: `${groupLabel} ${t('models.type.price.group_without_input')}`,
              value: `${dp(item.rateCardRate)} ${mUnit}`
            })
          } else if (String(cfg.videoMuteFlag) === '1' && String(item.voicedFlag) === '0') {
            lines.push({
              label: `${groupLabel} ${t('models.type.price.group_with_audio')}`,
              value: `${dp(item.rateCardVoicedRate)} ${mUnit}`
            })
            lines.push({
              label: `${groupLabel} ${t('models.type.price.group_without_audio')}`,
              value: `${dp(item.rateCardRate)} ${mUnit}`
            })
          } else if (String(cfg.inputMethodFlag) === '1') {
            const methods = String(cfg.inputMethodVal ?? '')
            if (methods.includes('text'))
              lines.push({
                label: `${groupLabel} ${t('models.type.price.group_text_to_video')}`,
                value: `${dp(item.rateCardRate)} ${mUnit}`
              })
            if (methods.includes('img'))
              lines.push({
                label: `${groupLabel} ${t('models.type.price.group_image_to_video')}`,
                value: `${dp(item.rateCardI2vRate)} ${mUnit}`
              })
          } else {
            lines.push({ label: groupLabel, value: `${dp(item.rateCardRate)} ${mUnit}` })
          }
        }
      }
      pushGroup(null, lines)
    } else {
      const list: string[] = pick('priceConfigList') ?? []
      if (list.length)
        pushGroup(
          null,
          list.flatMap((s) => splitMultiLine(d(s)))
        )
      else pushGroup(null, [...inputLines(), ...outputLines()])
    }
  } else if (chargeType === 1) {
    if (!isFree)
      pushGroup(null, [{ label: '', value: `${dp(cfg.tokens)} ${unit}/${t('models.type.price.unit_million_tokens')}` }])
  } else if (chargeType === 2) {
    if (!isFree) {
      const lines: PriceLine[] = []
      if (modelAttribute === 'image_generation') {
        const imgUnit = `${unit}/${t('models.type.price.unit_image')}`
        /** 输出（分辨率/质量档位）行，取值口径与控制台收费标准列一致 */
        const imgOutputLines = (list: any[]): PriceLine[] => {
          const out: PriceLine[] = []
          for (const item of list ?? []) {
            const baseLabel = joinScoreRatio(item.scoreRatio)
            // qualityFlag=0 时按质量档位逐行展开（与控制台收费标准列一致），否则单行 rateCardRate
            if (String(item.qualityFlag) === '0') {
              for (const q of AI_IMG_QUALITY_OPTIONS) {
                const rate = getQualityRate(item, q.value, isUsd)
                if (rate === null || rate === undefined || rate === '') continue
                if (isUsd && String(rate) === '0') continue
                out.push({ label: `${baseLabel}-${q.label}`, value: `${dp(rate)} ${imgUnit}` })
              }
            } else {
              out.push({ label: baseLabel, value: `${dp(item.rateCardRate)} ${imgUnit}` })
            }
          }
          return out
        }
        const imgInputLines: PriceLine[] = []
        if (String(cfg.imgInputFlag) === '1') {
          if (Number(cfg.imgInputBill) === 1) {
            const suffix = Number(cfg.imgInputBillNum) > 0 ? `(n-${cfg.imgInputBillNum})` : ''
            imgInputLines.push({
              label: t('models.type.price.group_input_merged'),
              value: `${dp(cfg.imgInputPrice)} ${imgUnit}${suffix}`
            })
          } else {
            for (const item of cfg.imgConfigurationList ?? []) {
              imgInputLines.push({
                label: joinScoreRatio(item.scoreRatio),
                value: `${dp(item.imgInputPrice)} ${imgUnit}`
              })
            }
          }
        }
        // 分时计费：后端按 periodBillFlag 将 imgConfigurationList 拆为高峰/空闲两个列表，
        // 输出价按高峰/空闲分组展示（与官网一致）；快照缺拆分列表时按 item.periodBillFlag 本地拆分兜底
        let peakImgList: any[] = Array.isArray(cfg.peakImgConfigurationList) ? cfg.peakImgConfigurationList : []
        let idleImgList: any[] = Array.isArray(cfg.idleImgConfigurationList) ? cfg.idleImgConfigurationList : []
        if (peakEnabled && String(cfg.resolutionFlag) === '1' && !peakImgList.length && !idleImgList.length) {
          const all: any[] = cfg.imgConfigurationList ?? []
          if (all.some((it: any) => String(it?.periodBillFlag) === '1')) {
            peakImgList = all.filter((it: any) => String(it?.periodBillFlag) === '1')
            idleImgList = all.filter((it: any) => String(it?.periodBillFlag) !== '1')
            if (!peakImgList.length) peakImgList = all
          }
        }
        if (peakImgList.length > 0 || idleImgList.length > 0) {
          pushGroup('common.input', imgInputLines)
          pushGroup('models.type.price.peak_period', imgOutputLines(peakImgList))
          pushGroup('models.type.price.idle_period', imgOutputLines(idleImgList))
        } else if (
          peakEnabled &&
          String(cfg.resolutionFlag) !== '1' &&
          cfg.idleInteractiveNum !== null &&
          cfg.idleInteractiveNum !== undefined &&
          cfg.idleInteractiveNum !== ''
        ) {
          pushGroup('common.input', imgInputLines)
          pushGroup('models.type.price.peak_period', [{ label: '', value: `${dp(cfg.interactiveNum)} ${imgUnit}` }])
          pushGroup('models.type.price.idle_period', [{ label: '', value: `${dp(cfg.idleInteractiveNum)} ${imgUnit}` }])
        } else if (String(cfg.resolutionFlag) === '1') {
          lines.push(...imgInputLines, ...imgOutputLines(cfg.imgConfigurationList))
        } else {
          lines.push(...imgInputLines, { label: '', value: `${dp(cfg.interactiveNum)} ${imgUnit}` })
        }
      } else if (modelAttribute === 'visual_model') {
        const perUnit = cfg.secondUnit
          ? `${unit}/${cfg.secondUnit}${t('models.type.price.second')}`
          : `${unit}/${t('models.type.price.unit_count')}`
        lines.push({ label: '', value: `${dp(cfg.interactiveNum)} ${perUnit}` })
      } else if (modelAttribute === 'speech_model') {
        lines.push({
          label: '',
          value: `${dp(cfg.interactiveNum)} ${unit}/${t('models.type.price.ten_thousand_chars')}`
        })
      } else {
        lines.push({ label: '', value: `${dp(cfg.interactiveNum)} ${unit}/${t('models.type.price.unit_count')}` })
      }
      pushGroup(null, lines)
    }
  } else if (chargeType === 3) {
    const lines: PriceLine[] = []
    for (const item of cfg.videoConfigurationList ?? []) {
      const baseLabel = definitionLabel(item.definition)
      const duration = getDurationRangeString(item.minDuration, item.maxDuration)
      const durUnit = duration ? `/${duration}${t('models.type.price.second')}` : `/${t('models.type.price.second')}`
      if (String(cfg.videoMuteFlag) === '1' && String(item.voicedFlag) === '0') {
        lines.push({
          label: `${baseLabel} ${t('models.type.price.group_with_audio')}`,
          value: `${dp(isUsd ? item.usdRateCardVoicedRate : item.rateCardVoicedRate)} ${unit}${durUnit}`
        })
        lines.push({
          label: `${baseLabel} ${t('models.type.price.group_without_audio')}`,
          value: `${dp(isUsd ? item.usdRateCardRate : item.rateCardRate)} ${unit}${durUnit}`
        })
      } else {
        lines.push({
          label: baseLabel,
          value: `${dp(isUsd ? item.usdRateCardRate : item.rateCardRate)} ${unit}${durUnit}`
        })
      }
    }
    pushGroup(null, lines)
  }

  // ---------- 高峰时段 ----------
  const peak: PricePeak = {
    enabled: peakEnabled,
    scheduing: cfg.peakScheduing ?? '',
    periods: peakEnabled ? (cfg.peakList ?? []).map((p: any) => `${p.startTime}--${p.endTime}`) : []
  }

  // ---------- 缓存价格 / 思考价格 ----------
  const showCache = modelAttribute === 'text_model' || modelAttribute === 'image_generation'
  const cacheGroups: PriceGroup[] = []
  if (showCache) {
    /** configurationList 优先，缺失回退 cachePriceConfigList（二者均为后端成形字符串） */
    const listOr = (primary: string, fallback: string): string[] => {
      const p = pick(primary)
      if (Array.isArray(p) && p.length) return p
      const f = pick(fallback)
      return Array.isArray(f) ? f : []
    }
    const peakSrc = listOr('peakConfigurationList', 'peakCachePriceConfigList')
    const idleSrc = listOr('idleConfigurationList', 'idleCachePriceConfigList')
    const cacheSrc = listOr('configurationList', 'cachePriceConfigList')
    if (
      peakEnabled &&
      (peakSrc.length > 0 ||
        idleSrc.length > 0 ||
        Number(cfg.peakOutputStrategyThink) === 1 ||
        Number(cfg.outputStrategyThink) === 1)
    ) {
      const peakLines: PriceLine[] = peakSrc.map((s: string) => splitLine(d(s)))
      if (Number(cfg.peakOutputStrategyThink) === 1 && pick('peakThinkConfiguration'))
        peakLines.push(splitLine(d(pick('peakThinkConfiguration'))))
      cacheGroups.push({ titleKey: 'models.type.price.peak_period', lines: peakLines })

      const idleLines: PriceLine[] = idleSrc.map((s: string) => splitLine(d(s)))
      if (Number(cfg.idleOutputStrategyThink) === 1 && pick('idleThinkConfiguration'))
        idleLines.push(splitLine(d(pick('idleThinkConfiguration'))))
      cacheGroups.push({ titleKey: 'models.type.price.idle_period', lines: idleLines })
    } else if (cacheSrc.length > 0 || pick('cachePriceConfigList') != null || Number(cfg.outputStrategyThink) === 1) {
      const lines: PriceLine[] = cacheSrc.map((s: string) => splitLine(d(s)))
      if (Number(cfg.outputStrategyThink) === 1 && pick('thinkConfiguration'))
        lines.push(splitLine(d(pick('thinkConfiguration'))))
      cacheGroups.push({ titleKey: null, lines })
    }
  }

  const vm: PriceViewModel = {
    modelName: cfg.modelName ?? row?.modelName ?? row?.model ?? '',
    providerName: cfg.serviceName ?? row?.serviceName ?? row?.providerName ?? '',
    chargeTypeKey,
    isFree,
    standardTitleKey: chargeType === 1 ? 'models.type.price.output_price' : 'models.type.price.standard',
    standardGroups,
    peak,
    showCache,
    cacheGroups,
    discount,
    isSnapshot,
    hasData: isFree || hasLines(standardGroups) || peak.enabled || hasLines(cacheGroups)
  }
  return vm
}
