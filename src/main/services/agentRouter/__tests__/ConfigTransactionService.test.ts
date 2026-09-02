import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
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
        verify: JSON.parse
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
        verify: JSON.parse
      })
    ).rejects.toMatchObject({ code: 'VERIFY_FAILED' })
    expect(await readFile(configPath, 'utf8')).toBe('[]\n')
  })

  it('lists backups and rolls one back with revision protection', async () => {
    const service = new ConfigTransactionService()
    const before = await service.readSnapshot(configPath)
    const applied = await service.apply({
      configPath,
      expectedRevision: before.revision,
      serializedContent: '[{"id":"new"}]\n',
      verify: JSON.parse
    })
    const current = await service.readSnapshot(configPath)

    expect(await service.listBackups(configPath)).toContainEqual(expect.objectContaining({ id: applied.backupId }))
    await service.rollback({
      configPath,
      backupId: applied.backupId,
      expectedRevision: current.revision,
      verify: JSON.parse
    })
    expect(JSON.parse(await readFile(configPath, 'utf8'))).toEqual([])
  })
})
