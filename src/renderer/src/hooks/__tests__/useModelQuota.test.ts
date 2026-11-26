import { describe, expect, it } from 'vitest'

import { formatQuotaNumber, QUOTA_LOW_RATIO, quotaTone, resolveFreeQuota } from '../useModelQuota'

describe('formatQuotaNumber', () => {
  it('格式化为千分位（en-US）', () => {
    expect(formatQuotaNumber(840000)).toBe('840,000')
    expect(formatQuotaNumber(1000000)).toBe('1,000,000')
    expect(formatQuotaNumber(0)).toBe('0')
    expect(formatQuotaNumber(999)).toBe('999')
  })

  it('向下取整、负数钳 0、非法值输出 0', () => {
    expect(formatQuotaNumber(1234.9)).toBe('1,234')
    expect(formatQuotaNumber(-5)).toBe('0')
    expect(formatQuotaNumber(Number.NaN)).toBe('0')
    expect(formatQuotaNumber(Number.POSITIVE_INFINITY)).toBe('0')
  })
})

describe('quotaTone', () => {
  it('剩余为 0 判耗尽', () => {
    expect(quotaTone(0, 1000)).toBe('empty')
    expect(quotaTone(-1, 1000)).toBe('empty')
  })

  it('总量非法判耗尽（防御）', () => {
    expect(quotaTone(100, 0)).toBe('empty')
    expect(quotaTone(100, Number.NaN)).toBe('empty')
  })

  it(`剩余占比 ≤ ${QUOTA_LOW_RATIO * 100}% 判低余量，恰好超过阈值判正常`, () => {
    // 恰好 20% → low（边界含等号）
    expect(quotaTone(200, 1000)).toBe('low')
    // 略高于 20% → ok
    expect(quotaTone(200.0001, 1000)).toBe('ok')
    // 略低于 20% → low
    expect(quotaTone(199.9999, 1000)).toBe('low')
    expect(quotaTone(840000, 1000000)).toBe('ok')
  })
})

describe('resolveFreeQuota', () => {
  it('文本模型：tokens 单位，剩余 = 总量 - 已用', () => {
    const q = resolveFreeQuota({ modelAttribute: 'text_model', userExperienceAll: 1000000, userExperienceRest: 160000 })
    expect(q).toMatchObject({ total: 1000000, used: 160000, rest: 840000, unit: 'tokens', tone: 'ok' })
    expect(q?.percent).toBeCloseTo(84)
  })

  it('非文本模型：times 单位', () => {
    const q = resolveFreeQuota({ modelAttribute: 'image_generation', userExperienceAll: 100, userExperienceRest: 90 })
    expect(q).toMatchObject({ total: 100, used: 90, rest: 10, unit: 'times', tone: 'low' })
  })

  it('缺省 modelAttribute 时按 times 处理', () => {
    const q = resolveFreeQuota({ userExperienceAll: 10, userExperienceRest: 1 })
    expect(q?.unit).toBe('times')
  })

  it('已用超过总量：剩余钳 0，判耗尽', () => {
    const q = resolveFreeQuota({ modelAttribute: 'text_model', userExperienceAll: 1000, userExperienceRest: 1500 })
    expect(q).toMatchObject({ rest: 0, tone: 'empty', percent: 0 })
  })

  it('已用为负/缺省按 0 处理', () => {
    expect(resolveFreeQuota({ userExperienceAll: 1000, userExperienceRest: -5 })?.rest).toBe(1000)
    expect(resolveFreeQuota({ userExperienceAll: 1000 })?.used).toBe(0)
  })

  it('字符串数字（后端 BigDecimal 序列化）可归一', () => {
    const q = resolveFreeQuota({
      modelAttribute: 'text_model',
      userExperienceAll: '1000' as never,
      userExperienceRest: '200' as never
    })
    expect(q).toMatchObject({ total: 1000, used: 200, rest: 800 })
  })

  it('无有效总量配置返回 undefined（行内不展示额度区）', () => {
    expect(resolveFreeQuota({ userExperienceRest: 100 })).toBeUndefined()
    expect(resolveFreeQuota({ userExperienceAll: 0, userExperienceRest: 0 })).toBeUndefined()
    expect(resolveFreeQuota({ userExperienceAll: -1 })).toBeUndefined()
    expect(resolveFreeQuota({ userExperienceAll: 'abc' as never })).toBeUndefined()
    expect(resolveFreeQuota(undefined)).toBeUndefined()
    expect(resolveFreeQuota(null)).toBeUndefined()
  })
})
