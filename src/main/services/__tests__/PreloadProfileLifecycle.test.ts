import { describe, expect, it, vi } from 'vitest'

import { createProfileRendererReadyNotifier } from '../../../preload/profileLifecycle'

describe('createProfileRendererReadyNotifier', () => {
  it('does not send renderer-ready IPC from auxiliary renderers', async () => {
    const invoke = vi.fn()
    const notifyRendererReady = createProfileRendererReadyNotifier(false, invoke)

    await expect(notifyRendererReady()).resolves.toEqual({ started: false })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('sends renderer-ready IPC from the application renderer', async () => {
    const invoke = vi.fn().mockResolvedValue({ started: true })
    const notifyRendererReady = createProfileRendererReadyNotifier(true, invoke)

    await expect(notifyRendererReady()).resolves.toEqual({ started: true })
    expect(invoke).toHaveBeenCalledOnce()
  })
})
