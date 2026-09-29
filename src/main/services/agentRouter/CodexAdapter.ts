import * as TOML from '@iarna/toml'
import type { CodexManagedField, CodexRoutePreviewEntry, CodexRouteProfile } from '@shared/agentRouter'
import { APP_API_HOST } from '@shared/config/constant'

import { AgentRouterError } from './WorkBuddyAdapter'

export interface CodexAuthJson {
  OPENAI_API_KEY?: string
  [key: string]: unknown
}

const CONFIG_FIELDS: readonly CodexManagedField[] = [
  'model',
  'model_provider',
  'model_reasoning_effort',
  'disable_response_storage'
]

const PROVIDER_FIELDS: readonly CodexManagedField[] = ['name', 'base_url', 'wire_api', 'requires_openai_auth']

// Managed provider id and display name follow the build flavor: CN build (llm.aiionly.com) → 'AiiOnly', global build → 'AiOnly'
export const CODEX_MANAGED_PROVIDER_ID = APP_API_HOST.includes('aiionly') ? 'AiiOnly' : 'AiOnly'

const maskSecret = (value: string): string => {
  if (value.length <= 8) return '••••'
  return `${value.slice(0, 4)}••••${value.slice(-4)}`
}

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

export interface CodexManagedPlan {
  configToml: Record<string, unknown>
  provider: Record<string, unknown>
  authJson: CodexAuthJson
}

export class CodexAdapter {
  parseConfigToml(content?: string): Record<string, unknown> {
    if (content === undefined || content.trim() === '') return {}
    let document: unknown
    try {
      document = TOML.parse(content)
    } catch {
      throw new AgentRouterError('INVALID_CONFIG', 'Codex config.toml is not valid TOML')
    }
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
      throw new AgentRouterError('UNSUPPORTED_FORMAT', 'Codex config.toml must be a TOML table')
    }
    return document as Record<string, unknown>
  }

  parseAuthJson(content?: string): CodexAuthJson {
    if (content === undefined || content.trim() === '') return {}
    let document: unknown
    try {
      document = JSON.parse(content)
    } catch {
      throw new AgentRouterError('INVALID_CONFIG', 'Codex auth.json is not valid JSON')
    }
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
      throw new AgentRouterError('UNSUPPORTED_FORMAT', 'Codex auth.json must be a JSON object')
    }
    return document as CodexAuthJson
  }

  /**
   * Managed layout (Codex official format):
   * - config.toml keeps the user's own content; we own the managed `[model_providers.AiOnly]`
   *   table (id follows the build flavor), the top-level `model_provider` id string, the `model`
   *   selection and reasoning flags.
   * - auth.json only carries OPENAI_API_KEY (read by Codex via requires_openai_auth).
   */
  buildManagedPlan(
    currentToml: Record<string, unknown>,
    profile: CodexRouteProfile,
    credential: string,
    apiUrl: string
  ): CodexManagedPlan {
    if (!credential || !apiUrl || !profile.model.trim()) {
      throw new AgentRouterError('INVALID_REQUEST', 'Codex route profile is incomplete')
    }
    const configToml = { ...currentToml }
    const providers = { ...asObject(configToml.model_providers) }
    const provider = { ...asObject(providers[CODEX_MANAGED_PROVIDER_ID]) }
    provider.name = CODEX_MANAGED_PROVIDER_ID
    provider.base_url = apiUrl
    provider.wire_api = 'responses'
    provider.requires_openai_auth = true
    // env_key was written by earlier managed applies; requires_openai_auth replaces it
    delete provider.env_key
    providers[CODEX_MANAGED_PROVIDER_ID] = provider
    configToml.model_providers = providers
    configToml.model_provider = CODEX_MANAGED_PROVIDER_ID
    configToml.model = profile.model
    configToml.model_reasoning_effort = 'medium'
    configToml.disable_response_storage = true
    const authJson: CodexAuthJson = { OPENAI_API_KEY: credential }
    return { configToml, provider, authJson }
  }

  createPreview(
    currentToml: Record<string, unknown>,
    currentAuth: CodexAuthJson,
    profile: CodexRouteProfile,
    credential: string,
    apiUrl: string
  ): CodexRoutePreviewEntry[] {
    const plan = this.buildManagedPlan(currentToml, profile, credential, apiUrl)
    return ([...CONFIG_FIELDS, ...PROVIDER_FIELDS, 'OPENAI_API_KEY'] as const).flatMap((field) => {
      const previous = this.readField(currentToml, currentAuth, field)
      const upcoming = this.readField(plan.configToml, plan.authJson, field)
      if (previous === upcoming) return []
      const sensitive = field === 'OPENAI_API_KEY'
      return [
        {
          field,
          previous: previous === undefined ? undefined : sensitive ? maskSecret(previous) : previous,
          next: upcoming === undefined ? undefined : sensitive ? maskSecret(upcoming) : upcoming,
          sensitive
        }
      ]
    })
  }

  removeManagedFields(
    currentToml: Record<string, unknown>,
    currentAuth: CodexAuthJson
  ): { configToml: Record<string, unknown>; authJson: CodexAuthJson } {
    const configToml = { ...currentToml }
    for (const field of CONFIG_FIELDS) delete configToml[field]
    const providers = { ...asObject(configToml.model_providers) }
    delete providers[CODEX_MANAGED_PROVIDER_ID]
    if (Object.keys(providers).length) configToml.model_providers = providers
    else delete configToml.model_providers
    const authJson = { ...currentAuth }
    delete authJson.OPENAI_API_KEY
    return { configToml, authJson }
  }

  hasManagedFields(currentToml: Record<string, unknown>, currentAuth: CodexAuthJson): boolean {
    if (CONFIG_FIELDS.some((field) => this.readConfigField(currentToml, field) !== undefined)) return true
    if (Object.keys(asObject(currentToml.model_providers)).includes(CODEX_MANAGED_PROVIDER_ID)) return true
    return currentAuth.OPENAI_API_KEY !== undefined
  }

  serializeConfigToml(configToml: Record<string, unknown>): string {
    const serialized = TOML.stringify(configToml as TOML.JsonMap)
    return `${serialized.trimEnd()}\n`
  }

  serializeAuthJson(authJson: CodexAuthJson): string {
    return `${JSON.stringify(authJson, null, 2)}\n`
  }

  verify(
    configTomlContent: string,
    authJsonContent: string,
    expectedToml: Record<string, unknown>,
    expectedAuth: CodexAuthJson
  ): void {
    const actualToml = this.parseConfigToml(configTomlContent)
    const actualAuth = this.parseAuthJson(authJsonContent)
    for (const field of [...CONFIG_FIELDS, ...PROVIDER_FIELDS]) {
      if (this.readConfigField(expectedToml, field) !== this.readConfigField(actualToml, field)) {
        throw new AgentRouterError('VERIFY_FAILED', `Codex config was not applied: ${field}`)
      }
    }
    if ((expectedAuth.OPENAI_API_KEY ?? undefined) !== (actualAuth.OPENAI_API_KEY ?? undefined)) {
      throw new AgentRouterError('VERIFY_FAILED', 'Codex auth was not applied: OPENAI_API_KEY')
    }
  }

  private readConfigField(configToml: Record<string, unknown>, field: CodexManagedField): string | undefined {
    if (PROVIDER_FIELDS.includes(field)) {
      const value = asObject(asObject(configToml.model_providers)[CODEX_MANAGED_PROVIDER_ID])[field]
      return typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number'
        ? String(value)
        : undefined
    }
    const value = configToml[field]
    if (typeof value === 'string') return value
    if (typeof value === 'boolean') return String(value)
    return undefined
  }

  private readField(
    configToml: Record<string, unknown>,
    authJson: CodexAuthJson,
    field: CodexManagedField
  ): string | undefined {
    if (field === 'OPENAI_API_KEY') {
      const value = authJson.OPENAI_API_KEY
      return typeof value === 'string' ? value : undefined
    }
    return this.readConfigField(configToml, field)
  }
}
