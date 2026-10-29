import background from '@renderer/assets/images/home/landing/background.png'
import AgentRouterIcon from '@renderer/components/Icons/AgentRouterIcon'
import { QuickPanelProvider } from '@renderer/components/QuickPanel'
import { ensureAiOnlyModelsLoaded } from '@renderer/hooks/useAiOnlyModels'
import { useAppSelector } from '@renderer/store'
import { selectAiOnlyModels } from '@renderer/store/user'
import type { Assistant, Topic } from '@renderer/types'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import RoundtableSidebarIcon from '../roundtable/RoundtableSidebarIcon'
import HomeAnnouncements from './HomeAnnouncements'
import { type HomeContentAction, type HomePushItem, resolveHomeContentAction } from './homeContent'
import { getHomePushList } from './homeContentApi'
import HomeMascot from './HomeMascot'
import Inputbar from './Inputbar/Inputbar'
import ModelGuidance from './ModelGuidance'

interface Props {
  assistant: Assistant
  activeTopic: Topic
  setActiveTopic: (topic: Topic) => void
}

const LandingPage: FC<Props> = ({ assistant, activeTopic, setActiveTopic }) => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const availableModels = useAppSelector(selectAiOnlyModels)
  const [topLoop, setTopLoop] = useState<HomePushItem[]>([])
  const [cartoon, setCartoon] = useState<HomePushItem[]>([])
  const [modelsReady, setModelsReady] = useState(false)

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
    let mounted = true
    void ensureAiOnlyModelsLoaded().finally(() => {
      if (mounted) setModelsReady(true)
    })
    return () => {
      mounted = false
    }
  }, [])

  const openConversation = useCallback(() => {
    navigate('/chat', { state: { assistant, topic: activeTopic } })
  }, [activeTopic, assistant, navigate])

  const openContentAction = useCallback(
    (action: HomeContentAction) => {
      const safeAction = resolveHomeContentAction(action.target)
      if (!safeAction) return
      if (safeAction.type === 'route') {
        navigate(safeAction.target)
      } else {
        void window.api.shell.openExternal(safeAction.target)
      }
    },
    [navigate]
  )

  return (
    <Container id="landing-page">
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
          <QuickPanelProvider>
            <Inputbar
              assistant={assistant}
              topic={activeTopic}
              setActiveTopic={setActiveTopic}
              onMessageAccepted={openConversation}
              compact
            />
          </QuickPanelProvider>
        </Composer>
        <ModelGuidance
          modelsReady={modelsReady}
          hasModel={availableModels.length > 0}
          onOpenModels={() => navigate('/settings/model')}
        />
      </Content>
      <MascotPosition>
        <HomeMascot promotion={cartoon[0] ?? null} onAction={openContentAction} />
      </MascotPosition>
      <FooterNote>{t('homeLanding.disclaimer')}</FooterNote>
    </Container>
  )
}

const Container = styled.main`
  position: relative;
  display: flex;
  flex: 1;
  justify-content: center;
  min-width: 0;
  overflow: auto;
  background: url(${background}) center center / cover no-repeat;
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
  width: min(100%, 72vw, 1000px);
  margin-top: 38px;

  .narrow-mode.active {
    max-width: 100%;
  }

  .inputbar {
    padding: 0;
  }

  .inputbar-container {
    min-height: 112px;
    border: 1px solid #6f738b1a;
    border-radius: 12px;
    background: rgb(244 248 255 / 75%);
    backdrop-filter: blur(20px);
    box-shadow: 0 14px 38px #6f738b12;
  }
`

const MascotPosition = styled.div`
  position: absolute;
  z-index: 3;
  top: calc(24% + 55px);
  right: 16%;

  @media (max-width: 700px) {
    top: calc(13% + 55px);
    right: 8px;
    transform: scale(0.75);
    transform-origin: top right;
  }
`

const FooterNote = styled.p`
  position: absolute;
  bottom: 12px;
  left: 50%;
  width: calc(100% - 32px);
  margin: 0;
  color: #7d8496;
  font-size: 11px;
  line-height: 1.4;
  text-align: center;
  transform: translateX(-50%);
`

export default LandingPage
