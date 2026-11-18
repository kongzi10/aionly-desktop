/**
 * 刊例价折扣活动（官网「限时X折 / 限时免费」营销活动）
 * 对应后端 org.dromara.ai.domain.vo.PublishPriceDiscountActivityVo
 */
export interface PublishPriceDiscountActivity {
  /** 刊例价折扣活动id */
  discountId: number
  /** 活动名称 */
  activityName?: string
  /** 折扣力度：50 表示5折（乘数=discount/100）；0 表示限时免费 */
  discount: number
  /** 活动开始时间 */
  startTime: string
  /** 活动结束时间（展示有效期兜底校验） */
  endTime: string
}

/** 模型ID（ai_model.id） -> 当前生效活动 */
export type PublishPriceDiscountMap = Record<string, PublishPriceDiscountActivity>
