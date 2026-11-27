/**
 * 服务配置（serviceInfo/agentInfo）统一拉取服务。
 *
 * 背景：`serviceInfo.planStatus` 驱动左侧导航 token plan、设置页 TokenPlan 按钮等入口，
 * 但历史上唯一的拉取点在登录页 Layout —— 启动自动登录、切换身份等链路不经过登录页，
 * serviceInfo 缺失时上述入口全部消失。
 *
 * 本服务提供：
 * - `resolveServiceDomainName()`：统一 domainName 取值（修复打包版 file:// 协议下 hostname 为空的问题）；
 * - `refreshServiceInfo()`：登录态下拉取 serviceInfo 并写入 Redux 与 profile 隔离存储；
 *   失败/空响应保留既有缓存，绝不清空（防止误删 planStatus）。
 */

import { loggerService } from '@logger'
import { getServiceApi } from '@renderer/api/seat'
import { store } from '@renderer/store'
import { setServiceInfo } from '@renderer/store/user'
import { WEB_UI_HOST } from '@shared/config/constant'

const logger = loggerService.withContext('ServiceInfoService')

/**
 * 解析 getAgentOrService 的 domainName 参数。
 * - dev/web 环境：`window.location.hostname` 非空，直接使用（与历史行为一致）；
 * - 打包版主窗口经 loadFile（file:// 协议）加载，hostname 为空串：回退到官网域名。
 * TODO: 空域名/回退域名的后端匹配行为需与后端最终确认。
 */
export function resolveServiceDomainName(): string {
  const hostname = window.location.hostname
  if (hostname) return hostname
  try {
    return new URL(WEB_UI_HOST).hostname
  } catch {
    return ''
  }
}

/**
 * 登录态下刷新 serviceInfo（写入 Redux + profile 隔离 localStorage）。
 * - 未登录不请求；
 * - 请求失败或响应为空时保留既有缓存，避免清空 planStatus 导致 TokenPlan 入口消失。
 */
export async function refreshServiceInfo(): Promise<void> {
  if (!store.getState().user?.token) return
  try {
    const res = await getServiceApi(resolveServiceDomainName())
    const agentInfo = (res as { data?: unknown } | undefined)?.data
    if (agentInfo && typeof agentInfo === 'object') {
      store.dispatch(setServiceInfo(agentInfo as Record<string, unknown>))
    } else {
      logger.warn('refreshServiceInfo got empty agentInfo, keep cached serviceInfo')
    }
  } catch (error) {
    logger.warn('refreshServiceInfo failed, keep cached serviceInfo', error as Error)
  }
}
