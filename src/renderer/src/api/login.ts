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
  return http.post(`/auth/login`, body, { loading: false, headers: { isToken: false, isEncrypt: true } }) // 正常 post json 请求  ==>  application/json
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
