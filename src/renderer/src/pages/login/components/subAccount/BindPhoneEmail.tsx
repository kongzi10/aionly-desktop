import { getUserProfileApi } from '@renderer/api/login'
import { TopView } from '@renderer/components/TopView'
import Verify from '@renderer/components/verifition/Verify'
import { SubAccountLoginProvider } from '@renderer/pages/login/contexts/SubAccountContext'
import { applyProfileSwitch } from '@renderer/services/ProfileLifecycleService'
import { store } from '@renderer/store'
import { setUserInfo } from '@renderer/store/user'
import type { FormInstance, TabsProps } from 'antd'
import { Button, Flex, Modal } from 'antd'
import { Tabs } from 'antd'
import React, { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NavigateFunction } from 'react-router-dom'
import styled from 'styled-components'

import type { EmailBindRef } from './EmailBind'
import EmailBind from './EmailBind'
import type { PhoneBindRef } from './PhoneBind'
import PhoneBind from './PhoneBind'
import type { SubAccountLoginFieldType } from './SubAccountLogin'

interface Props {
  resolve?: (data: any) => void
  parentForm?: FormInstance<SubAccountLoginFieldType>
  navigate?: NavigateFunction
}

interface showParamsType {
  parentForm?: FormInstance<SubAccountLoginFieldType>
  navigate?: NavigateFunction
}

const BindPhoneEmail: React.FC<Props> = ({ resolve, parentForm, navigate }) => {
  void navigate
  const { t } = useTranslation()

  const [open, setOpen] = useState(true)
  const verifyRef = useRef<any>(null)
  const [loading, setLoading] = useState(false)
  const [activeTabKey, setActiveTabKey] = useState('phone')
  const phoneBindRef = useRef<PhoneBindRef | null>(null)
  const emailBindRef = useRef<EmailBindRef | null>(null)

  /** 查询并保存用户信息 **/
  const saveUserInfo = useCallback(async () => {
    const res = await getUserProfileApi()
    const data = res.data?.user
    // const balance = await getFinanceInfo()
    // dispatch(setMyBalance(balance.data))
    return data
  }, [])

  /** 登录成功 **/
  const handleLoginSuccess = async () => {
    const userData = await saveUserInfo()
    const bootstrap = {
      token: localStorage.getItem('token') || undefined,
      userInfo: JSON.stringify(userData || {})
    }
    const result = await window.api.profile.activate(String(userData?.userId || ''), bootstrap)
    await applyProfileSwitch({ profileId: result.profileId, bootstrap }, () => {
      store.dispatch(setUserInfo(userData || {}))
    })
  }

  const tabList: TabsProps['items'] = [
    {
      key: 'phone',
      label: t('login.sub_account.bind_phone_email.phone.title'),
      children: <PhoneBind ref={phoneBindRef} verifyRef={verifyRef} onSuccess={handleLoginSuccess} />
    },
    {
      key: 'email',
      label: t('login.sub_account.bind_phone_email.email.title'),
      children: <EmailBind ref={emailBindRef} verifyRef={verifyRef} onSuccess={handleLoginSuccess} />
    }
  ]

  // 获取当前激活 tab 对应的子组件 ref
  const getActiveRef = () => {
    const map = {
      phone: phoneBindRef,
      email: emailBindRef
    }
    return map[activeTabKey]
  }

  const onChange = (key: string) => {
    setActiveTabKey(key)
  }

  const onOk = async () => {
    const activeRef = getActiveRef()
    if (!activeRef?.current?.login) return
    setLoading(true)
    try {
      await activeRef.current.login()
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const onCancel = () => {
    setOpen(false)
  }

  const onClose = () => {
    resolve?.({})
  }

  // 滑块验证码成功回调——路由到当前激活的子组件
  const verifyOnSuccess = async (params: any) => {
    const activeRef = getActiveRef()
    activeRef?.current?.sendCode?.(params)
    verifyRef.current?.closeBox()
  }

  const footer = (
    <Flex justify="center">
      <Button type="primary" block={true} size="large" loading={loading} onClick={onOk}>
        {t('login.sub_account.bind_phone_email.bind_btn_text')}
      </Button>
    </Flex>
  )

  BindPhoneEmailModal.hide = onCancel

  return (
    <>
      <SubAccountLoginProvider value={{ parentForm }}>
        <MyModal
          title={t('login.sub_account.bind_phone_email.title')}
          open={open}
          onCancel={onCancel}
          afterClose={onClose}
          transitionName="animation-move-down"
          centered
          footer={footer}>
          <Tabs defaultActiveKey="1" tabBarGutter={56} items={tabList} onChange={onChange} />
        </MyModal>
      </SubAccountLoginProvider>

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

const MyModal = styled(Modal)`
  .ant-modal-content{
    .ant-modal-body {
      padding: 0 24px !important;
    }
  }
`

const TopViewKey = 'BindPhoneEmail'

export default class BindPhoneEmailModal {
  static topviewId = 0
  static hide() {
    TopView.hide(TopViewKey)
  }
  static show({ parentForm, navigate }: showParamsType) {
    return new Promise<any>((resolve) => {
      TopView.show(
        <BindPhoneEmail
          parentForm={parentForm}
          navigate={navigate}
          resolve={(v) => {
            resolve(v)
            TopView.hide(TopViewKey)
          }}
        />,
        TopViewKey
      )
    })
  }
}
