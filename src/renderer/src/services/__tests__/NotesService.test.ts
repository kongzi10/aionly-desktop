import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@renderer/store', () => ({ default: { dispatch: vi.fn() } }))

import { resolveNotesPath } from '../NotesService'

const ACTIVE_PROFILE_KEY = 'aionly:active-profile-id'

const getAppInfo = vi.hoisted(() => vi.fn())

function setActiveProfile(profileId: string | null): void {
  if (profileId) localStorage.setItem(ACTIVE_PROFILE_KEY, profileId)
  else localStorage.removeItem(ACTIVE_PROFILE_KEY)
}

// Unique hex ids per test: the cache is module-level, and ids must match the /^[a-f0-9]{32}$/ profile pattern.
function profileIdOf(seed: string): string {
  return seed.padEnd(32, '0')
}

describe('resolveNotesPath default path cache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.stubGlobal('api', { getAppInfo })
  })

  it('reuses the cached default path for the same profile', async () => {
    setActiveProfile(profileIdOf('a'))
    getAppInfo.mockResolvedValue({ notesPath: 'C:/profiles/a/Notes' })

    await resolveNotesPath('')
    const resolved = await resolveNotesPath('')

    expect(getAppInfo).toHaveBeenCalledTimes(1)
    expect(resolved).toEqual({ path: 'C:/profiles/a/Notes', isFallback: true })
  })

  it('re-resolves the default path after the active profile changes', async () => {
    setActiveProfile(profileIdOf('d'))
    getAppInfo.mockResolvedValue({ notesPath: 'C:/profiles/a/Notes' })
    await resolveNotesPath('')

    setActiveProfile(profileIdOf('e'))
    getAppInfo.mockResolvedValue({ notesPath: 'C:/profiles/b/Notes' })
    const resolved = await resolveNotesPath('')

    expect(getAppInfo).toHaveBeenCalledTimes(2)
    expect(resolved).toEqual({ path: 'C:/profiles/b/Notes', isFallback: true })
  })

  it('retries after a failed lookup instead of caching the rejection', async () => {
    setActiveProfile(profileIdOf('c'))
    getAppInfo.mockRejectedValueOnce(new Error('offline'))
    await expect(resolveNotesPath('')).rejects.toThrow('offline')

    getAppInfo.mockResolvedValue({ notesPath: 'C:/profiles/a/Notes' })
    const resolved = await resolveNotesPath('')

    expect(getAppInfo).toHaveBeenCalledTimes(2)
    expect(resolved.path).toBe('C:/profiles/a/Notes')
  })
})
