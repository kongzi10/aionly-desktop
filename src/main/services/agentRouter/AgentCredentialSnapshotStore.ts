import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { AgentRouterTargetId } from '@shared/agentRouter'

export class AgentCredentialSnapshotStore {
  constructor(private readonly rootPath: string) {}

  async create(accountId: string, targetId: AgentRouterTargetId, value: string): Promise<string> {
    if (!value) throw new Error('Credential value is required')
    const credentialId = randomUUID()
    await this.write(this.path(accountId, targetId, credentialId), value)
    return credentialId
  }

  async resolve(accountId: string, targetId: AgentRouterTargetId, credentialId: string): Promise<string> {
    const credential = JSON.parse(await readFile(this.path(accountId, targetId, credentialId), 'utf8')) as {
      apiKey: string
    }
    if (!credential.apiKey) throw new Error('Agent credential is unavailable')
    return credential.apiKey
  }

  remove(accountId: string, targetId: AgentRouterTargetId, credentialId: string): Promise<void> {
    return rm(this.path(accountId, targetId, credentialId), { force: true })
  }

  private path(accountId: string, targetId: AgentRouterTargetId, credentialId: string): string {
    const accountKey = createHash('sha256').update(accountId).digest('hex')
    return join(this.rootPath, 'agent-credentials', accountKey, targetId, `${credentialId}.json`)
  }

  private async write(filePath: string, apiKey: string): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true })
    const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify({ apiKey }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    await rename(temporaryPath, filePath)
  }
}
