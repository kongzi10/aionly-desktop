import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { ProfileConfigPaths } from '../ProfileConfigPaths'

const mocks = vi.hoisted(() => ({ get: vi.fn(), refresh: vi.fn() }))
vi.mock('@main/utils/shell-env', () => ({ default: mocks.get, refreshShellEnv: mocks.refresh }))

describe('profile configuration paths', () => {
  it('does not fetch a login shell until a router handler needs paths', async () => {
    mocks.get.mockReset().mockResolvedValue({ CODEX_HOME: '/shell/codex', CLAUDE_CONFIG_DIR: '/shell/claude' })
    const paths = new ProfileConfigPaths()
    expect(mocks.get).not.toHaveBeenCalled()
    await Promise.all([paths.resolve(), paths.resolve()])
    expect(mocks.get).toHaveBeenCalledTimes(1)
    expect(paths.codex).toBe(join('/shell/codex', 'config.toml'))
    expect(paths.codexAuth).toBe(join('/shell/codex', 'auth.json'))
    expect(paths.claudeCode).toBe(join('/shell/claude', 'settings.json'))
  })

  it('refreshes shell defaults without replacing manually selected files', async () => {
    mocks.get.mockReset().mockResolvedValue({ CODEX_HOME: '/old/codex', CLAUDE_CONFIG_DIR: '/old/claude' })
    mocks.refresh.mockReset().mockResolvedValue({ CODEX_HOME: '/new/codex', CLAUDE_CONFIG_DIR: '/new/claude' })
    const paths = new ProfileConfigPaths()
    await paths.resolve()
    paths.select('codex', '/selected/config.toml')
    await paths.resolve(true)
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    expect(paths.codex).toBe('/selected/config.toml')
    expect(paths.codexAuth).toBe(join('/selected', 'auth.json'))
    expect(paths.claudeCode).toBe(join('/new/claude', 'settings.json'))
    paths.select('claude-code', '/selected/settings.json')
    await paths.resolve(true)
    expect(paths.claudeCode).toBe('/selected/settings.json')
  })
})
