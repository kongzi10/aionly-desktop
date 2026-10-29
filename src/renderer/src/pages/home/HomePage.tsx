import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { useAssistants, useDefaultAssistant } from '@renderer/hooks/useAssistant'
import { useNavbarPosition, useSettings } from '@renderer/hooks/useSettings'
import { useShortcut } from '@renderer/hooks/useShortcuts'
import { useShowAssistants, useShowTopics } from '@renderer/hooks/useStore'
import { useActiveTopic } from '@renderer/hooks/useTopic'
import { getDefaultTopic } from '@renderer/services/AssistantService'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import NavigationService from '@renderer/services/NavigationService'
import { newMessagesActions } from '@renderer/store/newMessage'
import type { Assistant, AssistantWorkspace, Topic } from '@renderer/types'
import { uuid } from '@renderer/utils'
import { MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH, SECOND_MIN_WINDOW_WIDTH } from '@shared/config/constant'
import { AnimatePresence, motion } from 'motion/react'
import type { FC } from 'react'
import { startTransition, useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import styled, { css } from 'styled-components'

import RoundtableChat from '../roundtable/RoundtableChat'
import { filterAssistantsByWorkspace, getAssistantWorkspace } from '../roundtable/roundtableWorkspace'
import Chat from './Chat'
import LandingPage from './LandingPage'
import Navbar from './Navbar'
// import HomeTabs from './Tabs'
import HomePanel from './Panel'

const activeAssistants: Partial<Record<AssistantWorkspace, Assistant>> = {}

interface Props {
  mode?: 'chat' | 'roundtable' | 'landing'
}

const HomePage: FC<Props> = ({ mode = 'chat' }) => {
  const isConversationWorkspace = mode === 'chat' || mode === 'roundtable'
  const workspace: AssistantWorkspace = mode === 'roundtable' ? 'roundtable' : 'chat'
  const { assistants, addAssistant } = useAssistants()
  const { defaultAssistant } = useDefaultAssistant()
  const workspaceAssistants = filterAssistantsByWorkspace(assistants, workspace)
  const navigate = useNavigate()
  const { isLeftNavbar } = useNavbarPosition()

  const location = useLocation()
  const state = location.state

  const [workspaceDefault] = useState<Assistant>(() => {
    const id = uuid()
    return { ...defaultAssistant, id, workspace, topics: [getDefaultTopic(id)] }
  })
  const [activeAssistant, _setActiveAssistant] = useState<Assistant>(() => {
    const stateAssistant = state?.assistant as Assistant | undefined
    if (stateAssistant && getAssistantWorkspace(stateAssistant) === workspace) return stateAssistant
    const cachedAssistant = workspaceAssistants.find((assistant) => assistant.id === activeAssistants[workspace]?.id)
    return cachedAssistant || workspaceAssistants[0] || workspaceDefault
  })
  const { activeTopic, setActiveTopic: _setActiveTopic } = useActiveTopic(activeAssistant?.id ?? '', state?.topic)
  const { showAssistants, showTopics, topicPosition } = useSettings()
  const { setShowAssistants, toggleShowAssistants } = useShowAssistants()
  const { toggleShowTopics } = useShowTopics()
  const dispatch = useDispatch()

  activeAssistants[workspace] = activeAssistant

  useEffect(() => {
    if (workspaceAssistants.length === 0) {
      addAssistant(workspaceDefault)
    }
  }, [addAssistant, workspaceAssistants.length, workspaceDefault])

  useShortcut('toggle_show_assistants', () => {
    if (topicPosition === 'right') {
      toggleShowAssistants()
      return
    }

    if (!showAssistants) {
      setShowAssistants(true)
      requestAnimationFrame(() => {
        void EventEmitter.emit(EVENT_NAMES.SHOW_ASSISTANTS)
      })
      return
    }

    void EventEmitter.emit(EVENT_NAMES.SHOW_ASSISTANTS)
  })

  useShortcut('toggle_show_topics', () => {
    if (topicPosition === 'right') {
      toggleShowTopics()
      return
    }

    if (!showAssistants) {
      setShowAssistants(true)
      requestAnimationFrame(() => {
        void EventEmitter.emit(EVENT_NAMES.SHOW_TOPIC_SIDEBAR)
      })
      return
    }

    void EventEmitter.emit(EVENT_NAMES.SHOW_TOPIC_SIDEBAR)
  })

  const setActiveAssistant = useCallback(
    (newAssistant: Assistant) => {
      if (newAssistant.id === activeAssistant?.id) return
      startTransition(() => {
        _setActiveAssistant(newAssistant)
        // 同步更新 active topic，避免不必要的重新渲染
        const newTopic = newAssistant.topics[0]
        _setActiveTopic((prev) => (newTopic?.id === prev.id ? prev : newTopic))
      })
    },
    [_setActiveTopic, activeAssistant?.id]
  )

  const setActiveTopic = useCallback(
    (newTopic: Topic) => {
      startTransition(() => {
        _setActiveTopic((prev) => (newTopic?.id === prev.id ? prev : newTopic))
        dispatch(newMessagesActions.setTopicFulfilled({ topicId: newTopic.id, fulfilled: false }))
      })
    },
    [_setActiveTopic, dispatch]
  )

  useEffect(() => {
    NavigationService.setNavigate(navigate)
  }, [navigate])

  useEffect(() => {
    const stateAssistant = state?.assistant as Assistant | undefined
    if (stateAssistant && getAssistantWorkspace(stateAssistant) === workspace) {
      setActiveAssistant(stateAssistant)
      state?.topic && setActiveTopic(state.topic)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, workspace])

  useEffect(() => {
    const canMinimize = topicPosition == 'left' ? !showAssistants : !showAssistants && !showTopics
    void window.api.window.setMinimumSize(canMinimize ? SECOND_MIN_WINDOW_WIDTH : MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT)

    return () => {
      void window.api.window.resetMinimumSize()
    }
  }, [showAssistants, showTopics, topicPosition])

  return (
    <Container
      id={mode === 'roundtable' ? 'roundtable-page' : 'home-page'}
      className={
        isConversationWorkspace ? 'page-container nav-module-layout chat-layout' : 'page-container nav-module-layout'
      }
      $chat={isConversationWorkspace}>
      {isLeftNavbar && (
        <Navbar
          activeAssistant={activeAssistant}
          activeTopic={activeTopic}
          setActiveTopic={setActiveTopic}
          setActiveAssistant={setActiveAssistant}
          position="left"
          titleKey={mode === 'landing' ? 'title.home' : mode === 'roundtable' ? 'roundtable.title' : 'assistants.title'}
          showTitle={false}
          showAssistantToggle={mode !== 'landing'}
        />
      )}
      <ContentContainer
        id={isLeftNavbar ? 'content-container' : undefined}
        className="nav-module-surface"
        $unified={isConversationWorkspace}>
        <AnimatePresence initial={false}>
          {mode !== 'landing' && showAssistants && (
            <ErrorBoundary>
              <motion.div
                className={isConversationWorkspace ? 'chat-history-panel' : undefined}
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'var(--assistants-width)', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}>
                {/*<HomeTabs
                  activeAssistant={activeAssistant}
                  activeTopic={activeTopic}
                  setActiveAssistant={setActiveAssistant}
                  setActiveTopic={setActiveTopic}
                  position="left"
                />*/}

                <HomePanel
                  workspace={workspace}
                  activeAssistant={activeAssistant}
                  activeTopic={activeTopic}
                  setActiveAssistant={setActiveAssistant}
                  setActiveTopic={setActiveTopic}
                  position="left"
                />
              </motion.div>
            </ErrorBoundary>
          )}
        </AnimatePresence>
        <ErrorBoundary>
          {mode === 'landing' ? (
            <LandingPage assistant={activeAssistant} activeTopic={activeTopic} setActiveTopic={setActiveTopic} />
          ) : mode === 'roundtable' ? (
            <RoundtableChat assistant={activeAssistant} activeTopic={activeTopic} setActiveTopic={setActiveTopic} />
          ) : (
            <Chat
              assistant={activeAssistant}
              activeTopic={activeTopic}
              setActiveTopic={setActiveTopic}
              setActiveAssistant={setActiveAssistant}
            />
          )}
        </ErrorBoundary>
      </ContentContainer>
    </Container>
  )
}

const Container = styled.div<{ $chat: boolean }>`
  display: flex;
  flex: 1;
  flex-direction: column;
  ${({ $chat }) => $chat && '--assistants-width: clamp(200px, 22vw, 230px);'}
  border-top: ${({ $chat }) => ($chat ? '1px solid var(--color-border)' : 'none')};
  [navbar-position='left'] & {
    max-width: calc(100vw - var(--sidebar-width));
  }
  [navbar-position='top'] & {
    max-width: 100vw;
  }
`

const ContentContainer = styled.div<{ $unified: boolean }>`
  display: flex;
  flex: 1;
  flex-direction: row;
  gap: ${({ $unified }) => ($unified ? '0' : '8px')};
  overflow: hidden;

  ${({ $unified }) =>
    $unified &&
    css`
      border: 1px solid var(--color-border);
      border-radius: 12px;
      background: var(--color-background);

      &#content-container {
        border-radius: 12px;
      }

      .chat-history-panel {
        border-right: 1px solid var(--color-border);
      }

      body.light & {
        border-color: rgb(132 172 226 / 16%);
        box-shadow: 0 8px 24px rgb(77 122 190 / 7%);

        .chat-history-panel {
          border-right-color: rgb(132 172 226 / 15%);
        }

        .inputbar-container {
          border: 1px solid rgb(255 255 255 / 76%);
          border-radius: 12px;
          background: rgb(246 249 255 / 88%);
          backdrop-filter: blur(20px);
          box-shadow:
            0 -8px 28px rgb(48 79 133 / 10%),
            0 5px 18px rgb(48 79 133 / 7%),
            inset 0 1px rgb(255 255 255 / 75%);
        }
      }
    `}

  [navbar-position='top'] & {
    max-width: calc(100vw - 12px);
  }
`

export default HomePage
