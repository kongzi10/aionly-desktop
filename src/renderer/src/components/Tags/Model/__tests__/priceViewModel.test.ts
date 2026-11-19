import { describe, expect, it } from 'vitest'

import { buildPriceViewModel, splitLine } from '../priceViewModel'

const t = (key: string) => key

describe('priceViewModel', () => {
  describe('splitLine', () => {
    it('按首个冒号拆分 label/value', () => {
      expect(splitLine('文本输入: 10.5金币/M tokens')).toEqual({ label: '文本输入', value: '10.5金币/M tokens' })
      expect(splitLine('输入：1.5 金币 / M tokens')).toEqual({ label: '输入', value: '1.5 金币 / M tokens' })
      expect(splitLine('0.14金币/张')).toEqual({ label: '', value: '0.14金币/张' })
    })
  })

  it('文本模型按tokens收费：逐档明细 + 刊例折扣', () => {
    const vm = buildPriceViewModel(
      {
        modelId: 1,
        modelName: 'GPT Image 2.5 Sunburst',
        serviceName: 'Azure-Openai',
        modelAttribute: 'text_model',
        chargeType: 0,
        priceConfigList: ['文本输入: 10.5金币/M tokens', '输出: 21金币/M tokens'],
        priceDiscount: { discount: 0.8 }
      },
      { moneyType: '1', t }
    )
    expect(vm.chargeTypeKey).toBe('models.type.price.per_tokens')
    expect(vm.isFree).toBe(false)
    expect(vm.discount).toBe(0.8)
    expect(vm.standardGroups).toHaveLength(1)
    expect(vm.standardGroups[0].lines[0]).toEqual({ label: '文本输入', value: '8.4金币/M tokens' })
    expect(vm.standardGroups[0].lines[1]).toEqual({ label: '输出', value: '16.8金币/M tokens' })
    expect(vm.hasData).toBe(true)
  })

  it('输入/输出混排同一串（换行分隔）拆为两行展示', () => {
    const vm = buildPriceViewModel(
      {
        modelAttribute: 'text_model',
        chargeType: 0,
        priceConfigList: ['文本输入: 0.8-2.4金币/M tokens\n文本输出: 2-24金币/M tokens']
      },
      { moneyType: '1', t }
    )
    expect(vm.standardGroups[0].lines).toEqual([
      { label: '文本输入', value: '0.8-2.4金币/M tokens' },
      { label: '文本输出', value: '2-24金币/M tokens' }
    ])
  })

  it('图片生成分辨率计费：数组 scoreRatio 不崩溃 + 质量档位逐行展开', () => {
    const unit = 'models.type.price.gold_coin/models.type.price.unit_image'
    const vm = buildPriceViewModel(
      {
        modelAttribute: 'image_generation',
        chargeType: 2,
        interactiveNum: '1',
        resolutionFlag: '1',
        imgConfigurationList: [
          { scoreRatio: ['1K'], qualityFlag: 0, rateCardRate: '0.28', mediumRateCardRate: '0.42' },
          { scoreRatio: ['2K'], qualityFlag: 0, rateCardRate: '0.42', mediumRateCardRate: '0.56' }
        ]
      },
      { moneyType: '1', t }
    )
    expect(vm.standardGroups[0].lines).toEqual([
      { label: '1K-低', value: `0.28 ${unit}` },
      { label: '1K-中', value: `0.42 ${unit}` },
      { label: '2K-低', value: `0.42 ${unit}` },
      { label: '2K-中', value: `0.56 ${unit}` }
    ])
  })

  it('图片按张分时计费：输出价按高峰/空闲分组（peakImgConfigurationList/idleImgConfigurationList）', () => {
    const unit = 'models.type.price.gold_coin/models.type.price.unit_image'
    const vm = buildPriceViewModel(
      {
        modelAttribute: 'image_generation',
        chargeType: 2,
        periodBillFlag: '1',
        peakScheduing: '周一、周二、周三、周四、周五',
        peakList: [
          { startTime: '10:00', endTime: '12:00' },
          { startTime: '14:00', endTime: '18:00' }
        ],
        imgInputFlag: '1',
        imgInputBill: 0,
        resolutionFlag: '1',
        imgConfigurationList: [
          { scoreRatio: ['1K', '2K'], periodBillFlag: '1', imgInputPrice: '0.02', rateCardRate: '0.18' },
          { scoreRatio: ['1K', '2K'], periodBillFlag: '0', imgInputPrice: '0.01', rateCardRate: '0.09' }
        ],
        peakImgConfigurationList: [{ scoreRatio: ['1K', '2K'], rateCardRate: '0.18' }],
        idleImgConfigurationList: [{ scoreRatio: ['1K', '2K'], rateCardRate: '0.09' }]
      },
      { moneyType: '1', t }
    )
    expect(vm.peak.enabled).toBe(true)
    expect(vm.standardGroups.map((g) => g.titleKey)).toEqual([
      'common.input',
      'models.type.price.peak_period',
      'models.type.price.idle_period'
    ])
    expect(vm.standardGroups[0].lines).toEqual([
      { label: '1K、2K', value: `0.02 ${unit}` },
      { label: '1K、2K', value: `0.01 ${unit}` }
    ])
    expect(vm.standardGroups[1].lines).toEqual([{ label: '1K、2K', value: `0.18 ${unit}` }])
    expect(vm.standardGroups[2].lines).toEqual([{ label: '1K、2K', value: `0.09 ${unit}` }])
  })

  it('图片按张分时计费：快照缺高峰/空闲拆分列表时按 item.periodBillFlag 本地拆分', () => {
    const unit = 'models.type.price.gold_coin/models.type.price.unit_image'
    const vm = buildPriceViewModel(
      {
        modelAttribute: 'image_generation',
        chargeType: 2,
        periodBillFlag: '1',
        imgInputFlag: '1',
        imgInputBill: 0,
        resolutionFlag: '1',
        imgConfigurationList: [
          { scoreRatio: ['1K', '2K'], periodBillFlag: '1', imgInputPrice: '0.02', rateCardRate: '0.18' },
          { scoreRatio: ['1K', '2K'], periodBillFlag: '0', imgInputPrice: '0.01', rateCardRate: '0.09' }
        ]
      },
      { moneyType: '1', t }
    )
    expect(vm.standardGroups.map((g) => g.titleKey)).toEqual([
      'common.input',
      'models.type.price.peak_period',
      'models.type.price.idle_period'
    ])
    expect(vm.standardGroups[1].lines).toEqual([{ label: '1K、2K', value: `0.18 ${unit}` }])
    expect(vm.standardGroups[2].lines).toEqual([{ label: '1K、2K', value: `0.09 ${unit}` }])
  })

  it('免费模型标识', () => {
    const vm = buildPriceViewModel(
      { modelAttribute: 'text_model', chargeType: 0, freeFlag: '1' },
      { moneyType: '1', t }
    )
    expect(vm.isFree).toBe(true)
    expect(vm.hasData).toBe(true)
  })

  it('高峰时段：periodBillFlag=1 时输出时段与分组价格', () => {
    const vm = buildPriceViewModel(
      {
        modelAttribute: 'text_model',
        chargeType: 0,
        periodBillFlag: '1',
        peakScheduing: '工作日',
        peakList: [
          { startTime: '09:00', endTime: '12:00' },
          { startTime: '19:00', endTime: '23:00' }
        ],
        peakInputConfiguration: '输入: 2金币/M tokens',
        peakOutputConfiguration: '输出: 3金币/M tokens',
        idleInputConfiguration: '输入: 1金币/M tokens',
        idleOutputConfiguration: '输出: 2金币/M tokens'
      },
      { moneyType: '1', t }
    )
    expect(vm.peak).toEqual({ enabled: true, scheduing: '工作日', periods: ['09:00--12:00', '19:00--23:00'] })
    expect(vm.standardGroups.map((g) => g.titleKey)).toEqual([
      'models.type.price.peak_period',
      'models.type.price.idle_period'
    ])
  })

  it('分时计费：标志缺失但存在高峰字段仍分组 + 多行成形串拆行 + 缓存高峰/空闲分组', () => {
    const vm = buildPriceViewModel(
      {
        modelAttribute: 'text_model',
        chargeType: 0,
        peakInputConfiguration: '文本输入: 35金币/M tokens',
        peakOutputConfiguration: '输出: 56金币/M tokens',
        idleInputConfiguration: '文本输入: 14金币/M tokens\n缓存输入: 28金币/M tokens',
        idleOutputConfiguration: '输出: 105金币/M tokens',
        peakConfigurationList: ['缓存读取: 14金币/M tokens'],
        idleConfigurationList: ['缓存读取: 7金币/M tokens']
      },
      { moneyType: '1', t }
    )
    expect(vm.peak.enabled).toBe(true)
    expect(vm.standardGroups.map((g) => g.titleKey)).toEqual([
      'models.type.price.peak_period',
      'models.type.price.idle_period'
    ])
    expect(vm.standardGroups[1].lines).toEqual([
      { label: '文本输入', value: '14金币/M tokens' },
      { label: '缓存输入', value: '28金币/M tokens' },
      { label: '输出', value: '105金币/M tokens' }
    ])
    expect(vm.cacheGroups.map((g) => g.titleKey)).toEqual([
      'models.type.price.peak_period',
      'models.type.price.idle_period'
    ])
    expect(vm.cacheGroups[0].lines[0]).toEqual({ label: '缓存读取', value: '14金币/M tokens' })
    expect(vm.cacheGroups[1].lines[0]).toEqual({ label: '缓存读取', value: '7金币/M tokens' })
  })

  it('标准列高峰配置缺失时回退 peakPriceConfigList', () => {
    const vm = buildPriceViewModel(
      {
        modelAttribute: 'text_model',
        chargeType: 0,
        periodBillFlag: '1',
        peakPriceConfigList: ['文本输入: 35金币/M tokens', '输出: 56金币/M tokens'],
        idlePriceConfigList: ['文本输入: 14金币/M tokens']
      },
      { moneyType: '1', t }
    )
    expect(vm.standardGroups[0].lines).toHaveLength(2)
    expect(vm.standardGroups[1].lines[0]).toEqual({ label: '文本输入', value: '14金币/M tokens' })
  })

  it('分时计费优先于模型属性分支：image_generation 标注下仍按高峰/空闲分组', () => {
    const vm = buildPriceViewModel(
      {
        modelAttribute: 'image_generation',
        chargeType: 0,
        peakInputConfiguration: '文本输入: 35金币/M tokens',
        peakOutputConfiguration: '输出: 56金币/M tokens',
        idleInputConfiguration: '文本输入: 14金币/M tokens',
        idleOutputConfiguration: '输出: 105金币/M tokens',
        priceConfigList: ['文本输入: 35金币/M tokens']
      },
      { moneyType: '1', t }
    )
    expect(vm.standardGroups.map((g) => g.titleKey)).toEqual([
      'models.type.price.peak_period',
      'models.type.price.idle_period'
    ])
    expect(vm.standardGroups[0].lines).toEqual([
      { label: '文本输入', value: '35金币/M tokens' },
      { label: '输出', value: '56金币/M tokens' }
    ])
  })

  it('非高峰模型高峰区块为 --', () => {
    const vm = buildPriceViewModel({ modelAttribute: 'text_model', chargeType: 0 }, { moneyType: '1', t })
    expect(vm.peak.enabled).toBe(false)
    expect(vm.peak.periods).toEqual([])
  })

  it('缓存/思考价格：configurationList + thinkConfiguration', () => {
    const vm = buildPriceViewModel(
      {
        modelAttribute: 'text_model',
        chargeType: 0,
        outputStrategyThink: 1,
        cachePriceConfigList: ['x'],
        modelChargeConfigVo: undefined,
        configurationList: ['文本缓存读取: 14金币/M tokens'],
        thinkConfiguration: '思考输出: 6金币/M tokens'
      },
      { moneyType: '1', t }
    )
    expect(vm.showCache).toBe(true)
    expect(vm.cacheGroups).toHaveLength(1)
    expect(vm.cacheGroups[0].lines).toHaveLength(2)
    expect(vm.cacheGroups[0].lines[1]).toEqual({ label: '思考输出', value: '6金币/M tokens' })
  })

  it('原始数值字段：前端补输入/输出标识与单位', () => {
    const vm = buildPriceViewModel(
      { modelAttribute: 'text_model', chargeType: 0, inputConfiguration: '12', outputConfiguration: '36' },
      { moneyType: '1', t }
    )
    expect(vm.standardGroups[0].lines).toEqual([
      { label: 'common.input', value: '12 models.type.price.gold_coin/models.type.price.unit_m_tokens' },
      { label: 'common.output', value: '36 models.type.price.gold_coin/models.type.price.unit_m_tokens' }
    ])
  })

  it('缓存明细缺失 configurationList 时回退 cachePriceConfigList', () => {
    const vm = buildPriceViewModel(
      { modelAttribute: 'text_model', chargeType: 0, cachePriceConfigList: ['缓存读取: 2.4金币/M tokens'] },
      { moneyType: '1', t }
    )
    expect(vm.cacheGroups).toHaveLength(1)
    expect(vm.cacheGroups[0].lines[0]).toEqual({ label: '缓存读取', value: '2.4金币/M tokens' })
  })

  it('视觉/语音模型不展示缓存区块', () => {
    const vm = buildPriceViewModel(
      { modelAttribute: 'visual_model', chargeType: 2, interactiveNum: '1' },
      { moneyType: '1', t }
    )
    expect(vm.showCache).toBe(false)
  })

  it('按张收费拼装单位', () => {
    const vm = buildPriceViewModel(
      { modelAttribute: 'image_generation', chargeType: 2, interactiveNum: '0.1400' },
      { moneyType: '1', t }
    )
    expect(vm.chargeTypeKey).toBe('models.type.price.per_image')
    expect(vm.standardGroups[0].lines[0].value).toContain('0.1400')
    expect(vm.standardGroups[0].lines[0].value).toContain('models.type.price.unit_image')
  })

  it('USD 模式取 *Usd 字段', () => {
    const vm = buildPriceViewModel(
      {
        modelAttribute: 'text_model',
        chargeType: 0,
        inputConfiguration: '输入: 10金币/M tokens',
        inputConfigurationUsd: '输入: 1.5$/M tokens'
      },
      { moneyType: '2', t }
    )
    expect(vm.standardGroups[0].lines[0].value).toBe('1.5$/M tokens')
  })

  it('USD 开关显式关闭时回退金币价', () => {
    const vm = buildPriceViewModel(
      {
        modelAttribute: 'text_model',
        chargeType: 0,
        usdConfigStatus: '0',
        inputConfiguration: '输入: 10金币/M tokens',
        inputConfigurationUsd: '输入: 1.5$/M tokens'
      },
      { moneyType: '2', t }
    )
    expect(vm.standardGroups[0].lines[0].value).toBe('10金币/M tokens')
  })

  it('快照行（modelChargeConfigVo 嵌套）可解析', () => {
    const vm = buildPriceViewModel(
      {
        modelName: 'Qwen3.7-Max',
        modelAttribute: 'text_model',
        modelChargeConfigVo: { chargeType: 0, priceConfigList: ['输入: 2金币/M tokens'] }
      },
      { moneyType: '1', isSnapshot: true, t }
    )
    expect(vm.isSnapshot).toBe(true)
    expect(vm.modelName).toBe('Qwen3.7-Max')
    expect(vm.standardGroups[0].lines[0].value).toBe('2金币/M tokens')
  })

  it('无数据时 hasData=false', () => {
    const vm = buildPriceViewModel({ modelAttribute: 'text_model', chargeType: 0 }, { moneyType: '1', t })
    expect(vm.hasData).toBe(false)
  })
})
