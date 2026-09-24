import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, normalize, resolve } from 'node:path'

export type TransactionErrorCode =
  | 'REVISION_CONFLICT'
  | 'BACKUP_FAILED'
  | 'WRITE_FAILED'
  | 'VERIFY_FAILED'
  | 'BACKUP_NOT_FOUND'
  | 'INVALID_REQUEST'

export class ConfigTransactionError extends Error {
  constructor(
    public readonly code: TransactionErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'ConfigTransactionError'
  }
}

export interface ConfigSnapshot {
  content: string
  revision: string
}

export interface BackupInfo {
  id: string
  createdAt: string
  size: number
}

interface MutationRequest {
  configPath: string
  expectedRevision: string
  verify: (content: string, authContent?: string) => unknown
  allowMissing?: boolean
}

interface ApplyRequest extends MutationRequest {
  serializedContent: string
  /** Optional companion file (e.g. Codex auth.json) written atomically together with configPath. */
  authPath?: string
  serializedAuthContent?: string
  /** Revision guard for the companion file; defaults to the snapshot read at apply time. */
  expectedAuthRevision?: string
}

interface RollbackRequest extends MutationRequest {
  backupId: string
  expectedAuthRevision?: string
}

const revisionOf = (content: string): string => `sha256:${createHash('sha256').update(content).digest('hex')}`

/**
 * Tag written in front of every backup payload. Backups produced by other tools (or legacy
 * raw-content copies) never start with this marker, so rollback can tell the formats apart
 * without sniffing the configuration content itself.
 */
const BACKUP_MAGIC = 'aionly-backup/v1'

interface BackupPayload {
  target: string
  content: string
}

export class ConfigTransactionService {
  private readonly queues = new Map<string, Promise<void>>()

  constructor(
    private readonly fileOperations: {
      rename: typeof rename
      writeFile: typeof writeFile
      rm: typeof rm
    } = { rename, writeFile, rm }
  ) {}

  async readSnapshot(configPath: string, options: { allowMissing?: boolean } = {}): Promise<ConfigSnapshot> {
    try {
      const content = await readFile(resolve(configPath), 'utf8')
      return { content, revision: revisionOf(content) }
    } catch (error) {
      if (options.allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { content: '', revision: revisionOf('') }
      }
      throw error
    }
  }

  async apply(request: ApplyRequest): Promise<{ backupId: string; revision: string; authRevision?: string }> {
    return this.enqueue(request.configPath, () => this.applyUnlocked(request))
  }

  async listBackups(configPath: string): Promise<BackupInfo[]> {
    const directory = this.backupDirectory(configPath)
    try {
      const names = (await readdir(directory))
        .filter((name) => name.endsWith('.bak'))
        .toSorted()
        .reverse()
      return await Promise.all(
        names.map(async (id) => {
          const details = await stat(join(directory, id))
          return { id, createdAt: details.birthtime.toISOString(), size: details.size }
        })
      )
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
  }

  async rollback(request: RollbackRequest): Promise<{ backupId: string; revision: string; authRevision?: string }> {
    const backupPath = this.safeBackupPath(request.configPath, request.backupId)
    let serializedContent: string
    let authPayload: BackupPayload[] | undefined
    let authPath: string | undefined
    let expectedAuthRevision = request.expectedAuthRevision
    try {
      const raw = await readFile(backupPath, 'utf8')
      if (raw.startsWith(`${BACKUP_MAGIC}\n`)) {
        const snapshots = JSON.parse(raw.slice(BACKUP_MAGIC.length + 1)) as BackupPayload[]
        const primary = snapshots.find(({ target }) => resolve(target) === resolve(request.configPath))
        if (!primary) {
          throw new ConfigTransactionError('BACKUP_NOT_FOUND', 'Backup does not contain this configuration')
        }
        serializedContent = primary.content
        authPayload = snapshots.filter(({ target }) => resolve(target) !== resolve(request.configPath))
        authPath = authPayload[0]?.target
        if (authPath && !expectedAuthRevision) {
          expectedAuthRevision = (await this.readSnapshot(authPath, { allowMissing: true })).revision
        }
      } else {
        // Legacy backups carry the raw file content; anything untagged is restored verbatim.
        serializedContent = raw
      }
    } catch (error) {
      if (error instanceof ConfigTransactionError) throw error
      throw new ConfigTransactionError('BACKUP_NOT_FOUND', 'The selected backup does not exist', { cause: error })
    }
    return this.apply({
      ...request,
      serializedContent,
      authPath,
      serializedAuthContent: authPayload?.[0]?.content,
      expectedAuthRevision
    })
  }

  private async applyUnlocked(
    request: ApplyRequest
  ): Promise<{ backupId: string; revision: string; authRevision?: string }> {
    const configPath = resolve(request.configPath)
    const authPath = request.authPath ? resolve(request.authPath) : undefined
    if (authPath && request.serializedAuthContent === undefined) {
      throw new ConfigTransactionError('INVALID_REQUEST', 'authPath requires serializedAuthContent')
    }
    const targets = authPath ? [configPath, authPath] : [configPath]
    const snapshots = await Promise.all(
      targets.map((target) =>
        this.readSnapshot(target, { allowMissing: request.allowMissing }).then((snapshot) => ({ target, snapshot }))
      )
    )
    for (const { target, snapshot } of snapshots) {
      const expected =
        target === configPath ? request.expectedRevision : (request.expectedAuthRevision ?? snapshot.revision)
      if (snapshot.revision !== expected) {
        throw new ConfigTransactionError('REVISION_CONFLICT', 'The target changed after it was inspected')
      }
    }

    const backupId = `${Date.now()}-${randomUUID()}.bak`
    const backupPath = join(this.backupDirectory(configPath), backupId)
    try {
      await mkdir(dirname(backupPath), { recursive: true })
      const backupPayload: BackupPayload[] = snapshots.map(({ target, snapshot }) => ({
        target,
        content: snapshot.content
      }))
      await writeFile(backupPath, `${BACKUP_MAGIC}\n${JSON.stringify(backupPayload)}`, 'utf8')
    } catch (error) {
      throw new ConfigTransactionError('BACKUP_FAILED', 'Could not create a configuration backup', { cause: error })
    }

    const temporaryPaths: { temp: string; target: string; content: string }[] = []
    const replacedTargets: string[] = []
    try {
      await mkdir(dirname(configPath), { recursive: true })
      if (authPath) await mkdir(dirname(authPath), { recursive: true })
      for (const { target } of snapshots) {
        const content = target === configPath ? request.serializedContent : (request.serializedAuthContent ?? '')
        const temporaryPath = join(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`)
        temporaryPaths.push({ temp: temporaryPath, target, content })
        await this.fileOperations.writeFile(temporaryPath, content, { encoding: 'utf8', mode: 0o600 })
      }
      for (const { temp, target } of temporaryPaths) {
        await this.fileOperations.rename(temp, target)
        replacedTargets.push(target)
      }
    } catch (error) {
      for (const { temp } of temporaryPaths) {
        await this.fileOperations.rm(temp, { force: true }).catch(() => undefined)
      }
      await Promise.all(
        snapshots
          .filter(({ target }) => replacedTargets.includes(target))
          .map(async ({ target, snapshot }) => {
            if (snapshot.content === '' && request.allowMissing) {
              await this.fileOperations.rm(target, { force: true }).catch(() => undefined)
              return
            }
            await this.fileOperations.writeFile(target, snapshot.content, 'utf8').catch(() => undefined)
          })
      )
      throw new ConfigTransactionError('WRITE_FAILED', 'Could not replace the target configuration', { cause: error })
    }

    try {
      const verified = await Promise.all(targets.map((target) => this.readSnapshot(target)))
      request.verify(verified[0].content, verified[1]?.content)
      await this.pruneBackups(configPath)
      return { backupId, revision: verified[0].revision, authRevision: verified[1]?.revision }
    } catch (error) {
      await Promise.all(
        snapshots.map(async ({ target, snapshot }) => {
          if (snapshot.content === '' && request.allowMissing) {
            await this.fileOperations.rm(target, { force: true }).catch(() => undefined)
            return
          }
          await this.fileOperations.writeFile(target, snapshot.content, 'utf8').catch(() => undefined)
        })
      )
      throw new ConfigTransactionError('VERIFY_FAILED', 'The written configuration failed verification', {
        cause: error
      })
    }
  }

  private backupDirectory(configPath: string): string {
    return join(dirname(resolve(configPath)), '.aionly-backups')
  }

  private safeBackupPath(configPath: string, backupId: string): string {
    if (basename(backupId) !== backupId || !backupId.endsWith('.bak')) {
      throw new ConfigTransactionError('BACKUP_NOT_FOUND', 'Invalid backup identifier')
    }
    return join(this.backupDirectory(configPath), backupId)
  }

  private async pruneBackups(configPath: string): Promise<void> {
    const backups = await this.listBackups(configPath)
    await Promise.all(backups.slice(10).map((backup) => rm(join(this.backupDirectory(configPath), backup.id))))
  }

  private async enqueue<T>(configPath: string, operation: () => Promise<T>): Promise<T> {
    const key = normalize(resolve(configPath)).toLowerCase()
    const previous = this.queues.get(key) ?? Promise.resolve()
    const result = previous.then(operation, operation)
    const tail = result.then(
      () => undefined,
      () => undefined
    )
    this.queues.set(key, tail)
    try {
      return await result
    } finally {
      if (this.queues.get(key) === tail) this.queues.delete(key)
    }
  }
}
