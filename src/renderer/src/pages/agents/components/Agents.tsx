import { CloseCircleFilled } from '@ant-design/icons'
import DraggableVirtualList from '@renderer/components/DraggableList/virtual-list'
import { useActiveAgent } from '@renderer/hooks/agents/useActiveAgent'
import { useAgents } from '@renderer/hooks/agents/useAgents'
import { useRuntime } from '@renderer/hooks/useRuntime'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import AgentItem from './AgentItem'

interface AgentsProps {
  onSelectItem?: () => void
}

const Agents = ({ onSelectItem }: AgentsProps) => {
  const { t } = useTranslation()
  const { agents, deleteAgent, isLoading, error, reorderAgents } = useAgents()
  const { chat } = useRuntime()
  const { activeAgentId } = chat
  const { setActiveAgentId } = useActiveAgent()

  const handleAgentPress = useCallback(
    (agentId: string) => {
      void setActiveAgentId(agentId)
      onSelectItem?.()
    },
    [setActiveAgentId, onSelectItem]
  )

  if (isLoading) {
    return <div className="p-5 text-center text-(--color-text-secondary) text-[13px]">{t('common.loading')}</div>
  }

  if (error) {
    return (
      <div className="p-5 text-center text-(--color-error)">
        <CloseCircleFilled style={{ fontSize: 30, color: 'red' }} />
        <div className="text-[13px]">{error.message}</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <DraggableVirtualList
        className="agents-tab flex min-h-0 flex-1 flex-col"
        itemStyle={{ marginBottom: 6 }}
        list={agents ?? []}
        estimateSize={() => 34}
        scrollerStyle={{ overflowX: 'hidden', padding: '2px 2px 6px' }}
        onUpdate={reorderAgents}
        itemKey={(index) => (agents ?? [])[index]?.id ?? index}>
        {(agent) => (
          <AgentItem
            agent={agent}
            isActive={agent.id === activeAgentId}
            onDelete={() => deleteAgent(agent.id)}
            onPress={() => handleAgentPress(agent.id)}
          />
        )}
      </DraggableVirtualList>
    </div>
  )
}

export default memo(Agents)
