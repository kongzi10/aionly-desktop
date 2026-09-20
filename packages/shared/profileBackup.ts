export const PROFILE_BACKUP_VERSION = 7 as const
export const PROFILE_BACKUP_SCOPE = 'single-profile' as const

export interface ProfileBackupMetadata {
  version: typeof PROFILE_BACKUP_VERSION
  scope: typeof PROFILE_BACKUP_SCOPE
  timestamp: number
  appName: string
  appVersion: string
  platform: string
  arch: string
  profile: {
    id: string
    userIdHash: string
    displayName?: string
  }
}

export interface ProfileBackupPayload {
  metadata: ProfileBackupMetadata
  localStorage: Record<string, string>
  indexedDB: Record<string, unknown>
}
