import { loggerService } from '@logger'
import type { FileMetadata, Provider } from '@renderer/types'
import type { TFunction } from 'i18next'
import { isEmpty } from 'lodash'

const logger = loggerService.withContext('paintings-utils')

export function checkProviderEnabled(provider: Provider, t: TFunction): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (provider.enabled && !isEmpty(provider.apiKey)) {
      resolve(true)
      return
    }

    window.modal.warning({
      content: provider.apiKey ? t('error.no_api_key') : t('error.provider_disabled'),
      centered: true,
      closable: true,
      okText: t('common.go_to_settings'),
      onOk: () => {
        window.navigate?.(`/settings/provider?id=${provider.id}`)
        reject('Provider disabled')
      },
      onCancel: () => reject('Provider disabled')
    })
  })
}

export function findPaintingByFiles<T extends { providerId?: string; files: ReadonlyArray<Pick<FileMetadata, 'id'>> }>(
  paintings: ReadonlyArray<T>,
  providerId: string,
  files: ReadonlyArray<Pick<FileMetadata, 'id'>>
): T | undefined {
  return paintings.find(
    (painting) =>
      painting.providerId === providerId &&
      painting.files.length === files.length &&
      painting.files.every((file, index) => file.id === files[index]?.id)
  )
}

/**
 * 将本地文件存储中的 FileMetadata 转换为 File 对象，供绘画编辑模式作为输入图片使用。
 * 转换失败时返回 null。
 */
export async function fileMetadataToFile(file: FileMetadata, index: number): Promise<File | null> {
  try {
    // NOTE: 用 name（始终是磁盘文件名）而非 id + ext — 部分保存路径（如 saveBase64Image）
    // 的 ext 不带点，拼接会产生 `<uuid>png` 这样的坏路径（同 ApiService.collectImagesFromMessages）
    const ext = file.ext.startsWith('.') ? file.ext : `.${file.ext}`
    const { data, mime } = await window.api.file.binaryImage(file.name || file.id + ext)
    const fileName = file.name || `image_${index + 1}${ext}`

    return new File([data], fileName, {
      type: mime,
      lastModified: new Date(file.created_at).getTime()
    })
  } catch (error) {
    logger.error('Failed to convert FileMetadata to File:', error as Error)
    return null
  }
}
