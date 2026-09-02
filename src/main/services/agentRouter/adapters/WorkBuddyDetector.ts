import { homedir } from 'node:os'
import { join } from 'node:path'

import { AGENT_ROUTER_TARGET_WORKBUDDY } from '@shared/agentRouter'

import type { TargetDetector } from '../TargetAdapter'
import { WorkBuddyAdapter } from '../WorkBuddyAdapter'

export class WorkBuddyDetector implements TargetDetector {
  readonly targetId = AGENT_ROUTER_TARGET_WORKBUDDY
  private readonly adapter = new WorkBuddyAdapter()

  defaultConfigPaths(): string[] {
    return [join(homedir(), '.workbuddy', 'models.json')]
  }

  identify(content: string): boolean {
    try {
      this.adapter.parse(content)
      return true
    } catch {
      return false
    }
  }
}
