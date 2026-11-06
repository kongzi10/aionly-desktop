import mascot from '@renderer/assets/images/home/landing/mascot-reference.png'
import { X } from 'lucide-react'
import type { FC } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled, { keyframes } from 'styled-components'

import { type HomeContentAction, type HomePushItem, resolveHomeContentAction } from './homeContent'
import {
  PushActionButton,
  PushCardBase,
  PushCardFoot,
  PushCloseButton,
  PushDots,
  PushSlide,
  PushViewport,
  usePushCarousel
} from './homePushCard'

interface Props {
  items: HomePushItem[]
  onAction: (action: HomeContentAction, item: HomePushItem) => void
}

// 会话级关闭标记：模块作用域变量存活于渲染进程本次运行期间，
// 关闭后切换路由重挂载不再弹出，客户端重启（模块重新求值）后自动恢复弹出
let cartoonPushDismissed = false

export const dismissCartoonPush = () => {
  cartoonPushDismissed = true
}

export const isCartoonPushDismissed = () => cartoonPushDismissed

export const resetCartoonPushDismissed = () => {
  cartoonPushDismissed = false
}

const HomeMascot: FC<Props> = ({ items, onAction }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const count = items.length
  const itemsKey = useMemo(() => items.map((item) => item.id).join('|'), [items])
  const { index, setIndex, pausedRef } = usePushCarousel(count)

  // 推送列表变化（后台新发布/下线）时回到第一条；本次会话内已关闭则不再重新弹出
  useEffect(() => {
    setOpen(count > 0 && !isCartoonPushDismissed())
    setIndex(0)
  }, [itemsKey, count, setIndex])

  const current = count ? items[index % count] : null
  const action = resolveHomeContentAction(current?.buttonUrl)

  return (
    <Container>
      <Glow aria-hidden="true" />
      <FloatWrap>
        <img className="mascot" src={mascot} alt="AiOnly" />
      </FloatWrap>
      {open && current && (
        <PromotionCard
          aria-roledescription="carousel"
          onMouseEnter={() => {
            pausedRef.current = true
          }}
          onMouseLeave={() => {
            pausedRef.current = false
          }}>
          <PushCloseButton
            type="button"
            aria-label={t('homeLanding.closeCartoonPush')}
            onClick={() => {
              dismissCartoonPush()
              setOpen(false)
            }}>
            <X size={14} />
          </PushCloseButton>
          <PushViewport>
            {items.map((item, i) => (
              <PushSlide key={item.id} $active={i === index % count} aria-hidden={i !== index % count}>
                <strong>{item.title}</strong>
                {item.description && <p>{item.description}</p>}
              </PushSlide>
            ))}
          </PushViewport>
          <PushCardFoot>
            <PushDots>
              {count > 1 &&
                items.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    className={i === index % count ? 'active' : ''}
                    aria-label={item.title}
                    onClick={() => setIndex(i)}
                  />
                ))}
            </PushDots>
            {current.buttonText && action && (
              <PushActionButton type="button" onClick={() => onAction(action, current)}>
                <span className="text-container">
                  <span className="text">{current.buttonText}</span>
                </span>
              </PushActionButton>
            )}
          </PushCardFoot>
        </PromotionCard>
      )}
    </Container>
  )
}

const Container = styled.div`
  position: relative;
  width: clamp(88px, 10vw, 155px);
  flex-shrink: 0;
`

const floatY = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
`

const glowPulse = keyframes`
  0%, 100% { opacity: 0.75; }
  50% { opacity: 1; }
`

const FloatWrap = styled.div`
  animation: ${floatY} 4.2s ease-in-out infinite;

  .mascot {
    display: block;
    width: 100%;
    height: auto;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Glow = styled.span`
  position: absolute;
  z-index: -1;
  left: 50%;
  bottom: -7%;
  width: 130%;
  height: 28%;
  background: radial-gradient(50% 50% at 50% 50%, rgb(64 150 255 / 40%), rgb(64 150 255 / 0) 72%);
  filter: blur(5px);
  transform: translateX(-50%);
  animation: ${glowPulse} 4.2s ease-in-out infinite;
  pointer-events: none;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

// 思考框：基础样式见 PushCardBase，此处负责定位与气泡尾巴
const PromotionCard = styled(PushCardBase)`
  /* 窄屏右缘锚定向左展开防裁切；宽屏(>=1000px)按设计稿居右摆放到头部右上；宽度/内边距随视口 clamp 缩放 */
  position: absolute;
  z-index: 4;
  right: -10%;
  bottom: 96%;
  width: clamp(150px, 16vw, 260px);
  padding: clamp(8px, 0.9vw, 12px) clamp(10px, 1.1vw, 14px) clamp(7px, 0.85vw, 11px);
  pointer-events: auto;

  /* 气泡尾巴：位于气泡右下指向吉祥物头部，背景/描边继承卡片以自动适配主题 */
  &::after {
    content: '';
    position: absolute;
    left: auto;
    right: 22px;
    bottom: -6px;
    width: 12px;
    height: 12px;
    background: inherit;
    border-right: 1px solid;
    border-bottom: 1px solid;
    border-color: inherit;
    transform: rotate(45deg);
  }

  @media (max-width: 700px) {
    right: -12px;
    bottom: 82%;
  }

  /* 宽屏按设计稿居右：左缘锚定头部右侧、气泡向右展开，尾巴回到左下指向头部 */
  @media (min-width: 1000px) {
    left: 40%;
    right: auto;

    &::after {
      left: 26px;
      right: auto;
    }
  }
`

export default HomeMascot
