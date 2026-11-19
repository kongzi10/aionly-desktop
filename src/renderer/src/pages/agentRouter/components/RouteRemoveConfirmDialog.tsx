import { ExclamationCircleOutlined } from '@ant-design/icons'
import type { AgentRouteModel } from '@shared/agentRouter'
import { Modal } from 'antd'
import { useTranslation } from 'react-i18next'
import { css, styled } from 'styled-components'

/**
 * V1 经典危险确认弹窗（docs/agent-router-delete-dialog/styles/style-v1-classic-danger.css）。
 * 仅用于路由删除场景，不改动共享的 ConfirmDialog，避免波及其他二次确认。
 */
const dangerConfirmShell = css`
  &&& .ant-modal-content {
    padding: 0;
    border: 1px solid #e8ecf2;
    border-radius: 16px;
    background: #fff;
    box-shadow:
      0 20px 48px rgba(15, 23, 42, 0.14),
      0 2px 8px rgba(15, 23, 42, 0.05);
    overflow: hidden;
  }

  body.dark &&& .ant-modal-content {
    border-color: rgb(255 255 255 / 10%);
    background: #1c1c1f;
    box-shadow: 0 20px 48px rgb(0 0 0 / 50%);
  }

  &&& .ant-modal-close {
    top: 18px;
    inset-inline-end: 18px;
    width: 28px;
    height: 28px;
    color: #94a3b8;
  }

  &&& .ant-modal-header {
    margin: 0;
    padding: 0;
    border-bottom: 0;
    background: transparent;
  }

  &&& .ant-modal-body {
    padding: 0;
  }

  &&& .ant-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin: 0;
    padding: 14px 24px 20px;
    border-top: 1px solid #f1f5f9;
  }

  body.dark &&& .ant-modal-footer {
    border-top-color: rgb(255 255 255 / 8%);
  }

  &&& .ant-modal-footer .ant-btn {
    min-width: 72px;
    height: 34px;
    padding: 0 16px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 600;
    box-shadow: none;
  }

  &&& .ant-modal-footer .ant-btn-default {
    border: 1px solid #e2e8f0;
    background: #fff;
    color: #475569;
  }

  &&& .ant-modal-footer .ant-btn-default:hover {
    border-color: #94a3b8;
  }

  body.dark &&& .ant-modal-footer .ant-btn-default {
    border-color: rgb(255 255 255 / 16%);
    background: transparent;
    color: #cbd5e1;
  }

  &&& .ant-modal-footer .ant-btn-dangerous.ant-btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 1px solid #ff4d50;
    background: #ff4d50;
    color: #fff;
  }

  &&& .ant-modal-footer .ant-btn-dangerous.ant-btn-primary:hover {
    border-color: #e04144;
    background: #e04144;
  }
`

const DangerModal = styled(Modal).attrs({ centered: true, width: 380 })`
  ${dangerConfirmShell}
`

const Header = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 24px 24px 18px;
`

const DangerIcon = styled.span`
  display: grid;
  place-items: center;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #fff2f2;
  color: #ff4d50;
  font-size: 20px;

  body.dark & {
    background: rgb(255 77 80 / 12%);
  }
`

const Heading = styled.div`
  min-width: 0;
  padding-top: 1px;
`

const Title = styled.h3`
  margin: 0;
  color: #1f2937;
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;

  body.dark & {
    color: #e8eaed;
  }
`

const Subtitle = styled.p`
  margin: 3px 0 0;
  color: #94a3b8;
  font-size: 12px;

  body.dark & {
    color: #6b7280;
  }
`

const Body = styled.div`
  padding: 0 24px 22px;
`

const Description = styled.p`
  margin: 0 0 12px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.65;

  body.dark & {
    color: #9aa4b2;
  }
`

const Target = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #ffd9da;
  border-radius: 10px;
  background: #fff2f2;

  body.dark & {
    border-color: rgb(255 77 80 / 28%);
    background: rgb(255 77 80 / 12%);
  }
`

const TargetMark = styled.span`
  display: grid;
  place-items: center;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #ff4d50;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
`

const TargetName = styled.span`
  overflow: hidden;
  color: #1f2937;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;

  body.dark & {
    color: #e8eaed;
  }
`

const TargetMeta = styled.span`
  flex: 0 0 auto;
  margin-left: auto;
  color: #64748b;
  font-size: 11px;

  body.dark & {
    color: #9aa4b2;
  }
`

interface RouteRemoveConfirmDialogProps {
  open: boolean
  route: AgentRouteModel | null
  onCancel: () => void
  onOk: () => void
}

export const RouteRemoveConfirmDialog = ({ open, route, onCancel, onOk }: RouteRemoveConfirmDialogProps) => {
  const { t } = useTranslation()

  return (
    <DangerModal
      open={open}
      title={
        <Header>
          <DangerIcon>
            <ExclamationCircleOutlined />
          </DangerIcon>
          <Heading>
            <Title>{t('agentRouter.removeConfirmTitle')}</Title>
            <Subtitle>{t('agentRouter.removeConfirmSubtitle')}</Subtitle>
          </Heading>
        </Header>
      }
      okText={t('agentRouter.remove')}
      okButtonProps={{ danger: true }}
      cancelText={t('common.cancel')}
      onCancel={onCancel}
      onOk={onOk}>
      <Body>
        <Description>{t('agentRouter.removeConfirmDescription')}</Description>
        {route && (
          <Target>
            <TargetMark>{route.modelId.slice(0, 1).toUpperCase()}</TargetMark>
            <TargetName>{route.modelId}</TargetName>
            <TargetMeta>
              {route.accessMode === 'api' ? 'API' : 'TokenPlan'} ·{' '}
              {t(route.enabled ? 'common.enabled' : 'common.disabled')}
            </TargetMeta>
          </Target>
        )}
      </Body>
    </DangerModal>
  )
}
