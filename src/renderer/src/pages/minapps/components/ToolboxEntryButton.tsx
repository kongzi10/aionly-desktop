import type { FC, MouseEventHandler } from 'react'
import styled from 'styled-components'

import ToolboxCard from './ToolboxCard'

interface Props {
  icon: React.ReactNode
  tone: 'blue' | 'cyan'
  label: string
  onClick: MouseEventHandler
}

/**
 * 工具箱页固定模块入口卡片(绘画、翻译等),样式与小程序卡片对齐
 */
const ToolboxEntryButton: FC<Props> = ({ icon, tone, label, onClick }) => {
  return <ToolboxCard icon={<IconContainer $tone={tone}>{icon}</IconContainer>} title={label} onClick={onClick} />
}

const IconContainer = styled.div<{ $tone: Props['tone'] }>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  position: relative;
  background: ${({ $tone }) =>
    $tone === 'blue'
      ? 'linear-gradient(145deg, #7374ff, #3267ef 65%, #269cee)'
      : 'linear-gradient(145deg, #28d6cc, #04a9bd 65%, #0996cb)'};
  color: #fff;
  box-shadow: 0 5px 12px ${({ $tone }) => ($tone === 'blue' ? '#3c74ea24' : '#08a8bf24')};

  &::after {
    content: '';
    position: absolute;
    inset: 1px;
    border-radius: 13px;
    border-top: 1px solid #ffffff55;
    pointer-events: none;
  }
`

export default ToolboxEntryButton
