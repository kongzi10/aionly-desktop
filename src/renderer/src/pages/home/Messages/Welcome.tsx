import chatMascot from '@renderer/assets/images/home/landing/mascot-reference.png'
import roundtableBg from '@renderer/assets/images/home/roundtable-welcome.png'
import React from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { getRoundtableWelcomeKey } from '../../roundtable/roundtableView'

interface Props {
  mode?: 'chat' | 'roundtable'
}

const Welcome: React.FC<Props> = ({ mode = 'chat' }) => {
  const { t } = useTranslation()

  return (
    <Container $roundtable={mode === 'roundtable'}>
      <img className="image-welcome" src={mode === 'roundtable' ? roundtableBg : chatMascot} alt="" />
      <div className="text">{t(mode === 'roundtable' ? getRoundtableWelcomeKey() : 'chat.welcome')}</div>
    </Container>
  )
}

const Container = styled.div<{ $roundtable: boolean }>`
  width: 100%;
  height: calc(100vh - 100px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 20px;

  .image-welcome {
    width: ${({ $roundtable }) => ($roundtable ? '200px' : '112px')};
    height: ${({ $roundtable }) => ($roundtable ? '173px' : '150px')};
    object-fit: contain;
    object-position: center bottom;
  }

  .text {
    text-align: center;
    font-family: ${({ $roundtable }) => ($roundtable ? 'Alimama ShuHeiTi' : 'var(--font-family)')};
    font-weight: 700;
    color: ${({ $roundtable }) => ($roundtable ? 'var(--text-color)' : 'var(--color-text)')};
    font-size: ${({ $roundtable }) => ($roundtable ? '36px' : '28px')};
    letter-spacing: ${({ $roundtable }) => ($roundtable ? '5px' : '0.01em')};
  }

  body.light :is(#home-page, #roundtable-page) & .text {
    color: #10234d;
  }
`

export default Welcome
