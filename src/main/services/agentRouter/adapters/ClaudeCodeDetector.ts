import { homedir } from 'node:os'
import { join } from 'node:path'

import { AGENT_ROUTER_TARGET_CLAUDE_CODE } from '@shared/agentRouter'

import { ClaudeCodeAdapter } from '../ClaudeCodeAdapter'
import type { TargetDetector } from '../TargetAdapter'

export class ClaudeCodeDetector implements TargetDetector {
  readonly targetId = AGENT_ROUTER_TARGET_CLAUDE_CODE
  private readonly adapter = new ClaudeCodeAdapter()

  defaultConfigPaths(env: NodeJS.ProcessEnv = process.env): string[] {
    return [join(env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'settings.json')]
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
