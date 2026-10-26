import background from '@renderer/assets/images/home/landing/background.png'
import { QuickPanelProvider } from '@renderer/components/QuickPanel'
import { ensureAiOnlyModelsLoaded } from '@renderer/hooks/useAiOnlyModels'
import { useAppSelector } from '@renderer/store'
import { selectAiOnlyModels } from '@renderer/store/user'
import type { Assistant, Topic } from '@renderer/types'
import { Bot, Coins, MessagesSquare } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import HomeAnnouncements from './HomeAnnouncements'
import { type HomeContent, type HomeContentAction, resolveHomeContentAction } from './homeContent'
import { getPublishedHomeContent } from './homeContentApi'
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
  const [content, setContent] = useState<HomeContent>({ ticker: [], announcements: [], avatarPromotion: null })
  const [modelsReady, setModelsReady] = useState(false)
  const hasPublishedContent =
    content.ticker.length > 0 || content.announcements.length > 0 || content.avatarPromotion !== null
  const displayContent: HomeContent = hasPublishedContent
    ? content
    : {
        ticker: [
          {
            id: 'built-in-multi-model',
            slot: 'ticker',
            title: t('homeLanding.modelGuide.action'),
            description: t('homeLanding.modelGuide.description'),
            action: { type: 'route', target: '/settings/model' }
          }
        ],
        announcements: [
          {
            id: 'built-in-model-guide',
            slot: 'announcement',
            title: t('homeLanding.multiModel'),
            description: t('homeLanding.viewPromotion'),
            action: { type: 'route', target: '/chat' }
          }
        ],
        avatarPromotion: {
          id: 'built-in-model-promotion',
          slot: 'avatar',
          title: t('homeLanding.modelGuide.action'),
          description: t('homeLanding.modelGuide.description'),
          action: { type: 'route', target: '/settings/model' }
        }
      }

  useEffect(() => {
    let mounted = true
    void getPublishedHomeContent()
      .then((published) => {
        if (mounted) setContent(published)
      })
      .catch(() => {
        // Keep the landing page usable when content publishing is unavailable.
      })
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
      const safeAction = resolveHomeContentAction(action)
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
        <HomeAnnouncements
          ticker={displayContent.ticker}
          announcements={displayContent.announcements}
          onAction={openContentAction}
        />
        <h1>{t('homeLanding.title')}</h1>
        <QuickActions>
          <button type="button" onClick={() => navigate('/chat')}>
            <MessagesSquare size={15} /> {t('homeLanding.multiModel')}
          </button>
          <button type="button" onClick={() => navigate('/tokenPlan')}>
            <Coins size={15} /> {t('tokenPlan.title')}
          </button>
          <button type="button" onClick={() => navigate('/agent-router')}>
            <Bot size={15} /> {t('agentRouter.title')}
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
        {hasPublishedContent && (
          <ModelGuidance
            modelsReady={modelsReady}
            hasModel={availableModels.length > 0}
            onOpenModels={() => navigate('/settings/model')}
          />
        )}
      </Content>
      <MascotPosition>
        <HomeMascot promotion={displayContent.avatarPromotion} onAction={openContentAction} autoOpen />
      </MascotPosition>
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
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 18px;

  button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border: 1px solid var(--color-border);
    border-radius: 100px;
    background: var(--color-background-opacity);
    color: var(--color-text-2);
    font-size: 12px;
    cursor: pointer;
  }

  button:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }

  button:nth-child(2) {
    color: #3474ed;
    border-color: rgb(255 255 255 / 70%);
    background: rgb(232 242 255 / 85%);
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

export default LandingPage
