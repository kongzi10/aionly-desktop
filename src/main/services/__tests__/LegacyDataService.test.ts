import fs from 'node:fs/promises'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LegacyDataService } from '../LegacyDataService'

describe('LegacyDataService', () => {
  let root: string
  let legacyRoot: string
  let profileRoot: string
  let markerRoot: string

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(process.env.TEMP || process.cwd(), 'aionly-legacy-'))
    legacyRoot = path.join(root, 'Data')
    profileRoot = path.join(root, 'Profiles', 'profile-a')
    markerRoot = path.join(root, 'Global')
  })

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('replaces the current profile with the legacy snapshot', async () => {
    await fs.mkdir(path.join(legacyRoot, 'Files'), { recursive: true })
    await fs.mkdir(path.join(profileRoot, 'Files'), { recursive: true })
    await fs.writeFile(path.join(legacyRoot, 'Files', 'missing.txt'), 'legacy')
    await fs.writeFile(path.join(legacyRoot, 'Files', 'conflict.txt'), 'legacy')
    await fs.writeFile(path.join(profileRoot, 'Files', 'conflict.txt'), 'current')
    await fs.writeFile(path.join(profileRoot, 'Files', 'current-only.txt'), 'current')
    const service = new LegacyDataService({ legacyRoot, profileRoot, markerRoot, profileId: 'profile-a' })

    const result = await service.recover()

    expect(result.copiedFiles).toBe(2)
    await expect(fs.readFile(path.join(profileRoot, 'Files', 'missing.txt'), 'utf8')).resolves.toBe('legacy')
    await expect(fs.readFile(path.join(profileRoot, 'Files', 'conflict.txt'), 'utf8')).resolves.toBe('legacy')
    await expect(fs.stat(path.join(profileRoot, 'Files', 'current-only.txt'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect((await service.getStatus()).cleanupAllowed).toBe(true)
  })

  it('is repeatable and allows cleanup whenever legacy data exists', async () => {
    await fs.mkdir(legacyRoot, { recursive: true })
    await fs.writeFile(path.join(legacyRoot, 'conversation.json'), 'legacy')
    const service = new LegacyDataService({ legacyRoot, profileRoot, markerRoot, profileId: 'profile-a' })

    expect((await service.getStatus()).cleanupAllowed).toBe(true)
    await service.recover()
    expect((await service.recover()).copiedFiles).toBe(1)
    expect((await service.getStatus()).cleanupAllowed).toBe(true)
  })

  it('clears only the legacy directory without requiring recovery', async () => {
    await fs.mkdir(legacyRoot, { recursive: true })
    await fs.writeFile(path.join(legacyRoot, 'legacy.txt'), 'legacy')
    await fs.mkdir(profileRoot, { recursive: true })
    await fs.writeFile(path.join(profileRoot, 'current.txt'), 'current')
    const service = new LegacyDataService({ legacyRoot, profileRoot, markerRoot, profileId: 'profile-a' })

    await service.cleanup()

    await expect(fs.stat(legacyRoot)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.readFile(path.join(profileRoot, 'current.txt'), 'utf8')).resolves.toBe('current')
  })

  it('restores and cleans up the legacy Claude configuration', async () => {
    const legacyClaudeRoot = path.join(root, '.claude')
    await fs.mkdir(legacyRoot, { recursive: true })
    await fs.writeFile(path.join(legacyRoot, 'conversation.json'), 'legacy')
    await fs.mkdir(legacyClaudeRoot, { recursive: true })
    await fs.writeFile(path.join(legacyClaudeRoot, 'settings.json'), '{"legacy":true}')
    const service = new LegacyDataService({
      legacyRoot,
      legacyClaudeRoot,
      profileRoot,
      markerRoot,
      profileId: 'profile-a'
    })

    await service.recover()

    await expect(fs.readFile(path.join(profileRoot, 'ClaudeConfig', 'settings.json'), 'utf8')).resolves.toBe(
      '{"legacy":true}'
    )
    await service.cleanup()
    await expect(fs.stat(legacyClaudeRoot)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
