interface BackupIdentity {
  metadata?: {
    version?: number
    scope?: string
    profile?: { id?: string }
  }
}

export function validateProfileBackup(backup: BackupIdentity, activeProfileId: string): void {
  if (!activeProfileId) throw new Error('Profile is not active')
  if (backup.metadata?.version !== PROFILE_BACKUP_VERSION || backup.metadata.scope !== PROFILE_BACKUP_SCOPE) {
    throw new Error('Unsupported legacy backup format')
  }
  if (!backup.metadata.profile?.id || backup.metadata.profile.id !== activeProfileId) {
    throw new Error('Backup belongs to another profile')
  }
}
import { PROFILE_BACKUP_SCOPE, PROFILE_BACKUP_VERSION } from '@shared/profileBackup'
