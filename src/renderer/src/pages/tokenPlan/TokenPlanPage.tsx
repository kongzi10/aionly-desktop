import { ArrowLeftOutlined, ArrowRightOutlined, CodeOutlined, ReloadOutlined } from '@ant-design/icons'
import { loggerService } from '@logger'
import aiOnlyPng from '@renderer/assets/images/logo.png'
import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import WebviewContainer from '@renderer/components/MinApp/WebviewContainer'
import { isDev, isLinux, isWin } from '@renderer/config/constant'
import { useRuntime } from '@renderer/hooks/useRuntime'
import { useNavbarPosition, useSettings } from '@renderer/hooks/useSettings'
import { useTimer } from '@renderer/hooks/useTimer'
import { setWebviewLoaded } from '@renderer/utils/webviewStateManager'
import { USER_UI_HOST } from '@shared/config/constant'
import { Avatar, Tooltip } from 'antd'
import type { WebviewTag } from 'electron'
import type { FC } from 'react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import BeatLoader from 'react-spinners/BeatLoader'
import styled from 'styled-components'

const logger = loggerService.withContext('TokenPlanPage')

const TokenPlanPage: FC = () => {
  // hooks
  const { t } = useTranslation()

  /** store the webview refs, one of the key to make them keepalive */
  const webviewRefs = useRef<Map<string, WebviewTag | null>>(new Map())
  /** the current REAL url of the minapp
   * different from the app preset url, because user may navigate in minapp */
  const [_currentUrl, setCurrentUrl] = useState<string | null>(null)
  /** whether the current minapp is ready */
  const [isReady, setIsReady] = useState(false)
  const { isTopNavbar } = useNavbarPosition()

  const [app] = useState({
    id: 'tokenPlan',
    name: 'tokenPlan',
    logo: aiOnlyPng,
    supportedRegions: ['CN', 'Global'],
    url: `${USER_UI_HOST}/tokenPlan`
    // url: 'http://localhost:7023/tokenPlan'
  })

  const { openedKeepAliveMinapps, openedOneOffMinapp } = useRuntime()

  const combinedApps = useMemo(() => {
    return [...openedKeepAliveMinapps, ...(openedOneOffMinapp ? [openedOneOffMinapp] : [])]
  }, [openedKeepAliveMinapps, openedOneOffMinapp])

  /** Note: WebView loaded states now managed globally via webviewStateManager */
  /** whether the minapps open link external is enabled */
  const { minappsOpenLinkExternal } = useSettings()
  const { setTimeoutTimer } = useTimer()

  /** the callback function to set the webviews ref */
  const handleWebviewSetRef = (appid: string, element: WebviewTag | null) => {
    if (element) {
      webviewRefs.current.set(appid, element)
    } else {
      webviewRefs.current.delete(appid)
    }
  }

  /** the callback function to set the webviews loaded indicator */
  const handleWebviewLoaded = (appid: string) => {
    // console.log('-------handleWebviewLoaded----->')
    setWebviewLoaded(appid, true)
    const webviewElement = webviewRefs.current.get(appid)
    if (webviewElement) {
      try {
        const webviewId = webviewElement.getWebContentsId()
        if (webviewId) {
          void window.api.webview.setOpenLinkExternal(webviewId, minappsOpenLinkExternal)
        }
      } catch (error) {
        logger.debug(`WebView ${appid} not ready for getWebContentsId() in handleWebviewLoaded`)
      }
    }
    setTimeoutTimer('handleWebviewLoaded', () => setIsReady(true), 200)
  }

  /** the callback function to handle webview navigation */
  const handleWebviewNavigate = (appid: string, url: string) => {
    // 记录当前URL，用于GoogleLoginTip判断
    logger.debug(`URL changed: ${appid}---${url}`)
    setCurrentUrl(url)
  }

  /** navigate back in webview history */
  const handleGoBack = (appid: string) => {
    const webview = webviewRefs.current.get(appid)
    if (webview) {
      try {
        if (webview.canGoBack()) {
          webview.goBack()
        }
      } catch (error) {
        logger.debug(`WebView ${appid} not ready for goBack()`)
      }
    }
  }

  /** navigate forward in webview history */
  const handleGoForward = (appid: string) => {
    const webview = webviewRefs.current.get(appid)
    if (webview) {
      try {
        if (webview.canGoForward()) {
          webview.goForward()
        }
      } catch (error) {
        logger.debug(`WebView ${appid} not ready for goForward()`)
      }
    }
  }

  /** only reload the original url */
  const handleReload = (appid: string) => {
    const webview = webviewRefs.current.get(appid)
    if (webview) {
      const url = combinedApps.find((item) => item.id === appid)?.url
      if (url) {
        webview.src = url
      } else {
        webview.reload()
      }
    }
  }

  /** will open the devtools of the minapp */
  const handleOpenDevTools = (appid: string) => {
    const webview = webviewRefs.current.get(appid)
    if (webview) {
      webview.openDevTools()
    }
  }

  return (
    <Container id="translate-page" className="page-container">
      <Navbar>
        <NavbarCenter style={{ borderRight: 'none', gap: 10 }}>{t('tokenPlan.title')}</NavbarCenter>
      </Navbar>
      <ButtonsGroup
        className={isWin || isLinux ? 'windows' : ''}
        style={{ marginRight: isWin || isLinux ? '140px' : 0 }}
        isTopNavbar={isTopNavbar}>
        <Tooltip title={t('minapp.popup.goBack')} mouseEnterDelay={0.8} placement="bottom">
          <TitleButton onClick={() => handleGoBack(app.id)}>
            <ArrowLeftOutlined />
          </TitleButton>
        </Tooltip>
        <Tooltip title={t('minapp.popup.goForward')} mouseEnterDelay={0.8} placement="bottom">
          <TitleButton onClick={() => handleGoForward(app.id)}>
            <ArrowRightOutlined />
          </TitleButton>
        </Tooltip>
        <Tooltip title={t('minapp.popup.refresh')} mouseEnterDelay={0.8} placement="bottom">
          <TitleButton onClick={() => handleReload(app.id)}>
            <ReloadOutlined />
          </TitleButton>
        </Tooltip>
        {isDev && (
          <Tooltip title={t('minapp.popup.devtools')} mouseEnterDelay={0.8} placement="bottom">
            <TitleButton onClick={() => handleOpenDevTools(app.id)}>
              <CodeOutlined />
            </TitleButton>
          </Tooltip>
        )}
      </ButtonsGroup>
      <ContentContainer id="content-container" data-tour="tokenplan-content">
        {!isReady && (
          <EmptyView style={{ backgroundColor: 'var(--color-background-soft)' }}>
            <Avatar
              src={app?.logo}
              size={80}
              style={{
                border: '1px solid var(--color-border)',
                marginTop: -150,
                height: '40px',
                width: 'auto',
                padding: '6px',
                borderRadius: '4px'
              }}
            />
            <BeatLoader color="var(--color-text-2)" size={10} style={{ marginTop: 15 }} />
          </EmptyView>
        )}
        <WebviewContainer
          key={app.id}
          appid={app.id}
          url={app.url}
          onSetRefCallback={handleWebviewSetRef}
          onLoadedCallback={handleWebviewLoaded}
          onNavigateCallback={handleWebviewNavigate}
        />
      </ContentContainer>
    </Container>
  )
}

const Container = styled.div`
  flex: 1;
`

const ContentContainer = styled.div`
  height: calc(100vh - var(--navbar-height) - 40px);
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  position: relative;
  background-color: var(--color-background);
  border-radius: 0 0 var(--base-border-radius) var(--base-border-radius) !important;
  overflow: hidden;
`

const ButtonsGroup = styled.div<{ isTopNavbar: boolean }>`
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 5px;
  -webkit-app-region: no-drag;
  border-radius: var(--base-border-radius) var(--base-border-radius) 0 0;
  &.windows {
    background-color: var(--color-background-mute);
    padding: 0 3px;
    overflow: hidden;
  }
`

const TitleButton = styled.div`
  cursor: pointer;
  width: 30px;
  height: 30px;
  border-radius: 5px;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  color: var(--color-text-2);
  transition: all 0.2s ease;
  font-size: 14px;
  -webkit-app-region: no-drag;
  &:hover {
    color: var(--color-text-1);
    background-color: var(--color-background-mute);
  }
  &.pinned {
    color: var(--color-primary);
    //background-color: var(--color-primary-bg);
  }
  &.open-external {
    color: var(--color-primary);
    //background-color: var(--color-primary-bg);
  }
`

const EmptyView = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  background-color: var(--color-background);
`

export default TokenPlanPage
