import type { AgentRouterTargetId } from '@shared/agentRouter'

export interface TargetDetector {
  readonly targetId: AgentRouterTargetId
  defaultConfigPaths(): string[]
  identify(content: string): boolean
}
