import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { AgentRouteConfig, AgentRouteModel, AgentRouteRef, AgentRouterTargetId } from '@shared/agentRouter'

const SECRET_FIELD_NAMES = new Set(['apikey', 'secret', 'token', 'authorization'])

const assertNoSecretFields = (value: unknown): void => {
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_FIELD_NAMES.has(key.toLowerCase()))
      throw new Error(`Route record contains forbidden secret field: ${key}`)
    assertNoSecretFields(child)
  }
}

const validateModels = (models: AgentRouteModel[]): void => {
  const ids = new Set<string>()
  for (const model of models) {
    const id = `${model.modelId}\u0000${model.credentialId}`
    if (!model.modelId || !model.credentialId || ids.has(id))
      throw new Error(`Invalid or duplicate route model: ${model.modelId}`)
    ids.add(id)
    if ((model.accessMode === 'tokenPlan') !== Boolean(model.tokenPlanId)) {
      throw new Error(`Credential mode does not match TokenPlan reference: ${model.modelId}`)
    }
  }
}

export class RouteRecordStore {
  private readonly writeQueues = new Map<string, Promise<void>>()

  constructor(private readonly rootPath: string) {}

  getFilePath(accountId: string, targetId: AgentRouterTargetId): string {
    const accountKey = createHash('sha256').update(accountId).digest('hex')
    return join(this.rootPath, 'routes', accountKey, `${targetId}.json`)
  }

  async getRouteConfig(accountId: string, targetId: AgentRouterTargetId): Promise<AgentRouteConfig> {
    const filePath = this.getFilePath(accountId, targetId)
    let document: AgentRouteConfig
    try {
      document = JSON.parse(await readFile(filePath, 'utf8')) as AgentRouteConfig
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { targetId, models: [] }
      throw error
    }
    if (document.targetId !== targetId || !Array.isArray(document.models)) throw new Error('Invalid route document')
    document = {
      ...document,
      models: document.models.map((model) => ({ ...model, enabled: false }))
    }
    assertNoSecretFields(document)
    validateModels(document.models)
    return document
  }

  async saveRouteModels(accountId: string, targetId: AgentRouterTargetId, models: AgentRouteModel[]): Promise<void> {
    assertNoSecretFields(models)
    validateModels(models)
    const current = await this.getRouteConfig(accountId, targetId)
    const byModel = new Map(current.models.map((model) => [`${model.modelId}\u0000${model.credentialId}`, model]))
    for (const model of models) byModel.set(`${model.modelId}\u0000${model.credentialId}`, model)
    await this.write(accountId, targetId, { targetId, models: [...byModel.values()] })
  }

  async removeRouteModels(
    accountId: string,
    targetId: AgentRouterTargetId,
    routes: readonly AgentRouteRef[]
  ): Promise<void> {
    const removed = new Set(routes.map((route) => `${route.modelId}\u0000${route.credentialId}`))
    const current = await this.getRouteConfig(accountId, targetId)
    await this.write(accountId, targetId, {
      targetId,
      models: current.models.filter((model) => !removed.has(`${model.modelId}\u0000${model.credentialId}`))
    })
  }

  async replaceRouteModel(
    accountId: string,
    targetId: AgentRouterTargetId,
    currentRoute: AgentRouteRef,
    replacement: AgentRouteModel
  ): Promise<void> {
    const current = await this.getRouteConfig(accountId, targetId)
    const index = current.models.findIndex(
      (model) => model.modelId === currentRoute.modelId && model.credentialId === currentRoute.credentialId
    )
    if (index < 0) throw new Error('Agent route does not exist')
    const models = [...current.models]
    models[index] = replacement
    validateModels(models)
    await this.write(accountId, targetId, { targetId, models })
  }

  private async write(accountId: string, targetId: AgentRouterTargetId, document: AgentRouteConfig): Promise<void> {
    const filePath = this.getFilePath(accountId, targetId)
    const previous = this.writeQueues.get(filePath) ?? Promise.resolve()
    const operation = previous.then(async () => {
      await mkdir(dirname(filePath), { recursive: true })
      const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
      const persistedDocument = {
        ...document,
        models: document.models.map((model) => {
          const persisted: Partial<AgentRouteModel> = { ...model }
          delete persisted.enabled
          return persisted
        })
      }
      await writeFile(temporaryPath, `${JSON.stringify(persistedDocument, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600
      })
      await rename(temporaryPath, filePath)
    })
    this.writeQueues.set(
      filePath,
      operation.catch(() => undefined)
    )
    return operation
  }
}
