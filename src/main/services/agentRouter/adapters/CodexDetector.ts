import { homedir } from 'node:os'
import { join } from 'node:path'

import { AGENT_ROUTER_TARGET_CODEX } from '@shared/agentRouter'

import { CodexAdapter } from '../CodexAdapter'
import type { TargetDetector } from '../TargetAdapter'

export class CodexDetector implements TargetDetector {
  readonly targetId = AGENT_ROUTER_TARGET_CODEX
  private readonly adapter = new CodexAdapter()

  defaultConfigPaths(): string[] {
    const codexHome = process.env.CODEX_HOME || join(homedir(), '.codex')
    return [join(codexHome, 'config.toml'), join(codexHome, 'auth.json')]
  }

  identify(content: string): boolean {
    try {
      const document = this.adapter.parseConfigToml(content)
      return (
        document.model !== undefined || document.model_provider !== undefined || document.model_providers !== undefined
      )
    } catch {
      return false
    }
  }
}
