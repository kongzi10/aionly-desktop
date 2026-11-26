import { loggerService } from '@logger'
import { captchaEnabledApi, loginApi, smsCaptchaAndTokenApi } from '@renderer/api/login'
import i18n from '@renderer/i18n'
import type { FormProps } from 'antd'
import { Button, Form, Input, message, Space } from 'antd'
import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import styled from 'styled-components'

const Container = styled.div`
  padding-top: 12px;
`

const StyleInput = styled(Input)`
    height: 46px;
`

const logger = loggerService.withContext('SMSLogin')

interface LoginFormProps {
  ref?: React.Ref<SMSLoginRef>
  /** 登录成功回调；loginAccount 为本次登录手机号（切换身份回写历史账号用） */
  onSuccess?: (loginAccount?: string) => void
  onFormChange?: (valid: boolean) => void
  verifyRef?: any
  setLoading?: (loading: boolean) => void
  isAccept: boolean
  /** 预填手机号（切换身份会话过期 → 登录页一次性预填） */
  initialAccount?: string
}

export interface SMSLoginRef {
  sendCode?: (verifyParams: any) => void
  login?: () => Promise<void>
  triggerVerify?: () => void
}

export const SMSLogin = ({ ref, ...props }: LoginFormProps) => {
  type FieldType = {
    phonenumber?: string
    smsCode?: string
  }

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [form] = Form.useForm<FieldType>()

  const [codeForm, setCodeForm] = useState({
    tenantId: '000001',
    phonenumber: '',
    clientId: import.meta.env.VITE_APP_CLIENT_ID,
    userType: 'web_user',
    grantType: 'sms',
    smsCode: '',
    code: '',
    inviteAccountId: undefined,
    inviteCode: undefined,
    inviteSuffix: undefined,
    loginUrl: window.location.href
  })

  // 预填手机号（内存一次性传递，勿持久化）
  useEffect(() => {
    if (!props.initialAccount) return
    form.setFieldsValue({ phonenumber: props.initialAccount })
    setCodeForm((prev) => ({ ...prev, phonenumber: props.initialAccount as string }))
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

      const { data } = await loginApi(codeForm)
      if (data && data.access_token) {
        localStorage.setItem('token', data.access_token)
        await props.onSuccess?.(codeForm.phonenumber)
      }
    } catch (error: any) {
      logger.error('短信登录失败', error)
    } finally {
      props.setLoading?.(false)
    }
  }

  const onFinish: FormProps<FieldType>['onFinish'] = (values) => {
    logger.debug('短信登录表单提交成功', values)
    login()
  }

  const onValuesChange = (_changedValues: any, allValues: any) => {
    const valid = !!allValues.phonenumber && !!allValues.smsCode
    props.onFormChange?.(valid)
    setCodeForm({
      ...codeForm,
      phonenumber: allValues.phonenumber,
      smsCode: allValues.smsCode
    })
  }

  const [disabled, setDisabled] = useState(true)
  const [codeBtnText, setCodeBtnText] = useState(i18n.t('login.sms_login.send_code'))

  const handleChangePhone = (e: any) => {
    const disabled = !e.target.value
    setDisabled(disabled)
  }

  const disCount = (time: number) => {
    timerRef.current = setTimeout(() => {
      const next = time - 1
      if (next <= 0) {
        timerRef.current = null
        setDisabled(false)
        setCodeBtnText(i18n.t('login.sms_login.send_code'))
      } else {
        setCodeBtnText(i18n.t('login.sms_login.send_code') + '(' + next + ')')
        disCount(next)
      }
    }, 1000)
  }

  const handleSendCode = async () => {
    const phone = form.getFieldValue('phonenumber')
    const regexp =
      /^(((13[0-9]{1})|(15[0-9]{1})|(16[0-9]{1})|(17[3-8]{1})|(18[0-9]{1})|(19[0-9]{1})|(14[5-7]{1}))+\d{8})$/

    if (!phone) {
      return
    }

    if (!regexp.test(phone)) {
      message.error(i18n.t('login.sms_login.phone_invalid'))
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
    setCodeBtnText(i18n.t('login.sms_login.send_code') + '(60)')
    disCount(60)
    handleSmsCaptchaAndTokenApi(verifyParams)
  }

  // 校验手机验证码
  async function handleSmsCaptchaAndTokenApi(verifyParams: any) {
    // 更新验证码参数
    setCodeForm({
      ...codeForm,
      code: verifyParams.captchaVerification
    })
    try {
      //添加滑块验证token
      const tokenValidate = localStorage.getItem('tokenValidate')
      //若为邀请账号，则后台验证是否输入的为邀请人账号
      const inviteAccountId = codeForm.inviteAccountId
      await smsCaptchaAndTokenApi({
        phonenumber: codeForm.phonenumber,
        tokenValidate,
        inviteAccountId,
        loginUrl: window.location.href
      })
    } catch (e: any) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      setDisabled(false)
      setCodeBtnText(i18n.t('login.sms_login.send_code'))
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
      setCodeForm((prev) => ({
        ...prev,
        inviteAccountId: inviteCode,
        inviteCode: undefined,
        inviteSuffix: undefined
      }))
      sessionStorage.removeItem('inviteCode')
    } else if (inviteLinkCode && suffix) {
      setCodeForm((c) => ({
        ...c,
        inviteAccountId: undefined,
        inviteCode: inviteLinkCode,
        inviteSuffix: suffix
      }))
    } else {
      setCodeForm((c) => ({
        ...c,
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
          name="phonenumber"
          rules={[{ required: true, message: i18n.t('login.sms_login.phone_required') }]}>
          <Space.Compact style={{ width: '100%' }}>
            <StyleInput style={{ width: '20%' }} value={'+86'} readOnly={true} />
            <StyleInput
              style={{ width: '80%' }}
              onChange={handleChangePhone}
              onPressEnter={login}
              placeholder={i18n.t('login.sms_login.phone_required')}
            />
          </Space.Compact>
        </Form.Item>

        <Form.Item<FieldType>
          name="smsCode"
          rules={[{ required: true, message: i18n.t('login.sms_login.code_required') }]}>
          <StyleInput suffix={suffix} placeholder={i18n.t('login.sms_login.code_required')} onPressEnter={login} />
        </Form.Item>
      </Form>
    </Container>
  )
}
