import type { VeryClawDownloadResult } from '@shared/veryclaw'
import { app, net, shell } from 'electron'

const DOWNLOAD_ORIGIN = 'https://yixiao.aionly.com'

interface Dependencies {
  platform: string
  arch: string
  translated: boolean
  fetch: (url: string, init: RequestInit) => Promise<Response>
  openExternal: (url: string) => Promise<void>
}

export async function downloadVeryClaw(
  deps: Dependencies = {
    platform: process.platform,
    arch: process.arch,
    translated: app.runningUnderARM64Translation,
    fetch: (url, init) => net.fetch(url, init),
    openExternal: (url) => shell.openExternal(url)
  }
): Promise<VeryClawDownloadResult> {
  const platform = deps.platform === 'win32' ? 'windows' : deps.platform === 'darwin' ? 'macos' : undefined
  const arch = deps.translated ? 'arm64' : deps.arch
  if (!platform || (arch !== 'x64' && arch !== 'arm64')) return { status: 'unsupported' }

  const endpoint = new URL('/downloads/veryclaw/latest', DOWNLOAD_ORIGIN)
  endpoint.search = new URLSearchParams({
    platform,
    arch,
    channel: 'latest',
    package_type: platform === 'windows' ? 'exe' : 'dmg'
  }).toString()
  const response = await deps.fetch(endpoint.href, { signal: AbortSignal.timeout(15000), cache: 'no-store' })
  if (!response.ok) throw new Error(`VeryClaw release lookup failed (${response.status})`)
  const payload = await response.json()
  if (payload?.code !== 200 || typeof payload.data?.has_update !== 'boolean')
    throw new Error('Invalid VeryClaw release response')
  if (!payload.data.has_update) return { status: 'unavailable' }

  const release = payload.data
  if (
    release.platform !== platform ||
    release.arch !== arch ||
    release.package_type !== (platform === 'windows' ? 'exe' : 'dmg')
  ) {
    throw new Error('VeryClaw release does not match this system')
  }
  const url = new URL(release.download_url)
  if (
    url.origin !== DOWNLOAD_ORIGIN ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/downloads\/veryclaw\/releases\/[a-zA-Z0-9-]+\/download$/.test(url.pathname)
  ) {
    throw new Error('Unexpected VeryClaw download URL')
  }
  await deps.openExternal(url.href)
  return { status: 'started' }
}
