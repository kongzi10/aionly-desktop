/**
 * 价格格式化工具
 * 移植自控制台 qt `src/utils/publishDiscount.js` 与 `src/utils/format.ts`，
 * 保证桌面端收费浮窗与控制台「模型价格」页数字口径逐字一致。
 */

/** 去除小数尾零；空值返回 '--'（与控制台 format.ts trimTrailingZeros 一致） */
export const trimTrailingZeros = (value: any): string => {
  if (value === null || value === undefined || value === '') return '--'
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  return String(parseFloat(num.toFixed(6)))
}

/** 数字乘折扣并去尾零 */
export const mulDiscount = (value: any, discount: number): string => {
  const num = Number(value)
  if (discount === null || discount === undefined || Number.isNaN(num)) return trimTrailingZeros(value)
  return trimTrailingZeros(num * discount)
}

const NUMBER_PATTERN = /\d+(?:\.\d+)?/g

/**
 * 对「含单位文本中的数字」应用刊例折扣（与控制台 applyPublishDiscount 一致）
 * 例：applyPublishDiscount('输入：1.5 金币 / M tokens', 0.8) => '输入：1.2 金币 / M tokens'
 */
export const applyPublishDiscount = (value: any, discount: number | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '--'
  if (discount === null || discount === undefined) return String(value)
  const rate = Number(discount)
  if (!rate || Number.isNaN(rate)) return String(value)
  return String(value).replace(NUMBER_PATTERN, (match) => mulDiscount(match, rate))
}

/**
 * 前端拼装数值的价格：USD 先 trim 再折扣（与控制台 discountPrice 一致），金币直接折扣
 */
export const discountPrice = (value: any, discount: number | null | undefined, isUsd = false): string => {
  const base = isUsd
    ? trimTrailingZeros(value)
    : value === null || value === undefined || value === ''
      ? '--'
      : String(value)
  if (base === '--') return '--'
  return applyPublishDiscount(base, discount)
}

/** 折扣是否展示（0=限时免费，(0,1)=限时x折），与控制台 isActiveDiscount 一致 */
export const isActiveDiscount = (discount: any): boolean => {
  if (discount === null || discount === undefined || discount === '') return false
  const num = Number(discount)
  if (Number.isNaN(num)) return false
  return num === 0 || (num > 0 && num < 1)
}
