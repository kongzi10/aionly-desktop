import { Spin } from 'antd'
import type { FC, MouseEventHandler, ReactNode } from 'react'
import styled from 'styled-components'

interface Props {
  icon: ReactNode
  title: string
  onClick?: MouseEventHandler<HTMLButtonElement>
  busy?: boolean
}

const ToolboxCard: FC<Props> = ({ icon, title, onClick, busy = false }) => {
  return (
    <Container type="button" onClick={onClick} disabled={busy} aria-busy={busy} aria-label={title}>
      <IconContainer>
        {icon}
        {busy ? (
          <SpinOverlay>
            <Spin size="small" />
          </SpinOverlay>
        ) : null}
      </IconContainer>
      <Title title={title}>{title}</Title>
    </Container>
  )
}

const Container = styled.button`
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  min-height: 80px;
  padding: 12px 14px;
  gap: 13px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: var(--color-background-soft);
  color: var(--color-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;

  &:hover:not(:disabled) {
    border-color: var(--color-primary-mute);
    background: var(--color-background-mute);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  &:disabled {
    cursor: wait;
    opacity: 0.72;
  }
`

const IconContainer = styled.span`
  position: relative;
  display: flex;
  flex: 0 0 56px;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  overflow: hidden;

  img {
    width: 56px;
    height: 56px;
    object-fit: contain;
    border-radius: inherit;
  }
`

const SpinOverlay = styled.span`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-background-mute);
`

const Title = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--color-text);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export default ToolboxCard
