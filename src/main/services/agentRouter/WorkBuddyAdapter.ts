import type { AgentRouteModelType, AgentRouterErrorCode } from '@shared/agentRouter'

type WorkBuddyRouteDefinition = {
  modelId: string
  modelTypes: readonly AgentRouteModelType[]
}

import { APP_NAME, LOGO_URL } from '@shared/config/constant'

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
  'useCustomProtocol',
  'iconUrl'
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
  iconUrl?: string
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

    const entries = document.map((candidate) => {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        throw new AgentRouterError('INVALID_CONFIG', 'Every WorkBuddy model entry must be an object')
      }

      const source = candidate as Record<string, unknown>
      const unknownFields = Object.fromEntries(Object.entries(source).filter(([key]) => !KNOWN_ENTRY_KEYS.has(key)))
      const value = { ...source } as WorkBuddyEntry

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
      name: APP_NAME,
      vendor: 'Custom',
      url: apiUrl,
      apiKey,
      supportsToolCall: intent.modelTypes.includes('function_calling'),
      supportsImages: intent.modelTypes.includes('vision'),
      supportsReasoning: intent.modelTypes.includes('reasoning'),
      useCustomProtocol: false,
      iconUrl: LOGO_URL
    }
  }

  merge(
    current: WorkBuddyEntry[],
    generated: WorkBuddyEntry[],
    managedIds = new Set(current.filter((entry) => this.isAionlyEntry(entry)).map((entry) => entry.id)),
    iconRefreshKeys = new Set<string>()
  ): WorkBuddyEntry[] {
    const generatedIds = new Set(generated.map((entry) => entry.id))
    const preserved = current
      .filter((entry) => !generatedIds.has(entry.id) && (!managedIds.has(entry.id) || !this.isAionlyEntry(entry)))
      .map((entry) =>
        this.isAionlyEntry(entry) && iconRefreshKeys.has(JSON.stringify([entry.id, entry.apiKey]))
          ? { ...entry, iconUrl: LOGO_URL }
          : entry
      )
    return [...generated, ...preserved]
  }

  validate(entries: WorkBuddyEntry[]): void {
    this.parse(JSON.stringify(entries))
  }

  serialize(entries: WorkBuddyEntry[]): string {
    this.validate(entries)
    return `${JSON.stringify(entries, null, 2)}\n`
  }
}
