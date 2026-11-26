/**
 * 会话初始化引导（登录成功 / 切换身份共用）。
 *
 * 抽取自 LoginForm.saveUserInfo（docs/切换身份改造/切换身份功能改造开发文档.md §3.5）：
 * - `fetchSessionData()`：拉取用户信息 + 余额 + apikey（含 tokenPlan 预存替换逻辑）；
 *   返回 `null` 表示会话已过期（请求层业务码 401 已全局提示并跳转 #/login）；
 * - `applySessionData()`：将会话数据写入 Redux store 与 profileStorage。
 *
 * 行为对齐原登录链路：任一步骤失败向上抛错，由调用方决定回退（登录失败提示 / 切换降级）。
 */

import { getFinanceInfo } from '@renderer/api/balance'
import { getApikeyByUserId, getUserProfileApi } from '@renderer/api/login'
import { setupModelsForCurrentUser } from '@renderer/hooks/useAiOnlyModels'
import { profileStorage } from '@renderer/services/ProfileStorageService'
import { store } from '@renderer/store'
import { updateProvider as updateProviderAction } from '@renderer/store/llm'
import { setApiKey, setMyBalance, setUserInfo } from '@renderer/store/user'
import { ENABLED_PLAN_STORAGE_KEY, LOCAL_USER_SECRET_KEY } from '@shared/config/constant'

export interface SessionBootstrapData {
  userData: any
  secretKey: string
  balance: any
  providerApiKey?: string
}

/**
 * 查询并组装当前登录态的会话数据。
 * @returns null 表示会话过期（401，请求层已全局处理跳转）
 */
export async function fetchSessionData(): Promise<SessionBootstrapData | null> {
  const res = await getUserProfileApi()
  // 业务码 401 时请求层 resolve(undefined)：视为会话过期
  if (!res || !res.data) return null
  const user_data = res.data?.user
  const balance = await getFinanceInfo()

  // TODO：无论用户有没有启用tokenPlan, 先使用用户id获取用户的apikey存到本地
  const api_key_res = await getApikeyByUserId({ userId: user_data?.userId || '' })
  const secretKey = api_key_res?.msg ?? ''

  // TODO：用户启用了tokenPlan, 则需要将预存的apikey换成tokenPlan的apikey
  const key = `${ENABLED_PLAN_STORAGE_KEY}_${user_data?.userId || ''}`
  const user_token_plan = localStorage.getItem(key)
  if (!!user_token_plan) {
    const userTokenPlan = JSON.parse(user_token_plan)
    const apiKey = userTokenPlan.apikey
    if (!!apiKey) {
      return { userData: user_data, secretKey, balance: balance.data, providerApiKey: apiKey }
    }
  } else {
    // TODO：用户没有启用tokenPlan, 则使用用户id获取用户的apikey来预存
    return { userData: user_data, secretKey, balance: balance.data, providerApiKey: secretKey }
  }
  return { userData: user_data, secretKey, balance: balance.data, providerApiKey: undefined }
}

/** 将会话数据写入 Redux store 与 profileStorage（与登录成功链路一致） */
export function applySessionData(data: SessionBootstrapData): void {
  store.dispatch(setUserInfo(data.userData || {}))
  store.dispatch(setMyBalance(data.balance))
  store.dispatch(setApiKey(data.secretKey))
  profileStorage.setItem(LOCAL_USER_SECRET_KEY, data.secretKey)
  if (data.providerApiKey) store.dispatch(updateProviderAction({ id: 'aionly', apiKey: data.providerApiKey }))
}

/**
 * 切换身份后的会话初始化：先用 bootstrap 缓存数据点亮 UI，
 * 再拉取服务端数据刷新并校验会话（顺带触发 401 全局处理）。
 * @returns 'ok' 服务端校验通过；'expired' 会话过期（401）；'offline' 网络异常（保留缓存数据，不阻塞切换）
 */
export async function initializeSwitchedSession(
  userId: string,
  cachedUserInfoJson?: string
): Promise<'ok' | 'expired' | 'offline'> {
  if (cachedUserInfoJson) {
    try {
      const cachedUserData = JSON.parse(cachedUserInfoJson)
      if (cachedUserData && typeof cachedUserData === 'object') {
        store.dispatch(setUserInfo(cachedUserData))
      }
    } catch {
      // 缓存 userInfo 解析失败：忽略，等待服务端刷新兜底
    }
  }

  let fresh: SessionBootstrapData | null
  try {
    fresh = await fetchSessionData()
  } catch {
    // 网络异常：离线容错，保留缓存数据进入首页（文档 #7 本地完成切换）
    await setupModelsForCurrentUser(10, userId).catch(() => undefined)
    return 'offline'
  }
  if (!fresh) return 'expired'

  applySessionData(fresh)
  await setupModelsForCurrentUser(10, userId).catch(() => undefined)
  return 'ok'
}
