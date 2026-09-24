import { loggerService } from '@logger'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useSettings } from '@renderer/hooks/useSettings'
import { authStorage, getProfileWebviewPartition } from '@renderer/services/ProfileStorageService'
import { USER_UI_HOST, WEB_UI_HOST } from '@shared/config/constant'
import type { WebviewTag } from 'electron'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

const logger = loggerService.withContext('WebviewContainer')

/** Hosts allowed to receive app-config in the webview. Keep in sync with WebviewService. */
const ALLOWED_WEBVIEW_HOSTS = [USER_UI_HOST, WEB_UI_HOST, 'http://localhost:7023']

/**
 * WebviewContainer is a component that renders a webview element.
 * It is used in the MinAppPopupContainer component.
 * The webcontent can be remain in memory
 */
const WebviewContainer = memo(
  ({
    appid,
    url,
    onSetRefCallback,
    onLoadedCallback,
    onNavigateCallback
  }: {
    appid: string
    url: string
    onSetRefCallback: (appid: string, element: WebviewTag | null) => void
    onLoadedCallback: (appid: string) => void
    onNavigateCallback: (appid: string, url: string) => void
  }) => {
    const webviewRef = useRef<WebviewTag | null>(null)
    const { enableSpellCheck, minappsOpenLinkExternal } = useSettings()
    const [preloadPath, setPreloadPath] = useState<string>('')
    const { theme } = useTheme()

    // Latest values for the listeners registered in the [appid, url] effect below.
    // That effect can't list them as dependencies (it assigns webview.src, so re-running
    // it would reload the page), which means its handlers would otherwise close over
    // mount-time values — and every later `dom-ready` would push a stale openLinkExternal
    // value back to the main process, undoing the user's toggle.
    const latestSettingsRef = useRef({ enableSpellCheck, minappsOpenLinkExternal })
    const latestOnLoadedCallbackRef = useRef(onLoadedCallback)
    useEffect(() => {
      latestSettingsRef.current = { enableSpellCheck, minappsOpenLinkExternal }
      latestOnLoadedCallbackRef.current = onLoadedCallback
    })

    // Fetch preload path from main process
    useEffect(() => {
      window.api
        .getWebviewPreloadPath()
        .then((path) => {
          setPreloadPath(path)
          logger.warn(`[WebviewContainer] Webview preload path received: ${path}`)
        })
        .catch((err) => {
          logger.error('[WebviewContainer] Failed to get webview preload path:', err)
        })
    }, [])

    const setRef = (appid: string) => {
      onSetRefCallback(appid, null)

      return (element: WebviewTag | null) => {
        onSetRefCallback(appid, element)
        if (element) {
          webviewRef.current = element
        } else {
          webviewRef.current = null
        }
      }
    }

    useEffect(() => {
      if (!webviewRef.current) return

      let loadCallbackFired = false

      const handleLoaded = () => {
        logger.debug(`WebView did-finish-load for app: ${appid}`)
        // Only fire callback once per load cycle
        if (!loadCallbackFired) {
          loadCallbackFired = true
          // Small delay to ensure content is actually visible
          setTimeout(() => {
            logger.debug(`Calling onLoadedCallback for app: ${appid}`)
            latestOnLoadedCallbackRef.current(appid)
          }, 100)
        }
      }

      // Additional callback for when page is ready to show
      const handleReadyToShow = () => {
        logger.debug(`WebView ready-to-show for app: ${appid}`)
        if (!loadCallbackFired) {
          loadCallbackFired = true
          logger.debug(`Calling onLoadedCallback from ready-to-show for app: ${appid}`)
          latestOnLoadedCallbackRef.current(appid)
        }
      }

      const handleNavigate = (event: any) => {
        onNavigateCallback(appid, event.url)
      }

      const handleIpcMessage = (event: any) => {
        const channel = event.channel
        const data = event.args[0]

        logger.debug(`[webview ${appid}] Received IPC message on channel: ${channel}`, data)

        // Handle messages from external web projects loaded in webview
        switch (channel) {
          case 'user-action':
            logger.info(`[webview ${appid}] User action:`, data)
            if (data?.url) {
              onNavigateCallback(appid, data.url)
            }
            break

          default:
            logger.debug(`[webview ${appid}] Unhandled IPC channel: ${channel}`)
            break
        }
      }

      const handleDomReady = () => {
        const webviewId = webviewRef.current?.getWebContentsId()
        if (webviewId) {
          const settings = latestSettingsRef.current
          void window.api?.webview?.setSpellCheckEnabled?.(webviewId, settings.enableSpellCheck)
          // Set link opening behavior for this webview
          void window.api?.webview?.setOpenLinkExternal?.(webviewId, settings.minappsOpenLinkExternal)
        }
      }

      const handleStartLoading = () => {
        // Reset callback flag when starting a new load
        loadCallbackFired = false
      }

      webviewRef.current.addEventListener('did-start-loading', handleStartLoading)
      webviewRef.current.addEventListener('dom-ready', handleDomReady)
      webviewRef.current.addEventListener('did-finish-load', handleLoaded)
      webviewRef.current.addEventListener('ready-to-show', handleReadyToShow)
      webviewRef.current.addEventListener('did-navigate-in-page', handleNavigate)
      webviewRef.current.addEventListener('ipc-message', handleIpcMessage)

      // we set the url when the webview is ready
      webviewRef.current.src = url

      return () => {
        webviewRef.current?.removeEventListener('did-start-loading', handleStartLoading)
        webviewRef.current?.removeEventListener('dom-ready', handleDomReady)
        webviewRef.current?.removeEventListener('did-finish-load', handleLoaded)
        webviewRef.current?.removeEventListener('ready-to-show', handleReadyToShow)
        webviewRef.current?.removeEventListener('did-navigate-in-page', handleNavigate)
        webviewRef.current?.removeEventListener('ipc-message', handleIpcMessage)
      }
      // because the appid and url are enough, no need to add onLoadedCallback
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appid, url])

    // Setup keyboard shortcuts handler for print and save
    useEffect(() => {
      if (!webviewRef.current) return

      const unsubscribe = window.api?.webview?.onFindShortcut?.(async (payload) => {
        // Get webviewId when event is triggered
        const webviewId = webviewRef.current?.getWebContentsId()

        // Only handle events for this webview
        if (!webviewId || payload.webviewId !== webviewId) return

        const key = payload.key?.toLowerCase()
        const isModifier = payload.control || payload.meta

        if (!isModifier || !key) return

        try {
          if (key === 'p') {
            // Print to PDF
            logger.info(`Printing webview ${appid} to PDF`)
            const filePath = await window.api.webview.printToPDF(webviewId)
            if (filePath) {
              window.toast?.success?.(`PDF saved to: ${filePath}`)
              logger.info(`PDF saved to: ${filePath}`)
            }
          } else if (key === 's') {
            // Save as HTML
            logger.info(`Saving webview ${appid} as HTML`)
            const filePath = await window.api.webview.saveAsHTML(webviewId)
            if (filePath) {
              window.toast?.success?.(`HTML saved to: ${filePath}`)
              logger.info(`HTML saved to: ${filePath}`)
            }
          }
        } catch (error) {
          logger.error(`Failed to handle shortcut for webview ${appid}:`, error as Error)
          window.toast?.error?.(`Failed: ${(error as Error).message}`)
        }
      })

      return () => {
        unsubscribe?.()
      }
    }, [appid])

    // Update webview settings when they change
    useEffect(() => {
      if (!webviewRef.current) return

      try {
        const webviewId = webviewRef.current.getWebContentsId()
        if (webviewId) {
          void window.api?.webview?.setSpellCheckEnabled?.(webviewId, enableSpellCheck)
          void window.api?.webview?.setOpenLinkExternal?.(webviewId, minappsOpenLinkExternal)
        }
      } catch (error) {
        // WebView may not be ready yet, settings will be applied in dom-ready event
        logger.debug(`WebView ${appid} not ready for settings update`)
      }
    }, [appid, minappsOpenLinkExternal, enableSpellCheck])

    const buildAppConfig = useCallback(
      (url: string) => {
        const target_path = url.split('?')[1]
        const path = target_path?.includes('redirect=') ? target_path.split('=')[1] : undefined
        return {
          appId: appid,
          token: authStorage.getItem('token'),
          path,
          clientId: import.meta.env.VITE_APP_CLIENT_ID,
          config: { theme }
        }
      },
      [appid, theme]
    )

    // TODO: 临时处理，待优化
    useEffect(() => {
      // 只允许以 allows 中地址开头的 URL
      if (!ALLOWED_WEBVIEW_HOSTS.some((allowedUrl) => url.startsWith(allowedUrl))) {
        return
      }

      if (!webviewRef.current) return

      // 发送初始化消息给目标页面
      const sendInitData = () => {
        const configData = buildAppConfig(url)

        logger.warn(`[WebviewContainer] Sending app-config to webview ${appid}`, {
          hasToken: !!configData.token,
          hasWebview: !!webviewRef.current,
          url
        })

        webviewRef.current?.send('app-config', configData)
      }

      // 在dom-ready 时发送
      webviewRef.current.addEventListener('dom-ready', sendInitData)

      return () => {
        webviewRef.current?.removeEventListener('dom-ready', sendInitData)
      }
    }, [url, appid, buildAppConfig])

    // Popups opened by this webview (e.g. the payment /payResult window) share the session but
    // have no preload bridge of their own. When the main process reports one on an allowed host,
    // push the same app-config so the SPA boot carries the auth token instead of logging out.
    useEffect(() => {
      const { onPopupNeedsAppConfig, sendAppConfigToPopup } = window.api?.webview ?? {}
      if (!onPopupNeedsAppConfig || !sendAppConfigToPopup) return

      const unsubscribe = onPopupNeedsAppConfig(({ webviewId, popupId, url: popupUrl }) => {
        const currentId = webviewRef.current?.getWebContentsId()
        if (!currentId || currentId !== webviewId) return
        if (!ALLOWED_WEBVIEW_HOSTS.some((allowedUrl) => popupUrl.startsWith(allowedUrl))) return
        sendAppConfigToPopup(popupId, buildAppConfig(popupUrl))
      })

      return unsubscribe
    }, [appid, buildAppConfig])

    const WebviewStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      backgroundColor: 'var(--color-background)',
      display: 'inline-flex'
    }

    return (
      <webview
        key={appid}
        ref={setRef(appid)}
        data-minapp-id={appid}
        style={WebviewStyle}
        allowpopups={'true' as any}
        partition={getProfileWebviewPartition()}
        preload={preloadPath || undefined}
        nodeintegration={false}
        disablewebsecurity={true}
        useragent={
          appid === 'google'
            ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)  Safari/537.36'
            : undefined
        }
      />
    )
  }
)

export default WebviewContainer
