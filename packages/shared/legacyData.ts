export type LegacyRecoveryState = 'idle' | 'recovering' | 'verifying' | 'completed' | 'failed'

export interface LegacyDataStatus {
  hasLegacyNativeData: boolean
  hasLegacyReduxData: boolean
  hasLegacyIndexedDb: boolean
  recoveryState: LegacyRecoveryState
  cleanupAllowed: boolean
  lastError?: string
}

export interface LegacyRecoveryResult {
  copiedFiles: number
  preservedConflicts: number
}
