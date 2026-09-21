import { ACTIVE_PROFILE_STORAGE_KEY, authStorage } from './ProfileStorageService'

export interface RendererProfileBootstrap {
  token?: string
  userInfo?: string
  serviceInfo?: string
  localUserSecret?: string
}

export interface RendererProfileSwitch {
  profileId: string | null
  bootstrap: RendererProfileBootstrap | null
}

export interface RendererProfileRuntimeDependencies {
  flushStore(): Promise<unknown>
  pauseStore(): void
  closeDatabase(): void
  applyProfileStorage(profile: RendererProfileSwitch): void
  resetDatabase(): void
  resetStore(): void | Promise<void>
  initializeProfile?(): void | Promise<void>
  notifyProfileChanged(): void
  navigate(profileId: string | null): void
  recover?(): void
}

export const PROFILE_RUNTIME_CHANGED_EVENT = 'aionly:profile-runtime-changed'

export class ProfileGeneration {
  private value = 0

  capture(): number {
    return this.value
  }

  advance(): number {
    this.value += 1
    return this.value
  }

  assertCurrent(generation: number): void {
    if (generation !== this.value) throw new Error('Profile changed before the operation completed')
  }
}

export const profileGeneration = new ProfileGeneration()

export function applyRendererProfileStorage({ profileId, bootstrap }: RendererProfileSwitch): void {
  if (profileId) localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profileId)
  else localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY)

  const authKeys = ['token', 'userInfo', 'serviceInfo', 'userSecretKey'] as const
  if (!profileId) {
    for (const key of authKeys) localStorage.removeItem(key)
    return
  }

  if (!bootstrap) return
  const values = {
    token: bootstrap.token,
    userInfo: bootstrap.userInfo,
    serviceInfo: bootstrap.serviceInfo,
    userSecretKey: bootstrap.localUserSecret
  }
  for (const key of authKeys) {
    const value = values[key]
    if (value) authStorage.setItem(key, value)
    else authStorage.removeItem(key)
    localStorage.removeItem(key)
  }
}

export async function switchRendererProfile(
  profile: RendererProfileSwitch,
  dependencies: RendererProfileRuntimeDependencies
): Promise<void> {
  profileGeneration.advance()
  let runtimeMutationStarted = false
  try {
    await dependencies.flushStore()
    runtimeMutationStarted = true
    dependencies.pauseStore()
    dependencies.closeDatabase()
    dependencies.applyProfileStorage(profile)
    dependencies.resetDatabase()
    await dependencies.resetStore()
    await dependencies.initializeProfile?.()
    dependencies.notifyProfileChanged()
    dependencies.navigate(profile.profileId)
  } catch (error) {
    if (runtimeMutationStarted) dependencies.recover?.()
    throw error
  }
}
