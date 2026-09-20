import { describe, expect, it, vi } from 'vitest'

import {
  closeProfileRendererWindows,
  createProfileScopedServiceResolver,
  createProfileSwitchResponse,
  isTrustedProfileIpcSender,
  runWithProfileRuntimeStopped
} from '../ProfileIpcService'

describe('createProfileSwitchResponse', () => {
  it('reuses a profile-scoped service and replaces it after the active profile changes', () => {
    const factory = vi.fn((profile: { id: string }) => ({ profileId: profile.id }))
    const resolve = createProfileScopedServiceResolver(factory)

    expect(resolve({ id: 'a' })).toBe(resolve({ id: 'a' }))
    expect(resolve({ id: 'b' })).toEqual({ profileId: 'b' })
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('returns renderer switch state without a reload instruction', () => {
    expect(createProfileSwitchResponse('9a4da247945bd930a8911fd0b1526ad0')).toEqual({
      profileId: '9a4da247945bd930a8911fd0b1526ad0'
    })
    expect(createProfileSwitchResponse(null)).toEqual({ profileId: null })
  })

  it('accepts only the application renderer as a profile lifecycle caller', () => {
    expect(isTrustedProfileIpcSender('file:///app/out/renderer/index.html', 'window', 7, 7)).toBe(true)
    expect(isTrustedProfileIpcSender('http://localhost:5173/', 'window', 7, 7)).toBe(true)
    expect(isTrustedProfileIpcSender('http://localhost:7023/', 'webview', 8, 7)).toBe(false)
    expect(isTrustedProfileIpcSender('http://localhost:7023/', 'window', 8, 7)).toBe(false)
    expect(isTrustedProfileIpcSender('https://example.com/', 'window', 7, 7)).toBe(false)
    expect(isTrustedProfileIpcSender('', 'window', 7, 7)).toBe(false)
  })

  it('accepts a recreated main window and rejects the destroyed window id', () => {
    const recreatedMainWebContentsId = 12

    expect(
      isTrustedProfileIpcSender('file:///app/out/renderer/index.html', 'window', 12, recreatedMainWebContentsId)
    ).toBe(true)
    expect(
      isTrustedProfileIpcSender('file:///app/out/renderer/index.html', 'window', 7, recreatedMainWebContentsId)
    ).toBe(false)
  })

  it('destroys every profile renderer window except the window performing the switch', () => {
    const createWindow = (id: number) => ({
      webContents: { id },
      isDestroyed: () => false,
      destroy: vi.fn()
    })
    const mainWindow = createWindow(1)
    const miniWindow = createWindow(2)
    const selectionWindow = createWindow(3)

    closeProfileRendererWindows([mainWindow, miniWindow, selectionWindow] as never, 1)

    expect(mainWindow.destroy).not.toHaveBeenCalled()
    expect(miniWindow.destroy).toHaveBeenCalledOnce()
    expect(selectionWindow.destroy).toHaveBeenCalledOnce()
  })

  it('stops profile services while replacing native profile data', async () => {
    const calls: string[] = []
    const runtime = {
      isActive: () => true,
      stop: async () => {
        calls.push('stop')
      },
      start: async () => {
        calls.push('start')
      }
    }

    await runWithProfileRuntimeStopped(runtime, async () => {
      calls.push('recover')
    })

    expect(calls).toEqual(['stop', 'recover', 'start'])
  })
})
