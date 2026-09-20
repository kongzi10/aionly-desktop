import './assets/styles/index.css'
import './assets/styles/tailwind.css'
import '@ant-design/v5-patch-for-react-19'

import { loggerService } from '@logger'
import { createRoot } from 'react-dom/client'

const logger = loggerService.withContext('RendererEntry')

async function bootstrapRenderer(): Promise<void> {
  const rootElement = document.getElementById('root')
  if (!rootElement) throw new Error('Renderer root element was not found')

  try {
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
