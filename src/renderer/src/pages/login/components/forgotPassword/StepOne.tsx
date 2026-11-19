import Verify from '@renderer/components/verifition/Verify'
import i18n from '@renderer/i18n'
import type { TabsProps } from 'antd'
import { Tabs } from 'antd'
import React, { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { EmailFormRef } from './EmailForm'
import EmailForm from './EmailForm'
import type { PhoneFormRef } from './PhoneForm'
import PhoneForm from './PhoneForm'

interface Props {
  changeStep?: (step: number, data?: any) => void
}

const StepOne: React.FC<Props> = ({ changeStep }) => {
  const { t } = useTranslation()

  const verifyRef = useRef<any>(null)
  const [activeTabKey, setActiveTabKey] = useState('sms')

  const phoneFormRef = useRef<PhoneFormRef | null>(null)
  const emailFormRef = useRef<EmailFormRef | null>(null)

  const tabs: TabsProps['items'] = [
    {
      key: 'sms',
      label: t('login.forgot_password.phone.title'),
      children: <PhoneForm ref={phoneFormRef} changeStep={changeStep} verifyRef={verifyRef} />
    },
    {
      key: 'email',
      label: t('login.forgot_password.email.title'),
      children: <EmailForm ref={emailFormRef} changeStep={changeStep} verifyRef={verifyRef} />
    }
  ]

  const changeTabKey = useCallback((key: string) => {
    setActiveTabKey(key)
  }, [])

  const verifyOnSuccess = useCallback(
    (params: any) => {
      const map: any = {
        sms: phoneFormRef.current,
        email: emailFormRef.current
      }
      map[activeTabKey]?.sendCode(params)
      verifyRef.current?.closeBox()
    },
    [activeTabKey]
  )

  return (
    <>
      <Container>
        <LoginTitle>{i18n.t('login.forgot_password.stepOne.title')}</LoginTitle>
        <SubTitle>{i18n.t('login.forgot_password.sub_title')}</SubTitle>
        <Tabs activeKey={activeTabKey} items={tabs} onChange={changeTabKey} />
      </Container>

      <Verify
        ref={verifyRef}
        captchaType={'blockPuzzle'}
        mode={'pop'}
        imgSize={{ width: '400px', height: '200px' }}
        onSuccess={verifyOnSuccess}
      />
    </>
  )
}

export default StepOne

const Container = styled.div`
  padding-top: 12px;

  .ant-form-item {
    margin-bottom: 10px;
  }

  .ant-form-item-vertical {
    .ant-form-item-label {
      padding: 0;
    }
  }
`

const LoginTitle = styled.div`
  font-family: Alimama ShuHeiTi;
  font-weight: 700;
  color: #060a26;
  font-size: 30px;
  margin: 0 auto;
  [theme-mode='dark'] & {
    color: var(--color-white);
  }
`

const SubTitle = styled.div`
  font-weight: 400;
  color: var(--color-text-3);
  font-size: 12px;
  padding: 5px 0 20px;
  font-family: 'Alibaba PuHuiTi 3';
  opacity: 55%;
`
