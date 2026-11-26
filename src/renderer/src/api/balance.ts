import http from '@renderer/utils/request'

export const addRecharge = (params) => {
  return http.post(`/money/recharge/addRecharge`, params, { cancel: false, headers: { isEncrypt: true } })
}

//直接充值
export const addDirectRecharge = (params) => {
  return http.post(`/money/recharge/addDirectRecharge`, params, { cancel: false, headers: { isEncrypt: true } })
}

export const returnUrl = (params) => {
  return http.post(`/money/recharge/returnUrl`, params, { cancel: false })
}

export const queryMoneyConfig = (params = {}) => {
  return http.post(`/money/recharge/queryMoneyConfig`, params, { cancel: false })
}

export const tradeQuery = (params) => {
  return http.get(`/money/recharge/tradeQuery`, params, { cancel: false })
}

export const exchange = (params) => {
  return http.get(`/money/recharge/exchange`, params, { cancel: false })
}

export const getMoneyRechargeList = (params) => {
  return http.get(`/money/recharge/getMoneyRechargeList`, params, { cancel: false })
}

export const addMoneyConsumption = (params) => {
  return http.post(`/money/moneyConsumption/addMoneyConsumption`, params, {
    cancel: false,
    headers: { isEncrypt: true }
  })
}
export const addModelPayLater = (params) => {
  return http.post(`/money/moneyConsumption/addModelPayLater`, params, { cancel: false, headers: { isEncrypt: true } })
}

/** 一键批量开通先用后付模型，请求体加密，传参 { modelIds, autoOpenNewModel }；options 可覆盖请求配置（如 showError: false 由调用方自行处理业务错误） */
export const batchAddModelPayLaterApi = (params, options: Record<string, any> = {}) => {
  return http.post(`/money/moneyConsumption/batchAddModelPayLater`, params, {
    cancel: false,
    headers: { isEncrypt: true },
    ...options
  })
}

export const totalAmount = (params) => {
  return http.get(`/money/recharge/totalAmount`, params, { cancel: false })
}

export const paymentCodechaApi = (params) => {
  return http.get(`/money/moneyConsumption/paymentCode`, params, { loading: false }) // 正常 post json 请求  ==>  application/json
}

export const validatePaymentCode = (params) => {
  return http.post(`/money/moneyConsumption/validatePaymentCode`, params, {
    loading: false,
    headers: { isToken: true, isEncrypt: true }
  })
}

export const validatePaymentEmailCode = (params) => {
  return http.post(`/money/moneyConsumption/validatePaymentEmailCode`, params, {
    loading: false,
    headers: { isToken: true, isEncrypt: true }
  })
}

export const payment = (params) => {
  return http.post(`/money/moneyConsumption/payment`, params, { cancel: false, headers: { isEncrypt: true } })
}

export const paycancel = (params) => {
  return http.post(`/money/moneyConsumption/paycancel`, params, { cancel: false })
}

export const queryListModelId = (modelId) => {
  return http.get(`/ai/modelChargePackage/queryListModelId/${modelId}`, {}, { cancel: false })
}

export const listByModelId = (modelId) => {
  return http.get(`/money/moneyConsumption/listByModelId/${modelId}`, {}, { cancel: false })
}

export const getMoneyConsumptionlist = (params) => {
  return http.get(`/money/moneyConsumption/getMoneyConsumptionlist`, params, { cancel: false })
}

export const deletConsumption = (id) => {
  return http.get(`/money/moneyConsumption/deletConsumption/${id}`, {}, { cancel: false })
}

export const listByOrderNum = (orderNum) => {
  return http.get(`/bus/userVideoPackage/listByOrderNum/${orderNum}`, {}, { cancel: false })
}

export const getGoldDown = (params) => {
  return http.get(`/bus/downloadRecord/getGoldDown`, params, { cancel: false, loading: false })
}
export const getFinanceInfo = (params = {}) => {
  return http.get(`/money/userBalance/getFinanceInfo`, params, { cancel: false, loading: false })
}
//获取用户购买的音色列表
export const getUserTimbreList = (modelId) => {
  return http.get(`/bus/userVideoPackage/getUserTimbreList?modelId=` + modelId, {}, { cancel: false, loading: false })
}

export const listVoiceByModelId = (params) => {
  return http.get(`/money/moneyConsumption/listVoiceByModelId`, params, { cancel: false })
}

export const savePendingPaymentOrder = (id, cancelType) => {
  return http.get(`/money/moneyConsumption/savePendingPaymentOrder?id=${id}&cancelType=${cancelType}`, {
    cancel: false
  })
}

export const wxRechargeInquiry = (orderNumMy) => {
  return http.get(`/money/recharge/wxRechargeInquiry?orderNumMy=${orderNumMy}`, { cancel: false })
}
export const wxRechargeWx = (orderNumMy) => {
  return http.get(`/money/moneyWxpay/wxRechargeWx?orderNumMy=${orderNumMy}`, { cancel: false })
}

export const wxRechargeComsumption = (orderNumMy) => {
  return http.get(`/money/moneyWxpay/wxRechargeComsumption?orderNumMy=${orderNumMy}`, { cancel: false })
}

//订单支付
export const addOrderRechargeApi = (params) => {
  return http.post(`/money/recharge/addOrderRecharge`, params, { cancel: false, headers: { isEncrypt: true } })
}

//返回订单
export const returnOrderUrlApi = (params) => {
  return http.post(`/money/recharge/returnOrderUrl`, params, { cancel: false })
}

//查询是否使用过首冲价
export const getUseFirstPrice = () => {
  return http.get(`/money/moneyConsumption/getUseFirstPrice`, {}, { cancel: false })
}

export const capture = (token, PayerID) => {
  return http.get(`/money/recharge/paypalCapture?token=${token}&PayerID=${PayerID}`, { cancel: false })
}
export const paypalStatus = (token) => {
  return http.get(`/money/recharge/paypalStatus?token=${token}`, { cancel: false })
}
export const paypalCancel = (token) => {
  return http.get(`/money/recharge/paypalCancel?token=${token}`, { cancel: false })
}
export const currency = (cny) => {
  return http.get(`/money/recharge/currency?cny=${cny}`, { cancel: false })
}

export const checkModelUserDisable = (modelId) => {
  return http.get(`ai/modelUserDisable/checkModelUserDisable/${modelId}`, {}, { cancel: false })
}

//获取会员状态
export const getMemberStatus = () => {
  return http.get(`bus/userInfo/getMemberStatus`, {}, { cancel: false })
}

//获取会员订单列表

export const getMemberOrderListApi = (params) => {
  return http.get(`/money/memberOrder/getMemberOrderList`, params, { cancel: false })
}

//会员充值
export const addMemberRechargeApi = (params) => {
  return http.post(`/money/memberOrder/addRecharge`, params, { cancel: false, headers: { isEncrypt: true } })
}

//主动取消
export const saveMemberPendingPaymentOrderlApi = (id) => {
  return http.get(`/money/memberOrder/savePendingPaymentOrder?id=${id}`, { cancel: false })
}

//继续支付
export const addResumeApi = (params) => {
  return http.post(`/money/memberOrder/resume`, params, { cancel: false, headers: { isEncrypt: true } })
}

// 保存余额预警阈值配置
export const saveBalanceThresholdConfig = (params) => {
  return http.post(`/money/balanceThresholdConfig/add`, params, {
    cancel: false,
    headers: {
      isEncrypt: false
    }
  })
}

// 获取余额预警阈值配置（根据用户ID查询）
export const getBalanceThresholdConfig = (userId) => {
  return http.get(`/money/balanceThresholdConfig/getByUserId`, { userId }, { cancel: false })
}

// 更新余额预警阈值配置
export const updateBalanceThresholdConfig = (params) => {
  return http.post(`/money/balanceThresholdConfig/update`, params, {
    cancel: false,
    headers: {
      isEncrypt: false
    }
  })
}

// 禁用余额预警配置（将状态置为终止）
export const disableBalanceThresholdConfig = (params) => {
  return http.get(`/money/balanceThresholdConfig/disable`, params, {
    cancel: false
  })
}

// ---------- 余额阈值通知接收人 ----------
const notifyReceiverBase = '/money/balanceThresholdNotifyReceiver'

/** 根据阈值配置ID获取通知接收人列表 */
export const listNotifyReceiverByConfigId = (configId) => {
  return http.get(`${notifyReceiverBase}/list`, { configId }, { cancel: false })
}

/** 获取通知接收人详情 */
export const getNotifyReceiverInfo = (id) => {
  return http.get(`${notifyReceiverBase}/${id}`, {}, { cancel: false })
}

/** 新增通知接收人 */
export const addNotifyReceiver = (data) => {
  return http.post(notifyReceiverBase, data, { cancel: false })
}

/** 修改通知接收人 */
export const updateNotifyReceiver = (data) => {
  return http.put(notifyReceiverBase, data, { cancel: false })
}

/** 删除通知接收人 */
export const removeNotifyReceiver = (ids) => {
  return http.delete(`${notifyReceiverBase}/${ids}`, {}, { cancel: false })
}

export const getChildLimit = () => {
  return http.get(`/money/recharge/getChildLimit`, {}, { cancel: false, loading: false })
}

//获取token plan订单列表
export const getTokenPlanOrderListApi = (params) => {
  return http.get(`/ai/tokenPlanSubscribe/list`, params, { cancel: false })
}

export const getIndexTokenPlanPageListApi = (params) => {
  return http.get(`/ai/tokenPlanSubscribe/queryIndexPageList`, params, { cancel: false })
}

export const queryIndexDetail = (params: any) => {
  return http.get(`/ai/tokenPlanSubscribe/queryIndexDetail`, params, { cancel: false })
}

export const getRacorePayReslut = (id) => {
  return http.get(`/money/recharge/getRacorePayReslut/${id}`, {}, { cancel: false })
}
