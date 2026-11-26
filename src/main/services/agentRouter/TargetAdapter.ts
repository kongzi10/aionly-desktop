import type { AgentRouterTargetId } from '@shared/agentRouter'

export interface TargetDetector {
  readonly targetId: AgentRouterTargetId
  defaultConfigPaths(env?: NodeJS.ProcessEnv): string[]
  identify(content: string): boolean
}
