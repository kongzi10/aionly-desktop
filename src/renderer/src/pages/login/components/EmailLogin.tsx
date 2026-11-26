import { loggerService } from '@logger'
import { captchaEnabledApi, emailCaptchaApi, loginApi } from '@renderer/api/login'
import i18n from '@renderer/i18n'
import { Button, Form, type FormProps, Input, message } from 'antd'
import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import styled from 'styled-components'

interface EmailLoginProps {
  ref?: React.Ref<EmailLoginRef>
  /** 登录成功回调；loginAccount 为本次登录邮箱（切换身份回写历史账号用） */
  onSuccess?: (loginAccount?: string) => void
  onFormChange?: (valid: boolean) => void
  verifyRef?: any
  setLoading?: (loading: boolean) => void
  isAccept: boolean
  /** 预填邮箱（切换身份会话过期 → 登录页一次性预填） */
  initialAccount?: string
}

export interface EmailLoginRef {
  sendCode?: (verifyParams: any) => void
  login?: () => Promise<void>
  triggerVerify?: () => void
}

const Container = styled.div`
  padding-top: 12px;
`

const StyleInput = styled(Input)`
    height: 46px;
`

const logger = loggerService.withContext('EmailLogin')

export const EmailLogin = ({ ref, ...props }: EmailLoginProps) => {
  type FieldType = {
    email?: string
    emailCode?: string
  }

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [form] = Form.useForm<FieldType>()

  const [emailForm, setEmailForm] = useState({
    tenantId: '000001',
    email: '',
    clientId: import.meta.env.VITE_APP_CLIENT_ID,
    userType: 'web_user',
    grantType: 'email',
    emailCode: '',
    code: '',
    inviteAccountId: undefined,
    inviteCode: undefined,
    inviteSuffix: undefined,
    loginUrl: window.location.href
  })

  // 预填邮箱（内存一次性传递，勿持久化）
  useEffect(() => {
    if (!props.initialAccount) return
    form.setFieldsValue({ email: props.initialAccount })
    setEmailForm((prev) => ({ ...prev, email: props.initialAccount as string }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 登录接口
  const login = async () => {
    props.setLoading?.(true)
    try {
      // 先做表单验证
      await form.validateFields()

      if (!props.isAccept) {
        window.toast.error(i18n.t('login.agreements.accept_text'))
        return
      }

      const { data } = await loginApi(emailForm)
      if (data && data.access_token) {
        localStorage.setItem('token', data.access_token)
        await props.onSuccess?.(emailForm.email)
      }
    } catch (error: any) {
      logger.error('邮箱登录失败', error)
    } finally {
      props.setLoading?.(false)
    }
  }

  const onFinish: FormProps<FieldType>['onFinish'] = (values) => {
    logger.debug('邮箱登录表单提交成功', values)
    login()
  }

  const onValuesChange = (_changedValues: any, allValues: any) => {
    const valid = !!allValues.email && !!allValues.emailCode
    props.onFormChange?.(valid)
    setEmailForm({
      ...emailForm,
      email: allValues.email,
      emailCode: allValues.emailCode
    })
  }

  const [disabled, setDisabled] = useState(true)
  const [codeBtnText, setCodeBtnText] = useState(i18n.t('login.email_login.send_code'))

  const handleChangeEmail = (e: any) => {
    const disabled = !e.target.value
    setDisabled(disabled)
  }

  const disCount = (time: number) => {
    timerRef.current = setTimeout(() => {
      const next = time - 1
      if (next <= 0) {
        timerRef.current = null
        setDisabled(false)
        setCodeBtnText(i18n.t('login.email_login.send_code'))
      } else {
        setCodeBtnText(i18n.t('login.email_login.send_code') + '(' + next + ')')
        disCount(next)
      }
    }, 1000)
  }

  const handleSendCode = async () => {
    const email = form.getFieldValue('email')
    const regexp = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

    if (!email) {
      return
    }

    if (!regexp.test(email)) {
      message.error(i18n.t('login.email_login.email_invalid'))
      return
    }

    captchaEnabledApi()
    props.verifyRef.current?.show()
  }

  // 触发滑块验证码（供父组件调用）
  const triggerVerify = () => {
    handleSendCode()
  }

  // 发送验证码---真正走接口的地方
  const sendCode = (verifyParams: any) => {
    setDisabled(true)
    setCodeBtnText(i18n.t('login.email_login.send_code') + '(60)')
    disCount(60)
    handleEmailCaptchaAndTokenApi(verifyParams)
  }

  // 校验邮箱接口
  async function handleEmailCaptchaAndTokenApi(verifyParams: any) {
    setEmailForm({
      ...emailForm,
      code: verifyParams.captchaVerification
    })
    try {
      await emailCaptchaApi({
        email: emailForm.email,
        loginUrl: window.location.href
      })
    } catch (e: any) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      setDisabled(false)
      setCodeBtnText(i18n.t('login.email_login.send_code'))
      throw new Error(e)
    }
  }

  // 暴露给父组件
  useImperativeHandle(ref, () => ({
    sendCode,
    login,
    triggerVerify
  }))

  const suffix = (
    <Button type="link" size="small" disabled={disabled} onClick={handleSendCode}>
      {codeBtnText}
    </Button>
  )

  useEffect(() => {
    return () => {
      const timer = timerRef.current
      if (timer) clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    // 获取动态路由参数中的邀请码
    const inviteCode: any = sessionStorage.getItem('inviteCode')
    const inviteLinkCode: any = sessionStorage.getItem('inviteLinkCode')
    const suffix: any = sessionStorage.getItem('suffix')

    if (inviteCode) {
      setEmailForm((prev) => ({
        ...prev,
        inviteAccountId: inviteCode,
        inviteCode: undefined,
        inviteSuffix: undefined
      }))
      sessionStorage.removeItem('inviteCode')
    } else if (inviteLinkCode && suffix) {
      setEmailForm((e) => ({
        ...e,
        inviteAccountId: undefined,
        inviteCode: inviteLinkCode,
        inviteSuffix: suffix
      }))
    } else {
      setEmailForm((e) => ({
        ...e,
        inviteAccountId: undefined,
        inviteCode: undefined,
        inviteSuffix: undefined
      }))
    }
  }, [])

  return (
    <Container>
      <Form form={form} size="large" onFinish={onFinish} onValuesChange={onValuesChange} autoComplete="off">
        <Form.Item<FieldType>
          name="email"
          rules={[{ required: true, message: i18n.t('login.email_login.email_required') }]}>
          <StyleInput
            onChange={handleChangeEmail}
            onPressEnter={login}
            placeholder={i18n.t('login.email_login.email_required')}
          />
        </Form.Item>

        <Form.Item<FieldType>
          name="emailCode"
          rules={[{ required: true, message: i18n.t('login.email_login.code_required') }]}>
          <StyleInput suffix={suffix} onPressEnter={login} placeholder={i18n.t('login.email_login.code_required')} />
        </Form.Item>
      </Form>
    </Container>
  )
}
