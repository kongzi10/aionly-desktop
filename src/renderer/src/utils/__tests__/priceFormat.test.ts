import { describe, expect, it } from 'vitest'

import { applyPublishDiscount, discountPrice, isActiveDiscount, mulDiscount, trimTrailingZeros } from '../priceFormat'

describe('priceFormat', () => {
  describe('trimTrailingZeros', () => {
    it('去除小数尾零', () => {
      expect(trimTrailingZeros('10.50')).toBe('10.5')
      expect(trimTrailingZeros(210.0)).toBe('210')
      expect(trimTrailingZeros('0.1400')).toBe('0.14')
    })
    it('空值返回 --', () => {
      expect(trimTrailingZeros('')).toBe('--')
      expect(trimTrailingZeros(null)).toBe('--')
      expect(trimTrailingZeros(undefined)).toBe('--')
    })
    it('非数字原样返回', () => {
      expect(trimTrailingZeros('abc')).toBe('abc')
    })
  })

  describe('mulDiscount', () => {
    it('数字乘折扣并去尾零', () => {
      expect(mulDiscount('1.5', 0.8)).toBe('1.2')
      expect(mulDiscount(10, 0.5)).toBe('5')
    })
  })

  describe('applyPublishDiscount', () => {
    it('对含单位文本中的数字应用折扣', () => {
      expect(applyPublishDiscount('输入：1.5 金币 / M tokens', 0.8)).toBe('输入：1.2 金币 / M tokens')
      expect(applyPublishDiscount('文本输入: 10.5金币/M tokens', 0.8)).toBe('文本输入: 8.4金币/M tokens')
    })
    it('无折扣或折扣非法时原样返回', () => {
      expect(applyPublishDiscount('输入：1.5 金币 / M tokens', null)).toBe('输入：1.5 金币 / M tokens')
      expect(applyPublishDiscount('输入：1.5 金币 / M tokens', 0)).toBe('输入：1.5 金币 / M tokens')
      expect(applyPublishDiscount('输入：1.5 金币 / M tokens', 1)).toBe('输入：1.5 金币 / M tokens')
    })
    it('空值返回 --', () => {
      expect(applyPublishDiscount('', 0.8)).toBe('--')
    })
  })

  describe('discountPrice', () => {
    it('USD 先 trim 再折扣', () => {
      expect(discountPrice('0.1400', 0.8, true)).toBe('0.112')
    })
    it('金币直接折扣', () => {
      expect(discountPrice('0.14', 0.5, false)).toBe('0.07')
      expect(discountPrice('0.14', null, false)).toBe('0.14')
    })
  })

  describe('isActiveDiscount', () => {
    it('0 与 (0,1) 为有效折扣', () => {
      expect(isActiveDiscount(0)).toBe(true)
      expect(isActiveDiscount(0.5)).toBe(true)
      expect(isActiveDiscount(1)).toBe(false)
      expect(isActiveDiscount(null)).toBe(false)
      expect(isActiveDiscount('')).toBe(false)
    })
  })
})
