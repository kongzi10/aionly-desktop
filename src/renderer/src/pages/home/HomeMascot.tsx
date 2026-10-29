import mascot from '@renderer/assets/images/home/landing/mascot-reference.png'
import { X } from 'lucide-react'
import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { type HomeContentAction, type HomePushItem, resolveHomeContentAction } from './homeContent'

interface Props {
  promotion: HomePushItem | null
  onAction: (action: HomeContentAction) => void
}

const HomeMascot: FC<Props> = ({ promotion, onAction }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const promotionId = promotion?.id

  useEffect(() => setOpen(Boolean(promotionId)), [promotionId])

  const action = resolveHomeContentAction(promotion?.buttonUrl)

  return (
    <Container>
      <img className="mascot" src={mascot} alt="AiOnly" />
      {promotion && open && (
        <>
          <PromotionDecoration aria-hidden="true">✦</PromotionDecoration>
          <PromotionCard>
            <CloseButton type="button" aria-label={t('homeLanding.closeCartoonPush')} onClick={() => setOpen(false)}>
              <X size={14} />
            </CloseButton>
            <strong>{promotion.title}</strong>
            {promotion.description && <p>{promotion.description}</p>}
            {promotion.buttonText && action && (
              <ActionButton type="button" onClick={() => onAction(action)}>
                {promotion.buttonText}
              </ActionButton>
            )}
          </PromotionCard>
        </>
      )}
    </Container>
  )
}

const Container = styled.div`
  position: relative;
  width: clamp(88px, 10vw, 155px);
  flex-shrink: 0;

  .mascot {
    display: block;
    width: 100%;
    height: auto;
  }
`

const PromotionDecoration = styled.span`
  position: absolute;
  top: 10%;
  right: -58px;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 2px solid white;
  border-radius: 12px;
  background: linear-gradient(135deg, #59b9ff, #1776ee);
  color: white;
  box-shadow: 0 8px 24px #2589ed40;
`

const PromotionCard = styled.div`
  position: absolute;
  z-index: 4;
  top: -135px;
  right: -134px;
  width: clamp(185px, 19vw, 290px);
  padding: 14px;
  border: 1px solid rgb(255 255 255 / 75%);
  border-radius: 12px;
  background: rgb(235 245 255 / 94%);
  box-shadow: 0 12px 32px #17233b26;
  color: #152b54;
  font-size: 12px;

  p {
    margin: 8px 0;
    color: #667b9d;
    line-height: 1.5;
  }
`

const CloseButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #7d8496;
  cursor: pointer;
`

const ActionButton = styled.button`
  border: 0;
  border-radius: 6px;
  padding: 6px 12px;
  background: var(--color-primary);
  color: white;
  cursor: pointer;
`

export default HomeMascot
