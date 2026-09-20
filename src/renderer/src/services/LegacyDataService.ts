import type { LegacyDataStatus } from '@shared/legacyData'
import Dexie from 'dexie'

import {
  LEGACY_PROFILE_KEYS,
  PROFILE_RENDERER_MIGRATION_PREFIX,
  replaceLegacyIndexedDb,
  replaceLegacyReduxState
} from './ProfileDataMigrationService'

interface RendererLegacyDataDependencies {
  legacyIndexedDbExists(): Promise<boolean>
  migrateIndexedDb(profileId: string): Promise<void>
  deleteLegacyIndexedDb(): Promise<void>
}

const defaultDependencies: RendererLegacyDataDependencies = {
  legacyIndexedDbExists: () => Dexie.exists('AiOnly'),
  migrateIndexedDb: (profileId) => replaceLegacyIndexedDb(profileId),
  deleteLegacyIndexedDb: () => Dexie.delete('AiOnly')
}

export class RendererLegacyDataService {
  constructor(
    private readonly storage: Storage = localStorage,
    private readonly dependencies: RendererLegacyDataDependencies = defaultDependencies
  ) {}

  async getStatus(profileId: string): Promise<LegacyDataStatus> {
    const hasLegacyReduxData = this.storage.getItem('persist:aionly') !== null
    const hasLegacyStorage = LEGACY_PROFILE_KEYS.some((key) => this.storage.getItem(key) !== null)
    const hasLegacyIndexedDb = await this.dependencies.legacyIndexedDbExists()
    const marker = this.storage.getItem(`${PROFILE_RENDERER_MIGRATION_PREFIX}${profileId}`)
    return {
      hasLegacyNativeData: false,
      hasLegacyReduxData: hasLegacyReduxData || hasLegacyStorage,
      hasLegacyIndexedDb,
      recoveryState:
        marker === 'recovering'
          ? 'recovering'
          : marker === 'completed'
            ? 'completed'
            : marker === 'failed'
              ? 'failed'
              : 'idle',
      cleanupAllowed: hasLegacyReduxData || hasLegacyStorage || hasLegacyIndexedDb
    }
  }

  async recover(profileId: string): Promise<void> {
    const markerKey = `${PROFILE_RENDERER_MIGRATION_PREFIX}${profileId}`
    const targetKeys = [
      `persist:aionly:${profileId}`,
      ...LEGACY_PROFILE_KEYS.map((key) => `profile:${profileId}:${key}`)
    ]
    const previous = new Map(targetKeys.map((key) => [key, this.storage.getItem(key)]))
    this.storage.setItem(markerKey, 'recovering')
    try {
      replaceLegacyReduxState(this.storage, profileId)
      await this.dependencies.migrateIndexedDb(profileId)
      this.storage.setItem(markerKey, 'completed')
    } catch (error) {
      for (const [key, value] of previous) {
        if (value === null) this.storage.removeItem(key)
        else this.storage.setItem(key, value)
      }
      this.storage.setItem(markerKey, 'failed')
      throw error
    }
  }

  async cleanup(): Promise<void> {
    await this.dependencies.deleteLegacyIndexedDb()
    this.storage.removeItem('persist:aionly')
    for (const key of LEGACY_PROFILE_KEYS) this.storage.removeItem(key)
  }
}

export const rendererLegacyDataService = new RendererLegacyDataService()
