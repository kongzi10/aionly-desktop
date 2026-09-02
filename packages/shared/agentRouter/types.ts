export const AGENT_ROUTER_TARGET_WORKBUDDY = 'workbuddy' as const
export const AGENT_ROUTER_TARGET_CODEX = 'codex' as const

export const AGENT_ROUTER_TARGET_IDS = [AGENT_ROUTER_TARGET_WORKBUDDY, AGENT_ROUTER_TARGET_CODEX] as const

export type AgentRouterTargetId = (typeof AGENT_ROUTER_TARGET_IDS)[number]
export type AgentRouteAccessMode = 'api' | 'tokenPlan'

export type AgentRouteDetailStatus =
  | 'synced'
  | 'pendingAdd'
  | 'pendingUpdate'
  | 'pendingRemove'
  | 'externallyModified'
  | 'credentialInvalid'
  | 'targetNotWritable'

export type AgentRouteDisplayStatus = 'effective' | 'pending' | 'actionRequired'

export type AgentRouteIssueCode =
  | 'externallyModified'
  | 'credentialInvalid'
  | 'targetNotWritable'
  | 'ownershipConflict'
  | 'unsupportedFormat'
  | 'onlyFirstRouteApplied'

export type AgentRouterErrorCode =
  | 'TARGET_NOT_FOUND'
  | 'CONFIG_NOT_READABLE'
  | 'CONFIG_NOT_WRITABLE'
  | 'UNSUPPORTED_FORMAT'
  | 'INVALID_CONFIG'
  | 'REVISION_CONFLICT'
  | 'ENTRY_OWNERSHIP_CONFLICT'
  | 'CREDENTIAL_UNAVAILABLE'
  | 'TOKEN_PLAN_EXPIRED'
  | 'MODEL_NOT_ALLOWED'
  | 'BACKUP_FAILED'
  | 'WRITE_FAILED'
  | 'VERIFY_FAILED'
  | 'ROLLBACK_FAILED'
  | 'PREVIEW_EXPIRED'
  | 'INVALID_REQUEST'

export const AGENT_ROUTE_MODEL_TYPES = [
  'vision',
  'web_search',
  'reasoning',
  'function_calling',
  'rerank',
  'embedding'
] as const

export type AgentRouteModelType = (typeof AGENT_ROUTE_MODEL_TYPES)[number]

export interface AgentRouteModel {
  modelId: string
  displayName: string
  accessMode: AgentRouteAccessMode
  credentialId: string
  tokenPlanId?: string
  enabled: boolean
  modelTypes: readonly AgentRouteModelType[]
  routedAt: string
}

export interface AgentRouteConfig {
  targetId: AgentRouterTargetId
  models: AgentRouteModel[]
}

export interface AgentRouteTemplate {
  templateId: string
  modelId: string
  accessMode: AgentRouteAccessMode
  tokenPlanId?: string
  modelTypes: readonly AgentRouteModelType[]
  createdAt: string
  maskedKey: string
  joined?: boolean
}

export interface CreateAgentRouteRequest {
  modelId: string
  displayName?: string
  accessMode: AgentRouteAccessMode
  tokenPlanId?: string
  apiKey: string
  modelTypes: readonly AgentRouteModelType[]
}

export interface UpdateAgentRouteRequest {
  displayName?: string
  accessMode: AgentRouteAccessMode
  tokenPlanId?: string
  apiKey?: string
  modelTypes: readonly AgentRouteModelType[]
}

export interface AgentRouteRef {
  modelId: string
  credentialId: string
}

export interface CreateAgentRouteTemplateRequest {
  modelId: string
  accessMode: AgentRouteAccessMode
  tokenPlanId?: string
  apiKey: string
  modelTypes: readonly AgentRouteModelType[]
}

export interface RedactedCredentialSummary {
  id: string
  accessMode: AgentRouteAccessMode
  label: string
  maskedValue: string
  available: boolean
  reason?: AgentRouteIssueCode
  tokenPlanId?: string
}

export type AgentRouterDetectionState = 'detected' | 'notFound' | 'needsAttention'

export interface TargetSnapshot {
  targetId: AgentRouterTargetId
  configPath: string
  authPath?: string
  exists: boolean
  readable: boolean
  writable: boolean
  detectionState: AgentRouterDetectionState
  formatVersion?: 'workbuddy-models-v1'
  revision?: string
  lastModifiedAt?: string
  managedEntryCount: number
  externalEntryCount: number
  issues: AgentRouteIssueCode[]
}

export interface ApplyCounts {
  added: number
  updated: number
  removed: number
  unchanged: number
}

export interface RedactedTargetEntry {
  id: string
  name: string
  url: string
  apiKey: string
  modelTypes: readonly AgentRouteModelType[]
}

export interface ApplyPreview {
  previewToken: string
  targetId: AgentRouterTargetId
  expectedRevision: string
  counts: ApplyCounts
  entries: RedactedTargetEntry[]
  warnings: AgentRouteIssueCode[]
  expiresAt: string
}

export interface ResolvedAgentRouterCredential {
  credentialId: string
  value: string
}

export interface PreviewWorkBuddyRoutesRequest {
  accountId: string
  expectedRevision: string
  enabledRoutes: AgentRouteRef[]
  resolvedCredentials: ResolvedAgentRouterCredential[]
  apiUrl: string
}

export interface AgentRouterApplyRequest {
  accountId: string
  previewToken: string
  expectedRevision: string
}

export interface ApplyResult {
  targetId: AgentRouterTargetId
  revision: string
  backupId: string
  counts: ApplyCounts
  restartRequired: boolean
}

export interface AgentRouterFailure {
  ok: false
  code: AgentRouterErrorCode
  message: string
}

export interface AgentRouterSuccess<T> {
  ok: true
  data: T
}

export type AgentRouterResult<T> = AgentRouterSuccess<T> | AgentRouterFailure
