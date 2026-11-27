import { loggerService } from '@logger'

import { CacheService } from './CacheService'
import { ACTIVE_PROFILE_STORAGE_KEY, authStorage } from './ProfileStorageService'
import storeSyncService from './StoreSyncService'

const logger = loggerService.withContext('ProfileRendererRuntime')

export interface RendererProfileBootstrap {
  token?: string
  userInfo?: string
  serviceInfo?: string
  localUserSecret?: string
}

export interface RendererProfileSwitch {
  profileId: string | null
  bootstrap: RendererProfileBootstrap | null
}

export interface RendererProfileRuntimeDependencies {
  flushStore(): Promise<unknown>
  pauseStore(): void
  closeDatabase(): void
  applyProfileStorage(profile: RendererProfileSwitch): void
  /**
   * 激活新 profile 后、重建 DB/Store 前执行旧命名空间数据的一次性自动迁移。
   * 异常由 switchRendererProfile 兜底捕获，迁移失败不得阻断身份切换。
   */
  migrateLegacyData?(profile: RendererProfileSwitch): Promise<void>
  resetDatabase(): void
  resetStore(): void | Promise<void>
  initializeProfile?(): void | Promise<void>
  notifyProfileChanged(): void
  navigate(profileId: string | null): void
  recover?(): void
}

export const PROFILE_RUNTIME_CHANGED_EVENT = 'aionly:profile-runtime-changed'

export class ProfileGeneration {
  private value = 0

  capture(): number {
    return this.value
  }

  advance(): number {
    this.value += 1
    return this.value
  }

  assertCurrent(generation: number): void {
    if (generation !== this.value) throw new Error('Profile changed before the operation completed')
  }
}

export const profileGeneration = new ProfileGeneration()

export function applyRendererProfileStorage({ profileId, bootstrap }: RendererProfileSwitch): void {
  if (profileId) localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profileId)
  else localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY)

  // 同步更新跨窗口 StoreSync 的本窗口身份戳：
  // 后续新 store 的广播/接收均以此为准，防止切换期间残留辅窗的动作串写新身份数据
  storeSyncService.setLocalProfileId(profileId)

  const authKeys = ['token', 'userInfo', 'serviceInfo', 'userSecretKey'] as const
  if (!profileId) {
    for (const key of authKeys) localStorage.removeItem(key)
    return
  }

  if (!bootstrap) return
  const values = {
    token: bootstrap.token,
    userInfo: bootstrap.userInfo,
    serviceInfo: bootstrap.serviceInfo,
    userSecretKey: bootstrap.localUserSecret
  }
  for (const key of authKeys) {
    const value = values[key]
    if (value) authStorage.setItem(key, value)
    // serviceInfo 是域名级服务配置缓存（planStatus 等），不是账号凭据：
    // bootstrap 缺失时保留当前 profile 命名空间的既有值，登录/切换后由 refreshServiceInfo() 统一拉取覆盖，
    // 防止误删导致 TokenPlan 等入口消失
    else if (key !== 'serviceInfo') authStorage.removeItem(key)
    localStorage.removeItem(key)
  }
}

export async function switchRendererProfile(
  profile: RendererProfileSwitch,
  dependencies: RendererProfileRuntimeDependencies
): Promise<void> {
  profileGeneration.advance()
  let runtimeMutationStarted = false
  try {
    await dependencies.flushStore()
    runtimeMutationStarted = true
    dependencies.pauseStore()
    dependencies.closeDatabase()
    dependencies.applyProfileStorage(profile)
    // applyProfileStorage 已写入 profile 命名空间的 userInfo（归属校验依赖），
    // 且此时旧 DB 连接已关闭、新 Store 尚未 rehydrate，是迁移旧数据的唯一安全窗口
    if (profile.profileId && dependencies.migrateLegacyData) {
      try {
        await dependencies.migrateLegacyData(profile)
      } catch (error) {
        // 迁移失败不阻断身份切换；数据仍保留在旧命名空间，可重试或走设置里的"数据恢复"
        logger.error('Legacy data migration failed during profile switch', error as Error)
      }
    }
    // 丢弃旧身份的渲染进程内存 UI 缓存（输入框草稿、模型缓存等），避免重建 UI 后残留到新身份页面
    CacheService.clear()
    dependencies.resetDatabase()
    await dependencies.resetStore()
    await dependencies.initializeProfile?.()
    dependencies.notifyProfileChanged()
    dependencies.navigate(profile.profileId)
  } catch (error) {
    if (runtimeMutationStarted) dependencies.recover?.()
    throw error
  }
}
