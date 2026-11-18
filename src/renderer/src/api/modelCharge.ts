import http from '@renderer/utils/request'

/**
 * 模型价格主数据（与控制台「模型价格」页同源）
 * 桌面端收费浮窗价格展示以该接口为唯一权威来源，pagePcList 快照仅作回退。
 */

/** 按模型类型查询价格配置列表（modelId/modelName 由服务端过滤，单行查询耗时与网站端搜索同量级） */
export const queryModelChargeConfigListApi = (params: {
  modelAttribute: string
  modelName?: string
  modelId?: number | string
}) => {
  return http.get(`/ai/modelChargeConfig/queryList`, params as any, { cancel: false, loading: false })
}

/** 按 modelId 查询单个模型价格配置 */
export const getOneByModelIdApi = (modelId: number | string) => {
  return http.get(`/ai/modelChargeConfig/getOneByModelId/${modelId}`, {}, { cancel: false, loading: false })
}
