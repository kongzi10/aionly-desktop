import { db, resetDatabase } from '@renderer/databases'
import { persistor, resetStore } from '@renderer/store'
import type { LegacyDataStatus, LegacyRecoveryState } from '@shared/legacyData'

import { rendererLegacyDataService } from './LegacyDataService'
import { classifyLegacyDataOwner, readLegacyReduxUserId, readProfileAuthUserId } from './ProfileDataMigrationService'
import { PROFILE_RUNTIME_CHANGED_EVENT } from './ProfileRendererRuntime'
import { getActiveProfileId } from './ProfileStorageService'

let operation: Promise<void> | null = null

function requireProfileId(): string {
  const profileId = getActiveProfileId()
  if (!profileId) throw new Error('Profile is not active')
  return profileId
}

export async function getLegacyDataStatus(): Promise<LegacyDataStatus> {
  const profileId = getActiveProfileId()
  if (!profileId) {
    return {
      hasLegacyNativeData: false,
      hasLegacyReduxData: false,
      hasLegacyIndexedDb: false,
      recoveryState: 'idle',
      cleanupAllowed: false
    }
  }
  const [nativeStatus, rendererStatus] = await Promise.all([
    window.api.legacyData.getStatus(),
    rendererLegacyDataService.getStatus(profileId)
  ])
  const states = [nativeStatus.recoveryState, rendererStatus.recoveryState]
  let recoveryState: LegacyRecoveryState = 'idle'
  if (states.includes('failed')) {
    recoveryState = 'failed'
  } else if (states.includes('recovering')) {
    recoveryState = 'recovering'
  } else if (states.includes('verifying')) {
    recoveryState = 'verifying'
  } else if (states.every((state) => state === 'completed')) {
    recoveryState = 'completed'
  }
  return {
    hasLegacyNativeData: nativeStatus.hasLegacyNativeData,
    hasLegacyReduxData: rendererStatus.hasLegacyReduxData,
    hasLegacyIndexedDb: rendererStatus.hasLegacyIndexedDb,
    recoveryState,
    cleanupAllowed:
      nativeStatus.hasLegacyNativeData || rendererStatus.hasLegacyReduxData || rendererStatus.hasLegacyIndexedDb
  }
}

async function withRendererRuntimePaused(action: (profileId: string) => Promise<void>): Promise<void> {
  if (operation) return operation
  operation = (async () => {
    const profileId = requireProfileId()
    await persistor.flush()
    persistor.pause()
    db.close()
    try {
      await action(profileId)
    } finally {
      resetDatabase()
      resetStore()
      window.dispatchEvent(new Event(PROFILE_RUNTIME_CHANGED_EVENT))
    }
  })().finally(() => {
    operation = null
  })
  return operation
}

export function recoverLegacyData(allowUnknownOwner = false): Promise<void> {
  const profileId = requireProfileId()
  const ownerStatus = classifyLegacyDataOwner(
    readLegacyReduxUserId(localStorage),
    readProfileAuthUserId(localStorage, profileId)
  )
  if (ownerStatus === 'mismatch') throw new Error('LEGACY_DATA_OWNER_MISMATCH')
  if (ownerStatus === 'unknown' && !allowUnknownOwner) throw new Error('LEGACY_DATA_OWNER_UNKNOWN')
  return withRendererRuntimePaused(async (profileId) => {
    await window.api.legacyData.recover()
    await rendererLegacyDataService.recover(profileId)
  })
}

export function cleanupLegacyData(): Promise<void> {
  return withRendererRuntimePaused(async () => {
    const status = await getLegacyDataStatus()
    if (!status.cleanupAllowed) throw new Error('Legacy data does not exist')
    await rendererLegacyDataService.cleanup()
    await window.api.legacyData.cleanup()
  })
}
