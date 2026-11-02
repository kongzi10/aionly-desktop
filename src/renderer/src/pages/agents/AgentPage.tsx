import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { useActiveAgent } from '@renderer/hooks/agents/useActiveAgent'
import { useAgents } from '@renderer/hooks/agents/useAgents'
import { useApiServer } from '@renderer/hooks/useApiServer'
import { useRuntime } from '@renderer/hooks/useRuntime'
import { useNavbarPosition, useSettings } from '@renderer/hooks/useSettings'
import { useShortcut } from '@renderer/hooks/useShortcuts'
import { useShowTopics } from '@renderer/hooks/useStore'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import { cn } from '@renderer/utils'
import { MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH, SECOND_MIN_WINDOW_WIDTH } from '@shared/config/constant'
import { AnimatePresence, motion } from 'motion/react'
import type { PropsWithChildren } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import AgentChat from './AgentChat'
import AgentNavbar from './AgentNavbar'
import AgentSidePanel from './AgentSidePanel'
import { AgentEmpty, AgentServerDisabled, AgentServerStopped } from './components/status'

const AgentPage = () => {
  const { isLeftNavbar } = useNavbarPosition()
  const [showAgentSidebar, setShowAgentSidebar] = useState(true)
  const { showTopics, toggleShowTopics } = useShowTopics()
  const { topicPosition } = useSettings()
  const { chat } = useRuntime()
  const { activeAgentId } = chat
  const { agents } = useAgents()
  const { setActiveAgentId } = useActiveAgent()
  const { apiServerConfig, apiServerRunning, apiServerLoading } = useApiServer()
  const { t } = useTranslation()

  const toggleAgentSidebar = useCallback(() => {
    setShowAgentSidebar((visible) => !visible)
  }, [])

  useShortcut('toggle_show_assistants', toggleAgentSidebar)

  useShortcut('toggle_show_topics', () => {
    if (topicPosition === 'right') {
      toggleShowTopics()
    } else {
      void EventEmitter.emit(EVENT_NAMES.SHOW_TOPIC_SIDEBAR)
    }
  })

  // Auto-select first agent when none is active
  useEffect(() => {
    if (!activeAgentId && agents && agents.length > 0) {
      void setActiveAgentId(agents[0].id)
    }
  }, [activeAgentId, agents, setActiveAgentId])

  useEffect(() => {
    const canMinimize = topicPosition === 'left' ? !showAgentSidebar : !showAgentSidebar && !showTopics
    void window.api.window.setMinimumSize(canMinimize ? SECOND_MIN_WINDOW_WIDTH : MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT)
    return () => {
      void window.api.window.resetMinimumSize()
    }
  }, [showAgentSidebar, showTopics, topicPosition])

  if (!apiServerConfig.enabled) {
    return (
      <Container>
        <Navbar>
          <NavbarCenter style={{ borderRight: 'none' }}>{t('common.agent_one')}</NavbarCenter>
        </Navbar>
        <AgentServerDisabled />
      </Container>
    )
  }

  if (!apiServerLoading && !apiServerRunning) {
    return (
      <Container>
        <Navbar>
          <NavbarCenter style={{ borderRight: 'none' }}>{t('common.agent_one')}</NavbarCenter>
        </Navbar>
        <AgentServerStopped />
      </Container>
    )
  }

  if (agents && agents.length === 0) {
    return (
      <Container>
        <Navbar>
          <NavbarCenter style={{ borderRight: 'none' }}>{t('common.agent_one')}</NavbarCenter>
        </Navbar>
        <AgentEmpty />
      </Container>
    )
  }

  return (
    <Container>
      <AgentNavbar showSidebar={showAgentSidebar} toggleSidebar={toggleAgentSidebar} />
      <ContentContainer id={isLeftNavbar ? 'content-container' : undefined} className="nav-module-surface">
        <AnimatePresence initial={false}>
          {showAgentSidebar && (
            <ErrorBoundary>
              <motion.div
                className="agent-history-panel"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'var(--assistants-width)', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}>
                <AgentSidePanel />
              </motion.div>
            </ErrorBoundary>
          )}
        </AnimatePresence>
        <ErrorBoundary>
          <AgentChat />
        </ErrorBoundary>
      </ContentContainer>
    </Container>
  )
}

const Container = ({ children, className }: PropsWithChildren<{ className?: string }>) => {
  return (
    <div
      id="agent-page"
      className={cn('page-container nav-module-layout flex flex-1 flex-col overflow-hidden', className)}
      style={{ '--assistants-width': 'clamp(200px, 22vw, 230px)' } as React.CSSProperties}>
      {children}
    </div>
  )
}

/**
 * 与对话页 ContentContainer 一致的统一外壳：
 * 侧栏靠一条 1px 分割线与内容区分开，输入框在浅色主题下玻璃化，不再嵌套第二层圆角面板。
 */
const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  min-width: 0;
  gap: 0;
  overflow: hidden;

  .agent-history-panel {
    border-right: 1px solid var(--color-border);
  }

  body.light & .agent-history-panel {
    border-right-color: rgb(132 172 226 / 15%);
  }

  body.light & .inputbar-container {
    border: 1px solid rgb(255 255 255 / 76%);
    border-radius: 12px;
    background: rgb(246 249 255 / 88%);
    backdrop-filter: blur(20px);
    box-shadow:
      0 -8px 28px rgb(48 79 133 / 10%),
      0 5px 18px rgb(48 79 133 / 7%),
      inset 0 1px rgb(255 255 255 / 75%);
  }
`

export default AgentPage
