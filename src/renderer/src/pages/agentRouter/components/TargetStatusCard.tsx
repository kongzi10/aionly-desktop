import { CheckCircleFilled, ExclamationCircleFilled, InfoCircleFilled } from '@ant-design/icons'
import type { TargetSnapshot } from '@shared/agentRouter'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

type Tone = 'success' | 'neutral' | 'warning'

export const TargetStatusCard = ({
  target,
  onSelect,
  showEntryCounts = true,
  missingConfigWillBeCreated = false
}: {
  target: TargetSnapshot | null
  onSelect: () => void
  showEntryCounts?: boolean
  missingConfigWillBeCreated?: boolean
}) => {
  const { t } = useTranslation()
  const ready = Boolean(target?.detectionState === 'detected' && target.exists && target.readable && target.writable)
  const profileTarget = target?.targetId === 'codex' || target?.targetId === 'claude-code'
  const willCreateConfig = missingConfigWillBeCreated && target?.detectionState === 'notFound'
  const tone: Tone = ready ? 'success' : willCreateConfig ? 'neutral' : 'warning'

  return (
    <StatusBar $tone={tone} data-testid="target-status-bar">
      <StateIcon $tone={tone} aria-hidden="true">
        {tone === 'success' ? (
          <CheckCircleFilled />
        ) : tone === 'warning' ? (
          <ExclamationCircleFilled />
        ) : (
          <InfoCircleFilled />
        )}
      </StateIcon>
      <Copy>
        <strong>
          {ready
            ? t('agentRouter.configReady')
            : willCreateConfig
              ? t('agentRouter.configNotFoundTitle')
              : t('agentRouter.configNeedsAttention')}
        </strong>
        {!ready ? (
          <span>
            {willCreateConfig
              ? t('agentRouter.configNotFoundDescription')
              : t('agentRouter.configNeedsAttentionDescription')}
          </span>
        ) : null}
        {profileTarget ? <ConfigPath title={target.configPath}>{target.configPath}</ConfigPath> : null}
        {profileTarget && target.installed === false ? (
          <Notice>{t('agentRouter.installationNotDetectedDescription')}</Notice>
        ) : null}
      </Copy>
      {ready && showEntryCounts ? (
        <Facts>
          <Fact>
            <b>{target?.managedEntryCount ?? 0}</b>
            <span>{t('agentRouter.managedEntries')}</span>
          </Fact>
          <Divider aria-hidden="true" />
          <Fact>
            <b>{target?.externalEntryCount ?? 0}</b>
            <span>{t('agentRouter.externalEntries')}</span>
          </Fact>
        </Facts>
      ) : null}
      <Action type="button" onClick={onSelect}>
        {t('agentRouter.changeConfig')}
      </Action>
    </StatusBar>
  )
}

const toneColor = (tone: Tone) => (tone === 'success' ? '34 170 120' : tone === 'warning' ? '233 154 46' : '96 150 255')

const StatusBar = styled.div<{ $tone: Tone }>`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  min-height: 36px;
  padding: 6px 10px 6px 12px;
  border: 1px solid rgb(${(props) => toneColor(props.$tone)} / 22%);
  border-radius: 12px;
  background: rgb(${(props) => toneColor(props.$tone)} / 8%);

  body.dark & {
    background: rgb(${(props) => toneColor(props.$tone)} / 14%);
  }
`

const StateIcon = styled.span<{ $tone: Tone }>`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: rgb(${(props) => toneColor(props.$tone)});
  font-size: 15px;

  body.light & {
    color: ${(props) =>
      props.$tone === 'success' ? '#1f9d70' : props.$tone === 'warning' ? '#d4861e' : 'rgb(64 116 234)'};
  }
`

const Copy = styled.div`
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  min-width: 0;

  strong {
    color: var(--color-text);
    font-size: 12.5px;
    font-weight: 650;
    white-space: nowrap;
  }

  span {
    overflow: hidden;
    color: var(--color-text-3);
    font-size: 11.5px;
    line-height: 1.4;
    text-overflow: ellipsis;
  }
`

const Facts = styled.div`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
`

const Fact = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgb(255 255 255 / 78%);

  body.dark & {
    background: rgb(255 255 255 / 8%);
  }

  b {
    color: var(--color-text);
    font-size: 12px;
    font-weight: 650;
  }

  span {
    color: var(--color-text-3);
    font-size: 10.5px;
    white-space: nowrap;
  }
`

const Divider = styled.span`
  width: 1px;
  height: 14px;
  background: var(--color-border);
`

const ConfigPath = styled.span`
  flex-basis: 100%;
  color: var(--color-text-3);
`

const Notice = styled.span`
  flex-basis: 100%;
  white-space: normal;
`

const Action = styled.button`
  flex: 0 0 auto;
  height: 24px;
  padding: 0 10px;
  border: 1px solid rgb(132 172 226 / 34%);
  border-radius: 999px;
  background: rgb(255 255 255 / 92%);
  color: var(--color-primary);
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: rgb(90 143 215 / 52%);
    box-shadow: 0 4px 12px rgb(96 150 255 / 16%);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 1px;
  }

  body.dark & {
    background: rgb(255 255 255 / 8%);
  }
`
