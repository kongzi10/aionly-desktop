export const ACTIVE_PROFILE_STORAGE_KEY = 'aionly:active-profile-id'

const PROFILE_ID_PATTERN = /^[a-f0-9]{32}$/

export function getActiveProfileId(storage: Storage = localStorage): string | null {
  const profileId = storage.getItem(ACTIVE_PROFILE_STORAGE_KEY)
  return profileId && PROFILE_ID_PATTERN.test(profileId) ? profileId : null
}

function requireActiveProfileId(storage?: Storage): string {
  const profileId = getActiveProfileId(storage)
  if (!profileId) throw new Error('Profile is not active')
  return profileId
}

export function getProfileStorageKey(key: string, storage?: Storage): string {
  return `profile:${requireActiveProfileId(storage)}:${key}`
}

export function getReduxPersistKey(storage?: Storage): string {
  return `aionly:${requireActiveProfileId(storage)}`
}

export function getDexieDatabaseName(storage?: Storage): string {
  return `AiOnly-${requireActiveProfileId(storage)}`
}

export function getProfileWebviewPartition(storage?: Storage): string {
  return `persist:webview-${getActiveProfileId(storage) ?? 'login'}`
}

export const profileStorage = {
  getItem(key: string): string | null {
    const profileId = getActiveProfileId()
    return profileId ? localStorage.getItem(`profile:${profileId}:${key}`) : null
  },
  setItem(key: string, value: string): void {
    const profileId = getActiveProfileId()
    if (profileId) localStorage.setItem(`profile:${profileId}:${key}`, value)
  },
  removeItem(key: string): void {
    const profileId = getActiveProfileId()
    if (profileId) localStorage.removeItem(`profile:${profileId}:${key}`)
  }
}

export const authStorage = {
  getItem(key: string): string | null {
    const profileId = getActiveProfileId()
    return localStorage.getItem(profileId ? `profile:${profileId}:${key}` : key)
  },
  setItem(key: string, value: string): void {
    const profileId = getActiveProfileId()
    localStorage.setItem(profileId ? `profile:${profileId}:${key}` : key, value)
  },
  removeItem(key: string): void {
    const profileId = getActiveProfileId()
    localStorage.removeItem(profileId ? `profile:${profileId}:${key}` : key)
  }
}
