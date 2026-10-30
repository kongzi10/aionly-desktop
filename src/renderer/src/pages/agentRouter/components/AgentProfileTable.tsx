import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { Switch } from 'antd'
import type { Key, KeyboardEvent } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { AgentRouterCredential } from '../hooks/useAgentRouterSources'
import { ConfirmDialog } from './RouteFormModal'

interface AgentProfileRow {
  id: Key
  name: string
  accessMode: 'api' | 'tokenPlan'
  credentialId: string
  credentialName?: string
}

interface Props<T extends AgentProfileRow> {
  testId: string
  profiles: T[]
  credentials: AgentRouterCredential[]
  activeProfileId?: string
  busy?: boolean
  emptyDescription: string
  removeConfirmationTitle: string
  onEdit: (profileId: string) => void
  onToggle: (profile: T, enabled: boolean) => void
  onRemove: (profile: T) => void
}

export const AgentProfileTable = <T extends AgentProfileRow>({
  testId,
  profiles,
  credentials,
  activeProfileId,
  busy = false,
  emptyDescription,
  removeConfirmationTitle,
  onEdit,
  onToggle,
  onRemove
}: Props<T>) => {
  const { t } = useTranslation()
  const [profileToRemove, setProfileToRemove] = useState<T>()

  const getCredential = (profile: T) =>
    credentials.find(
      (credential) => credential.kind === profile.accessMode && credential.label === profile.credentialName
    )

  if (!profiles.length) {
    return (
      <EmptyBox data-testid={testId}>
        <strong>{emptyDescription}</strong>
      </EmptyBox>
    )
  }

  const openFromKeyboard = (event: KeyboardEvent, profileId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onEdit(profileId)
    }
  }

  return (
    <>
      <Rows data-testid={testId}>
        {profiles.map((profile) => {
          const active = profile.id === activeProfileId
          const credential = getCredential(profile)
          return (
            <Row
              key={String(profile.id)}
              $active={active}
              role="button"
              tabIndex={0}
              onClick={() => onEdit(String(profile.id))}
              onKeyDown={(event) => openFromKeyboard(event, String(profile.id))}>
              <Identity>
                <NameLine>
                  <strong>{profile.name}</strong>
                  {active ? <ActiveChip>{t('agentRouter.effective')}</ActiveChip> : null}
                </NameLine>
                <CredentialLine>
                  <strong>{profile.credentialName || credential?.label || profile.credentialId}</strong>
                  {credential ? <MutedText>{maskCredential(credential.value)}</MutedText> : null}
                </CredentialLine>
              </Identity>
              <AccessChip $mode={profile.accessMode}>{profile.accessMode === 'api' ? 'API' : 'TokenPlan'}</AccessChip>
              <RowActions onClick={(event) => event.stopPropagation()}>
                <Switch
                  size="small"
                  checked={active}
                  disabled={busy || active}
                  aria-label={profile.name}
                  onChange={() => onToggle(profile, true)}
                />
                <IconKey
                  type="button"
                  aria-label={`${t('agentRouter.edit')} ${profile.name}`}
                  title={t('agentRouter.edit')}
                  onClick={() => onEdit(String(profile.id))}>
                  <EditOutlined />
                </IconKey>
                <IconKey
                  type="button"
                  $danger
                  aria-label={`${t('agentRouter.remove')} ${profile.name}`}
                  title={t('agentRouter.remove')}
                  onClick={() => setProfileToRemove(profile)}>
                  <DeleteOutlined />
                </IconKey>
              </RowActions>
            </Row>
          )
        })}
      </Rows>
      <ConfirmDialog
        open={Boolean(profileToRemove)}
        title={removeConfirmationTitle}
        okText={t('agentRouter.remove')}
        cancelText={t('common.cancel')}
        okButtonProps={{ danger: true }}
        onCancel={() => setProfileToRemove(undefined)}
        onOk={() => {
          if (profileToRemove) onRemove(profileToRemove)
          setProfileToRemove(undefined)
        }}
      />
    </>
  )
}

const maskCredential = (value: string) => (value.length > 8 ? `${value.slice(0, 4)}••••${value.slice(-4)}` : '••••••••')

const Rows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 1px 0 2px;
`

const Row = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
  min-height: 62px;
  padding: 9px 10px 9px 14px;
  border: 1px solid ${(props) => (props.$active ? 'rgb(90 143 215 / 38%)' : 'rgb(132 172 226 / 18%)')};
  border-radius: 12px;
  background: rgb(246 250 255);
  cursor: pointer;
  transition: box-shadow 0.2s ease;

  body.dark & {
    background: rgb(255 255 255 / 5%);
  }

  &:hover {
    box-shadow: 0 8px 20px rgb(77 122 190 / 10%);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 1px;
  }
`

const Identity = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
`

const NameLine = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;

  strong {
    flex: 0 1 auto;
    overflow: hidden;
    color: var(--color-text-1);
    font-size: 13px;
    font-weight: 650;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
`

const CredentialLine = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;

  strong {
    flex: 0 1 auto;
    overflow: hidden;
    color: var(--color-text-2);
    font-size: 11.5px;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
`

const MutedText = styled.span`
  overflow: hidden;
  color: var(--color-text-3);
  font-family: monospace;
  font-size: 11px;
  white-space: nowrap;
  text-overflow: ellipsis;
`

const ActiveChip = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgb(233 246 240);
  color: #1f9d70;
  font-size: 10.5px;
  font-weight: 600;
  white-space: nowrap;

  body.dark & {
    background: rgb(34 170 120 / 18%);
  }
`

const AccessChip = styled.span<{ $mode: 'api' | 'tokenPlan' }>`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  height: 22px;
  padding: 0 9px;
  border-radius: 999px;
  background: ${(props) => (props.$mode === 'api' ? 'rgb(228 238 255)' : 'rgb(220 245 247)')};
  color: ${(props) => (props.$mode === 'api' ? 'rgb(64 116 234)' : 'rgb(6 158 176)')};
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;

  body.dark & {
    background: ${(props) => (props.$mode === 'api' ? 'rgb(64 116 234 / 20%)' : 'rgb(6 158 176 / 20%)')};
    color: ${(props) => (props.$mode === 'api' ? 'rgb(140 174 255)' : 'rgb(120 214 226)')};
  }
`

const RowActions = styled.div`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
`

const IconKey = styled.button<{ $danger?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 50%;
  background: transparent;
  color: ${(props) => (props.$danger ? 'var(--color-error, #d9534f)' : 'var(--color-text-3)')};
  font-size: 13px;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    opacity 0.2s ease;

  &:hover:not(:disabled) {
    background: ${(props) => (props.$danger ? 'rgb(217 83 79 / 12%)' : 'rgb(96 150 255 / 12%)')};
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 1px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`

const EmptyBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 2px 0;
  padding: 36px 16px;
  border: 1px dashed rgb(132 172 226 / 30%);
  border-radius: 14px;
  text-align: center;

  strong {
    color: var(--color-text-2);
    font-size: 13px;
    font-weight: 600;
  }

  span {
    color: var(--color-text-3);
    font-size: 11.5px;
    line-height: 1.5;
  }
`
