import { EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons'
import { loggerService } from '@logger'
import { getApikeyByUserId, getUserProfileApi, loginApi } from '@renderer/api/login'
import { queryPhoneByName } from '@renderer/api/user'
import Verify from '@renderer/components/verifition/Verify'
import { useFetchAndSetupModels } from '@renderer/hooks/useAiOnlyModels'
import { useProvider } from '@renderer/hooks/useProvider'
import i18n from '@renderer/i18n'
import { useAppDispatch } from '@renderer/store'
import { setApiKey, setUserInfo } from '@renderer/store/user'
import { ENABLED_PLAN_STORAGE_KEY, LOCAL_USER_SECRET_KEY } from '@shared/config/constant'
import { Button, Flex, Form, type FormProps, Input } from 'antd'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import { LoginSceneType, useLoginContext } from '../../contexts/LoginContext'
import BindPhoneEmailModal from './BindPhoneEmail'

interface SubAccountLoginProps {
  onComplete?: () => void
}

export type SubAccountLoginFieldType = {
  phoneNumber?: string
  username?: string
  password?: string
}

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

const StyleInput = styled(Input)`
  height: 46px;
`

const PwdInput = styled(Input.Password)`
  height: 46px;
`

const LoginTitle = styled.div`
  font-family: Alimama ShuHeiTi;
  font-weight: 700;
  color: #060a26;
  font-size: 30px;
  margin: 0 auto 15px;
  text-align: center;
  [theme-mode='dark'] & {
    color: var(--color-white);
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

const logger = loggerService.withContext('SubAccountLogin')

export const SubAccountLogin: React.FC<SubAccountLoginProps> = (props) => {
  // 手机号正则
  const phoneRegexp =
    /^(((13[0-9]{1})|(15[0-9]{1})|(16[0-9]{1})|(17[3-8]{1})|(18[0-9]{1})|(19[0-9]{1})|(14[5-7]{1}))+\d{8})$/
  // 邮箱正则
  const emailRegexp = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  // 账号ID正则（纯数字）
  const accountIdRegexp = /^\d+$/
  // 合并正则（手机号、邮箱或账号ID）
  const userNamePattern = new RegExp(`(${phoneRegexp.source})|(${emailRegexp.source})|(${accountIdRegexp.source})`)
  // 密码正则
  // const passwordPattern = /^(?![\d]+$)(?![a-zA-Z]+$)(?![^\da-zA-Z]+$)([^\u4e00-\u9fa5\s]){6,20}$/

  const { updateProvider } = useProvider('aionly')
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const setupModels = useFetchAndSetupModels()

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const verifyRef = useRef<any>(null)

  const verifyType = useRef('')
  const isProcessing = useRef(false) // 防止重复提交

  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm<SubAccountLoginFieldType>()

  const [accountForm, setAccountForm] = useState({
    tenantId: '000001',
    username: '',
    password: '',
    userType: 'web_sub_user',
    clientId: import.meta.env.VITE_APP_CLIENT_ID,
    phoneNumber: '',
    grantType: 'password',
    smsCode: '',
    code: ''
  })

  const { setScene } = useLoginContext()

  // 登录接口（改为触发滑块验证）
  const login = async () => {
    // 先做表单验证
    await form.validateFields()

    // 调试日志：查看请求参数
    logger.debug('账号登录请求参数', accountForm)

    // 触发滑块验证，验证成功后会调用 sendCode 方法
    triggerVerify()
  }

  const onFinish: FormProps<SubAccountLoginFieldType>['onFinish'] = (values) => {
    logger.debug('登录表单提交成功', values)
    login()
  }

  const onValuesChange = (_changedValues: any, allValues: any) => {
    // const valid = !!allValues.phoneNumber && !!allValues.username && !!allValues.password
    // props.onFormChange?.(valid)
    setAccountForm((prev) => {
      return {
        ...prev,
        phoneNumber: allValues.phoneNumber,
        username: allValues.username,
        password: allValues.password
      }
    })
  }

  // 触发滑块验证码（供父组件调用）
  const triggerVerify = () => {
    verifyRef.current?.show()
  }

  /** 显示绑定手机/邮箱弹窗 **/
  const showBindPhoneEmail = useCallback(() => {
    BindPhoneEmailModal.show({ parentForm: form, navigate }).then(() => {
      verifyType.current = ''
    })
  }, [form, navigate])

  /** 查询并保存用户信息 **/
  const saveUserInfo = useCallback(async () => {
    const res = await getUserProfileApi()
    const user_data = res.data?.user
    dispatch(setUserInfo(user_data))
    // const balance = await getFinanceInfo()
    // dispatch(setMyBalance(balance.data))

    // TODO：无论用户有没有启用tokenPlan, 先使用用户id获取用户的apikey存到本地
    const api_key_res = await getApikeyByUserId({ userId: user_data?.userId || '' })
    const secretKey = api_key_res?.msg ?? ''
    dispatch(setApiKey(secretKey))
    localStorage.setItem(LOCAL_USER_SECRET_KEY, secretKey)

    // TODO：用户启用了tokenPlan, 则需要将预存的apikey换成tokenPlan的apikey
    const key = `${ENABLED_PLAN_STORAGE_KEY}_${user_data?.userId || ''}`
    const user_token_plan = localStorage.getItem(key)
    if (!!user_token_plan) {
      const userTokenPlan = JSON.parse(user_token_plan)
      const apiKey = userTokenPlan.apikey
      if (!!apiKey) {
        updateProvider({
          apiKey
        })
      }
    } else {
      // TODO：用户没有启用tokenPlan, 则使用用户id获取用户的apikey来预存
      updateProvider({
        apiKey: secretKey
      })
    }
  }, [dispatch, updateProvider])

  /** 登录成功 **/
  const handleLoginSuccess = async () => {
    await saveUserInfo()
    await setupModels(10) // 预存10个模型供页面优先展示
    setScene(LoginSceneType.MainAccount)
    props.onComplete?.()
    navigate('/')
  }

  /** 接口校验 **/
  const checkByApi = async (params: any) => {
    if (verifyType.current !== 'bind' && !isProcessing.current) {
      // console.log('账号登录开始')
      // 直接执行登录
      try {
        isProcessing.current = true
        setLoading(true)
        const userName = params.username
        const phoneNumber = params.phoneNumber
        // 查询用户信息
        const user_res: any = await queryPhoneByName(userName, phoneNumber)
        if (user_res?.data) {
          // 调用登录接口
          const login_res: any = await loginApi(params)
          const data = login_res?.data
          if (data && data.access_token) {
            localStorage.setItem('token', data.access_token)
            await handleLoginSuccess()
          }
        } else {
          verifyType.current = 'bind'
          showBindPhoneEmail()
        }
      } catch (error: any) {
        setLoading(false)
        logger.error('账号登录失败', error)
      } finally {
        setLoading(false)
        isProcessing.current = false
      }
    }
  }

  // 发送验证码---真正走接口的地方（账号登录时，这里改为执行登录）
  const sendCode = async (verifyParams: any) => {
    // 更新滑块验证参数
    const updatedForm = {
      ...accountForm,
      code: verifyParams.captchaVerification
    }
    setAccountForm(updatedForm)
    await checkByApi(updatedForm)
  }

  // 滑块验证码成功回调
  const verifyOnSuccess = async (params: any) => {
    // 先关闭滑块弹窗，防止重复弹出
    verifyRef.current?.closeBox()
    // 延迟执行登录逻辑，确保滑块组件完全关闭
    await new Promise((resolve) => setTimeout(resolve, 100))
    await sendCode(params)
  }

  useEffect(() => {
    const timer = timerRef.current
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    // 获取动态路由参数中的邀请码
    const inviteCode: any = sessionStorage.getItem('inviteCode')
    const inviteLinkCode: any = sessionStorage.getItem('inviteLinkCode')
    const suffix: any = sessionStorage.getItem('suffix')

    if (inviteCode) {
      setAccountForm((prev) => ({
        ...prev,
        inviteAccountId: inviteCode,
        inviteCode: undefined,
        inviteSuffix: undefined
      }))
      sessionStorage.removeItem('inviteCode')
    } else if (inviteLinkCode && suffix) {
      setAccountForm((a) => ({
        ...a,
        inviteAccountId: undefined,
        inviteCode: inviteLinkCode,
        inviteSuffix: suffix
      }))
    } else {
      setAccountForm((a) => ({
        ...a,
        inviteAccountId: undefined,
        inviteCode: undefined,
        inviteSuffix: undefined
      }))
    }
  }, [])

  return (
    <>
      <Container>
        <LoginTitle>{i18n.t('login.sub_account.title')}</LoginTitle>
        <Form
          layout="vertical"
          form={form}
          size="large"
          onFinish={onFinish}
          onValuesChange={onValuesChange}
          autoComplete="off">
          <Form.Item<SubAccountLoginFieldType>
            label={i18n.t('login.sub_account.phone_email_label')}
            name="phoneNumber"
            rules={[
              {
                required: true,
                message: i18n.t('login.sub_account.phone_email_required')
              },
              {
                pattern: userNamePattern,
                message: i18n.t('login.sub_account.phone_email_invalid')
              }
            ]}>
            <StyleInput onPressEnter={login} placeholder={i18n.t('login.sub_account.phone_email_required')} />
          </Form.Item>

          <Form.Item<SubAccountLoginFieldType>
            label={i18n.t('login.sub_account.username_label')}
            name="username"
            rules={[
              {
                required: true,
                message: i18n.t('login.sub_account.username_required')
              }
            ]}>
            <StyleInput onPressEnter={login} placeholder={i18n.t('login.sub_account.username_required')} />
          </Form.Item>

          <Form.Item<SubAccountLoginFieldType>
            label={i18n.t('login.sub_account.password_label')}
            name="password"
            rules={[
              {
                required: true,
                message: i18n.t('login.sub_account.password_required')
              }
            ]}>
            <PwdInput
              onPressEnter={login}
              placeholder={i18n.t('login.sub_account.password_required')}
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>
          <Form.Item style={{ marginTop: 30, marginBottom: 5 }}>
            <LoginButton type="primary" htmlType="submit" block loading={loading}>
              {i18n.t('login.sub_account.login')}
            </LoginButton>
          </Form.Item>
          <Form.Item>
            <Flex justify="flex-end">
              <Button type="link" size="small" onClick={() => setScene(LoginSceneType.MainAccount)}>
                {i18n.t('login.sub_account.back_main_login')}
              </Button>
            </Flex>
          </Form.Item>
        </Form>
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
