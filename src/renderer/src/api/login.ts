import http from '@renderer/utils/request'

/**
 * @name 登录模块
 */
// 用户登录
export const loginApi = (params) => {
  const body = { ...params }
  const gt = String(body.grantType || '')
  if ((gt === 'sms' || gt === 'email') && body.registerProduct == null) {
    body.registerProduct = 'aionly_client'
  }
  return http.post(`/auth/login`, body, {
    loading: false,
    headers: { isToken: false, isEncrypt: true }
  }) // 正常 post json 请求  ==>  application/json
}

// 扫码登录（PC 端）：generate 取 ticket（免登录）→ 渲染二维码 → status 轮询（免登录）→ CONFIRMED 后复用 loginApi 换 token
export const qrcodeGenerateApi = () => {
  // showError: false：失败提示在二维码区域展示，不弹全局 toast
  return http.post(
    `/auth/qrcode/generate`,
    {},
    {
      loading: false,
      showError: false,
      headers: { isToken: false }
    }
  )
}

export const qrcodeStatusApi = (params: { ticket: string }) => {
  // cancel: false：轮询会重复发同一请求，避免被 axiosCanceler 自取消
  return http.get(`/auth/qrcode/status`, params, {
    loading: false,
    cancel: false,
    showError: false,
    headers: { isToken: false }
  })
}

export const emailCaptchaApi = (params) => {
  return http.get(`/resource/email/code`, params, { loading: false, headers: { isToken: false, isEncrypt: true } }) // 正常 post json 请求  ==>  application/json
}

export const smsCaptchaApi = (params) => {
  return http.get(`/resource/sms/code`, params, { loading: false, headers: { isToken: false, isEncrypt: true } }) // 正常 post json 请求  ==>  application/json
}
/* 短信验证码-（新版带滑块验证token）  参数inviteAccountId非必须，当仅为邀请链接不能输入邀请人手机号*/
export const smsCaptchaAndTokenApi = (params) => {
  return http.get(`/resource/sms/codeForToken`, params, {
    loading: false,
    headers: { isToken: false, isEncrypt: true }
  }) // 正常 post json 请求  ==>  application/json
}

export const passwordCodeApi = (params) => {
  return http.get(`/resource/sms/password_code`, params, {
    loading: false,
    headers: { isToken: false, isEncrypt: true }
  }) // 正常 post json 请求  ==>  application/json
}

//验证码验证
export const validateSmsCodeApi = (params) => {
  return http.post(`/bus/userProfile/validateCode`, params, {
    loading: false,
    headers: { isToken: false, isEncrypt: true }
  })
}

//更改密码
export const updatePwdApi = (params) => {
  return http.post(`/bus/userProfile/updatePwd`, params, {
    loading: false,
    headers: { isToken: false, isEncrypt: true }
  })
}

//设置密码
export const resetPwdApi = (params) => {
  return http.post(`/bus/userProfile/resetPwd`, params, {
    loading: false,
    headers: { isToken: true, isEncrypt: true }
  })
}
//设置支付密码
export const resetPayPwdApi = (params) => {
  return http.post(`/bus/userProfile/resetPayPwd`, params, {
    loading: false,
    headers: { isToken: true, isEncrypt: true }
  })
}
//验证支付密码
export const validatePayPwd = (params) => {
  return http.post(`/bus/userProfile/validatePayPwd`, params, {
    loading: false,
    headers: { isToken: true, isEncrypt: true }
  })
}

export const resetPwdSubApi = (params) => {
  return http.post(`/bus/userProfile/resetPwdSub`, params, {
    loading: false,
    headers: { isToken: true, isEncrypt: true }
  })
}

/**
 * 子账号首次登录强制改密检查。
 * 登录成功后调用，判定是否需要强制修改初始密码（企业开关开启 && 子账号存在 && 从未改密）。
 * 子账号 userName 在不同主账号下可能重复，必须同时传主账号 phoneNumber。
 * showError=false：网络/业务异常交由登录后守卫做 fail-closed 处理，不弹全局 toast。
 * @returns R<{ needUpdatePwd: boolean; forceUpdatePwd: number; subAccount: boolean }>
 */
export const checkForceUpdatePwdApi = (params: { userName: string; phoneNumber: string }) => {
  return http.get(`/bus/userProfile/checkForceUpdatePwd`, params, {
    cancel: false,
    loading: false,
    showError: false,
    headers: { isToken: false }
  })
}

/**
 * 子账号首次登录强制修改初始密码。
 * 后端 @ApiEncrypt 加密通道 + 网关白名单（无需登录态），按 body 中 username + phoneNumber 定位子账号。
 * showError=false：失败信息在强制改密弹窗内行内展示，不弹全局 toast。
 * @param data { username, phoneNumber, oldPassword, newPassword }
 */
export const updateSubPwdFirstLoginApi = (data: {
  username: string
  phoneNumber: string
  oldPassword: string
  newPassword: string
}) => {
  return http.post(`/bus/userProfile/updateSubPwdFirstLogin`, data, {
    loading: false,
    showError: false,
    headers: { isToken: false, isEncrypt: true }
  })
}

// 用户退出登录
export const logoutApi = () => {
  return http.post(`/auth/logout`, {}, { loading: false })
}

// 获取用户信息
export const getUserProfileApi = () => {
  return http.get(`/bus/userProfile/profile`, {}, { loading: false })
}
/**
 * 第三方登录
 */
export const callback = (data) => {
  return http.post(`/auth/social/callback`, data, { loading: false })
}

// 绑定账号
export const authBinding = (source, tenantId) => {
  const params = {
    tenantId: tenantId,
    domain: window.location.host
  }
  return http.get(`/auth/binding/${source}`, params, { loading: false, headers: { isToken: false, isEncrypt: true } })
}

// 启动验证码开关
export const captchaEnabledApi = () => {
  return http.get(`/auth/captcha/code`, { code: 'verify_code_type_user' }, { loading: false })
}

// 获取用户信息（只有用户信息）
export const getUserInfoVo = () => {
  return http.get(`/bus/userProfile/getUserInfoVo`, {}, { loading: false })
}

// AiOnly 登录
export const getApikeyByUserId = (params) => {
  return http.get(`/bus/apikey/getApikeyByUserId`, params, { loading: false })
}
