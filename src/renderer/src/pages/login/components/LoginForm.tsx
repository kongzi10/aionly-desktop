import Verify from '@renderer/components/verifition/Verify'
import { FEATURE_IDENTITY_SWITCH } from '@renderer/config/featureFlags'
import { useFetchAndSetupModels } from '@renderer/hooks/useAiOnlyModels'
import i18n from '@renderer/i18n'
import { Agreements } from '@renderer/pages/login/components/Agreements'
import { inferLoginTab, takePendingLoginAccount } from '@renderer/services/identityPrefill'
import { applyProfileSwitch } from '@renderer/services/ProfileLifecycleService'
import { applySessionData, fetchSessionData } from '@renderer/services/sessionBootstrap'
import { APP_PROTOCOL } from '@shared/config/constant'
import type { TabsProps } from 'antd'
import { Button } from 'antd'
import { Tabs } from 'antd'
import { useCallback, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'

import { LoginSceneType, useLoginContext } from '../contexts/LoginContext'
import { AccountLogin, type AccountLoginRef } from './AccountLogin'
import { EmailLogin, type EmailLoginRef } from './EmailLogin'
import { QrcodeLogin } from './QrcodeLogin'
import { SMSLogin, type SMSLoginRef } from './SMSLogin'

/** 扫码登录页签 */
const QRCODE_TAB_KEY = '4'

const LoginTitle = styled.div`
  font-family: Alimama ShuHeiTi;
  font-weight: 700;
  color: #060a26;
  font-size: 30px;
  margin: 0 auto 30px;
  text-align: center;

  [theme-mode='dark'] & {
    color: #ffffff;
  }
`

const BottomPanel = styled.div`
  width: 432px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 5px;
  font-size: 13px;

  button {
    padding: 0;
    font-size: 13px;
  }

  span{
    padding-top: 2px;
  }
`

const LoginButton = styled(Button)`
  width: 100%;
  height: 46px;
  background: rgba(6, 10, 38, 1);
  border-radius: 8px;

  [theme-mode='light'] & {
    &:not(:disabled):hover {
      background: rgba(6, 10, 38, 0.8) !important;
    }
  }

  [theme-mode='dark'] & {
    &:not(:disabled){
      background: rgba(33, 51, 172, 1);
      &:hover {
        background: rgba(33, 51, 172, 0.8);
      }
    }
  }
`

interface LoginFormProps {
  onComplete?: () => void
}

export const LoginForm = (_props: LoginFormProps) => {
  void _props
  const setupModels = useFetchAndSetupModels()

  // 切换身份会话过期 → 登录页一次性预填账号（内存传递，按账号形态选择页签）
  const [prefillAccount] = useState(() => takePendingLoginAccount())

  const [activeTabKey, setActiveTabKey] = useState<string>(() =>
    prefillAccount ? inferLoginTab(prefillAccount) : (APP_PROTOCOL as string) === 'aionly' ? '2' : '1'
  )
  const [isAccept, setIsAccept] = useState(false)
  const [formValid, setFormValid] = useState(false)
  const [loading, setLoading] = useState(false)

  const verifyRef = useRef<any>(null)
  const smsLoginRef = useRef<SMSLoginRef | null>(null)
  const emailLoginRef = useRef<EmailLoginRef | null>(null)
  const accountLoginRef = useRef<AccountLoginRef | null>(null)

  const { setScene } = useLoginContext()

  // 获取当前激活 tab 对应的子组件 ref
  const getActiveRef = () => {
    const map = {
      '1': smsLoginRef,
      '2': emailLoginRef,
      '3': accountLoginRef
    }
    return map[activeTabKey as '1' | '2' | '3']
  }

  const onAcceptChange = (checked: boolean) => {
    setIsAccept(checked)
  }

  const onFormChange = (valid: boolean) => {
    setFormValid(valid)
  }

  /** 登录成功；loginAccount 为本次登录账号（手机号/邮箱/用户名），用于切换身份历史账号回写 **/
  const handleLoginSuccess = useCallback(
    async (loginAccount?: string) => {
      // 会话数据拉取复用 sessionBootstrap（与原 saveUserInfo 行为一致，401 时返回 null）
      const session = await fetchSessionData()
      if (!session) throw new Error('登录态无效，请重新登录')
      const { userData, secretKey } = session
      const userId = userData?.userId
      if (userId === undefined || userId === null || !String(userId).trim()) {
        throw new Error('登录响应缺少用户 ID，无法创建用户数据目录')
      }
      const bootstrap = {
        token: localStorage.getItem('token') || undefined,
        userInfo: JSON.stringify(userData || {}),
        serviceInfo: localStorage.getItem('serviceInfo') || undefined,
        localUserSecret: secretKey || undefined
      }
      // 开关开启：upsertAccount 内部复用 activate 编排，同时写入历史账号元数据与长期凭据；
      // 开关关闭：保持改造前 activate 行为（可一键回滚）
      const result = FEATURE_IDENTITY_SWITCH
        ? await window.api.profile.upsertAccount({
            userId: String(userId),
            account: loginAccount ?? '',
            accountType: 'main',
            nickName: userData?.nickName ?? '',
            avatarUrl: userData?.avatarUrl ?? '',
            accountId:
              userData?.accountId !== undefined && userData?.accountId !== null ? String(userData.accountId) : '',
            bootstrap
          })
        : await window.api.profile.activate(String(userId), bootstrap)
      if (!result.profileId) throw new Error('Profile activation failed')
      await applyProfileSwitch({ profileId: result.profileId, bootstrap }, async () => {
        applySessionData(session)
        await setupModels(10, String(userId))
      })
    },
    [setupModels]
  )

  const tabList: TabsProps['items'] = useMemo(() => {
    // 预填账号只注入形态匹配的页签（手机号→短信 / 邮箱→邮箱 / 其他→账号）
    const prefillForTab = (tab: '1' | '2' | '3') =>
      prefillAccount && inferLoginTab(prefillAccount) === tab ? prefillAccount : undefined
    const base = [
      {
        key: '2',
        label: '邮箱登录',
        children: (
          <EmailLogin
            ref={emailLoginRef}
            verifyRef={verifyRef}
            isAccept={isAccept}
            onFormChange={onFormChange}
            onSuccess={handleLoginSuccess}
            setLoading={setLoading}
            initialAccount={prefillForTab('2')}
          />
        )
      },
      {
        key: '3',
        label: '账号登录',
        children: (
          <AccountLogin
            ref={accountLoginRef}
            verifyRef={verifyRef}
            isAccept={isAccept}
            onFormChange={onFormChange}
            onSuccess={handleLoginSuccess}
            setLoading={setLoading}
            initialAccount={prefillForTab('3')}
          />
        )
      }
    ]

    if ((APP_PROTOCOL as string) !== 'aiionly') {
      base.push({
        key: QRCODE_TAB_KEY,
        label: i18n.t('login.qrcode.tab'),
        children: (
          <QrcodeLogin
            active={activeTabKey === QRCODE_TAB_KEY}
            onSuccess={handleLoginSuccess}
            setLoading={setLoading}
          />
        )
      })
    }

    if ((APP_PROTOCOL as string) === 'aionly') {
      return base
    }
    return [
      {
        key: '1',
        label: '短信登录',
        children: (
          <SMSLogin
            ref={smsLoginRef}
            verifyRef={verifyRef}
            isAccept={isAccept}
            onFormChange={onFormChange}
            onSuccess={handleLoginSuccess}
            setLoading={setLoading}
            initialAccount={prefillForTab('1')}
          />
        )
      },
      ...base
    ]
  }, [activeTabKey, handleLoginSuccess, isAccept, prefillAccount])

  const onTabChange = (key: string) => {
    setActiveTabKey(key)
    // 切换 tab 时重置表单有效状态
    setFormValid(false)
  }

  // 滑块验证码成功回调——路由到当前激活的子组件
  const verifyOnSuccess = async (params: any) => {
    const activeRef = getActiveRef()
    activeRef?.current?.sendCode?.(params)
    verifyRef.current?.closeBox()
  }

  // 登录按钮点击——调用当前激活子组件的 login 方法
  const handleLoginSubmit = async () => {
    if (!isAccept) {
      return
    }
    const activeRef = getActiveRef()
    if (!activeRef?.current?.login) {
      return
    }
    try {
      await activeRef.current.login()
    } catch (e) {
      // login方法中的错误已经被子组件处理
    }
  }

  const disabledLogin = !isAccept || !formValid
  // 扫码登录页签：登录由手机端确认自动触发，无表单校验与协议勾选
  const isQrcodeTab = activeTabKey === QRCODE_TAB_KEY

  return (
    <>
      <>
        <LoginTitle>{i18n.t('login.title')}</LoginTitle>
        <Tabs
          centered
          style={{ width: '432px' }}
          tabBarGutter={48}
          size="large"
          activeKey={activeTabKey}
          defaultActiveKey="1"
          items={tabList}
          onChange={onTabChange}
        />

        {!isQrcodeTab && <Agreements onChange={onAcceptChange} checked={isAccept} />}

        {!isQrcodeTab && (
          <LoginButton
            type="primary"
            block={true}
            disabled={disabledLogin}
            loading={loading}
            onClick={handleLoginSubmit}
            style={{ marginTop: 12 }}>
            {i18n.t('login.login_btn_text')}
          </LoginButton>
        )}

        {!isQrcodeTab && (
          <BottomPanel>
            <Button type="link" onClick={() => setScene(LoginSceneType.SubAccount)}>
              {i18n.t('login.sub_account.btn_text')}
            </Button>
            <Button type="link" onClick={() => setScene(LoginSceneType.ForgotPassword)}>
              {i18n.t('login.forget_password')}
            </Button>
          </BottomPanel>
        )}
      </>

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
