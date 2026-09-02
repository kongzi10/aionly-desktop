import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { AgentRouteTemplate, CreateAgentRouteTemplateRequest } from '@shared/agentRouter'

const maskKey = (value: string) => `${value.slice(0, 4)}••••${value.slice(-4)}`

export class GlobalRouteTemplateStore {
  constructor(private readonly rootPath: string) {}

  getFilePath(accountId: string): string {
    return join(this.accountPath(accountId), 'templates.json')
  }

  async list(accountId: string): Promise<AgentRouteTemplate[]> {
    const templates = await this.readJson<AgentRouteTemplate[]>(this.getFilePath(accountId), [])
    return Promise.all(
      templates.map(async (template) => {
        try {
          return { ...template, maskedKey: maskKey(await this.resolveKey(accountId, template.templateId)) }
        } catch {
          return template
        }
      })
    )
  }

  async create(accountId: string, request: CreateAgentRouteTemplateRequest): Promise<AgentRouteTemplate> {
    if (!request.modelId || !request.apiKey || (request.accessMode === 'tokenPlan') !== Boolean(request.tokenPlanId)) {
      throw new Error('Invalid global route template')
    }
    const templates = await this.list(accountId)
    for (const item of templates) {
      if (item.modelId === request.modelId && (await this.resolveKey(accountId, item.templateId)) === request.apiKey) {
        throw new Error(`Duplicate global route template: ${request.modelId}`)
      }
    }
    const template: AgentRouteTemplate = {
      templateId: randomUUID(),
      modelId: request.modelId,
      displayName: request.displayName || request.modelId,
      accessMode: request.accessMode,
      tokenPlanId: request.tokenPlanId,
      modelTypes: request.modelTypes,
      createdAt: new Date().toISOString(),
      maskedKey: maskKey(request.apiKey)
    }
    await this.writeJson(this.secretPath(accountId, template.templateId), {
      apiKey: request.apiKey
    })
    await this.writeJson(this.getFilePath(accountId), [...templates, template])
    return template
  }

  async remove(accountId: string, templateId: string): Promise<void> {
    const templates = await this.list(accountId)
    await this.writeJson(
      this.getFilePath(accountId),
      templates.filter((item) => item.templateId !== templateId)
    )
    await this.writeJson(this.secretPath(accountId, templateId), { deleted: true })
  }

  async resolveKey(accountId: string, templateId: string): Promise<string> {
    const secret = await this.readJson<{ apiKey?: string }>(this.secretPath(accountId, templateId), {})
    if (!secret.apiKey) throw new Error('Global route template credential is unavailable')
    return secret.apiKey
  }

  private accountPath(accountId: string): string {
    const accountKey = createHash('sha256').update(accountId).digest('hex')
    return join(this.rootPath, 'global-templates', accountKey)
  }

  private secretPath(accountId: string, templateId: string): string {
    return join(this.accountPath(accountId), 'credentials', `${templateId}.json`)
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
