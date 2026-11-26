import http from '@renderer/utils/request'

/**
 * 模型体验（免费体验额度）相关接口。
 *
 * 与网站端体验中心 / 模型切换弹窗同源：GET /ai/model/getChangeModelList，
 * selectType=office 时后端（ht ModelServiceImpl#queryChangePage）回填
 * userExperienceAll（额度总量）/ userExperienceRest（已使用量，字段名为历史命名，
 * 实际存的是 ai_model_experience_rest.token_use / interactive_num_use 的累计使用值），
 * 剩余量 = userExperienceAll - userExperienceRest（前端钳 0）。
 */

/** getChangeModelList 返回行（ModelVo 子集，字段与网站端体验中心一致） */
export interface ExperienceModelRow {
  /** ai_model.id */
  id?: string | number
  baseId?: string | number
  model?: string
  modelName?: string
  modelAttribute?: string
  serviceName?: string
  modelFileUrl?: string
  /** 会员专享：0否 1是 */
  memberSpecial?: string
  /** 是否免费：0否 1是 */
  freeFlag?: string
  /** 体验启用状态：0否 1是 */
  experienceStatus?: string
  recommendLabel?: string
  modelLabel?: string
  discountFlag?: string
  discountStartTime?: string
  discountEndTime?: string
  /** 体验额度总量（文本模型为 tokens，非文本为交互次数） */
  userExperienceAll?: number | string
  /** 体验额度已使用量（注意：字段名为历史命名，实际是"已用"而非"剩余"） */
  userExperienceRest?: number | string
}

export interface ChangeModelListParams {
  /** office：免费体验模型列表；open：已开通先用后付模型 */
  selectType?: string
  /** 模型类型：1文本（默认） */
  type?: string
  /** 模型属性：text_model / image_generation 等 */
  modelAttribute?: string
  modelName?: string
  domain?: string
  pageNum?: number
  pageSize?: number
}

// 模型切换列表（与网站端体验中心同源接口）
export const getChangeModelListApi = (params: ChangeModelListParams = {}) => {
  return http.get(
    `/ai/model/getChangeModelList`,
    {
      domain: window.location.hostname || 'localhost:5173',
      pageNum: 1,
      pageSize: 200,
      ...params
    },
    { cancel: false }
  )
}
