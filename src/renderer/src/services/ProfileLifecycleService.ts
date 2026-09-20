import { db, resetDatabase } from '@renderer/databases'
import { persistor, resetStore } from '@renderer/store'

import {
  applyRendererProfileStorage,
  PROFILE_RUNTIME_CHANGED_EVENT,
  type RendererProfileSwitch,
  switchRendererProfile
} from './ProfileRendererRuntime'

export async function applyProfileSwitch(
  profile: RendererProfileSwitch,
  initializeProfile?: () => void | Promise<void>
): Promise<void> {
  await switchRendererProfile(profile, {
    flushStore: () => persistor.flush(),
    pauseStore: () => persistor.pause(),
    closeDatabase: () => db.close(),
    applyProfileStorage: applyRendererProfileStorage,
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
