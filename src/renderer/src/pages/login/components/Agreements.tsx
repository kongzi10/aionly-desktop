import { loggerService } from '@logger'
import i18n from '@renderer/i18n'
import { USER_UI_HOST } from '@shared/config/constant'
import type { CheckboxProps } from 'antd'
import { Modal } from 'antd'
import { Button, Checkbox } from 'antd'
import React from 'react'
import styled from 'styled-components'

interface AgreementsProps {
  onChange?: (checked: boolean) => void
  checked?: boolean
}

const ACheckbox = styled(Checkbox)`
  .ant-checkbox-label{
    padding-right: 0;
    font-size: 13px;
  }
`
const LinkButton = styled(Button)`
  padding: 0;
  font-size: 13px;
`

const SpanText = styled.span`
  font-size: 13px;
  padding-top: 1px;
`

const logger = loggerService.withContext('Agreements')

export const Agreements = (props: AgreementsProps) => {
  const WebviewStyle: React.CSSProperties = {
    width: '100%',
    height: 'calc(100vh - 300px)',
    // backgroundColor: 'var(--color-background)', // TODO：临时注释，待后续处理（暗黑模式下，嵌入的页面显示有问题）
    display: 'inline-flex'
  }

  const onChange: CheckboxProps['onChange'] = (e) => {
    logger.debug('协议勾选状态变更', { checked: e.target.checked })
    props.onChange?.(e.target.checked)
  }

  const handleShowAgreement = (appKey: string) => {
    const url = `${USER_UI_HOST}/agreement?appKey=${appKey}`
    const text = `login.agreements.${appKey.split('_')[1]}`
    Modal.info({
      title: i18n.t(text),
      width: '80%',
      maskClosable: true,
      content: (
        <webview
          key={appKey}
          src={url}
          style={WebviewStyle}
          allowpopups={'true' as any}
          partition="persist:webview-login"
          nodeintegration={false}
          disablewebsecurity={true}
          useragent={undefined}
        />
      )
    })
  }

  return (
    <div className="flex justify-center">
      <ACheckbox onChange={onChange}>{i18n.t('login.agreements.agree')}</ACheckbox>
      <LinkButton type="link" size="small" onClick={() => handleShowAgreement('agreement_user')}>
        {i18n.t('login.agreements.user')}{' '}
      </LinkButton>
      <SpanText>、</SpanText>
      <LinkButton type="link" size="small" onClick={() => handleShowAgreement('agreement_privacy')}>
        {i18n.t('login.agreements.privacy')}{' '}
      </LinkButton>
      <SpanText>{i18n.t('login.agreements.yu')}</SpanText>
      <LinkButton type="link" size="small" onClick={() => handleShowAgreement('agreenment_disclaimer')}>
        {i18n.t('login.agreements.disclaimer')}
      </LinkButton>
    </div>
  )
}
