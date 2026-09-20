import fs from 'node:fs/promises'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.unmock('node:fs')
vi.unmock('node:path')

import { UserProfileService } from '../UserProfileService'

describe('UserProfileService', () => {
  let root: string

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(process.env.TEMP || process.cwd(), 'aionly-profile-'))
  })

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('derives stable opaque and distinct profile paths from user ids', () => {
    const service = new UserProfileService(root)

    const first = service.getProfile('user@example.com')
    const same = service.getProfile('user@example.com')
    const other = service.getProfile('another@example.com')

    expect(first).toEqual(same)
    expect(first.id).not.toContain('user@example.com')
    expect(first.root).not.toContain('user@example.com')
    expect(first.id).not.toBe(other.id)
    expect(first.dataRoot).not.toBe(other.dataRoot)
    expect(first.partition).toMatch(/^persist:aionly-[a-f0-9]{32}$/)
  })

  it('assigns legacy native data to the first account without copying Chromium session directories', async () => {
    await fs.mkdir(path.join(root, 'Data'), { recursive: true })
    await fs.writeFile(path.join(root, 'Data', 'agents.db'), 'agent-conversation')
    await fs.mkdir(path.join(root, 'IndexedDB'), { recursive: true })
    await fs.writeFile(path.join(root, 'IndexedDB', 'messages.leveldb'), 'messages')
    await fs.mkdir(path.join(root, 'Local Storage'), { recursive: true })
    await fs.writeFile(path.join(root, 'Local Storage', 'redux.leveldb'), 'topics')

    const service = new UserProfileService(root)
    const first = await service.activate('first-user', { token: 'first-token' })
    const second = await service.activate('second-user', { token: 'second-token' })

    await expect(fs.readFile(path.join(first.dataRoot, 'agents.db'), 'utf8')).resolves.toBe('agent-conversation')
    await expect(fs.stat(path.join(root, 'Partitions'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.readFile(path.join(root, 'IndexedDB', 'messages.leveldb'), 'utf8')).resolves.toBe('messages')
    await expect(fs.readFile(path.join(root, 'Local Storage', 'redux.leveldb'), 'utf8')).resolves.toBe('topics')
    await expect(fs.stat(path.join(second.dataRoot, 'agents.db'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(service.isLegacyOwner(first.id)).toBe(true)
    expect(service.isLegacyOwner(second.id)).toBe(false)
  })

  it('keeps legacy sources authoritative when validation fails and retries safely', async () => {
    await fs.mkdir(path.join(root, 'Data'), { recursive: true })
    const legacyDb = path.join(root, 'Data', 'agents.db')
    await fs.writeFile(legacyDb, 'agent-conversation')

    let shouldFail = true
    const service = new UserProfileService(root, {
      validateMigration: async () => {
        if (shouldFail) throw new Error('validation failed')
      }
    })

    await expect(service.activate('first-user', { token: 'token' })).rejects.toThrow('validation failed')
    await expect(fs.readFile(legacyDb, 'utf8')).resolves.toBe('agent-conversation')
    expect(service.getActiveProfile()).toBeNull()

    shouldFail = false
    const profile = await service.activate('first-user', { token: 'token' })

    await expect(fs.readFile(path.join(profile.dataRoot, 'agents.db'), 'utf8')).resolves.toBe('agent-conversation')
    expect(service.getActiveProfile()?.id).toBe(profile.id)
  })

  it('keeps committed migrated data when persisting the committed registry state fails', async () => {
    await fs.mkdir(path.join(root, 'Data'), { recursive: true })
    await fs.writeFile(path.join(root, 'Data', 'agents.db'), 'migrated-data')
    const service = new UserProfileService(root)
    const originalWriteRegistry = (service as any).writeRegistry.bind(service)
    ;(service as any).writeRegistry = async () => {
      const records = Object.values((service as any).registry.migrations) as Array<{ state: string }>
      if (records.some((record) => record.state === 'committed')) throw new Error('registry write failed')
      await originalWriteRegistry()
    }

    const profile = service.getProfile('first-user')
    await expect(service.activate('first-user', { token: 'token' })).rejects.toThrow('registry write failed')

    await expect(fs.readFile(path.join(profile.dataRoot, 'agents.db'), 'utf8')).resolves.toBe('migrated-data')
  })

  it('rejects migration when the destination copy is missing a source file', async () => {
    await fs.mkdir(path.join(root, 'Data'), { recursive: true })
    await fs.writeFile(path.join(root, 'Data', 'first.txt'), 'first')
    await fs.writeFile(path.join(root, 'Data', 'second.txt'), 'second')
    const service = new UserProfileService(root, {
      copyDirectory: async (source, destination) => {
        await fs.mkdir(destination, { recursive: true })
        await fs.copyFile(path.join(source, 'first.txt'), path.join(destination, 'first.txt'))
      }
    })

    await expect(service.activate('first-user', { token: 'token' })).rejects.toThrow(
      'Legacy profile migration validation failed'
    )
    await expect(fs.readFile(path.join(root, 'Data', 'second.txt'), 'utf8')).resolves.toBe('second')
    expect(service.getActiveProfile()).toBeNull()
  })

  it('can pause legacy native migration without claiming or deleting the source', async () => {
    await fs.mkdir(path.join(root, 'Data'), { recursive: true })
    await fs.writeFile(path.join(root, 'Data', 'agents.db'), 'legacy-agent')
    const service = new UserProfileService(root, { enableLegacyMigration: false })

    const profile = await service.activate('first-user', { token: 'token' })

    await expect(fs.stat(path.join(profile.dataRoot, 'agents.db'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.readFile(path.join(root, 'Data', 'agents.db'), 'utf8')).resolves.toBe('legacy-agent')
    expect(service.isLegacyOwner(profile.id)).toBe(false)
  })

  it('merges legacy data into a profile created while migration was paused without overwriting profile files', async () => {
    await fs.mkdir(path.join(root, 'Data'), { recursive: true })
    await fs.writeFile(path.join(root, 'Data', 'legacy.txt'), 'legacy')
    const paused = new UserProfileService(root, { enableLegacyMigration: false })
    const profile = await paused.activate('first-user', { token: 'token' })
    await fs.writeFile(path.join(profile.dataRoot, 'current.txt'), 'current')
    await fs.writeFile(path.join(profile.dataRoot, 'legacy.txt'), 'profile-wins')

    const enabled = new UserProfileService(root)
    await enabled.activate('first-user', { token: 'token' })

    await expect(fs.readFile(path.join(profile.dataRoot, 'current.txt'), 'utf8')).resolves.toBe('current')
    await expect(fs.readFile(path.join(profile.dataRoot, 'legacy.txt'), 'utf8')).resolves.toBe('profile-wins')
    expect(enabled.isLegacyOwner(profile.id)).toBe(true)
  })

  it('stores only allowlisted authentication bootstrap values and consumes them once', async () => {
    const service = new UserProfileService(root)
    const profile = await service.activate('user-1', {
      token: 'token-1',
      serviceInfo: '{"name":"user"}',
      ignored: 'must-not-cross-process'
    })

    expect(service.consumeBootstrap(profile.id)).toEqual({
      token: 'token-1',
      serviceInfo: '{"name":"user"}'
    })
    expect(service.consumeBootstrap(profile.id)).toBeNull()
  })

  it('does not persist authentication bootstrap values as plaintext', async () => {
    const service = new UserProfileService(root)
    await service.activate('user-1', { token: 'plain-secret-token' })

    const registry = await fs.readFile(path.join(root, 'Global', 'profile-registry.json'), 'utf8')

    expect(registry).not.toContain('plain-secret-token')
  })

  it('does not mutate the registry when secure bootstrap encoding fails', async () => {
    const service = new UserProfileService(root, {
      encodeBootstrap: () => {
        throw new Error('secure storage unavailable')
      }
    })

    await expect(service.activate('user-1', { token: 'token-1' })).rejects.toThrow('secure storage unavailable')

    expect((service as any).registry.profiles).toEqual({})
    expect((service as any).registry.bootstraps).toEqual({})
  })

  it('deactivates without deleting the account profile', async () => {
    const service = new UserProfileService(root)
    const profile = await service.activate('user-1', { token: 'token-1' })

    await service.deactivate()

    expect(service.getActiveProfile()).toBeNull()
    await expect(fs.stat(profile.dataRoot)).resolves.toBeDefined()
  })

  it('compensates a missing migrated conversation file from the retained legacy source', async () => {
    await fs.mkdir(path.join(root, 'Data', 'Files'), { recursive: true })
    await fs.writeFile(path.join(root, 'Data', 'Files', 'conversation.json'), 'history')
    const service = new UserProfileService(root)
    const profile = await service.activate('first-user', { token: 'token' })
    const migrated = path.join(profile.dataRoot, 'Files', 'conversation.json')
    await fs.rm(migrated)

    await service.compensateActiveProfile()

    await expect(fs.readFile(migrated, 'utf8')).resolves.toBe('history')
  })
})
