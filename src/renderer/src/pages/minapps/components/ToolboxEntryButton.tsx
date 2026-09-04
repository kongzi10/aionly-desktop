import type { FC, MouseEventHandler } from 'react'
import styled from 'styled-components'

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
  return (
    <Container onClick={onClick}>
      <IconContainer $tone={tone}>{icon}</IconContainer>
      <AppTitle>{label}</AppTitle>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  overflow: hidden;
  min-height: 85px;
`

const IconContainer = styled.div<{ $tone: Props['tone'] }>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 60px;
  height: 60px;
  border-radius: 15px;
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
    border-radius: 14px;
    border-top: 1px solid #ffffff55;
    pointer-events: none;
  }
`

const AppTitle = styled.div`
  font-size: 12px;
  margin-top: 5px;
  color: var(--color-text-soft);
  text-align: center;
  user-select: none;
  width: 100%;
  line-height: 1.3;
  word-break: break-word;
  overflow-wrap: break-word;
`

export default ToolboxEntryButton
