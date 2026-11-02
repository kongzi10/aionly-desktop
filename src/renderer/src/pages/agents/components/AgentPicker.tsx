import AgentModalPopup from '@renderer/components/Popups/agent/AgentModal'
import { useActiveAgent } from '@renderer/hooks/agents/useActiveAgent'
import { useAgents } from '@renderer/hooks/agents/useAgents'
import { useApiServer } from '@renderer/hooks/useApiServer'
import { useRuntime } from '@renderer/hooks/useRuntime'
import AgentSettingsPopup from '@renderer/pages/settings/AgentSettings/AgentSettingsPopup'
import { AgentLabel } from '@renderer/pages/settings/AgentSettings/shared'
import type { AgentEntity } from '@renderer/types'
import { Popover } from 'antd'
import { ChevronDown, Pencil, Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import Agents from './Agents'

/** 下拉里智能体列表的固定高度：DraggableVirtualList 需要确定的父高度才能测量行高 */
const AGENT_LIST_HEIGHT = 260

/**
 * 智能体选择器。
 * 结构与对话页侧栏的角色选择器（HomePanel/RolePicker）保持一致：
 * 收起时只显示当前智能体，展开后是智能体列表 + 新建/编辑操作。
 */
const AgentPicker = () => {
  const { t } = useTranslation()
  const { agents } = useAgents()
  const { apiServerRunning, startApiServer } = useApiServer()
  const { chat } = useRuntime()
  const { activeAgentId } = chat
  const { setActiveAgentId } = useActiveAgent()
  const [open, setOpen] = useState(false)

  const activeAgent = useMemo(() => agents?.find((agent) => agent.id === activeAgentId), [agents, activeAgentId])

  const handleCreate = useCallback(() => {
    setOpen(false)
    void (!apiServerRunning && startApiServer())
    void AgentModalPopup.show({
      afterSubmit: (agent: AgentEntity) => {
        void setActiveAgentId(agent.id)
      }
    })
  }, [apiServerRunning, setActiveAgentId, startApiServer])

  const handleEdit = useCallback(() => {
    setOpen(false)
    if (activeAgent) {
      void AgentSettingsPopup.show({ agentId: activeAgent.id })
    }
  }, [activeAgent])

  return (
    <Picker>
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger="click"
        placement="bottomLeft"
        arrow={false}
        content={
          <PopoverContent>
            <div className="menu-title">{t('agent.sidebar_title')}</div>
            <div className="agent-list" style={{ height: AGENT_LIST_HEIGHT }}>
              <Agents onSelectItem={() => setOpen(false)} />
            </div>
            <div className="actions">
              <button type="button" onClick={handleCreate}>
                <Plus size={13} />
                {t('agent.sidebar_agent.add')}
              </button>
              <button type="button" onClick={handleEdit} disabled={!activeAgent}>
                <Pencil size={13} />
                {t('common.edit')}
              </button>
            </div>
          </PopoverContent>
        }>
        <button className="agent-selector" type="button" aria-expanded={open}>
          {activeAgent ? (
            <AgentLabel
              agent={activeAgent}
              classNames={{ container: 'min-w-0 flex-1', name: 'text-[13px] font-semibold' }}
            />
          ) : (
            <span className="placeholder">{t('agent.sidebar_title')}</span>
          )}
          <ChevronDown size={16} className="chevron" />
        </button>
      </Popover>
    </Picker>
  )
}

const Picker = styled.div`
  flex-shrink: 0;
  padding: 8px 10px 2px;

  .agent-selector {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    min-height: 42px;
    padding: 6px 8px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    text-align: left;

    .placeholder {
      flex: 1;
      overflow: hidden;
      color: var(--color-text-3);
      font-size: 13px;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chevron {
      flex-shrink: 0;
      color: var(--color-text-3);
      transition: transform 0.2s ease;
    }

    &:hover {
      background: var(--color-background-soft);
    }

    &:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    &[aria-expanded='true'] > svg:last-child {
      transform: rotate(180deg);
    }
  }

  body.light & .agent-selector:hover,
  body.light & .agent-selector[aria-expanded='true'] {
    background: rgb(229 239 255 / 75%);
  }
`

const PopoverContent = styled.div`
  width: 218px;

  .menu-title {
    padding: 0 10px 8px;
    color: var(--color-text-secondary);
    font-size: 12px;
  }

  .agent-list {
    overflow: hidden;
  }

  .actions {
    display: flex;
    justify-content: space-between;
    gap: 4px;
    padding: 8px 4px 0;
    border-top: 1px solid var(--color-border);

    button {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 5px 8px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--color-primary);
      cursor: pointer;
      font-size: 12px;

      &:hover:not(:disabled) {
        background: var(--color-primary-plain);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }
`

export default AgentPicker
