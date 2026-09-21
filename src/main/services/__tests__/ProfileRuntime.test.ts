import { describe, expect, it, vi } from 'vitest'

import { createProfileRuntime, ProfileRuntime } from '../ProfileRuntime'

describe('ProfileRuntime', () => {
  it('rolls back a failed start and remains reusable', async () => {
    const stop = vi.fn(async () => undefined)
    const start = vi.fn().mockRejectedValueOnce(new Error('start failed')).mockResolvedValueOnce(undefined)
    const runtime = new ProfileRuntime({ start, stop })

    await expect(runtime.start()).rejects.toThrow('start failed')
    expect(stop).toHaveBeenCalledOnce()

    await runtime.start()
    expect(runtime.isActive()).toBe(true)
  })

  it('stops an active runtime only once', async () => {
    const stop = vi.fn(async () => undefined)
    const runtime = new ProfileRuntime({ start: async () => undefined, stop })

    await runtime.start()
    await runtime.stop()
    await runtime.stop()

    expect(stop).toHaveBeenCalledOnce()
    expect(runtime.isActive()).toBe(false)
  })

  it('shares concurrent start calls during renderer startup', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => (release = resolve))
    const start = vi.fn(() => pending)
    const runtime = new ProfileRuntime({ start, stop: async () => undefined })

    const first = runtime.start()
    const second = runtime.start()
    release()

    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined])
    expect(start).toHaveBeenCalledOnce()
  })

  it('cleans up MCP clients when stopping profile services', async () => {
    const cleanupMcp = vi.fn(async () => undefined)
    const stopFileWatcher = vi.fn(async () => undefined)
    const runtime = createProfileRuntime({
      bootstrapAgents: async () => undefined,
      startApiServer: async () => undefined,
      restoreSchedulers: async () => undefined,
      startChannels: async () => undefined,
      stopSchedulers: () => undefined,
      stopChannels: async () => undefined,
      stopApiServer: async () => undefined,
      closeKnowledge: async () => undefined,
      closeMemory: async () => undefined,
      closeDatabase: async () => undefined,
      cleanupMcp,
      stopFileWatcher
    })

    await runtime.start()
    await runtime.stop()

    expect(cleanupMcp).toHaveBeenCalledOnce()
    expect(stopFileWatcher).toHaveBeenCalledOnce()
  })

  it('continues stopping remaining services after one cleanup fails', async () => {
    const calls: string[] = []
    const runtime = createProfileRuntime({
      bootstrapAgents: async () => undefined,
      startApiServer: async () => undefined,
      restoreSchedulers: async () => undefined,
      startChannels: async () => undefined,
      stopSchedulers: () => calls.push('schedulers'),
      stopChannels: async () => {
        calls.push('channels')
        throw new Error('channel cleanup failed')
      },
      stopApiServer: async () => {
        calls.push('api')
      },
      cleanupMcp: async () => {
        calls.push('mcp')
      },
      stopFileWatcher: async () => {
        calls.push('file-watcher')
      },
      closeKnowledge: async () => {
        calls.push('knowledge')
      },
      closeMemory: async () => {
        calls.push('memory')
      },
      closeDatabase: async () => {
        calls.push('database')
      }
    })

    await runtime.start()
    await expect(runtime.stop()).rejects.toThrow('channel cleanup failed')
    expect(calls).toEqual(['schedulers', 'channels', 'api', 'mcp', 'file-watcher', 'knowledge', 'memory', 'database'])
  })

  it('preserves the start error when rollback cleanup also fails', async () => {
    const runtime = new ProfileRuntime({
      start: async () => {
        throw new Error('start failed')
      },
      stop: async () => {
        throw new Error('rollback failed')
      }
    })

    await expect(runtime.start()).rejects.toThrow('start failed')
  })
})
