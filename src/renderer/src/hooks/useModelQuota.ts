import type { ExperienceModelRow } from '@renderer/api/experience'

/**
 * 免费体验额度归一纯函数（可单测，不依赖 React/接口）。
 *
 * 后端口径（ht ModelServiceImpl#queryChangePage，selectType=office）：
 * - userExperienceAll：额度总量（文本模型为 tokens，非文本为交互次数）
 * - userExperienceRest：已使用量（历史命名，实际为累计已用，见 api/experience.ts 注释）
 * 剩余 = max(0, All - Rest)。
 */

/** 额度三态：正常 / 低余量（剩余占比 ≤ 20%）/ 耗尽 */
export type QuotaTone = 'ok' | 'low' | 'empty'

export interface ModelQuota {
  /** 总量 */
  total: number
  /** 已使用 */
  used: number
  /** 剩余（钳 0） */
  rest: number
  /** 计量单位：tokens（文本模型）/ times（交互次数） */
  unit: 'tokens' | 'times'
  /** 剩余百分比（0-100） */
  percent: number
  tone: QuotaTone
}

/** 低余量阈值：剩余占比 ≤ 20% 标橙 */
export const QUOTA_LOW_RATIO = 0.2

/** 千分位格式化（向下取整、负数钳 0），与网站端/原型一致 */
export const formatQuotaNumber = (n: number): string => {
  if (!Number.isFinite(n)) return '0'
  return Math.max(0, Math.floor(n)).toLocaleString('en-US')
}

/** 三态判定：rest<=0 耗尽；rest/total<=20% 低余量；否则正常 */
export const quotaTone = (rest: number, total: number): QuotaTone => {
  if (!(total > 0) || rest <= 0) return 'empty'
  return rest / total <= QUOTA_LOW_RATIO ? 'low' : 'ok'
}

/**
 * 从 getChangeModelList 行解析免费体验额度。
 * 无有效总量配置（缺字段/0/负数/非法值）返回 undefined → 行内不展示额度区。
 */
export function resolveFreeQuota(
  row?: Pick<ExperienceModelRow, 'userExperienceAll' | 'userExperienceRest' | 'modelAttribute'> | null
): ModelQuota | undefined {
  const total = Number(row?.userExperienceAll)
  if (!Number.isFinite(total) || total <= 0) {
    return undefined
  }
  const used = Math.max(0, Number(row?.userExperienceRest) || 0)
  const rest = Math.max(0, total - used)
  const percent = Math.min(100, Math.max(0, (rest / total) * 100))
  return {
    total,
    used,
    rest,
    unit: row?.modelAttribute === 'text_model' ? 'tokens' : 'times',
    percent,
    tone: quotaTone(rest, total)
  }
}
