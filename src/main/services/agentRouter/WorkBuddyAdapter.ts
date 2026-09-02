import type { AgentRouteModelType, AgentRouterErrorCode } from '@shared/agentRouter'

type WorkBuddyRouteDefinition = {
  modelId: string
  displayName: string
  modelTypes: readonly AgentRouteModelType[]
}

const MAX_CONFIG_BYTES = 2 * 1024 * 1024
const MAX_ENTRIES = 1000
const KNOWN_ENTRY_KEYS = new Set([
  'id',
  'name',
  'vendor',
  'url',
  'apiKey',
  'supportsToolCall',
  'supportsImages',
  'supportsReasoning',
  'useCustomProtocol'
])

export class AgentRouterError extends Error {
  constructor(
    public readonly code: AgentRouterErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'AgentRouterError'
  }
}

export interface WorkBuddyEntry {
  id: string
  name: string
  vendor: string
  url: string
  apiKey: string
  supportsToolCall: boolean
  supportsImages: boolean
  supportsReasoning: boolean
  useCustomProtocol: boolean
  [key: string]: unknown
}

export interface ParsedWorkBuddyEntry {
  value: WorkBuddyEntry
  unknownFields: Record<string, unknown>
}

export interface ParsedWorkBuddyDocument {
  formatVersion: 'workbuddy-models-v1'
  entries: ParsedWorkBuddyEntry[]
}

const requireString = (entry: Record<string, unknown>, key: string): string => {
  const value = entry[key]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgentRouterError('INVALID_CONFIG', `WorkBuddy entry field "${key}" must be a non-empty string`)
  }
  return value
}

const normalizeBoolean = (value: unknown): boolean => value === true

export class WorkBuddyAdapter {
  isAionlyEntry(entry: WorkBuddyEntry): boolean {
    if (entry.vendor !== 'Custom') return false
    try {
      const url = new URL(entry.url)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
      const hostname = url.hostname.toLowerCase()
      return ['aionly.com', 'aiionly.com'].some((root) => hostname === root || hostname.endsWith(`.${root}`))
    } catch {
      return false
    }
  }

  parse(content: string): ParsedWorkBuddyDocument {
    if (Buffer.byteLength(content, 'utf8') > MAX_CONFIG_BYTES) {
      throw new AgentRouterError('INVALID_CONFIG', 'WorkBuddy configuration exceeds the supported size')
    }

    let document: unknown
    try {
      document = JSON.parse(content)
    } catch {
      throw new AgentRouterError('INVALID_CONFIG', 'WorkBuddy configuration is not valid JSON')
    }

    if (!Array.isArray(document)) {
      throw new AgentRouterError('UNSUPPORTED_FORMAT', 'Unsupported WorkBuddy configuration format')
    }
    if (document.length > MAX_ENTRIES) {
      throw new AgentRouterError('INVALID_CONFIG', 'WorkBuddy configuration contains too many entries')
    }

    const ids = new Set<string>()
    const entries = document.map((candidate) => {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        throw new AgentRouterError('INVALID_CONFIG', 'Every WorkBuddy model entry must be an object')
      }

      const source = candidate as Record<string, unknown>
      const id = requireString(source, 'id')
      if (ids.has(id)) {
        throw new AgentRouterError('INVALID_CONFIG', `Duplicate WorkBuddy model id: ${id}`)
      }
      ids.add(id)

      const unknownFields = Object.fromEntries(Object.entries(source).filter(([key]) => !KNOWN_ENTRY_KEYS.has(key)))
      const value: WorkBuddyEntry = {
        ...unknownFields,
        id,
        name: requireString(source, 'name'),
        vendor: requireString(source, 'vendor'),
        url: requireString(source, 'url'),
        apiKey: requireString(source, 'apiKey'),
        supportsToolCall: normalizeBoolean(source.supportsToolCall),
        supportsImages: normalizeBoolean(source.supportsImages),
        supportsReasoning: normalizeBoolean(source.supportsReasoning),
        useCustomProtocol: normalizeBoolean(source.useCustomProtocol)
      }

      return { value, unknownFields }
    })

    return { formatVersion: 'workbuddy-models-v1', entries }
  }

  buildEntry(intent: WorkBuddyRouteDefinition, apiKey: string, apiUrl: string): WorkBuddyEntry {
    if (!apiKey || !apiUrl) {
      throw new AgentRouterError('CREDENTIAL_UNAVAILABLE', 'A valid credential and API URL are required')
    }

    return {
      id: intent.modelId,
      name: intent.displayName || intent.modelId,
      vendor: 'Custom',
      url: apiUrl,
      apiKey,
      supportsToolCall: intent.modelTypes.includes('function_calling'),
      supportsImages: intent.modelTypes.includes('vision'),
      supportsReasoning: intent.modelTypes.includes('reasoning'),
      useCustomProtocol: false
    }
  }

  merge(current: WorkBuddyEntry[], generated: WorkBuddyEntry[]): WorkBuddyEntry[] {
    const generatedIds = new Set(generated.map((entry) => entry.id))

    for (const entry of current) {
      if (generatedIds.has(entry.id) && !this.isAionlyEntry(entry)) {
        throw new AgentRouterError(
          'ENTRY_OWNERSHIP_CONFLICT',
          `WorkBuddy model "${entry.id}" exists but is not managed by AiOnly`
        )
      }
    }

    const preserved = current.filter((entry) => !this.isAionlyEntry(entry))
    return [...preserved, ...generated]
  }

  validate(entries: WorkBuddyEntry[]): void {
    this.parse(JSON.stringify(entries))
  }

  serialize(entries: WorkBuddyEntry[]): string {
    this.validate(entries)
    return `${JSON.stringify(entries, null, 2)}\n`
  }
}
