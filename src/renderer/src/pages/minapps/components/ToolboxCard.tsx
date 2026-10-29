import { Spin } from 'antd'
import { ChevronRight } from 'lucide-react'
import type { FC, MouseEventHandler, ReactNode } from 'react'
import styled from 'styled-components'

interface Props {
  icon: ReactNode
  title: string
  /** 常驻在标题下方的补充说明，缺省时只显示标题 */
  description?: string
  onClick?: MouseEventHandler<HTMLButtonElement>
  busy?: boolean
}

/**
 * 工具箱页统一的入口卡片（内置工具、扩展应用、小程序共用同一尺寸）：
 * 左侧 56px 图标槽 + 标题/描述 + 右侧引导箭头，最小高度 104px。
 */
const ToolboxCard: FC<Props> = ({ icon, title, description, onClick, busy = false }) => {
  return (
    <Container type="button" onClick={onClick} disabled={busy} aria-busy={busy} aria-label={title}>
      <IconSlot>
        {icon}
        {busy ? (
          <SpinOverlay>
            <Spin size="small" />
          </SpinOverlay>
        ) : null}
      </IconSlot>
      <TextGroup>
        <Title title={title}>{title}</Title>
        {description ? <Description title={description}>{description}</Description> : null}
      </TextGroup>
      <Chevron aria-hidden="true">
        <ChevronRight size={15} strokeWidth={2.4} />
      </Chevron>
    </Container>
  )
}

const Container = styled.button`
  position: relative;
  display: flex;
  box-sizing: border-box;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-width: 0;
  min-height: 104px;
  padding: 16px 18px;
  overflow: hidden;
  border: 1px solid var(--color-border-soft);
  border-radius: 14px;
  background: var(--color-background-soft);
  color: var(--color-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;

  body.light & {
    border-color: rgb(132 172 226 / 16%);
    background: rgb(248 251 255 / 76%);
    box-shadow: 0 8px 20px rgb(77 122 190 / 5%);
  }

  /* 悬停只做位移与投影加深，不改变任何颜色 */
  &:hover:not(:disabled),
  &:focus-visible {
    transform: translateY(-3px);
  }

  body.light &:hover:not(:disabled),
  body.light &:focus-visible {
    box-shadow: 0 16px 34px rgb(77 122 190 / 15%);
  }

  &:active:not(:disabled) {
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  &:disabled {
    cursor: wait;
    opacity: 0.75;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &:hover:not(:disabled),
    &:active:not(:disabled) {
      transform: none;
    }
  }
`

const IconSlot = styled.span`
  position: relative;
  display: flex;
  flex: 0 0 56px;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  overflow: hidden;
  border-radius: 16px;
  transition: transform 0.2s ease;

  img {
    width: 100%;
    height: 100%;
    border-radius: inherit;
    object-fit: contain;
  }

  ${Container}:hover:not(:disabled) & {
    transform: scale(1.06);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    ${Container}:hover:not(:disabled) & {
      transform: none;
    }
  }
`

const TextGroup = styled.span`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`

const Title = styled.span`
  overflow: hidden;
  color: var(--color-text);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const Description = styled.span`
  display: -webkit-box;
  overflow: hidden;
  color: var(--color-text-3);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
`

const Chevron = styled.span`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid rgb(90 143 215 / 18%);
  border-radius: 50%;
  color: var(--color-text-3);
  transition: transform 0.2s ease;

  ${Container}:hover:not(:disabled) & {
    transform: translateX(2px);
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

export default ToolboxCard
