import { loggerService } from '@logger'
import type { Middleware } from '@reduxjs/toolkit'
import { getActiveProfileId } from '@renderer/services/ProfileStorageService'
import { IpcChannel } from '@shared/IpcChannel'
import type { StoreSyncAction } from '@types'

const logger = loggerService.withContext('StoreSyncService')

/** 未登录/无身份窗口（redux persist key 为 persist:aionly）的统一身份戳 */
export const LEGACY_PROFILE_STAMP = 'legacy'

type SyncOptions = {
  syncList: string[]
}

/**
 * StoreSyncService class manages Redux store synchronization between multiple windows
 * It uses singleton pattern to ensure only one sync service instance exists in the application
 *
 * Main features:
 * 1. Synchronizes Redux actions between windows via IPC
 * 2. Provides Redux middleware to intercept and broadcast actions that need syncing
 * 3. Supports whitelist configuration for action types to sync
 * 4. Handles window subscription and unsubscription logic
 */
export class StoreSyncService {
  private static instance: StoreSyncService
  private options: SyncOptions = {
    syncList: []
  }
  private broadcastSyncRemover: (() => void) | null = null
  /**
   * 本窗口 store 绑定的身份 id（redux persist key 所属身份）。
   * subscribe() 时取当前 active profile；身份切换由 applyRendererProfileStorage 调 setLocalProfileId 更新。
   * 注意：接收端校验不能直接读 getActiveProfileId()——localStorage 跨窗口共享，
   * 主窗切换身份后仍存活的辅窗（如 loginOther 不销毁子窗）读到的已是新身份，会导致过滤失效。
   */
  private localProfileId: string | null = null

  private constructor() {
    return
  }

  /** 身份切换/登出时由 applyRendererProfileStorage 调用，保持与本窗口 store 绑定身份一致 */
  public setLocalProfileId(profileId: string | null): void {
    this.localProfileId = profileId
  }

  /** 本窗口身份戳：未登录/未初始化统一为 LEGACY_PROFILE_STAMP */
  private getLocalProfileStamp(): string {
    return this.localProfileId ?? getActiveProfileId() ?? LEGACY_PROFILE_STAMP
  }

  /**
   * Get the singleton instance of StoreSyncService
   */
  public static getInstance(): StoreSyncService {
    if (!StoreSyncService.instance) {
      StoreSyncService.instance = new StoreSyncService()
    }
    return StoreSyncService.instance
  }

  /**
   * Set sync options
   * @param options Partial sync options
   */
  public setOptions(options: Partial<SyncOptions>): void {
    this.options = { ...this.options, ...options }
  }

  /**
   * Create Redux middleware to intercept and broadcast actions
   * Actions will not be broadcasted if they are not in whitelist or come from sync
   */
  public createMiddleware(): Middleware {
    return () => (next) => (action) => {
      // Process the action normally first
      const result = next(action)

      // Check if this action came from sync or is a whitelisted action
      const syncAction = action as StoreSyncAction
      if (!syncAction.meta?.fromSync && this.shouldSyncAction(syncAction.type)) {
        // Send to main process for broadcasting to other windows using the preload API
        if (window.api?.storeSync) {
          // 打上本窗口身份戳：接收窗口若绑定其它身份则丢弃，防止跨身份串写持久化数据
          const stamped: StoreSyncAction = {
            ...syncAction,
            meta: { ...syncAction.meta, profileId: this.getLocalProfileStamp() }
          }
          void window.api.storeSync.onUpdate(stamped)
        }
      }

      return result
    }
  }

  /**
   * Check if action type is in whitelist
   * @param actionType Action type to check
   * @returns Whether the action should be synced
   */
  private shouldSyncAction(actionType: string): boolean {
    // If no whitelist is specified, sync nothing
    if (!this.options.syncList.length) {
      return false
    }

    // Check if the action belongs to a store slice we want to sync
    return this.options.syncList.some((prefix) => {
      return actionType.startsWith(prefix)
    })
  }

  /**
   * Subscribe to sync service
   * Sets up IPC listener and registers cleanup on window close
   */
  public subscribe(): void {
    if (this.broadcastSyncRemover || !window.api?.storeSync) {
      return
    }

    // 记录本窗口 store 绑定的身份（store 创建与 subscribe 之间无身份切换，取 active profile 即绑定身份）
    if (this.localProfileId === null) {
      this.localProfileId = getActiveProfileId()
    }

    this.broadcastSyncRemover = window.electron.ipcRenderer.on(
      IpcChannel.StoreSync_BroadcastSync,
      (_, action: StoreSyncAction) => {
        try {
          // 跨身份隔离：丢弃其它身份窗口广播的动作（无 profileId 的旧版本消息放行，便于灰度期兼容）
          const senderProfileId = action.meta?.profileId
          const localStamp = this.getLocalProfileStamp()
          if (senderProfileId && senderProfileId !== localStamp) {
            logger.warn(`Drop synced action "${action.type}" from profile ${senderProfileId} (local ${localStamp})`)
            return
          }
          // Dispatch to the store
          if (window.store) {
            window.store.dispatch(action)
          }
        } catch (error) {
          logger.error('Error dispatching synced action:', error as Error)
        }
      }
    )

    void window.api.storeSync.subscribe()

    window.addEventListener('beforeunload', () => {
      this.unsubscribe()
    })
  }

  /**
   * Unsubscribe from sync service
   * Cleans up IPC listener and related resources
   */
  public unsubscribe(): void {
    if (window.api?.storeSync) {
      void window.api.storeSync.unsubscribe()
    }

    if (this.broadcastSyncRemover) {
      this.broadcastSyncRemover()
      this.broadcastSyncRemover = null
    }
  }
}

// Export singleton instance
export default StoreSyncService.getInstance()
