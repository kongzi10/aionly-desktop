import roundtableBg from '@renderer/assets/images/home/roundtable-welcome.png'
import bg from '@renderer/assets/images/home/welcome.png'
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
      <img className="image-welcome" src={mode === 'roundtable' ? roundtableBg : bg} alt="" />
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
    width: ${({ $roundtable }) => ($roundtable ? '200px' : '130px')};
    height: 173px;
    object-fit: contain;
    object-position: center bottom;
  }

  .text {
    text-align: center;
    font-family: Alimama ShuHeiTi;
    font-weight: 700;
    color: var(--text-color);
    font-size: 36px;
    letter-spacing: 5px;
  }
`

export default Welcome
