import { CheckCircleFilled, ExclamationCircleFilled } from '@ant-design/icons'
import type { TargetSnapshot } from '@shared/agentRouter'
import { Button } from 'antd'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

export const TargetStatusCard = ({ target, onSelect }: { target: TargetSnapshot | null; onSelect: () => void }) => {
  const { t } = useTranslation()
  const ready = Boolean(target?.exists && target.readable && target.writable)
  return (
    <Card $ready={ready}>
      <StateIcon $ready={ready}>{ready ? <CheckCircleFilled /> : <ExclamationCircleFilled />}</StateIcon>
      <Copy>
        <strong>{ready ? t('agentRouter.configReady') : t('agentRouter.configNeedsAttention')}</strong>
        <span>
          {ready ? t('agentRouter.configReadyDescription') : t('agentRouter.configNeedsAttentionDescription')}
        </span>
      </Copy>
      <Facts>
        <Fact>
          <b>{target?.managedEntryCount ?? 0}</b>
          <span>{t('agentRouter.managedEntries')}</span>
        </Fact>
        <Divider />
        <Fact>
          <b>{target?.externalEntryCount ?? 0}</b>
          <span>{t('agentRouter.externalEntries')}</span>
        </Fact>
      </Facts>
      {!ready ? (
        <Button size="small" onClick={onSelect}>
          {t('agentRouter.changeConfig')}
        </Button>
      ) : null}
    </Card>
  )
}

const Card = styled.div<{
  $ready: boolean
}>`height: 116px; padding: 16px; display: flex; align-items: center; gap: 12px; border: 1px solid ${({ $ready }) => ($ready ? 'rgba(34,170,120,.3)' : 'rgba(233,154,46,.35)')}; border-radius: 12px; background: color-mix(in srgb, ${({ $ready }) => ($ready ? '#22aa78' : '#e99a2e')} 7%, var(--color-background));`
const StateIcon = styled.div<{
  $ready: boolean
}>`width: 38px; height: 38px; flex: 0 0 38px; display: grid; place-items: center; border-radius: 50%; color: ${({ $ready }) => ($ready ? '#1f9d70' : '#d4861e')}; background: color-mix(in srgb, ${({ $ready }) => ($ready ? '#22aa78' : '#e99a2e')} 14%, var(--color-background)); font-size: 20px;`
const Copy = styled.div`min-width: 0; flex: 1; display: flex; flex-direction: column; strong { font-size: 15px; } span { margin-top: 3px; color: var(--color-text-3); font-size: 11px; line-height: 1.4; }`
const Facts = styled.div`display: flex; align-items: center; gap: 12px;`
const Fact = styled.div`min-width: 54px; display: flex; flex-direction: column; align-items: center; b { color: var(--color-text); font-size: 18px; } span { color: var(--color-text-3); font-size: 10px; white-space: nowrap; }`
const Divider = styled.div`width: 1px; height: 30px; background: var(--color-border);`
