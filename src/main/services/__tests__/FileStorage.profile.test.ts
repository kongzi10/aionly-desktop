import { getFilesDir } from '@main/utils/file'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ filesDir: 'C:/profiles/account-a/Files' }))

vi.mock('@main/utils/file', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getFilesDir: vi.fn(() => mocks.filesDir)
  }
})

import * as fs from 'fs'

import { fileStorage } from '../FileStorage'

describe('FileStorage profile directory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.filesDir = 'C:/profiles/account-a/Files'
  })

  it('saves into the active profile directory after the account changes', async () => {
    expect(vi.mocked(getFilesDir)()).toBe('C:/profiles/account-a/Files')
    mocks.filesDir = 'C:/profiles/account-b/Files'

    await fileStorage.saveBase64Image({} as Electron.IpcMainInvokeEvent, Buffer.from('image').toString('base64'))

    const savedPath = vi.mocked(fs.promises.writeFile).mock.calls[0]?.[0]
    expect(String(savedPath)).toMatch(/^C:\/profiles\/account-b\/Files\//)
  })
})
