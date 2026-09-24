import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ConfigTransactionService } from '../ConfigTransactionService'

describe('ConfigTransactionService', () => {
  let root: string
  let configPath: string

  beforeEach(async () => {
    root = join(process.cwd(), '.tmp', `agent-router-transaction-${crypto.randomUUID()}`)
    configPath = join(root, 'models.json')
    await mkdir(root, { recursive: true })
    await writeFile(configPath, '[]\n', 'utf8')
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('backs up, atomically replaces, and verifies the target', async () => {
    const service = new ConfigTransactionService()
    const before = await service.readSnapshot(configPath)
    const result = await service.apply({
      configPath,
      expectedRevision: before.revision,
      serializedContent: '[{"id":"gpt-5"}]\n',
      verify: (value) => JSON.parse(value)
    })

    expect(result.backupId).toBeTruthy()
    expect(JSON.parse(await readFile(configPath, 'utf8'))).toEqual([{ id: 'gpt-5' }])
    expect((await readdir(root)).some((name) => name.endsWith('.tmp'))).toBe(false)
  })

  it('rejects a stale revision without changing the target', async () => {
    const service = new ConfigTransactionService()
    await expect(
      service.apply({
        configPath,
        expectedRevision: 'sha256:stale',
        serializedContent: '[{"id":"changed"}]',
        verify: (content) => JSON.parse(content)
      })
    ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' })
    expect(await readFile(configPath, 'utf8')).toBe('[]\n')
  })

  it('restores the backup when read-back verification fails', async () => {
    const service = new ConfigTransactionService()
    const before = await service.readSnapshot(configPath)
    await expect(
      service.apply({
        configPath,
        expectedRevision: before.revision,
        serializedContent: 'invalid',
        verify: (content) => JSON.parse(content)
      })
    ).rejects.toMatchObject({ code: 'VERIFY_FAILED' })
    expect(await readFile(configPath, 'utf8')).toBe('[]\n')
  })

  it('restores already-replaced files when a companion file rename fails', async () => {
    const revisionService = new ConfigTransactionService()
    const authPath = join(root, 'auth.json')
    await writeFile(configPath, 'old-config\n', 'utf8')
    await writeFile(authPath, 'old-auth\n', 'utf8')
    const before = await revisionService.readSnapshot(configPath)
    const realRename = rename
    let renameCount = 0
    const service = new ConfigTransactionService({
      rename: async (from, to) => {
        renameCount++
        if (renameCount === 2) throw new Error('simulated companion rename failure')
        await realRename(from, to)
      },
      writeFile,
      rm
    })

    await expect(
      service.apply({
        configPath,
        expectedRevision: before.revision,
        serializedContent: 'new-config\n',
        authPath,
        serializedAuthContent: 'new-auth\n',
        verify: () => undefined
      })
    ).rejects.toMatchObject({ code: 'WRITE_FAILED' })

    expect(await readFile(configPath, 'utf8')).toBe('old-config\n')
    expect(await readFile(authPath, 'utf8')).toBe('old-auth\n')
  })

  it('lists backups and rolls one back with revision protection', async () => {
    const service = new ConfigTransactionService()
    const before = await service.readSnapshot(configPath)
    const applied = await service.apply({
      configPath,
      expectedRevision: before.revision,
      serializedContent: '[{"id":"new"}]\n',
      verify: (content) => JSON.parse(content)
    })
    const current = await service.readSnapshot(configPath)

    expect(await service.listBackups(configPath)).toContainEqual(expect.objectContaining({ id: applied.backupId }))
    await service.rollback({
      configPath,
      backupId: applied.backupId,
      expectedRevision: current.revision,
      verify: (content) => JSON.parse(content)
    })
    expect(JSON.parse(await readFile(configPath, 'utf8'))).toEqual([])
  })

  it('rolls back a legacy raw-content backup verbatim', async () => {
    const service = new ConfigTransactionService()
    const backupDirectory = join(root, '.aionly-backups')
    await mkdir(backupDirectory, { recursive: true })
    await writeFile(join(backupDirectory, 'legacy.bak'), '[{"id":"legacy"}]\n', 'utf8')
    const current = await service.readSnapshot(configPath)

    await service.rollback({
      configPath,
      backupId: 'legacy.bak',
      expectedRevision: current.revision,
      verify: (content) => JSON.parse(content)
    })
    expect(JSON.parse(await readFile(configPath, 'utf8'))).toEqual([{ id: 'legacy' }])
  })

  it('fails rollback when a tagged backup does not contain the configuration', async () => {
    const service = new ConfigTransactionService()
    const otherPath = join(root, 'other.json')
    const before = await service.readSnapshot(otherPath, { allowMissing: true })
    await service.apply({
      configPath: otherPath,
      expectedRevision: before.revision,
      serializedContent: '{"a":1}\n',
      allowMissing: true,
      verify: (content) => JSON.parse(content)
    })
    const backup = (await service.listBackups(otherPath))[0]
    const current = await service.readSnapshot(configPath)

    await expect(
      service.rollback({
        configPath,
        backupId: backup.id,
        expectedRevision: current.revision,
        verify: (content) => JSON.parse(content)
      })
    ).rejects.toMatchObject({ code: 'BACKUP_NOT_FOUND' })
    expect(await readFile(configPath, 'utf8')).toBe('[]\n')
  })
})
