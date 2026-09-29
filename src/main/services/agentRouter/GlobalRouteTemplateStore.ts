import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { AgentRouteTemplate, CreateAgentRouteTemplateRequest } from '@shared/agentRouter'
import type { WorkBuddyEdition } from '@shared/agentRouter'

const maskKey = (value: string) => `${value.slice(0, 4)}••••${value.slice(-4)}`

export class GlobalRouteTemplateStore {
  constructor(private readonly rootPath: string) {}

  getFilePath(accountId: string, edition: WorkBuddyEdition = 'domestic'): string {
    return join(this.accountPath(accountId, edition), 'templates.json')
  }

  async list(accountId: string, edition: WorkBuddyEdition = 'domestic'): Promise<AgentRouteTemplate[]> {
    const templates = await this.readJson<AgentRouteTemplate[]>(this.getFilePath(accountId, edition), [])
    return Promise.all(
      templates.map(async (template) => {
        try {
          return { ...template, maskedKey: maskKey(await this.resolveKey(accountId, template.templateId, edition)) }
        } catch {
          return template
        }
      })
    )
  }

  async create(
    accountId: string,
    request: CreateAgentRouteTemplateRequest,
    edition: WorkBuddyEdition = 'domestic'
  ): Promise<AgentRouteTemplate> {
    if (!request.modelId || !request.apiKey || (request.accessMode === 'tokenPlan') !== Boolean(request.tokenPlanId)) {
      throw new Error('Invalid global route template')
    }
    const templates = await this.list(accountId, edition)
    for (const item of templates) {
      if (
        item.modelId === request.modelId &&
        (await this.resolveKey(accountId, item.templateId, edition)) === request.apiKey
      ) {
        return item
      }
    }
    const template: AgentRouteTemplate = {
      templateId: randomUUID(),
      modelId: request.modelId,
      credentialName: request.credentialName,
      accessMode: request.accessMode,
      tokenPlanId: request.tokenPlanId,
      modelTypes: request.modelTypes,
      createdAt: new Date().toISOString(),
      maskedKey: maskKey(request.apiKey)
    }
    await this.writeJson(this.secretPath(accountId, template.templateId, edition), {
      apiKey: request.apiKey
    })
    await this.writeJson(this.getFilePath(accountId, edition), [...templates, template])
    return template
  }

  async remove(accountId: string, templateId: string, edition: WorkBuddyEdition = 'domestic'): Promise<void> {
    const templates = await this.list(accountId, edition)
    await this.writeJson(
      this.getFilePath(accountId, edition),
      templates.filter((item) => item.templateId !== templateId)
    )
    await this.writeJson(this.secretPath(accountId, templateId, edition), { deleted: true })
  }

  async resolveKey(accountId: string, templateId: string, edition: WorkBuddyEdition = 'domestic'): Promise<string> {
    const secret = await this.readJson<{ apiKey?: string }>(this.secretPath(accountId, templateId, edition), {})
    if (!secret.apiKey) throw new Error('Global route template credential is unavailable')
    return secret.apiKey
  }

  private accountPath(accountId: string, edition: WorkBuddyEdition): string {
    const accountKey = createHash('sha256').update(accountId).digest('hex')
    return join(
      this.rootPath,
      'global-templates',
      accountKey,
      ...(edition === 'overseas' ? ['workbuddy-overseas'] : [])
    )
  }

  private secretPath(accountId: string, templateId: string, edition: WorkBuddyEdition): string {
    return join(this.accountPath(accountId, edition), 'credentials', `${templateId}.json`)
  }

  private async readJson<T>(filePath: string, fallback: T): Promise<T> {
    try {
      return JSON.parse(await readFile(filePath, 'utf8')) as T
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback
      throw error
    }
  }

  private async writeJson(filePath: string, value: unknown): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true })
    const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    await rename(temporaryPath, filePath)
  }
}
