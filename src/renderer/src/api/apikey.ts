import http from '@renderer/utils/request'
export const addApikey = (params) => {
  return http.post(`/bus/apikey/addApikey`, params, { cancel: false })
}

export const getApikeyList = (params) => {
  return http.get(`/bus/apikey/getApikeyList`, params, { cancel: false })
}

export const updateApikey = (params) => {
  return http.post(`/bus/apikey/updateApikey`, params, { cancel: false })
}

export const deleteApikeyById = (params) => {
  return http.get(`/bus/apikey/deleteApikeyById`, params, { cancel: false })
}

/**
 * 更新控制台 API Key 启用/禁用状态（对齐网站端 /bus/apikey/changeStatus）
 * @param params.id key 主键
 * @param params.status '0' 禁用 / '1' 启用
 * showError:false — 业务失败由调用方 toast msg，避免全局重复弹错
 */
export const changeApikeyStatus = (params: { id: number | string; status: '0' | '1' }) => {
  return http.post(`/bus/apikey/changeStatus`, params, { cancel: false, showError: false })
}

export const addApikeyIpWhitelist = (params) => {
  return http.post(`/bus/apikeyIpWhitelist`, params, { cancel: false })
}

export const getApikeyIpWhitelist = (params) => {
  return http.get(`/bus/apikeyIpWhitelist/list`, params, { cancel: false })
}

export const updateApikeyIpWhitelist = (params) => {
  return http.put(`/bus/apikeyIpWhitelist`, params, { cancel: false })
}

export const deleteApikeyIpWhitelist = (params) => {
  return http.delete(`/bus/apikeyIpWhitelist/${params.id}`, params, { cancel: false })
}
