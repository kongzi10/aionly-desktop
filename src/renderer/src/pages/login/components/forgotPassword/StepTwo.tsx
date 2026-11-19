import { updatePwdApi } from '@renderer/api/login'
import { LoginSceneType, useLoginContext } from '@renderer/pages/login/contexts/LoginContext'
import { Button, Flex, Form, type FormProps, Input } from 'antd'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  changeStep?: (step: number, data?: any) => void
  validateResult: any
}

type FieldType = {
  newPassword: string
  confirmPassword: string
}

const passwordRegexp = /^(?![\d]+$)(?![a-zA-Z]+$)(?![^\da-zA-Z]+$)([^\u4e00-\u9fa5\s]){6,20}$/

const StepTwo: React.FC<Props> = ({ changeStep, validateResult }) => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm<FieldType>()
  const { setScene } = useLoginContext()

  // const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 更新密码接口
  const fetchUpdatePwdApi = async () => {
    try {
      setLoading(true)
      const confirmPassword = form.getFieldValue('confirmPassword')
      const requestData = {
        phonenumber: validateResult.phonenumber || undefined,
        email: validateResult.email || undefined,
        token: validateResult.token,
        smsCode: validateResult.smsCode || undefined,
        emailCode: validateResult.emailCode || undefined,
        newPassword: confirmPassword
      }
      await updatePwdApi(requestData)
      changeStep?.(3)
    } finally {
      setLoading(false)
    }
  }

  const onFinish: FormProps<FieldType>['onFinish'] = async () => {
    await fetchUpdatePwdApi()
  }

  const handleNext = async () => {
    await form.validateFields()
    await fetchUpdatePwdApi()
  }

  return (
    <Container>
      <LoginTitle>{t('login.forgot_password.stepTwo.title')}</LoginTitle>
      <SubTitle>{t('login.forgot_password.stepTwo.sub_title')}</SubTitle>
      <Form layout="vertical" form={form} size="large" onFinish={onFinish} autoComplete="off">
        <Form.Item<FieldType>
          label={t('login.forgot_password.stepTwo.new_password_label')}
          name="newPassword"
          rules={[
            {
              required: true,
              message: t('login.forgot_password.stepTwo.new_password_required')
            },
            {
              pattern: passwordRegexp,
              message: t('login.forgot_password.stepTwo.new_password_invalid')
            }
          ]}>
          <StyleInput
            onPressEnter={handleNext}
            placeholder={t('login.forgot_password.stepTwo.new_password_required')}
          />
        </Form.Item>

        <Form.Item<FieldType>
          label={t('login.forgot_password.stepTwo.confirm_password_label')}
          name="confirmPassword"
          rules={[
            {
              required: true,
              message: t('login.forgot_password.stepTwo.confirm_password_required')
            },
            {
              validator: (_, value) => {
                if (value && value !== form.getFieldValue('newPassword')) {
                  return Promise.reject(new Error(t('login.forgot_password.stepTwo.password_not_match')))
                }
                return Promise.resolve()
              }
            }
          ]}>
          <StyleInput
            onPressEnter={handleNext}
            placeholder={t('login.forgot_password.stepTwo.confirm_password_required')}
          />
        </Form.Item>

        <Form.Item style={{ marginTop: 30, marginBottom: 5 }}>
          <LoginButton type="primary" htmlType="submit" block loading={loading}>
            {t('login.forgot_password.next')}
          </LoginButton>
        </Form.Item>
        <Form.Item>
          <Flex justify="flex-end">
            <Button type="link" size="small" onClick={() => setScene(LoginSceneType.MainAccount)}>
              {t('login.back_main_login')}
            </Button>
          </Flex>
        </Form.Item>
      </Form>
    </Container>
  )
}

export default StepTwo

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
`

const LoginTitle = styled.div`
  font-family: Alimama ShuHeiTi;
  font-weight: 700;
  color: #060a26;
  font-size: 30px;
  margin: 0 auto;
`

const SubTitle = styled.div`
  font-weight: 400;
  color: #36445b;
  font-size: 12px;
  padding: 5px 0 20px;
  font-family: 'Alibaba PuHuiTi 3';
  opacity: 55%;
`

const StyleInput = styled(Input.Password)`
  height: 46px;
`

const LoginButton = styled(Button)`
  width: 100%;
  height: 46px;
  background: rgba(6, 10, 38, 1);
  border-radius: 8px;

  &:not(:disabled):hover {
    background: rgba(6, 10, 38, 0.8) !important;
  }
`
