import type { FileMetadata } from '@renderer/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fileMetadataToFile, findPaintingByFiles } from '../index'

describe('findPaintingByFiles', () => {
  const createPainting = (id: string, providerId: string, fileIds: string[]) => ({
    id,
    providerId,
    files: fileIds.map((fileId) => ({ id: fileId }))
  })

  it('returns a painting with the same provider and file order', () => {
    const paintings = [
      createPainting('1', 'provider-a', ['file-1', 'file-2']),
      createPainting('2', 'provider-a', ['file-3'])
    ]

    expect(findPaintingByFiles(paintings, 'provider-a', [{ id: 'file-1' }, { id: 'file-2' }])).toMatchObject({
      id: '1'
    })
  })

  it('ignores paintings from other providers or different file sequences', () => {
    const paintings = [
      createPainting('1', 'provider-b', ['file-1', 'file-2']),
      createPainting('2', 'provider-a', ['file-2', 'file-1'])
    ]

    expect(findPaintingByFiles(paintings, 'provider-a', [{ id: 'file-1' }, { id: 'file-2' }])).toBeUndefined()
  })
})

describe('fileMetadataToFile', () => {
  const binaryImageMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(window as any).api = { file: { binaryImage: binaryImageMock } }
  })

  const createFileMetadata = (overrides: Partial<FileMetadata> = {}): FileMetadata => ({
    id: 'file-1',
    name: 'image.png',
    origin_name: 'image.png',
    path: '',
    size: 4,
    ext: '.png',
    type: 'image' as FileMetadata['type'],
    created_at: '2026-01-01T00:00:00.000Z',
    count: 1,
    ...overrides
  })

  it('reads the stored image by name, the on-disk filename', async () => {
    binaryImageMock.mockResolvedValue({ data: new Uint8Array([1, 2, 3, 4]), mime: 'image/png' })

    const file = await fileMetadataToFile(createFileMetadata(), 0)

    expect(binaryImageMock).toHaveBeenCalledWith('image.png')
    expect(file).toBeInstanceOf(File)
    expect(file!.name).toBe('image.png')
    expect(file!.type).toBe('image/png')
    expect(file!.size).toBe(4)
    expect(file!.lastModified).toBe(new Date('2026-01-01T00:00:00.000Z').getTime())
  })

  it('falls back to id + ext when the metadata has no name', async () => {
    binaryImageMock.mockResolvedValue({ data: new Uint8Array([1]), mime: 'image/jpeg' })

    const file = await fileMetadataToFile(createFileMetadata({ name: '', ext: '.jpg' }), 2)

    expect(binaryImageMock).toHaveBeenCalledWith('file-1.jpg')
    expect(file!.name).toBe('image_3.jpg')
  })

  it('normalizes an ext missing the leading dot in the fallback', async () => {
    binaryImageMock.mockResolvedValue({ data: new Uint8Array([1]), mime: 'image/png' })

    await fileMetadataToFile(createFileMetadata({ name: '', ext: 'png' }), 0)

    expect(binaryImageMock).toHaveBeenCalledWith('file-1.png')
  })

  it('returns null when reading the stored image fails', async () => {
    binaryImageMock.mockRejectedValue(new Error('not found'))

    const file = await fileMetadataToFile(createFileMetadata(), 0)

    expect(file).toBeNull()
  })
})
