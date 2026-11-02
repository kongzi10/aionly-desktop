import type { AgentBaseWithId, ApiModel } from '@renderer/types'
import type { FC } from 'react'

import SelectAgentBaseModelButton from './SelectAgentBaseModelButton'

interface Props {
  /** 当前会话实体，选中模型后同时写回会话与所属智能体 */
  agentBase: AgentBaseWithId
  onSelect: (model: ApiModel) => Promise<void>
}

/**
 * 输入框右下角的模型选择按钮。
 * 视觉规格与对话页的 SelectModelButton 完全一致：15px 胶囊、20px 模型头像、
 * 12px/500 名称、14px 下拉箭头；只是数据源换成了智能体会话。
 */
const AgentModelSelectButton: FC<Props> = ({ agentBase, onSelect }) => {
  return (
    <SelectAgentBaseModelButton
      agentBase={agentBase}
      onSelect={onSelect}
      hideServiceName
      avatarSize={20}
      iconSize={14}
      containerClassName="flex items-center gap-1.5"
      className="agent-model-select"
      buttonStyle={{
        borderRadius: 15,
        padding: '13px 5px',
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--color-text)'
      }}
    />
  )
}

export default AgentModelSelectButton
