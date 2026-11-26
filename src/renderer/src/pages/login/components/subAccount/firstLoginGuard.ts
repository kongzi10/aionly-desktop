import { loggerService } from '@logger'
import { checkForceUpdatePwdApi } from '@renderer/api/login'
import { FEATURE_SUB_FORCE_UPDATE_PWD } from '@renderer/config/featureFlags'
import i18n from '@renderer/i18n'

import ForceUpdatePwdModal from './ForceUpdatePwdModal'

const logger = loggerService.withContext('firstLoginGuard')

/** 守卫结果：entered=已落 token 并进入；switch=用户切换账号（未落 token）；fail=检查异常 fail-closed（未落 token） */
export type GuardResult = 'entered' | 'switch' | 'fail'

/**
 * 内存级待提交 token 缓存（仅内存，不落 localStorage）。
 * 命中强制改密时暂存于此；改密成功或未命中时才写入 localStorage，
 * 保证「命中强制改密的临时 token 永不持久化」（安全要求）。
 */
let pendingToken: string | undefined

/**
 * 子账号登录成功后的首登强制改密守卫编排。
 *
 * 时序（对齐文档 §5.2）：
 * loginApi 成功 → token 暂存内存（不落盘）→ 本守卫
 *   → checkForceUpdatePwd
 *     ├─ 未命中 / 开关关闭 → finish()：localStorage.setItem('token') → onEntered(username) 进入
 *     ├─ 检查异常 → fail-closed：提示网络异常，不落 token，返回 'fail' 留在登录页
 *     └─ 命中 → 弹不可关闭改密弹窗
 *         ├─ success → finish() 进入
 *         └─ switch → 丢弃 pendingToken，返回 'switch'（登录页清空密码）
 *
 * @param params 子账号名与主账号标识（与 loginApi 入参一致）
 * @param accessToken loginApi 返回的临时 token（暂存内存）
 * @param onEntered 进入系统的回调（组件内 handleLoginSuccess，负责读取 localStorage token）
 */
export async function guardAndFinish(
  params: { username: string; phoneNumber: string },
  accessToken: string,
  onEntered: (username: string) => Promise<void>
): Promise<GuardResult> {
  const { username, phoneNumber } = params
  pendingToken = accessToken

  const finish = async (): Promise<GuardResult> => {
    if (pendingToken) {
      localStorage.setItem('token', pendingToken)
      pendingToken = undefined
    }
    await onEntered(username)
    return 'entered'
  }

  // 应急回滚：开关关闭时行为与现状完全一致，直接进入
  if (!FEATURE_SUB_FORCE_UPDATE_PWD) {
    return finish()
  }

  // 步骤1：首登强制改密检查
  let needUpdatePwd = false
  try {
    const chk = await checkForceUpdatePwdApi({ userName: username, phoneNumber })
    needUpdatePwd = (chk as any)?.data?.needUpdatePwd === true
    logger.info('子账号首登强制改密 check', { userName: username, phoneNumber, needUpdatePwd })
  } catch (e) {
    // fail-closed：检查失败不放行、不进入、不落 token
    logger.error('子账号首登强制改密 check_fail', e as any)
    pendingToken = undefined
    window.toast?.error(i18n.t('login.sub_account.force_update_pwd.err_network'))
    return 'fail'
  }

  // 步骤2：未命中 → 直接进入
  if (!needUpdatePwd) {
    return finish()
  }

  // 步骤3：命中 → 弹不可关闭改密弹窗
  logger.info('子账号首登强制改密 show', { userName: username })
  const result = await ForceUpdatePwdModal.show({ username, phoneNumber })
  if (result === 'switch') {
    pendingToken = undefined
    return 'switch'
  }
  // 改密成功 → 进入
  return finish()
}

/** 测试/登出等场景清理内存缓存 token */
export function clearPendingToken() {
  pendingToken = undefined
}
