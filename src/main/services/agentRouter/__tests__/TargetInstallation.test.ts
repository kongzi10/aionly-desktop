import type * as FileSystem from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { detectTargetInstallation } from '../TargetInstallation'

const mocks = vi.hoisted(() => ({
  mac: false,
  find: vi.fn(),
  execute: vi.fn(),
  access: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn()
}))

vi.mock('@main/constant', () => ({
  get isMac() {
    return mocks.mac
  },
  isWin: false
}))
vi.mock('@main/utils/process', () => ({ findExecutableInEnv: mocks.find, executeCommand: mocks.execute }))
vi.mock('node:fs/promises', () => ({ access: mocks.access, readdir: mocks.readdir, stat: mocks.stat }))
vi.mock('node:fs', async () => ({ constants: (await vi.importActual<typeof FileSystem>('node:fs')).constants }))

describe('profile target installation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.mac = false
    mocks.find.mockResolvedValue(null)
    mocks.access.mockRejectedValue(new Error('not found'))
    mocks.readdir.mockResolvedValue([])
    mocks.stat.mockResolvedValue({ isFile: () => true })
    mocks.execute.mockRejectedValue(new Error('not found'))
  })

  it.each([
    ['codex', 'codex-cli 0.162.1'],
    ['claude-code', '2.1.50 (Claude Code)']
  ] as const)('recognizes a working %s CLI without a config', async (target, version) => {
    mocks.find.mockResolvedValue('/tools/agent')
    mocks.execute.mockResolvedValue(version)
    expect(await detectTargetInstallation(target)).toBe(true)
    expect(mocks.find).toHaveBeenCalledWith(target === 'codex' ? 'codex' : 'claude')
    expect(mocks.execute).toHaveBeenCalledWith('/tools/agent', ['--version'], { capture: true, timeout: 5000 })
  })

  it('does not treat configuration directories as installation evidence', async () => {
    expect(await detectTargetInstallation('codex')).toBe(false)
    expect(await detectTargetInstallation('claude-code')).toBe(false)
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it('checks the official local bin location when it is absent from PATH', async () => {
    mocks.access.mockResolvedValue(undefined)
    mocks.execute.mockResolvedValue('2.1.50 (Claude Code)')
    expect(await detectTargetInstallation('claude-code')).toBe(true)
    expect(mocks.execute).toHaveBeenCalledWith(
      join(homedir(), '.local', 'bin', 'claude'),
      ['--version'],
      expect.anything()
    )
  })

  it.each(['unrelated-tool 1.2.3', ''])('rejects an unrelated version output %j', async (output) => {
    mocks.find.mockResolvedValue('/tools/agent')
    mocks.execute.mockResolvedValue(output)
    expect(await detectTargetInstallation('codex')).toBe(false)
    expect(await detectTargetInstallation('claude-code')).toBe(false)
  })

  it('rejects a CLI that times out or exits unsuccessfully', async () => {
    mocks.find.mockResolvedValue('/tools/agent')
    mocks.execute.mockRejectedValue(new Error('Command timed out'))
    expect(await detectTargetInstallation('claude-code')).toBe(false)
  })

  it('recognizes a Codex macOS bundle found through Spotlight', async () => {
    mocks.mac = true
    mocks.execute.mockImplementation(async (command: string, args: string[]) => {
      if (command === '/usr/bin/mdfind') return '/custom/Codex.app\n'
      if (command === '/usr/bin/plutil' && args.at(-1) === '/custom/Codex.app/Contents/Info.plist')
        return 'com.openai.codex'
      throw new Error('not found')
    })
    expect(await detectTargetInstallation('codex')).toBe(true)
  })

  it('does not recognize a renamed unrelated application or a missing bundle', async () => {
    mocks.mac = true
    mocks.execute.mockImplementation(async (command: string) => {
      if (command === '/usr/bin/mdfind') return '/custom/Codex.app\n'
      return 'com.other.app'
    })
    expect(await detectTargetInstallation('codex')).toBe(false)
    mocks.execute.mockRejectedValue(new Error('bundle removed'))
    mocks.stat.mockRejectedValue(new Error('bundle removed'))
    expect(await detectTargetInstallation('codex')).toBe(false)
  })

  it('searches a nested Applications folder and reads the bundle ID with plutil', async () => {
    mocks.mac = true
    mocks.readdir.mockImplementation(async (directory: string) =>
      directory === '/Applications' ? [{ name: 'AI', isDirectory: () => true }] : []
    )
    mocks.execute.mockImplementation(async (command: string, args: string[]) => {
      if (command === '/usr/bin/plutil' && args.at(-1) === '/Applications/AI/Codex.app/Contents/Info.plist')
        return 'com.openai.codex'
      throw new Error('not found')
    })
    expect(await detectTargetInstallation('codex')).toBe(true)
  })
})
