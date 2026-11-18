import http from '@renderer/utils/request'

//获取计费管理列表
export const pageListApi = (params) => {
  return http.get(`/bus/userModelPackage/pagePcList`, params, { cancel: false })
}

//启用量包
export const enablePackageApi = (id) => {
  return http.post(`/bus/userModelPackage/enable/${id}`, {}, { cancel: false })
}

//启用检测
export const checkEnableApi = (id) => {
  return http.post(`/bus/userModelPackage/checkEnable/${id}`, {}, { cancel: false })
}

//停用量包
export const stopPackageApi = (id) => {
  return http.post(`/bus/userModelPackage/stop/${id}`, {}, { cancel: false })
}

//查询开通详细信息
export const getUserModelPackageById = (params) => {
  return http.get(`/bus/userModelPackage/getUserModelPackageById`, params, { cancel: false })
}

//组件分页查询
export const pageComponentListApi = (params) => {
  return http.get(`/bus/userComponentPackage/pagePcList`, params, { cancel: false })
}

//启用组件
export const enableComponentPackageApi = (id) => {
  return http.post(`/bus/userComponentPackage/enable/${id}`, {}, { cancel: false })
}

//停用组件
export const stopComponentPackageApi = (id) => {
  return http.post(`/bus/userComponentPackage/stop/${id}`, {}, { cancel: false })
}

//查询开通列表
export const getUserModelPackageList = (params) => {
  return http.get(`/bus/userModelPackage/queryPackageList`, params, { cancel: false })
}

//查询个人有效模型量包
export const getUserModelBagList = (params) => {
  return http.get(`/bus/userModelPackage/getUserModelBagList`, params, { cancel: false })
}

//查询开启的组件
export const queryUserComponentPackageByLoginUser = (params) => {
  return http.get(`/bus/userComponentPackage/queryUserComponentPackageByLoginUser`, params, { cancel: false })
}

// 获取未开通的先用后付模型列表（一键开通弹框用）
export const listUnopenedPayLaterModelsApi = () => {
  return http.get(`/ai/model/listUnopenedPayLaterModels`, {}, { cancel: false })
}

// 查询当前登录用户生效的刊例价折扣活动（按模型ID分组，模型列表展示「限时X折」标签用）
export const queryPublishPriceDiscountApi = (modelIds?: (number | string)[]) => {
  return http.get(
    `/ai/modelUserDiscount/publishPriceDiscount`,
    modelIds && modelIds.length > 0 ? { modelIds: modelIds.join(',') } : {},
    { cancel: false, loading: false }
  )
}

// 获取模型推荐标签字典（ai_model_label 有效标签，recommendLabel 的 labelId→labelName 映射用；服务端带缓存）
export const listModelLabelsApi = () => {
  return http.get(`/ai/modelLabel/getList`, {}, { cancel: false, loading: false })
}
