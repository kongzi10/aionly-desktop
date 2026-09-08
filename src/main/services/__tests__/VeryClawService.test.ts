import { describe, expect, it, vi } from 'vitest'

vi.unmock('node:os')
vi.unmock('node:fs/promises')
vi.unmock('node:child_process')

import { openVeryClaw } from '../VeryClawService'

function dependencies(platform = 'win32') {
  return {
    platform,
    run: vi.fn().mockResolvedValue(''),
    exists: vi.fn().mockResolvedValue(true),
    openPath: vi.fn().mockResolvedValue('')
  }
}

describe('openVeryClaw', () => {
  it.skipIf(process.platform !== 'win32')(
    'discovers an NSIS install with no InstallLocation using the actual PowerShell script',
    async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), 'veryclaw-lookup-'))
      try {
        const executable = path.join(directory, 'VeryClaw.exe')
        await writeFile(executable, '')
        const entry = Buffer.from(
          JSON.stringify({
            DisplayName: 'VeryClaw',
            UninstallString: `"${path.join(directory, 'Uninstall VeryClaw.exe')}" /currentuser`
          })
        ).toString('base64')
        const deps = dependencies()
        deps.run.mockImplementation(async (_file: string, args: string[]) => {
          const fixture = `$fixture = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${entry}')) | ConvertFrom-Json
function Get-ChildItem { [PSCustomObject]@{ PSPath = 'fixture' } }
function Get-ItemProperty { $fixture }
function Test-Path { param($LiteralPath, $PathType) if ($LiteralPath -like 'HK*') { return $true }; Microsoft.PowerShell.Management\\Test-Path -LiteralPath $LiteralPath -PathType Leaf }
`
          const { stdout } = await promisify(execFile)(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-Command', fixture + args[3]],
            { windowsHide: true, encoding: 'utf8' }
          )
          return stdout
        })
        expect(await openVeryClaw(deps)).toEqual({ status: 'opened' })
        expect(deps.openPath).toHaveBeenCalledWith(executable)
      } finally {
        if (path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep))
          await rm(directory, { recursive: true, force: true })
      }
    }
  )
  it('opens a custom Windows install location without shell interpolation', async () => {
    const deps = dependencies()
    deps.run.mockResolvedValue('D:\\My Apps\\VeryClaw\\VeryClaw.exe\r\n')
    expect(await openVeryClaw(deps)).toEqual({ status: 'opened' })
    expect(deps.openPath).toHaveBeenCalledWith('D:\\My Apps\\VeryClaw\\VeryClaw.exe')
  })

  it('reports an absent installation', async () => {
    const deps = dependencies()
    expect(await openVeryClaw(deps)).toEqual({ status: 'not-installed' })
    expect(deps.openPath).not.toHaveBeenCalled()
  })

  it('ignores stale install records', async () => {
    const deps = dependencies()
    deps.run.mockResolvedValue('D:\\Removed\\VeryClaw.exe')
    deps.exists.mockResolvedValue(false)
    expect(await openVeryClaw(deps)).toEqual({ status: 'not-installed' })
  })

  it('does not classify a launch failure as missing installation', async () => {
    const deps = dependencies()
    deps.run.mockResolvedValue('D:\\Apps\\VeryClaw.exe')
    deps.openPath.mockResolvedValue('Access denied')
    await expect(openVeryClaw(deps)).rejects.toThrow('Access denied')
  })

  it('opens the macOS bundle resolved by Launch Services, including an already running app', async () => {
    const deps = dependencies('darwin')
    deps.run.mockResolvedValueOnce('/Users/me/Applications/VeryClaw.app/\n').mockResolvedValueOnce('')
    expect(await openVeryClaw(deps)).toEqual({ status: 'opened' })
    expect(deps.run).toHaveBeenLastCalledWith('/usr/bin/open', ['/Users/me/Applications/VeryClaw.app/'])
  })

  it('distinguishes macOS detection errors from absence', async () => {
    const deps = dependencies('darwin')
    deps.run.mockRejectedValue(new Error('Timed out'))
    await expect(openVeryClaw(deps)).rejects.toThrow('Timed out')
  })

  it('reports an absent macOS bundle without opening anything', async () => {
    const deps = dependencies('darwin')
    expect(await openVeryClaw(deps)).toEqual({ status: 'not-installed' })
    expect(deps.run).toHaveBeenCalledOnce()
  })

  it('does not cache absence after a user installs the app', async () => {
    const deps = dependencies()
    expect(await openVeryClaw(deps)).toEqual({ status: 'not-installed' })
    deps.run.mockResolvedValue('D:\\Apps\\VeryClaw.exe')
    expect(await openVeryClaw(deps)).toEqual({ status: 'opened' })
  })

  it('returns unsupported on other systems', async () => {
    expect(await openVeryClaw(dependencies('linux'))).toEqual({ status: 'unsupported' })
  })
})
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
