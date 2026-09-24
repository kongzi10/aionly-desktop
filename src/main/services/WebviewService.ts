import path from 'node:path'

import { loggerService } from '@logger'
import { t } from '@main/utils/locales'
import { USER_UI_HOST, WEB_UI_HOST } from '@shared/config/constant'
import { IpcChannel } from '@shared/IpcChannel'
import { app, dialog, session, shell, webContents } from 'electron'
import { promises as fs } from 'fs'

import { configManager } from './ConfigManager'
import { isSafeExternalUrl } from './security'
import { getProfilePartition } from './UserProfileService'

const logger = loggerService.withContext('WebviewService')
const initializedWebviewSessions = new WeakSet<Electron.Session>()
const observedPopupWebviews = new WeakSet<Electron.WebContents>()

// Hosts whose popups receive the same app-config (auth token) as the webview itself.
// Must stay in sync with the `allows` list in WebviewContainer.
const ALLOWED_WEBVIEW_HOSTS = [USER_UI_HOST, WEB_UI_HOST, 'http://localhost:7023']

function isAllowedWebviewHost(url: string): boolean {
  return ALLOWED_WEBVIEW_HOSTS.some((host) => url.startsWith(host))
}

function getWebviewPreloadPath(): string {
  // Mirrors the preload path resolution in WindowService.will-attach-webview
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'out', 'preload', 'index.js')
  }
  return path.join(__dirname, '../preload/index.js')
}

function describePaymentNavigation(url: string) {
  try {
    const parsed = new URL(url)
    return {
      origin: parsed.origin,
      route:
        parsed.hostname === 'maas.aiionly.com'
          ? parsed.pathname
              .split('/')
              .slice(0, 3)
              .map((segment) => (segment.length > 20 ? ':id' : segment))
              .join('/')
          : undefined
    }
  } catch {
    return { origin: 'invalid' }
  }
}

/**
 * init the useragent of the webview session
 * remove the AiOnly and Electron from the useragent
 */
export function initSessionUserAgent() {
  const wvSession = session.fromPartition(getProfilePartition('webview'))
  if (initializedWebviewSessions.has(wvSession)) return
  initializedWebviewSessions.add(wvSession)
  const originUA = wvSession.getUserAgent()
  const newUA = originUA.replace(/AiOnly\/\S+\s/, '').replace(/Electron\/\S+\s/, '')

  wvSession.setUserAgent(newUA)
  wvSession.webRequest.onBeforeSendHeaders((details, cb) => {
    const language = configManager.getLanguage()
    const headers = {
      ...details.requestHeaders,
      'User-Agent': details.url.includes('google.com') ? originUA : newUA,
      'Accept-Language': `${language}, en;q=0.9, *;q=0.5`
    }
    cb({ requestHeaders: headers })
  })
  wvSession.webRequest.onCompleted((details) => {
    if (details.statusCode !== 401 && details.statusCode !== 403) return
    const navigation = describePaymentNavigation(details.url)
    if (!navigation.origin.endsWith('.aiionly.com')) return
    logger.warn('Webview HTTP authorization failure', {
      statusCode: details.statusCode,
      resourceType: details.resourceType,
      ...navigation
    })
  })
}

/**
 * WebviewService handles the behavior of links opened from webview elements
 * It controls whether links should be opened within the application or in an external browser
 */
export function setOpenLinkExternal(webviewId: number, isExternal: boolean) {
  const webview = webContents.fromId(webviewId)
  if (!webview) return

  if (!observedPopupWebviews.has(webview)) {
    observedPopupWebviews.add(webview)
    webview.on('did-create-window', (window, details) => {
      logger.info('Webview popup created', {
        webviewId,
        popupId: window.webContents.id,
        sameSession: window.webContents.session === webview.session,
        ...describePaymentNavigation(details.url)
      })
      const popup = window.webContents
      // Popups that stay on the app's own host need the same auth context as the webview,
      // otherwise the token-less SPA boot in the shared partition logs the whole app out.
      // Ask the main renderer for the app-config and forward it once the popup is ready.
      popup.on('dom-ready', () => {
        const popupUrl = popup.getURL()
        if (!isAllowedWebviewHost(popupUrl)) return
        const host = webview.hostWebContents
        if (!host || host.isDestroyed()) return
        host.send(IpcChannel.Webview_PopupNeedsAppConfig, {
          webviewId,
          popupId: popup.id,
          url: popupUrl
        })
      })
      window.webContents.on('did-navigate', (_event, url, httpResponseCode) => {
        logger.info('Webview popup navigated', {
          popupId: window.webContents.id,
          httpResponseCode,
          ...describePaymentNavigation(url)
        })
      })
      window.webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
        if (isMainFrame)
          logger.info('Webview popup route changed', {
            popupId: window.webContents.id,
            ...describePaymentNavigation(url)
          })
      })
    })
    webview.on('did-navigate', (_event, url, httpResponseCode) => {
      logger.info('Webview navigated', { webviewId, httpResponseCode, ...describePaymentNavigation(url) })
    })
    webview.on('did-navigate-in-page', (_event, url, isMainFrame) => {
      if (isMainFrame) logger.info('Webview route changed', { webviewId, ...describePaymentNavigation(url) })
    })
  }

  webview.setWindowOpenHandler(({ url }) => {
    logger.info('Webview popup requested', { webviewId, isExternal, ...describePaymentNavigation(url) })
    if (isExternal) {
      if (isSafeExternalUrl(url)) {
        void shell.openExternal(url)
      } else {
        logger.warn(`Blocked shell.openExternal for untrusted URL scheme: ${url}`)
      }
      return { action: 'deny' }
    } else {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          webPreferences: {
            session: webview.session,
            preload: getWebviewPreloadPath(),
            additionalArguments: ['--aionly-payment-popup'],
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
          }
        }
      }
    }
  })
}

const attachKeyboardHandler = (contents: Electron.WebContents) => {
  if (contents.getType?.() !== 'webview') {
    return
  }

  const handleBeforeInput = (event: Electron.Event, input: Electron.Input) => {
    if (!input) {
      return
    }

    const key = input.key?.toLowerCase()
    if (!key) {
      return
    }

    // Helper to check if this is a shortcut we handle
    const isHandledShortcut = (k: string) => {
      const isFindShortcut = (input.control || input.meta) && k === 'f'
      const isPrintShortcut = (input.control || input.meta) && k === 'p'
      const isSaveShortcut = (input.control || input.meta) && k === 's'
      const isEscape = k === 'escape'
      const isEnter = k === 'enter'
      return isFindShortcut || isPrintShortcut || isSaveShortcut || isEscape || isEnter
    }

    if (!isHandledShortcut(key)) {
      return
    }

    const host = contents.hostWebContents
    if (!host || host.isDestroyed()) {
      return
    }

    const isFindShortcut = (input.control || input.meta) && key === 'f'
    const isPrintShortcut = (input.control || input.meta) && key === 'p'
    const isSaveShortcut = (input.control || input.meta) && key === 's'

    // Always prevent Cmd/Ctrl+F to override the guest page's native find dialog
    if (isFindShortcut) {
      event.preventDefault()
    }

    // Prevent default print/save dialogs and handle them with custom logic
    if (isPrintShortcut || isSaveShortcut) {
      event.preventDefault()
    }

    // Send the hotkey event to the renderer
    // The renderer will decide whether to preventDefault for Escape and Enter
    // based on whether the search bar is visible
    host.send(IpcChannel.Webview_SearchHotkey, {
      webviewId: contents.id,
      key,
      control: Boolean(input.control),
      meta: Boolean(input.meta),
      shift: Boolean(input.shift),
      alt: Boolean(input.alt)
    })
  }

  contents.on('before-input-event', handleBeforeInput)
  contents.once('destroyed', () => {
    contents.removeListener('before-input-event', handleBeforeInput)
  })
}

export function initWebviewHotkeys() {
  webContents.getAllWebContents().forEach((contents) => {
    if (contents.isDestroyed()) return
    attachKeyboardHandler(contents)
  })

  app.on('web-contents-created', (_, contents) => {
    attachKeyboardHandler(contents)
  })
}

/**
 * Print webview content to PDF
 * @param webviewId The webview webContents id
 * @returns Path to saved PDF file or null if user cancelled
 */
export async function printWebviewToPDF(webviewId: number): Promise<string | null> {
  const webview = webContents.fromId(webviewId)
  if (!webview) {
    throw new Error('Webview not found')
  }

  try {
    // Get the page title for default filename
    const pageTitle = await webview.executeJavaScript('document.title || "webpage"').catch(() => 'webpage')
    // Sanitize filename by removing invalid characters
    const sanitizedTitle = pageTitle.replace(/[<>:"/\\|?*]/g, '-').substring(0, 100)
    const defaultFilename = sanitizedTitle ? `${sanitizedTitle}.pdf` : `webpage-${Date.now()}.pdf`

    // Show save dialog
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: t('dialog.save_as_pdf'),
      defaultPath: defaultFilename,
      filters: [{ name: t('dialog.pdf_files'), extensions: ['pdf'] }]
    })

    if (canceled || !filePath) {
      return null
    }

    // Generate PDF with settings to capture full page
    const pdfData = await webview.printToPDF({
      margins: {
        marginType: 'default'
      },
      printBackground: true,
      landscape: false,
      pageSize: 'A4',
      preferCSSPageSize: true
    })

    // Save PDF to file
    await fs.writeFile(filePath, pdfData)

    return filePath
  } catch (error) {
    throw new Error(`Failed to print to PDF: ${(error as Error).message}`)
  }
}

/**
 * Save webview content as HTML
 * @param webviewId The webview webContents id
 * @returns Path to saved HTML file or null if user cancelled
 */
export async function saveWebviewAsHTML(webviewId: number): Promise<string | null> {
  const webview = webContents.fromId(webviewId)
  if (!webview) {
    throw new Error('Webview not found')
  }

  try {
    // Get the page title for default filename
    const pageTitle = await webview.executeJavaScript('document.title || "webpage"').catch(() => 'webpage')
    // Sanitize filename by removing invalid characters
    const sanitizedTitle = pageTitle.replace(/[<>:"/\\|?*]/g, '-').substring(0, 100)
    const defaultFilename = sanitizedTitle ? `${sanitizedTitle}.html` : `webpage-${Date.now()}.html`

    // Show save dialog
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: t('dialog.save_as_html'),
      defaultPath: defaultFilename,
      filters: [
        { name: t('dialog.html_files'), extensions: ['html', 'htm'] },
        { name: t('dialog.all_files'), extensions: ['*'] }
      ]
    })

    if (canceled || !filePath) {
      return null
    }

    // Get the HTML content with safe error handling
    const html = await webview.executeJavaScript(`
      (() => {
        try {
          // Build complete DOCTYPE string if present
          let doctype = '';
          if (document.doctype) {
            const dt = document.doctype;
            doctype = '<!DOCTYPE ' + (dt.name || 'html');

            // Add PUBLIC identifier if publicId is present
            if (dt.publicId) {
              // Escape single quotes in publicId
              const escapedPublicId = String(dt.publicId).replace(/'/g, "\\'");
              doctype += " PUBLIC '" + escapedPublicId + "'";

              // Add systemId if present (required when publicId is present)
              if (dt.systemId) {
                const escapedSystemId = String(dt.systemId).replace(/'/g, "\\'");
                doctype += " '" + escapedSystemId + "'";
              }
            } else if (dt.systemId) {
              // SYSTEM identifier (without PUBLIC)
              const escapedSystemId = String(dt.systemId).replace(/'/g, "\\'");
              doctype += " SYSTEM '" + escapedSystemId + "'";
            }

            doctype += '>';
          }
          return doctype + (document.documentElement?.outerHTML || '');
        } catch (error) {
          // Fallback: just return the HTML without DOCTYPE if there's an error
          return document.documentElement?.outerHTML || '';
        }
      })()
    `)

    // Save HTML to file
    await fs.writeFile(filePath, html, 'utf-8')

    return filePath
  } catch (error) {
    throw new Error(`Failed to save as HTML: ${(error as Error).message}`)
  }
}
