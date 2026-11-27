import './assets/styles/index.css'
import './assets/styles/tailwind.css'
import '@ant-design/v5-patch-for-react-19'

import { loggerService } from '@logger'
import { createRoot } from 'react-dom/client'

import { getActiveProfileId } from './services/ProfileStorageService'

const logger = loggerService.withContext('RendererEntry')

/**
 * 启动路径的一次性旧数据迁移（方案 A）：
 * 已有登录态直接启动时不会走 applyProfileSwitch，需在 store 创建（App 动态 import）
 * 之前把旧版本固定命名空间的数据迁入当前 profile，rehydrate 首帧即可读到历史会话。
 * 失败不阻断启动；数据仍保留在旧命名空间，下次启动重试或走设置里的"数据恢复"。
 */
async function migrateLegacyProfileDataOnStartup(): Promise<void> {
  const profileId = getActiveProfileId()
  if (!profileId) return
  try {
    const { autoMigrateLegacyProfileData } = await import('./services/ProfileDataMigrationService')
    const result = await autoMigrateLegacyProfileData(profileId)
    if (result !== 'none' && result !== 'disabled') {
      logger.info('Legacy data auto migration finished on startup', { profileId, result })
    }
  } catch (error) {
    logger.error('Legacy data auto migration failed on startup', error as Error)
  }
}

async function bootstrapRenderer(): Promise<void> {
  const rootElement = document.getElementById('root')
  if (!rootElement) throw new Error('Renderer root element was not found')

  try {
    await migrateLegacyProfileDataOnStartup()
    const { default: App } = await import('./App')
    createRoot(rootElement).render(<App />)
  } catch (error) {
    logger.error('Failed to start renderer', error as Error)
    const message = document.createElement('p')
    message.textContent = '应用启动失败，请重试。 / The application failed to start.'
    const retryButton = document.createElement('button')
    retryButton.type = 'button'
    retryButton.textContent = '重试 / Retry'
    retryButton.addEventListener('click', () => window.location.reload())
    rootElement.replaceChildren(message, retryButton)
  }
}

void bootstrapRenderer()
