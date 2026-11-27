import { loggerService } from '@logger'
import { db, resetDatabase } from '@renderer/databases'
import { persistor, resetStore } from '@renderer/store'

import { autoMigrateLegacyProfileData } from './ProfileDataMigrationService'
import {
  applyRendererProfileStorage,
  PROFILE_RUNTIME_CHANGED_EVENT,
  type RendererProfileSwitch,
  switchRendererProfile
} from './ProfileRendererRuntime'

const logger = loggerService.withContext('ProfileLifecycleService')

export async function applyProfileSwitch(
  profile: RendererProfileSwitch,
  initializeProfile?: () => void | Promise<void>
): Promise<void> {
  await switchRendererProfile(profile, {
    flushStore: () => persistor.flush(),
    pauseStore: () => persistor.pause(),
    closeDatabase: () => db.close(),
    applyProfileStorage: applyRendererProfileStorage,
    migrateLegacyData: async ({ profileId }) => {
      if (!profileId) return
      const result = await autoMigrateLegacyProfileData(profileId)
      if (result !== 'none' && result !== 'disabled') {
        logger.info('Legacy data auto migration finished', { profileId, result }, { logToMain: true })
      }
    },
    resetDatabase,
    resetStore,
    initializeProfile,
    notifyProfileChanged: () => window.dispatchEvent(new Event(PROFILE_RUNTIME_CHANGED_EVENT)),
    recover: () => window.location.reload(),
    navigate: (profileId) => {
      window.location.hash = profileId ? '#/' : '#/login'
    }
  })
}
