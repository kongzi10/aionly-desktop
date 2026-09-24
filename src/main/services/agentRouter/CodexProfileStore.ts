import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { CodexProfileLibrary, CodexRouteProfile } from '@shared/agentRouter'

const validateProfile = (profile: CodexRouteProfile): void => {
  if (
    profile.targetId !== 'codex' ||
    !profile.id ||
    !profile.name.trim() ||
    !profile.credentialId ||
    !profile.model.trim()
  )
    throw new Error('Invalid Codex route profile')
  if ((profile.accessMode === 'tokenPlan') !== Boolean(profile.tokenPlanId))
    throw new Error('Codex credential mode does not match TokenPlan reference')
}

const validate = (library: CodexProfileLibrary): void => {
  if (library.version !== 1) throw new Error('Invalid Codex profile library version')
  library.profiles.forEach(validateProfile)
  if (new Set(library.profiles.map(({ id }) => id)).size !== library.profiles.length)
    throw new Error('Codex profile IDs must be unique')
  if (library.activeProfileId && !library.profiles.some(({ id }) => id === library.activeProfileId))
    throw new Error('Codex active profile does not exist')
  const serialized = JSON.stringify(library)
  if (/"(?:apiKey|secret|token|authorization)"\s*:/i.test(serialized)) {
    throw new Error('Codex profile contains a forbidden secret field')
  }
}

export class CodexProfileStore {
  private readonly queues = new Map<string, Promise<void>>()

  constructor(private readonly rootPath: string) {}

  getFilePath(accountId: string): string {
    const accountKey = createHash('sha256').update(accountId).digest('hex')
    return join(this.rootPath, 'routes', accountKey, 'codex.json')
  }

  async get(accountId: string): Promise<CodexProfileLibrary | undefined> {
    try {
      const parsed = JSON.parse(await readFile(this.getFilePath(accountId), 'utf8')) as CodexProfileLibrary
      validate(parsed)
      return parsed
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
    }
  }

  async save(accountId: string, library: CodexProfileLibrary): Promise<void> {
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
