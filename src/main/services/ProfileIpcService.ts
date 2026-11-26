import path from 'node:path'

import { IpcChannel } from '@shared/IpcChannel'
import type { UpsertAccountRequest } from '@shared/profile'
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import { app, BrowserWindow, ipcMain } from 'electron'

import { LegacyDataService } from './LegacyDataService'
import type { ProfileRuntime } from './ProfileRuntime'
import { getUserProfileService, type UserProfile } from './UserProfileService'
import { initSessionUserAgent } from './WebviewService'

let registered = false
let getMainWebContentsId: () => number | undefined = () => undefined

export function setProfileMainWebContentsIdResolver(resolver: () => number | undefined): void {
  getMainWebContentsId = resolver
}

export function isTrustedProfileIpcSender(
  url: string,
  senderType = 'window',
  senderId?: number,
  mainWebContentsId?: number
): boolean {
  if (senderType !== 'window' || senderId === undefined || senderId !== mainWebContentsId) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'file:' || (parsed.protocol === 'http:' && parsed.hostname === 'localhost')
  } catch {
    return false
  }
}

function requireTrustedProfileIpcSender(event: IpcMainEvent | IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? event.sender.getURL()
  const currentMainWebContentsId = getMainWebContentsId()
  if (!isTrustedProfileIpcSender(url, event.sender.getType(), event.sender.id, currentMainWebContentsId)) {
    throw new Error('Profile lifecycle IPC is restricted to the application renderer')
  }
}

export function createProfileSwitchResponse(profileId: string | null): { profileId: string | null } {
  return { profileId }
}

export function createProfileScopedServiceResolver<T, P extends { id: string }>(factory: (profile: P) => T) {
  let cachedProfileId: string | undefined
  let cachedService: T | undefined
  return (profile: P): T => {
    if (!cachedService || cachedProfileId !== profile.id) {
      cachedProfileId = profile.id
      cachedService = factory(profile)
    }
    return cachedService
  }
}

export function closeProfileRendererWindows(windows: BrowserWindow[], switchingWebContentsId: number): void {
  for (const window of windows) {
    if (window.webContents.id !== switchingWebContentsId && !window.isDestroyed()) window.destroy()
  }
}

export async function runWithProfileRuntimeStopped<T>(
  runtime: Pick<ProfileRuntime, 'isActive' | 'start' | 'stop'>,
  action: () => Promise<T>
): Promise<T> {
  const shouldRestart = runtime.isActive()
  if (shouldRestart) await runtime.stop()
  try {
    return await action()
  } finally {
    if (shouldRestart) await runtime.start()
  }
}

export function registerProfileIpc(runtime: ProfileRuntime): void {
  if (registered) return
  registered = true

  ipcMain.on(IpcChannel.Profile_GetBootstrap, (event: IpcMainEvent) => {
    requireTrustedProfileIpcSender(event)
    const service = getUserProfileService()
    const profile = service.getActiveProfile()
    event.returnValue = {
      profileId: profile?.id ?? null,
      bootstrap: profile ? service.consumeBootstrap(profile.id) : null
    }
  })

  ipcMain.handle(
    IpcChannel.Profile_Activate,
    async (event, userId: string, bootstrap: Record<string, string | undefined>) => {
      requireTrustedProfileIpcSender(event)
      if (typeof userId !== 'string' || !userId.trim()) throw new Error('Invalid profile user id')
      event.sender.session.flushStorageData()
      await runtime.stop()
      try {
        const profile = await getUserProfileService().activate(userId, bootstrap)
        closeProfileRendererWindows(BrowserWindow.getAllWindows(), event.sender.id)
        initSessionUserAgent()
        return createProfileSwitchResponse(profile.id)
      } catch (error) {
        if (getUserProfileService().getActiveProfile()) await runtime.start()
        throw error
      }
    }
  )

  ipcMain.handle(IpcChannel.Profile_Deactivate, async (event) => {
    requireTrustedProfileIpcSender(event)
    event.sender.session.flushStorageData()
    await runtime.stop()
    try {
      await getUserProfileService().deactivate()
      closeProfileRendererWindows(BrowserWindow.getAllWindows(), event.sender.id)
      return { success: true, ...createProfileSwitchResponse(null) }
    } catch (error) {
      if (getUserProfileService().getActiveProfile()) await runtime.start()
      throw error
    }
  })

  ipcMain.handle(IpcChannel.Profile_RendererReady, async (event) => {
    requireTrustedProfileIpcSender(event)
    if (!getUserProfileService().getActiveProfile()) return { started: false }
    await runtime.start()
    return { started: true }
  })

  // 历史登录账号列表：仅下发掩码元数据（AccountView 已在主进程剥离 account 原文与 userId）
  ipcMain.handle(IpcChannel.Profile_ListAccounts, (event) => {
    requireTrustedProfileIpcSender(event)
    return getUserProfileService().listAccounts()
  })

  // 移除历史登录记录：拒绝删除当前登录（ACTIVE_PROFILE_PROTECTED）；保留数据目录
  ipcMain.handle(IpcChannel.Profile_RemoveAccount, async (event, profileId: string) => {
    requireTrustedProfileIpcSender(event)
    return getUserProfileService().removeAccount(profileId)
  })

  // 切换前准备：解码长期凭据一次性返回（凭据零日志，异常信息仅含 profileId 与错误码）
  ipcMain.handle(IpcChannel.Profile_PrepareSwitch, (event, profileId: string) => {
    requireTrustedProfileIpcSender(event)
    return getUserProfileService().prepareSwitch(profileId)
  })

  // 登录成功回写：credentials + accounts（LRU）+ 复用 activate 编排（runtime 停机/窗口关闭/UA 刷新）
  ipcMain.handle(IpcChannel.Profile_UpsertAccount, async (event, req: UpsertAccountRequest) => {
    requireTrustedProfileIpcSender(event)
    if (!req || typeof req.userId !== 'string' || !req.userId.trim()) throw new Error('Invalid profile user id')
    event.sender.session.flushStorageData()
    await runtime.stop()
    try {
      const result = await getUserProfileService().upsertAccount(req)
      closeProfileRendererWindows(BrowserWindow.getAllWindows(), event.sender.id)
      initSessionUserAgent()
      return result
    } catch (error) {
      if (getUserProfileService().getActiveProfile()) await runtime.start()
      throw error
    }
  })

  const resolveLegacyService = createProfileScopedServiceResolver<LegacyDataService, UserProfile>(
    (profile) =>
      new LegacyDataService({
        legacyRoot: path.join(app.getPath('userData'), 'Data'),
        legacyClaudeRoot: path.join(app.getPath('userData'), '.claude'),
        profileRoot: profile.dataRoot,
        markerRoot: path.join(app.getPath('userData'), 'Global'),
        profileId: profile.id
      })
  )
  const getLegacyService = () => {
    const profile = getUserProfileService().getActiveProfile()
    if (!profile) throw new Error('Profile is not active')
    return resolveLegacyService(profile)
  }

  ipcMain.handle(IpcChannel.LegacyData_GetStatus, async (event) => {
    requireTrustedProfileIpcSender(event)
    return getLegacyService().getStatus()
  })
  ipcMain.handle(IpcChannel.LegacyData_Recover, async (event) => {
    requireTrustedProfileIpcSender(event)
    closeProfileRendererWindows(BrowserWindow.getAllWindows(), event.sender.id)
    return runWithProfileRuntimeStopped(runtime, () => getLegacyService().recover())
  })
  ipcMain.handle(IpcChannel.LegacyData_Cleanup, async (event) => {
    requireTrustedProfileIpcSender(event)
    await getLegacyService().cleanup()
    return { success: true }
  })
}
