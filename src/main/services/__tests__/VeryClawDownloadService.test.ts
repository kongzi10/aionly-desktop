import { describe, expect, it, vi } from 'vitest'

import { downloadVeryClaw } from '../VeryClawDownloadService'

function dependencies(platform = 'win32', arch = 'x64', translated = false) {
  const serverPlatform = platform === 'darwin' ? 'macos' : 'windows'
  const serverArch = translated ? 'arm64' : arch
  return {
    platform,
    arch,
    translated,
    fetch: vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          data: {
            has_update: true,
            platform: serverPlatform,
            arch: serverArch,
            package_type: platform === 'darwin' ? 'dmg' : 'exe',
            download_url: 'https://yixiao.aionly.com/downloads/veryclaw/releases/release-id/download'
          }
        })
      )
    ),
    openExternal: vi.fn().mockResolvedValue(undefined)
  }
}

describe('VeryClaw downloads', () => {
  it.each([
    ['win32', 'x64', 'windows'],
    ['win32', 'arm64', 'windows'],
    ['darwin', 'x64', 'macos'],
    ['darwin', 'arm64', 'macos']
  ])('selects %s %s', async (platform, arch, expected) => {
    const deps = dependencies(platform, arch)
    expect(await downloadVeryClaw(deps)).toEqual({ status: 'started' })
    const url = new URL(deps.fetch.mock.calls[0][0])
    expect(url.searchParams.get('platform')).toBe(expected)
    expect(url.searchParams.get('arch')).toBe(arch)
    expect(deps.openExternal).toHaveBeenCalledWith(
      'https://yixiao.aionly.com/downloads/veryclaw/releases/release-id/download'
    )
  })

  it('selects native ARM64 while running an Intel app under translation', async () => {
    const deps = dependencies('darwin', 'x64', true)
    await downloadVeryClaw(deps)
    expect(new URL(deps.fetch.mock.calls[0][0]).searchParams.get('arch')).toBe('arm64')
  })

  it('reports unpublished packages instead of downloading another architecture', async () => {
    const deps = dependencies('win32', 'arm64')
    deps.fetch.mockResolvedValue(new Response(JSON.stringify({ code: 200, data: { has_update: false } })))
    expect(await downloadVeryClaw(deps)).toEqual({ status: 'unavailable' })
    expect(deps.openExternal).not.toHaveBeenCalled()
  })

  it('reports unsupported platforms without querying', async () => {
    const deps = dependencies('linux')
    expect(await downloadVeryClaw(deps)).toEqual({ status: 'unsupported' })
    expect(deps.fetch).not.toHaveBeenCalled()
  })

  it.each(['https://evil.example/installer.exe', 'file:///installer.exe'])(
    'rejects unexpected URLs: %s',
    async (download_url) => {
      const deps = dependencies()
      deps.fetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 200,
            data: { has_update: true, platform: 'windows', arch: 'x64', package_type: 'exe', download_url }
          })
        )
      )
      await expect(downloadVeryClaw(deps)).rejects.toThrow()
      expect(deps.openExternal).not.toHaveBeenCalled()
    }
  )

  it('rejects failed HTTP requests', async () => {
    const deps = dependencies()
    deps.fetch.mockResolvedValue(new Response('', { status: 503 }))
    await expect(downloadVeryClaw(deps)).rejects.toThrow()
    expect(deps.openExternal).not.toHaveBeenCalled()
  })
})
