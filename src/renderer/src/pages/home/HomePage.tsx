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
import styled from 'styled-components'

import RoundtableChat from '../roundtable/RoundtableChat'
import { filterAssistantsByWorkspace, getAssistantWorkspace } from '../roundtable/roundtableWorkspace'
import Chat from './Chat'
import Navbar from './Navbar'
// import HomeTabs from './Tabs'
import HomePanel from './Panel'

const activeAssistants: Partial<Record<AssistantWorkspace, Assistant>> = {}

interface Props {
  mode?: 'chat' | 'roundtable'
}

const HomePage: FC<Props> = ({ mode = 'chat' }) => {
  const workspace: AssistantWorkspace = mode
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
    return activeAssistants[workspace] || workspaceAssistants[0] || workspaceDefault
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
    <Container id={mode === 'roundtable' ? 'roundtable-page' : 'home-page'} className="page-container">
      {isLeftNavbar && (
        <Navbar
          activeAssistant={activeAssistant}
          activeTopic={activeTopic}
          setActiveTopic={setActiveTopic}
          setActiveAssistant={setActiveAssistant}
          position="left"
          titleKey={mode === 'roundtable' ? 'roundtable.title' : 'assistants.title'}
        />
      )}
      <ContentContainer id={isLeftNavbar ? 'content-container' : undefined}>
        <AnimatePresence initial={false}>
          {showAssistants && (
            <ErrorBoundary>
              <motion.div
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
          {mode === 'roundtable' ? (
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

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  [navbar-position='left'] & {
    max-width: calc(100vw - var(--sidebar-width));
  }
  [navbar-position='top'] & {
    max-width: 100vw;
  }
`

const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  gap: 8px;
  overflow: hidden;

  [navbar-position='top'] & {
    max-width: calc(100vw - 12px);
  }
`

export default HomePage
