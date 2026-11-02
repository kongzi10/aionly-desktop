import { useCreateDefaultSession } from '@renderer/hooks/agents/useCreateDefaultSession'
import { useRuntime } from '@renderer/hooks/useRuntime'
import { Plus } from 'lucide-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import AgentPicker from './components/AgentPicker'
import Sessions from './components/Sessions'

interface AgentSidePanelProps {
  onSelectItem?: () => void
}

/**
 * 智能体侧栏。
 * 结构与对话页侧栏（HomePanel merged 形态）保持一致：
 * 顶部智能体选择器 → 新建会话 → 会话列表占满剩余高度。
 */
const AgentSidePanel: FC<AgentSidePanelProps> = ({ onSelectItem }) => {
  const { t } = useTranslation()
  const { chat } = useRuntime()
  const { activeAgentId } = chat
  const { createDefaultSession, creatingSession } = useCreateDefaultSession(activeAgentId ?? null)

  return (
    <Container className="agent-side-panel">
      <AgentPicker />

      <SidebarActions>
        <button
          className="new-session"
          type="button"
          disabled={!activeAgentId || creatingSession}
          onClick={() => void createDefaultSession()}>
          <Plus size={16} />
          <span>{t('agent.session.add.title')}</span>
        </button>
      </SidebarActions>

      <SectionHeader>
        <span className="title">{t('common.sessions')}</span>
      </SectionHeader>

      <SessionList>
        {activeAgentId ? (
          <Sessions agentId={activeAgentId} onSelectItem={onSelectItem} />
        ) : (
          <div className="empty">{t('chat.alerts.select_agent')}</div>
        )}
      </SessionList>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  overflow: hidden;
`

const SidebarActions = styled.div`
  display: flex;
  flex-shrink: 0;
  gap: 4px;
  padding: 2px 10px 5px;

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 34px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--color-text-1);
    cursor: pointer;

    &:hover:not(:disabled) {
      background: var(--color-background-soft);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: -2px;
    }
  }

  .new-session {
    flex: 1;
    justify-content: flex-start;
    gap: 9px;
    padding: 0 10px;
    font-size: 13px;
    font-weight: 500;
  }
`

const SectionHeader = styled.div`
  flex-shrink: 0;
  padding: 7px 14px 4px;

  .title {
    color: var(--color-text-3);
    font-size: 12px;
    font-weight: 500;
  }
`

const SessionList = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;

  .empty {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    padding: 20px;
    color: var(--color-text-secondary);
    font-size: 13px;
  }
`

export default AgentSidePanel
