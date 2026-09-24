import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { ClaudeCodeProfileLibrary, ClaudeCodeRouteProfile } from '@shared/agentRouter'

interface LegacyClaudeCodeProfileRecord {
  profile: Omit<ClaudeCodeRouteProfile, 'id' | 'name'>
  // Legacy v1 records carried an ownership snapshot; it is dropped during migration.
  ownership?: unknown
}

const validateProfile = (profile: ClaudeCodeRouteProfile): void => {
  if (profile.targetId !== 'claude-code' || !profile.id || !profile.name.trim() || !profile.credentialId)
    throw new Error('Invalid Claude Code route profile or model mapping')
  if ((profile.accessMode === 'tokenPlan') !== Boolean(profile.tokenPlanId))
    throw new Error('Claude Code credential mode does not match TokenPlan reference')
}

const validate = (library: ClaudeCodeProfileLibrary): void => {
  if (library.version !== 2) throw new Error('Invalid Claude Code profile library version')
  library.profiles.forEach(validateProfile)
  if (new Set(library.profiles.map(({ id }) => id)).size !== library.profiles.length)
    throw new Error('Claude Code profile IDs must be unique')
  if (library.activeProfileId && !library.profiles.some(({ id }) => id === library.activeProfileId))
    throw new Error('Claude Code active profile does not exist')
  const serialized = JSON.stringify(library)
  if (/"(?:apiKey|secret|token|authorization)"\s*:/i.test(serialized)) {
    throw new Error('Claude Code profile contains a forbidden secret field')
  }
}

const migrateLegacy = (record: LegacyClaudeCodeProfileRecord): ClaudeCodeProfileLibrary => {
  const id = createHash('sha256').update(`${record.profile.credentialId}\0${record.profile.managedAt}`).digest('hex')
  const profile: ClaudeCodeRouteProfile = { ...record.profile, id, name: 'Default' }
  const wasActive = Boolean(record.ownership)
  return { version: 2, profiles: [profile], activeProfileId: wasActive ? id : undefined }
}

export class ClaudeCodeProfileStore {
  private readonly queues = new Map<string, Promise<void>>()

  constructor(private readonly rootPath: string) {}

  getFilePath(accountId: string): string {
    const accountKey = createHash('sha256').update(accountId).digest('hex')
    return join(this.rootPath, 'routes', accountKey, 'claude-code.json')
  }

  async get(accountId: string): Promise<ClaudeCodeProfileLibrary | undefined> {
    try {
      const parsed = JSON.parse(await readFile(this.getFilePath(accountId), 'utf8')) as
        | ClaudeCodeProfileLibrary
        | LegacyClaudeCodeProfileRecord
      const library = 'profile' in parsed ? migrateLegacy(parsed) : parsed
      validate(library)
      return library
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
    }
  }

  async save(accountId: string, library: ClaudeCodeProfileLibrary): Promise<void> {
    validate(library)
    const filePath = this.getFilePath(accountId)
    const previous = this.queues.get(filePath) ?? Promise.resolve()
    const operation = previous.then(async () => {
      await mkdir(dirname(filePath), { recursive: true })
      const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
      await writeFile(temporaryPath, `${JSON.stringify(library, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
      await rename(temporaryPath, filePath)
    })
    this.queues.set(
      filePath,
      operation.catch(() => undefined)
    )
    return operation
  }

  remove(accountId: string): Promise<void> {
    return rm(this.getFilePath(accountId), { force: true })
  }
}
