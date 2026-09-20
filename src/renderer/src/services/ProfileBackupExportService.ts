import { PROFILE_BACKUP_SCOPE, PROFILE_BACKUP_VERSION, type ProfileBackupPayload } from '@shared/profileBackup'

interface KeyValueEntries {
  entries(): IterableIterator<[string, string]>
}

interface ProfileBackupExportOptions {
  profileId: string
  storage: KeyValueEntries
  exportIndexedDb(): Promise<Record<string, unknown>>
  timestamp?: number
  appName?: string
  appVersion?: string
  platform?: string
  arch?: string
}

export function collectProfileStorage(storage: KeyValueEntries, profileId: string): Record<string, string> {
  const reduxKey = `persist:aionly:${profileId}`
  const profilePrefix = `profile:${profileId}:`
  return Object.fromEntries([...storage.entries()].filter(([key]) => key === reduxKey || key.startsWith(profilePrefix)))
}

export async function createProfileBackupPayload({
  profileId,
  storage,
  exportIndexedDb,
  timestamp = Date.now(),
  appName = 'AiOnly',
  appVersion = '',
  platform = navigator.platform,
  arch = ''
}: ProfileBackupExportOptions): Promise<ProfileBackupPayload> {
  return {
    metadata: {
      version: PROFILE_BACKUP_VERSION,
      scope: PROFILE_BACKUP_SCOPE,
      timestamp,
      appName,
      appVersion,
      platform,
      arch,
      profile: { id: profileId, userIdHash: profileId }
    },
    localStorage: collectProfileStorage(storage, profileId),
    indexedDB: await exportIndexedDb()
  }
}
