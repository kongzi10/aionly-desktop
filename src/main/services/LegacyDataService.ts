import fs from 'node:fs/promises'
import path from 'node:path'

import type { LegacyDataStatus, LegacyRecoveryResult, LegacyRecoveryState } from '@shared/legacyData'

interface LegacyDataServiceOptions {
  legacyRoot: string
  legacyClaudeRoot?: string
  profileRoot: string
  markerRoot: string
  profileId: string
}

interface RecoveryMarker {
  profileId: string
  state: LegacyRecoveryState
  lastError?: string
}

export class LegacyDataService {
  private readonly markerPath: string
  private recovery: Promise<LegacyRecoveryResult> | null = null

  constructor(private readonly options: LegacyDataServiceOptions) {
    this.markerPath = path.join(options.markerRoot, 'legacy-data-recovery.json')
  }

  async getStatus(): Promise<LegacyDataStatus> {
    const marker = await this.readMarker()
    const hasLegacyNativeData =
      (await this.exists(this.options.legacyRoot)) ||
      (!!this.options.legacyClaudeRoot && (await this.exists(this.options.legacyClaudeRoot)))
    return {
      hasLegacyNativeData,
      hasLegacyReduxData: false,
      hasLegacyIndexedDb: false,
      recoveryState: marker?.profileId === this.options.profileId ? marker.state : 'idle',
      cleanupAllowed: hasLegacyNativeData,
      lastError: marker?.profileId === this.options.profileId ? marker.lastError : undefined
    }
  }

  async recover(): Promise<LegacyRecoveryResult> {
    if (this.recovery) return this.recovery
    this.recovery = this.performRecovery().finally(() => {
      this.recovery = null
    })
    return this.recovery
  }

  private async performRecovery(): Promise<LegacyRecoveryResult> {
    await this.writeMarker({ profileId: this.options.profileId, state: 'recovering' })
    const result = { copiedFiles: 0, preservedConflicts: 0 }
    const stagingRoot = `${this.options.profileRoot}.legacy-restore`
    const rollbackRoot = `${this.options.profileRoot}.legacy-rollback`
    try {
      const hasLegacyRoot = await this.exists(this.options.legacyRoot)
      const hasLegacyClaude = !!this.options.legacyClaudeRoot && (await this.exists(this.options.legacyClaudeRoot))
      if (hasLegacyRoot || hasLegacyClaude) {
        await fs.rm(stagingRoot, { recursive: true, force: true })
        await fs.rm(rollbackRoot, { recursive: true, force: true })
        if (hasLegacyRoot) await fs.cp(this.options.legacyRoot, stagingRoot, { recursive: true })
        else await fs.mkdir(stagingRoot, { recursive: true })
        if (hasLegacyClaude && this.options.legacyClaudeRoot) {
          await fs.cp(this.options.legacyClaudeRoot, path.join(stagingRoot, 'ClaudeConfig'), { recursive: true })
        }
        result.copiedFiles = (await this.fingerprint(stagingRoot)).fileCount
      }
      await this.writeMarker({ profileId: this.options.profileId, state: 'verifying' })
      if (hasLegacyRoot || hasLegacyClaude) {
        if (hasLegacyRoot) await this.verifyRecovered(this.options.legacyRoot, stagingRoot)
        if (hasLegacyClaude && this.options.legacyClaudeRoot) {
          await this.verifyRecovered(this.options.legacyClaudeRoot, path.join(stagingRoot, 'ClaudeConfig'))
        }
        if (await this.exists(this.options.profileRoot)) await fs.rename(this.options.profileRoot, rollbackRoot)
        try {
          await fs.rename(stagingRoot, this.options.profileRoot)
        } catch (error) {
          if (await this.exists(rollbackRoot)) await fs.rename(rollbackRoot, this.options.profileRoot)
          throw error
        }
        await fs.rm(rollbackRoot, { recursive: true, force: true })
      }
      await this.writeMarker({ profileId: this.options.profileId, state: 'completed' })
      return result
    } catch (error) {
      await fs.rm(stagingRoot, { recursive: true, force: true }).catch(() => {})
      if ((await this.exists(rollbackRoot)) && !(await this.exists(this.options.profileRoot))) {
        await fs.rename(rollbackRoot, this.options.profileRoot).catch(() => {})
      }
      await this.writeMarker({
        profileId: this.options.profileId,
        state: 'failed',
        lastError: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  async cleanup(): Promise<void> {
    await fs.rm(this.options.legacyRoot, { recursive: true, force: true })
    if (this.options.legacyClaudeRoot) {
      await fs.rm(this.options.legacyClaudeRoot, { recursive: true, force: true })
    }
  }

  private async fingerprint(root: string): Promise<{ fileCount: number }> {
    const result = { fileCount: 0 }
    const visit = async (target: string): Promise<void> => {
      const stat = await fs.stat(target)
      if (stat.isFile()) {
        result.fileCount += 1
        return
      }
      for (const entry of await fs.readdir(target)) await visit(path.join(target, entry))
    }
    await visit(root)
    return result
  }

  private async verifyRecovered(source: string, destination: string): Promise<void> {
    let stat
    try {
      stat = await fs.stat(source)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    if (stat.isFile()) {
      let destinationStat
      try {
        destinationStat = await fs.stat(destination)
      } catch {
        throw new Error(`Legacy recovery verification failed: ${source}`)
      }
      if (!destinationStat.isFile() || destinationStat.size !== stat.size) {
        throw new Error(`Legacy recovery verification failed: ${source}`)
      }
      return
    }
    for (const entry of await fs.readdir(source)) {
      await this.verifyRecovered(path.join(source, entry), path.join(destination, entry))
    }
  }

  private async readMarker(): Promise<RecoveryMarker | null> {
    try {
      return JSON.parse(await fs.readFile(this.markerPath, 'utf8')) as RecoveryMarker
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  private async writeMarker(marker: RecoveryMarker): Promise<void> {
    await fs.mkdir(path.dirname(this.markerPath), { recursive: true })
    const temporaryPath = `${this.markerPath}.${process.pid}.tmp`
    await fs.writeFile(temporaryPath, JSON.stringify(marker, null, 2), 'utf8')
    await fs.rename(temporaryPath, this.markerPath)
  }

  private async exists(target: string): Promise<boolean> {
    try {
      await fs.stat(target)
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
      throw error
    }
  }
}
