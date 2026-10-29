import type { FC, MouseEventHandler } from 'react'
import styled from 'styled-components'

import ToolboxCard from './ToolboxCard'

interface Props {
  icon: React.ReactNode
  tone: 'blue' | 'cyan'
  label: string
  description?: string
  onClick: MouseEventHandler
}

/**
 * 工具箱页固定模块入口卡片(绘画、智能体等),使用与其他入口一致的宽卡尺寸
 */
const ToolboxEntryButton: FC<Props> = ({ icon, tone, label, description, onClick }) => {
  return (
    <ToolboxCard
      icon={<IconContainer $tone={tone}>{icon}</IconContainer>}
      title={label}
      description={description}
      onClick={onClick}
    />
  )
}

const IconContainer = styled.div<{ $tone: Props['tone'] }>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  /* 单色实底：与 Hero 徽标同一套浅色系，不使用任何渐变 */
  background: ${({ $tone }) => ($tone === 'blue' ? 'rgb(228 238 255)' : 'rgb(220 245 247)')};
  color: ${({ $tone }) => ($tone === 'blue' ? 'rgb(64 116 234)' : 'rgb(6 158 176)')};

  body.dark & {
    background: ${({ $tone }) => ($tone === 'blue' ? 'rgb(64 116 234 / 18%)' : 'rgb(6 158 176 / 18%)')};
    color: ${({ $tone }) => ($tone === 'blue' ? 'rgb(140 174 255)' : 'rgb(120 214 226)')};
  }
`

export default ToolboxEntryButton
