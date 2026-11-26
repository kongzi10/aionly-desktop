import { constants } from 'node:fs'
import { access, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { isMac, isWin } from '@main/constant'
import { executeCommand, findExecutableInEnv } from '@main/utils/process'

type ProfileTargetId = 'codex' | 'claude-code'

const CODEX_BUNDLE_IDS = ['com.openai.codex', 'com.openai.codex.beta']

async function codexAppInstalled(): Promise<boolean> {
  const folders = ['/Applications', join(homedir(), 'Applications')]
  const nestedFolders = await Promise.all(
    folders.map(async (folder) => {
      const entries = await readdir(folder, { withFileTypes: true }).catch(() => [])
      return entries
        .filter((entry) => entry.isDirectory() && !entry.name.endsWith('.app') && !entry.name.startsWith('.'))
        .map((entry) => join(folder, entry.name))
    })
  )
  const candidates = [...folders, ...nestedFolders.flat()].flatMap((folder) =>
    ['Codex.app', 'ChatGPT.app'].map((name) => join(folder, name))
  )
  const spotlight = await executeCommand(
    '/usr/bin/mdfind',
    [CODEX_BUNDLE_IDS.map((id) => `kMDItemCFBundleIdentifier == '${id}'`).join(' || ')],
    { capture: true, timeout: 5000 }
  ).catch(() => '')
  candidates.push(
    ...spotlight
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.endsWith('.app'))
  )

  for (const bundle of new Set(candidates)) {
    const plist = join(bundle, 'Contents', 'Info.plist')
    if (
      !(await stat(plist)
        .then((details) => details.isFile())
        .catch(() => false))
    )
      continue
    // plutil also reads binary plists; the filename alone is not installation evidence.
    const id = await executeCommand('/usr/bin/plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', plist], {
      capture: true,
      timeout: 5000
    }).catch(() => '')
    if (CODEX_BUNDLE_IDS.includes(id.trim())) return true
  }
  return false
}

export async function detectTargetInstallation(targetId: ProfileTargetId): Promise<boolean> {
  const command = targetId === 'codex' ? 'codex' : 'claude'
  let executable = await findExecutableInEnv(command)
  if (!executable) {
    const localBin = join(homedir(), '.local', 'bin', command + (isWin ? '.exe' : ''))
    if (
      await access(localBin, constants.X_OK)
        .then(() => true)
        .catch(() => false)
    )
      executable = localBin
  }
  if (executable) {
    const version = await executeCommand(executable, ['--version'], { capture: true, timeout: 5000 }).catch(() => '')
    const expected =
      targetId === 'codex' ? /^codex-cli\s+\d+\.\d+\.\d+\b/m : /^\d+\.\d+\.\d+(?:[-+][^\s]+)?\s+\(Claude Code\)/m
    if (expected.test(version.trim())) return true
  }
  return targetId === 'codex' && isMac ? codexAppInstalled() : false
}
