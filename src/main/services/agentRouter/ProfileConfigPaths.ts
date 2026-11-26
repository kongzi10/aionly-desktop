import { dirname, join } from 'node:path'

import getShellEnv, { refreshShellEnv } from '@main/utils/shell-env'

import { getTargetDetector } from './TargetRegistry'

export class ProfileConfigPaths {
  claudeCode = getTargetDetector('claude-code').defaultConfigPaths()[0]
  codex = getTargetDetector('codex').defaultConfigPaths()[0]
  codexAuth = getTargetDetector('codex').defaultConfigPaths()[1]
  private selectedClaudeCode = false
  private selectedCodex = false
  private initialized?: Promise<void>

  resolve(refresh = false): Promise<void> {
    if (refresh) {
      this.initialized = (this.initialized ?? Promise.resolve()).then(async () => {
        this.setDefaults(await refreshShellEnv())
      })
    } else {
      this.initialized ??= getShellEnv().then((env) => this.setDefaults(env))
    }
    return this.initialized
  }

  select(targetId: 'codex' | 'claude-code', configPath: string): void {
    if (targetId === 'codex') {
      this.selectedCodex = true
      this.codex = configPath
      this.codexAuth = join(dirname(configPath), 'auth.json')
    } else {
      this.selectedClaudeCode = true
      this.claudeCode = configPath
    }
  }

  private setDefaults(env: NodeJS.ProcessEnv): void {
    if (!this.selectedClaudeCode) this.claudeCode = getTargetDetector('claude-code').defaultConfigPaths(env)[0]
    if (!this.selectedCodex) [this.codex, this.codexAuth] = getTargetDetector('codex').defaultConfigPaths(env)
  }
}
