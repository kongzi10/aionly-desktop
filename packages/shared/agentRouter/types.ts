export const AGENT_ROUTER_TARGET_WORKBUDDY = 'workbuddy' as const
export const AGENT_ROUTER_TARGET_CODEX = 'codex' as const
export const AGENT_ROUTER_TARGET_CLAUDE_CODE = 'claude-code' as const

export const AGENT_ROUTER_TARGET_IDS = [
  AGENT_ROUTER_TARGET_WORKBUDDY,
  AGENT_ROUTER_TARGET_CLAUDE_CODE,
  AGENT_ROUTER_TARGET_CODEX
] as const

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
  | 'unsupportedFormat'
  | 'onlyFirstRouteApplied'

export type AgentRouterErrorCode =
  | 'TARGET_NOT_FOUND'
  | 'CONFIG_NOT_READABLE'
  | 'CONFIG_NOT_WRITABLE'
  | 'UNSUPPORTED_FORMAT'
  | 'INVALID_CONFIG'
  | 'REVISION_CONFLICT'
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
  credentialName?: string
  modelId: string
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

export interface ClaudeCodeRouteProfile {
  id: string
  targetId: typeof AGENT_ROUTER_TARGET_CLAUDE_CODE
  name: string
  credentialId: string
  credentialName?: string
  accessMode: AgentRouteAccessMode
  tokenPlanId?: string
  models: {
    opus?: string
    sonnet?: string
    haiku?: string
    default?: string
    opusName?: string
    sonnetName?: string
    haikuName?: string
  }
  managedAt: string
}

export interface ClaudeCodeProfileLibrary {
  version: 2
  profiles: ClaudeCodeRouteProfile[]
  activeProfileId?: string
}

export interface SaveClaudeCodeProfileRequest {
  profileId?: string
  name: string
  credentialName?: string
  accessMode: AgentRouteAccessMode
  tokenPlanId?: string
  apiKey: string
  models: ClaudeCodeRouteProfile['models']
}

export interface PreviewClaudeCodeRouteRequest {
  accountId: string
  profileId: string
  expectedRevision: string
  apiUrl: string
}

export interface DeleteClaudeCodeProfileRequest {
  accountId: string
  profileId: string
}

export interface DeleteCodexProfileRequest {
  accountId: string
  profileId: string
}

export type ClaudeCodeManagedField =
  | 'ANTHROPIC_MODEL'
  | 'ANTHROPIC_BASE_URL'
  | 'ANTHROPIC_API_KEY'
  | 'ANTHROPIC_AUTH_TOKEN'
  | 'ANTHROPIC_DEFAULT_OPUS_MODEL'
  | 'ANTHROPIC_DEFAULT_SONNET_MODEL'
  | 'ANTHROPIC_DEFAULT_HAIKU_MODEL'
  | 'ANTHROPIC_DEFAULT_OPUS_MODEL_NAME'
  | 'ANTHROPIC_DEFAULT_SONNET_MODEL_NAME'
  | 'ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME'
  | 'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS'

export interface ClaudeCodeRoutePreviewEntry {
  field: ClaudeCodeManagedField
  previous?: string
  next?: string
  sensitive: boolean
}

export interface ClaudeCodeApplyPreview extends Omit<ApplyPreview, 'entries'> {
  entries: ClaudeCodeRoutePreviewEntry[]
}

export interface CodexRouteProfile {
  id: string
  targetId: typeof AGENT_ROUTER_TARGET_CODEX
  name: string
  credentialId: string
  credentialName?: string
  accessMode: AgentRouteAccessMode
  tokenPlanId?: string
  model: string
  reasoningEffort?: CodexReasoningEffort
  managedAt: string
}

export type CodexReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultra'

export interface CodexProfileLibrary {
  version: 1
  profiles: CodexRouteProfile[]
  activeProfileId?: string
}

export interface SaveCodexProfileRequest {
  profileId?: string
  name: string
  credentialName?: string
  accessMode: AgentRouteAccessMode
  tokenPlanId?: string
  apiKey: string
  model: string
  reasoningEffort?: CodexReasoningEffort
}

export interface PreviewCodexRouteRequest {
  accountId: string
  profileId: string
  expectedRevision: string
  apiUrl: string
}

export type CodexManagedField =
  | 'model'
  | 'model_provider'
  | 'model_reasoning_effort'
  | 'disable_response_storage'
  | 'name'
  | 'base_url'
  | 'wire_api'
  | 'requires_openai_auth'
  | 'OPENAI_API_KEY'

export interface CodexRoutePreviewEntry {
  field: CodexManagedField
  previous?: string
  next?: string
  sensitive: boolean
}

export interface CodexApplyPreview extends Omit<ApplyPreview, 'entries'> {
  entries: CodexRoutePreviewEntry[]
}

export interface AgentRouteTemplate {
  credentialName?: string
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
  credentialName?: string
  modelId: string
  accessMode: AgentRouteAccessMode
  tokenPlanId?: string
  apiKey: string
  modelTypes: readonly AgentRouteModelType[]
}

export interface UpdateAgentRouteRequest {
  credentialName?: string
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
  credentialName?: string
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
export type WorkBuddyEdition = 'domestic' | 'overseas'

export interface TargetSnapshot {
  targetId: AgentRouterTargetId
  configPath: string
  authPath?: string
  exists: boolean
  readable: boolean
  writable: boolean
  detectionState: AgentRouterDetectionState
  formatVersion?: 'workbuddy-models-v1' | 'claude-code-settings-v1' | 'codex-config-v1'
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
  incrementalModelIds?: string[]
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

export interface NamedAgentRouterCredential {
  value: string
  label: string
}
