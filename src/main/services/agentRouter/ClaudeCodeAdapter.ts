import type { ClaudeCodeManagedField, ClaudeCodeRoutePreviewEntry, ClaudeCodeRouteProfile } from '@shared/agentRouter'

import { AgentRouterError } from './WorkBuddyAdapter'

export type ClaudeCodeSettings = Record<string, unknown>

const ENV_FIELDS = [
  'ANTHROPIC_MODEL',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL_NAME',
  'ANTHROPIC_DEFAULT_SONNET_MODEL_NAME',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME',
  'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS'
] as const satisfies readonly ClaudeCodeManagedField[]

const maskSecret = (value: string): string => {
  if (value.length <= 8) return '••••'
  return `${value.slice(0, 4)}••••${value.slice(-4)}`
}

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

export class ClaudeCodeAdapter {
  parse(content?: string): ClaudeCodeSettings {
    if (content === undefined || content.trim() === '') return {}
    let document: unknown
    try {
      document = JSON.parse(content)
    } catch {
      throw new AgentRouterError('INVALID_CONFIG', 'Claude Code settings are not valid JSON')
    }
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
      throw new AgentRouterError('UNSUPPORTED_FORMAT', 'Claude Code settings must be a JSON object')
    }
    return document as ClaudeCodeSettings
  }

  merge(
    current: ClaudeCodeSettings,
    profile: ClaudeCodeRouteProfile,
    credential: string,
    apiUrl: string
  ): ClaudeCodeSettings {
    if (!credential || !apiUrl) {
      throw new AgentRouterError('INVALID_REQUEST', 'Claude Code route profile is incomplete')
    }
    const env = { ...asObject(current.env) }
    delete env.ANTHROPIC_API_KEY
    const assignSlot = (field: string, value?: string) => {
      if (value) env[field] = value
      else delete env[field]
    }
    const assignModelSlot = (modelField: string, nameField: string, model?: string, displayName?: string) => {
      assignSlot(modelField, model)
      assignSlot(nameField, model ? displayName : undefined)
    }
    assignModelSlot(
      'ANTHROPIC_DEFAULT_OPUS_MODEL',
      'ANTHROPIC_DEFAULT_OPUS_MODEL_NAME',
      profile.models.opus,
      profile.models.opusName
    )
    assignModelSlot(
      'ANTHROPIC_DEFAULT_SONNET_MODEL',
      'ANTHROPIC_DEFAULT_SONNET_MODEL_NAME',
      profile.models.sonnet,
      profile.models.sonnetName
    )
    assignModelSlot(
      'ANTHROPIC_DEFAULT_HAIKU_MODEL',
      'ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME',
      profile.models.haiku,
      profile.models.haikuName
    )
    assignSlot('ANTHROPIC_MODEL', profile.models.default)
    Object.assign(env, {
      ANTHROPIC_BASE_URL: apiUrl,
      ANTHROPIC_AUTH_TOKEN: credential,
      CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1'
    })
    return { ...current, env }
  }

  createPreview(
    current: ClaudeCodeSettings,
    profile: ClaudeCodeRouteProfile,
    credential: string,
    apiUrl: string
  ): ClaudeCodeRoutePreviewEntry[] {
    const next = this.merge(current, profile, credential, apiUrl)
    return ENV_FIELDS.flatMap((field) => {
      const previous = this.readField(current, field)
      const upcoming = this.readField(next, field)
      if (previous === upcoming) return []
      const sensitive = field === 'ANTHROPIC_API_KEY' || field === 'ANTHROPIC_AUTH_TOKEN'
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

  removeManagedFields(current: ClaudeCodeSettings): ClaudeCodeSettings {
    const next = { ...current }
    const env = { ...asObject(current.env) }
    for (const field of ENV_FIELDS) delete env[field]
    if (Object.keys(env).length) next.env = env
    else delete next.env
    return next
  }

  hasManagedFields(current: ClaudeCodeSettings): boolean {
    return ENV_FIELDS.some((field) => this.readField(current, field) !== undefined)
  }

  serialize(settings: ClaudeCodeSettings): string {
    this.parse(JSON.stringify(settings))
    return `${JSON.stringify(settings, null, 2)}\n`
  }

  verify(content: string, expected: ClaudeCodeSettings): void {
    const actual = this.parse(content)
    for (const field of ENV_FIELDS) {
      if (this.readField(expected, field) !== this.readField(actual, field)) {
        throw new AgentRouterError('VERIFY_FAILED', `Claude Code setting was not applied: ${field}`)
      }
    }
  }

  private readField(settings: ClaudeCodeSettings, field: ClaudeCodeManagedField): string | undefined {
    const value = asObject(settings.env)[field]
    return typeof value === 'string' ? value : undefined
  }
}
