import type { FSWatcher } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

import { ConfigFileWatcher } from '../ConfigFileWatcher'

describe('ConfigFileWatcher', () => {
  it('notifies when the configured file changes and ignores sibling files', async () => {
    const changed = vi.fn()
    let listener: ((eventType: string, fileName: string | Buffer | null) => void) | undefined
    const fsWatcher = { close: vi.fn(), once: vi.fn() } as unknown as FSWatcher
    const createWatcher = vi.fn((_, nextListener) => {
      listener = nextListener
      return fsWatcher
    })
    const watcher = new ConfigFileWatcher(changed, 10, createWatcher)
    expect(watcher.watch('C:/Users/test/.workbuddy/models.json')).toBe(true)

    listener?.('change', 'other.json')
    await new Promise((resolve) => setTimeout(resolve, 40))
    expect(changed).not.toHaveBeenCalled()

    listener?.('rename', 'models.json')
    await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
    watcher.close()
    expect(fsWatcher.close).toHaveBeenCalled()
  })
})
