import { createHash, randomUUID } from 'node:crypto'
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, normalize, resolve } from 'node:path'

export type TransactionErrorCode =
  | 'REVISION_CONFLICT'
  | 'BACKUP_FAILED'
  | 'WRITE_FAILED'
  | 'VERIFY_FAILED'
  | 'BACKUP_NOT_FOUND'

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
  verify: (content: string) => unknown
}

interface ApplyRequest extends MutationRequest {
  serializedContent: string
}

interface RollbackRequest extends MutationRequest {
  backupId: string
}

const revisionOf = (content: string): string => `sha256:${createHash('sha256').update(content).digest('hex')}`

export class ConfigTransactionService {
  private readonly queues = new Map<string, Promise<void>>()

  async readSnapshot(configPath: string): Promise<ConfigSnapshot> {
    const content = await readFile(resolve(configPath), 'utf8')
    return { content, revision: revisionOf(content) }
  }

  async apply(request: ApplyRequest): Promise<{ backupId: string; revision: string }> {
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

  async rollback(request: RollbackRequest): Promise<{ backupId: string; revision: string }> {
    const backupPath = this.safeBackupPath(request.configPath, request.backupId)
    let serializedContent: string
    try {
      serializedContent = await readFile(backupPath, 'utf8')
    } catch (error) {
      throw new ConfigTransactionError('BACKUP_NOT_FOUND', 'The selected backup does not exist', { cause: error })
    }
    return this.apply({ ...request, serializedContent })
  }

  private async applyUnlocked(request: ApplyRequest): Promise<{ backupId: string; revision: string }> {
    const configPath = resolve(request.configPath)
    const current = await this.readSnapshot(configPath)
    if (current.revision !== request.expectedRevision) {
      throw new ConfigTransactionError('REVISION_CONFLICT', 'The target changed after it was inspected')
    }

    const backupId = `${Date.now()}-${randomUUID()}.bak`
    const backupPath = join(this.backupDirectory(configPath), backupId)
    try {
      await mkdir(dirname(backupPath), { recursive: true })
      await copyFile(configPath, backupPath)
    } catch (error) {
      throw new ConfigTransactionError('BACKUP_FAILED', 'Could not create a configuration backup', { cause: error })
    }

    const temporaryPath = join(dirname(configPath), `.${basename(configPath)}.${randomUUID()}.tmp`)
    try {
      await writeFile(temporaryPath, request.serializedContent, { encoding: 'utf8', mode: 0o600 })
      await rename(temporaryPath, configPath)
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined)
      throw new ConfigTransactionError('WRITE_FAILED', 'Could not replace the target configuration', { cause: error })
    }

    try {
      const verified = await this.readSnapshot(configPath)
      request.verify(verified.content)
      await this.pruneBackups(configPath)
      return { backupId, revision: verified.revision }
    } catch (error) {
      await copyFile(backupPath, configPath)
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
