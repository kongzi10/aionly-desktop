import { execFile } from 'node:child_process'
import { access } from 'node:fs/promises'
import { promisify } from 'node:util'

import type { VeryClawOpenResult } from '@shared/veryclaw'
import { shell } from 'electron'

const execFileAsync = promisify(execFile)

// Query both user and machine scopes, including 32-bit installer records.
// The script is fixed; no renderer input is interpolated into commands.
const WINDOWS_LOOKUP = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$roots = @('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall', 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall', 'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall', 'HKCU:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall')
foreach ($root in $roots) {
  if (Test-Path -LiteralPath $root) {
    foreach ($key in Get-ChildItem -LiteralPath $root) {
      $entry = Get-ItemProperty -LiteralPath $key.PSPath
      if ($entry.DisplayName -eq 'VeryClaw') {
        $directories = @()
        if ($entry.InstallLocation) { $directories += $entry.InstallLocation }
        # NSIS may omit InstallLocation. Only extract the uninstaller path; never execute its command.
        if ($entry.UninstallString -match '^"([^"\\r\\n]+\\.exe)"(?:\\s|$)') {
          $directories += Split-Path -LiteralPath $Matches[1]
        }
        foreach ($directory in $directories) {
          $candidate = Join-Path $directory 'VeryClaw.exe'
          if (Test-Path -LiteralPath $candidate -PathType Leaf) { [Console]::WriteLine($candidate); exit 0 }
        }
      }
    }
  }
}
`

// Launch Services finds registered bundles outside /Applications too.
// Only the specific application-not-found code is treated as absence.
const MAC_LOOKUP = `try
  return POSIX path of (path to application id "app.veryclaw.desktop")
on error messageText number errorNumber
  if errorNumber is -10814 then return ""
  error messageText number errorNumber
end try`

interface Dependencies {
  platform: string
  run: (file: string, args: string[]) => Promise<string>
  exists: (path: string) => Promise<boolean>
  openPath: (path: string) => Promise<string>
}

const dependencies: Dependencies = {
  platform: process.platform,
  async run(file, args) {
    const { stdout } = await execFileAsync(file, args, { windowsHide: true, timeout: 15000, encoding: 'utf8' })
    return stdout
  },
  async exists(path) {
    try {
      await access(path)
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
      throw error
    }
  },
  openPath: (path) => shell.openPath(path)
}

export async function openVeryClaw(deps: Dependencies = dependencies): Promise<VeryClawOpenResult> {
  if (deps.platform !== 'win32' && deps.platform !== 'darwin') return { status: 'unsupported' }
  const path = (
    deps.platform === 'win32'
      ? await deps.run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_LOOKUP])
      : await deps.run('/usr/bin/osascript', ['-e', MAC_LOOKUP])
  ).trim()
  if (!path || !(await deps.exists(path))) return { status: 'not-installed' }

  if (deps.platform === 'darwin') {
    await deps.run('/usr/bin/open', [path])
  } else {
    const error = await deps.openPath(path)
    if (error) throw new Error(error)
  }
  return { status: 'opened' }
}
