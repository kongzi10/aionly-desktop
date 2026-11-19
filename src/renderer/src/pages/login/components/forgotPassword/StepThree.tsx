import successImage from '@renderer/assets/images/login/success.png'
import { Button } from 'antd'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { LoginSceneType, useLoginContext } from '../../contexts/LoginContext'

const StepThree: React.FC = () => {
  const { t } = useTranslation()
  const { setScene } = useLoginContext()
  const [countDown, setCountDown] = useState(6)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const disCountDown = useCallback(() => {
    if (countDown > 0) {
      timer.current = setTimeout(() => {
        setCountDown(countDown - 1)
      }, 1000)
    } else {
      setScene(LoginSceneType.MainAccount)
    }

    return () => {
      if (timer.current) {
        clearTimeout(timer.current)
      }
    }
  }, [countDown, setScene])

  useEffect(() => {
    disCountDown()
    return () => {
      if (timer.current) {
        clearTimeout(timer.current)
      }
    }
  }, [disCountDown])

  const handleNext = () => {
    setScene(LoginSceneType.MainAccount)
  }

  return (
    <Container>
      <Result>
        <img className="result-img" src={successImage} alt="success" />
        <div className="font-medium text-[16px]">{t('login.forgot_password.stepThree.successful')}</div>
      </Result>
      <LoginButton type="primary" block onClick={handleNext}>
        {t('login.back_login')}
      </LoginButton>
      <div className="tips">
        <span className="count">{countDown}</span>
        {t('login.forgot_password.stepThree.auto_back_text')}
      </div>
    </Container>
  )
}

export default StepThree

const Container = styled.div`
  background: #fff;
  padding-top: 12px;

  .ant-form-item {
    margin-bottom: 10px;
  }

  .ant-form-item-vertical {
    .ant-form-item-label {
      padding: 0;
    }
  }

  .tips{
    text-align: center;
    font-family: 'Alibaba PuHuiTi 3';
    color: var(--color-text-3);
    font-size: 12px;
    margin-top: 15px;
    .count{
      color: var(--color-primary);
    }
  }
`

const LoginButton = styled(Button)`
  width: 100%;
  height: 46px;
  background: rgba(6, 10, 38, 1);
  border-radius: 8px;
  margin-top: 50px;
  letter-spacing: 2px;

  &:not(:disabled):hover {
    background: rgba(6, 10, 38, 0.8) !important;
  }
`

const Result = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  .result-img{
    width: 120px;
    height: 120px;
    margin-bottom: 20px;
  }
`
