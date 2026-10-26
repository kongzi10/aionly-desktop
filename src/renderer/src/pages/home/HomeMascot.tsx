import mascot from '@renderer/assets/images/home/landing/mascot-reference.png'
import type { FC } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { HomeContentAction, HomeContentItem } from './homeContent'

interface Props {
  promotion: HomeContentItem | null
  onAction: (action: HomeContentAction) => void
  autoOpen?: boolean
}

const HomeMascot: FC<Props> = ({ promotion, onAction, autoOpen = false }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(autoOpen && promotion !== null)

  return (
    <Container onMouseLeave={autoOpen ? undefined : () => setOpen(false)}>
      <img className="mascot" src={mascot} alt="AiOnly" />
      {promotion && (
        <>
          <PromotionTrigger
            type="button"
            aria-label={promotion.title}
            onMouseEnter={autoOpen ? undefined : () => setOpen(true)}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen((current) => !current)}>
            {promotion.imageUrl ? <img src={promotion.imageUrl} alt="" /> : <span>✦</span>}
          </PromotionTrigger>
          {open && (
            <PromotionCard>
              <strong>{promotion.title}</strong>
              {promotion.description && <p>{promotion.description}</p>}
              {promotion.action && (
                <button
                  type="button"
                  aria-label={`${promotion.title} ${t('homeLanding.promotionAction')}`}
                  onClick={() => onAction(promotion.action!)}>
                  {t('homeLanding.viewPromotion')}
                </button>
              )}
            </PromotionCard>
          )}
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

const PromotionTrigger = styled.button`
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
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 9px;
  }
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

  button {
    border: 0;
    border-radius: 6px;
    padding: 6px 12px;
    background: var(--color-primary);
    color: white;
    cursor: pointer;
  }
`

export default HomeMascot
