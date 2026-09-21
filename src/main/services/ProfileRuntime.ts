interface ProfileRuntimeOperations {
  start(): Promise<void>
  stop(): Promise<void>
}

export interface ProfileServiceOperations {
  bootstrapAgents(): Promise<void>
  startApiServer(): Promise<void>
  restoreSchedulers(): Promise<void>
  startChannels(): Promise<void>
  stopSchedulers(): void
  stopChannels(): Promise<void>
  stopApiServer(): Promise<void>
  cleanupMcp(): Promise<void>
  stopFileWatcher(): Promise<void>
  closeKnowledge(): Promise<void>
  closeMemory(): Promise<void>
  closeDatabase(): Promise<void>
}

type ProfileRuntimeState = 'inactive' | 'starting' | 'active' | 'stopping'

export class ProfileRuntime {
  private state: ProfileRuntimeState = 'inactive'
  private transition: Promise<void> | null = null

  constructor(private readonly operations: ProfileRuntimeOperations) {}

  isActive(): boolean {
    return this.state === 'active'
  }

  async start(): Promise<void> {
    if (this.state === 'active') return
    if (this.state === 'starting' && this.transition) return this.transition
    if (this.state !== 'inactive') throw new Error(`Cannot start profile runtime while ${this.state}`)

    this.state = 'starting'
    this.transition = (async () => {
      try {
        await this.operations.start()
        this.state = 'active'
      } catch (error) {
        try {
          await this.operations.stop()
        } catch {
          // Preserve the startup failure; cleanup failures are secondary.
        } finally {
          this.state = 'inactive'
        }
        throw error
      } finally {
        this.transition = null
      }
    })()
    return this.transition
  }

  async stop(): Promise<void> {
    if (this.state === 'inactive') return
    if (this.state === 'starting' && this.transition) {
      try {
        await this.transition
      } catch {
        return
      }
    }
    if (this.state === 'stopping' && this.transition) return this.transition
    if (this.state !== 'active') throw new Error(`Cannot stop profile runtime while ${this.state}`)

    this.state = 'stopping'
    this.transition = this.operations.stop().finally(() => {
      this.state = 'inactive'
      this.transition = null
    })
    return this.transition
  }
}

export function createProfileRuntime(operations: ProfileServiceOperations): ProfileRuntime {
  return new ProfileRuntime({
    start: async () => {
      await operations.bootstrapAgents()
      await operations.startApiServer()
      await operations.restoreSchedulers()
      await operations.startChannels()
    },
    stop: async () => {
      const cleanupOperations = [
        async () => operations.stopSchedulers(),
        () => operations.stopChannels(),
        () => operations.stopApiServer(),
        () => operations.cleanupMcp(),
        () => operations.stopFileWatcher(),
        () => operations.closeKnowledge(),
        () => operations.closeMemory(),
        () => operations.closeDatabase()
      ]
      let firstError: unknown
      for (const cleanup of cleanupOperations) {
        try {
          await cleanup()
        } catch (error) {
          firstError ??= error
        }
      }
      if (firstError) throw firstError
    }
  })
}
