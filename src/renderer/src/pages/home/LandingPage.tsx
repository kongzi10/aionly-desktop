import aiOnlyPng from '@renderer/assets/images/logo.png'
import AgentRouterIcon from '@renderer/components/Icons/AgentRouterIcon'
import { QuickPanelProvider } from '@renderer/components/QuickPanel'
import { ensureAiOnlyModelsLoaded } from '@renderer/hooks/useAiOnlyModels'
import { useMinappPopup } from '@renderer/hooks/useMinappPopup'
import type { Assistant, Topic } from '@renderer/types'
import type { InputBarToolType } from '@renderer/types/chat'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import RoundtableSidebarIcon from '../roundtable/RoundtableSidebarIcon'
import AiFlowBackground from './components/AiFlowBackground'
import HomeAnnouncements from './HomeAnnouncements'
import { type HomeContentAction, type HomePushItem, resolveHomeContentAction } from './homeContent'
import { getHomePushList } from './homeContentApi'
import HomeMascot from './HomeMascot'
import Inputbar from './Inputbar/Inputbar'

interface Props {
  assistant: Assistant
  activeTopic: Topic
  setActiveTopic: (topic: Topic) => void
}

// 首页输入框不展示的工具：新建话题、清空、展开、新上下文
const LANDING_EXCLUDED_TOOLS: InputBarToolType[] = ['new_topic', 'clear_topic', 'toggle_expand', 'new_context']

const LandingPage: FC<Props> = ({ assistant, activeTopic, setActiveTopic }) => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { openSmartMinapp } = useMinappPopup()
  const [topLoop, setTopLoop] = useState<HomePushItem[]>([])
  const [cartoon, setCartoon] = useState<HomePushItem[]>([])

  useEffect(() => {
    let mounted = true
    void getHomePushList('top_loop')
      .then((items) => mounted && setTopLoop(items))
      .catch(() => {})
    void getHomePushList('cartoon')
      .then((items) => mounted && setCartoon(items))
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    void ensureAiOnlyModelsLoaded()
  }, [])

  const openConversation = useCallback(() => {
    navigate('/chat', { state: { assistant, topic: activeTopic } })
  }, [activeTopic, assistant, navigate])

  const openContentAction = useCallback(
    (action: HomeContentAction, item: HomePushItem) => {
      const safeAction = resolveHomeContentAction(action.target)
      if (!safeAction) return
      if (safeAction.type === 'route') {
        navigate(safeAction.target)
        return
      }
      // https 外链不再跳系统浏览器，改为内部小程序弹窗（webview）打开，
      // 与导航栏充值/会员入口保持一致
      openSmartMinapp(
        {
          id: `home-push-${item.id}`,
          name: item.buttonText || item.title || t('settings.provider.charge'),
          logo: aiOnlyPng,
          supportedRegions: ['CN', 'Global'],
          url: safeAction.target
        },
        true
      )
    },
    [navigate, openSmartMinapp, t]
  )

  return (
    <Container id="landing-page">
      <AiFlowBackground />
      <ScrollArea>
        <Content>
          <HomeAnnouncements items={topLoop} />
          <h1>{t('homeLanding.title')}</h1>
          <QuickActions>
            <button type="button" onClick={() => navigate('/roundtable')}>
              <RoundtableSidebarIcon width={15} height={15} /> {t('homeLanding.multiModel')}
            </button>
            <button type="button" onClick={() => navigate('/tokenPlan')}>
              <i className="iconfont icon-ziyuan1" aria-hidden="true" /> {t('tokenPlan.title')}
            </button>
            <button type="button" onClick={() => navigate('/agent-router')}>
              <AgentRouterIcon width={15} height={15} /> {t('agentRouter.title')}
            </button>
          </QuickActions>
          <Composer>
            <MascotAnchor>
              <HomeMascot items={cartoon} onAction={openContentAction} />
            </MascotAnchor>
            <QuickPanelProvider>
              <Inputbar
                assistant={assistant}
                topic={activeTopic}
                setActiveTopic={setActiveTopic}
                onMessageAccepted={openConversation}
                showOpenModelButton
                compact
                excludedTools={LANDING_EXCLUDED_TOOLS}
              />
            </QuickPanelProvider>
          </Composer>
        </Content>
      </ScrollArea>
      <FooterNote>{t('homeLanding.disclaimer')}</FooterNote>
    </Container>
  )
}

const Container = styled.main`
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
  overflow: hidden;
`

const ScrollArea = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex: 1;
  justify-content: center;
  min-width: 0;
  overflow: auto;
`

const Content = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(100%, 1100px);
  padding: clamp(175px, calc(20vh + 55px), 280px) 24px 72px;

  h1 {
    margin: 10px 0 0;
    color: #10234d;
    font-size: clamp(25px, 2.6vw, 38px);
    line-height: 1.3;
    font-weight: 700;
    letter-spacing: 0.01em;
    text-align: center;
  }

  body.dark & h1 {
    color: #e8f0ff;
  }

  @media (max-width: 800px) {
    padding-top: 131px;
  }

  @media (max-height: 700px) {
    padding-top: 95px;
  }
`

const QuickActions = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 18px;

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    box-sizing: border-box;
    min-width: 130px;
    height: 40px;
    padding: 0 14px;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: var(--color-background-opacity);
    color: var(--color-text-2);
    font-size: 12px;
    cursor: pointer;
    transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, color 180ms ease;
  }

  button:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
    transform: translateY(-4px);
    box-shadow: 0 8px 18px rgb(54 111 205 / 15%);
  }

  button:active {
    transform: translateY(-1px);
  }

  @media (prefers-reduced-motion: reduce) {
    button {
      transition: none;
    }
  }

  button .iconfont {
    font-size: 15px;
  }
`

const Composer = styled.div`
  position: relative;
  width: min(100%, 72vw, 1000px);
  margin-top: 38px;

  .narrow-mode.active {
    max-width: 100%;
  }

  .inputbar {
    padding: 0;
  }

  .inputbar-container {
    position: relative;
    z-index: 2;
    min-height: 112px;
    border-radius: 12px;
    backdrop-filter: blur(20px) saturate(1.2);
    -webkit-backdrop-filter: blur(20px) saturate(1.2);
  }

  body.light & .inputbar-container {
    border: 1px solid #6f738b1a;
    background: rgb(244 248 255 / 55%);
    box-shadow: 0 14px 38px #6f738b12;

    @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
      background: rgb(244 248 255 / 92%);
    }
  }
`

const MascotAnchor = styled.div`
  position: absolute;
  z-index: 1;
  right: 2px;
  bottom: calc(100% - clamp(88px, 10vw, 155px) * 0.28);
  pointer-events: none;
`

const FooterNote = styled.p`
  position: absolute;
  z-index: 3;
  bottom: 12px;
  left: 50%;
  width: calc(100% - 32px);
  margin: 0;
  color: #7d8496;
  font-size: 11px;
  line-height: 1.4;
  text-align: center;
  transform: translateX(-50%);

  body.dark & {
    color: #8b9dbb;
  }
`

export default LandingPage
