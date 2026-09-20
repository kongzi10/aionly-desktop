import { loggerService } from '@logger'
import { emailCaptchaApi, loginApi } from '@renderer/api/login'
import { checkBindTargetExists, editUserInfo } from '@renderer/api/user'
import i18n from '@renderer/i18n'
import type { FormProps } from 'antd'
import { Button, Form, Input, message } from 'antd'
import React, { useImperativeHandle, useRef, useState } from 'react'
import styled from 'styled-components'

import { useSubAccountLoginContext } from '../../contexts/SubAccountContext'

const logger = loggerService.withContext('EmailBind')

interface Props {
  ref?: React.Ref<EmailBindRef>
  onSuccess?: () => void | Promise<void>
  onFormChange?: (valid: boolean) => void
  verifyRef?: React.RefObject<any | null>
}

export interface EmailBindRef {
  sendCode?: (verifyParams: any) => void
  login?: () => Promise<void>
}

const Container = styled.div`
  padding-top: 12px;
`

const StyleInput = styled(Input)`
  height: 46px;
`

const emailRegExp = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

const EmailBind: React.FC<Props> = ({ ref, verifyRef, onSuccess, onFormChange }) => {
  type FieldType = {
    email?: string
    emailCode?: string
  }

  // 验证码按钮文案
  const codeText = i18n.t('login.sub_account.bind_phone_email.email.send_code')

  const { parentForm } = useSubAccountLoginContext()
  const [form] = Form.useForm<FieldType>()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 获取用户信息表单数据
  const getInfoFormData = () => ({
    phonenumber: '',
    email: form.getFieldValue('email') || '',
    smsCode: '',
    emailCode: form.getFieldValue('emailCode') || '',
    parentPhone: parentForm?.getFieldValue('phoneNumber') || '',
    userName: parentForm?.getFieldValue('username') || '',
    userId: ''
  })

  // 登录表单数据
  const loginForm = useRef({
    tenantId: '000001',
    phoneNumber: '',
    username: '',
    password: '',
    userType: 'web_sub_user',
    clientId: import.meta.env.VITE_APP_CLIENT_ID,
    grantType: 'password',
    smsCode: '',
    code: ''
  })

  // 获取登录表单数据
  const getLoginFormData = () => ({
    ...loginForm.current,
    phoneNumber: parentForm?.getFieldValue('phoneNumber') || '',
    username: parentForm?.getFieldValue('username') || '',
    password: parentForm?.getFieldValue('password') || ''
  })

  // 登录接口
  const login = async () => {
    // 先做表单验证
    await form.validateFields()

    // 更新用户信息
    const params = getInfoFormData()
    const user_res = await editUserInfo(params)
    if (user_res.code == 200) {
      window.toast.success(i18n.t('login.sub_account.bind_success'))
    }
    const loginParams = getLoginFormData()
    const { data } = await loginApi(loginParams)
    if (data && data.access_token) {
      localStorage.setItem('token', data.access_token)
      await onSuccess?.()
    }
  }

  const onFinish: FormProps<FieldType>['onFinish'] = (values) => {
    logger.debug('短信登录表单提交成功', values)
    login()
  }

  const onValuesChange = (_changedValues: any, allValues: any) => {
    const valid = !!allValues.email && !!allValues.emailCode
    onFormChange?.(valid)
  }

  const [disabled, setDisabled] = useState(true)
  const [codeBtnText, setCodeBtnText] = useState(codeText)

  const handleSendCode = () => {
    const email = form.getFieldValue('email')

    if (!email) {
      return
    }

    if (!emailRegExp.test(email)) {
      message.error(i18n.t('login.sms_login.phone_invalid'))
      return
    }

    verifyRef?.current?.show()
  }

  const handleChangePhone = (e: any) => {
    const disabled = !e.target.value
    setDisabled(disabled)
  }

  // 倒计时
  const disCount = (time: number) => {
    timerRef.current = setTimeout(() => {
      const next = time - 1
      if (next <= 0) {
        timerRef.current = null
        setDisabled(false)
        setCodeBtnText(codeText)
      } else {
        setCodeBtnText(codeText + '(' + next + ')')
        disCount(next)
      }
    }, 1000)
  }

  // 检查校验接口
  const handleCheck = async () => {
    const email = form.getFieldValue('email')

    // 检查手机号是否已绑定
    const res = await checkBindTargetExists({ email })
    if (res.code === 200 && res.data === true) {
      window.toast.error(i18n.t('login.sub_account.bind_phone_email.email.duplicate_email_message'))
      return
    }

    // 启动倒计时
    setDisabled(true)
    setCodeBtnText(codeText + '(60)')
    disCount(60)

    try {
      // 邮箱发送验证码
      await emailCaptchaApi({ email })
    } catch (error: any) {
      logger.error('EmailBind smsCaptchaAndTokenApi error', error)

      // 清除定时器并重置状态
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setDisabled(false)
      setCodeBtnText(codeText)

      // 显示错误提示
      window.toast.error(i18n.t('login.sub_account.bind_phone_email.email.fail'))

      // 向上抛出原始错误
      throw error
    }
  }

  // 发送验证码---真正走接口的地方
  const sendCode = (verifyParams: any) => {
    logger.info('发送验证码', verifyParams)
    loginForm.current = {
      ...loginForm.current,
      code: verifyParams.captchaVerification
    }
    handleCheck().then()
  }

  // 触发滑块验证码（供父组件调用）
  const triggerVerify = () => {
    handleSendCode()
  }

  /** 暴露给父组件 **/
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

  return (
    <Container>
      <Form
        form={form}
        size="large"
        layout="vertical"
        onFinish={onFinish}
        onValuesChange={onValuesChange}
        autoComplete="off">
        <Form.Item<FieldType>
          name="email"
          label={i18n.t('login.sub_account.bind_phone_email.email.email_label')}
          rules={[
            {
              required: true,
              message: i18n.t('login.sub_account.bind_phone_email.email.required')
            },
            {
              pattern: emailRegExp,
              message: i18n.t('login.sub_account.bind_phone_email.email.invalid')
            }
          ]}>
          <StyleInput
            onChange={handleChangePhone}
            onPressEnter={login}
            placeholder={i18n.t('login.sub_account.bind_phone_email.email.required')}
          />
        </Form.Item>

        <Form.Item<FieldType>
          name="emailCode"
          label={i18n.t('login.sub_account.bind_phone_email.email.code_label')}
          rules={[{ required: true, message: i18n.t('login.sub_account.bind_phone_email.email.code_required') }]}>
          <StyleInput
            suffix={suffix}
            placeholder={i18n.t('login.sub_account.bind_phone_email.email.code_required')}
            onPressEnter={login}
          />
        </Form.Item>
      </Form>
    </Container>
  )
}

export default EmailBind
