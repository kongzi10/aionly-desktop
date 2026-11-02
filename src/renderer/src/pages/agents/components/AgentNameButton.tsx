import AgentSettingsPopup from '@renderer/pages/settings/AgentSettings/AgentSettingsPopup'
import { AgentLabel } from '@renderer/pages/settings/AgentSettings/shared'
import type { AgentEntity } from '@renderer/types'
import { Tooltip } from 'antd'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  agent: AgentEntity
}

/**
 * 输入框左下角的智能体按钮。
 * 点击打开智能体设置弹窗，取代原先位于输入框上方顶栏的智能体名称。
 */
const AgentNameButton: FC<Props> = ({ agent }) => {
  const { t } = useTranslation()

  return (
    <Tooltip title={t('agent.edit.title')} mouseEnterDelay={0.8}>
      <NameButton type="button" onClick={() => void AgentSettingsPopup.show({ agentId: agent.id })}>
        <AgentLabel
          agent={agent}
          hideIcon={false}
          classNames={{
            container: 'min-w-0 gap-1.5',
            avatar: 'shrink-0',
            name: 'text-(--color-text) text-xs font-medium'
          }}
        />
      </NameButton>
    </Tooltip>
  )
}

const NameButton = styled.button`
  display: flex;
  align-items: center;
  max-width: 140px;
  height: 30px;
  padding: 0 7px;
  border: 0;
  border-radius: var(--base-border-radius);
  background: transparent;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: var(--color-gray-5);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }
`

export default AgentNameButton
