import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { Button, Empty, Modal, Switch, Table, Tag } from 'antd'
import type { Key, KeyboardEvent } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { AgentRouterCredential } from '../hooks/useAgentRouterSources'

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
  newLabel: string
  removeConfirmationTitle: string
  onEdit: (profileId: string) => void
  onToggle: (profile: T, enabled: boolean) => void
  onRemove: (profile: T) => void
  onNew: () => void
}

export const AgentProfileTable = <T extends AgentProfileRow>({
  testId,
  profiles,
  credentials,
  activeProfileId,
  busy = false,
  emptyDescription,
  newLabel,
  removeConfirmationTitle,
  onEdit,
  onToggle,
  onRemove,
  onNew
}: Props<T>) => {
  const { t } = useTranslation()
  const [profileToRemove, setProfileToRemove] = useState<T>()

  const getCredential = (profile: T) =>
    credentials.find(
      (credential) => credential.kind === profile.accessMode && credential.label === profile.credentialName
    )

  if (!profiles.length) {
    return (
      <CompactEmpty data-testid={testId} image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription}>
        <Button onClick={onNew}>{newLabel}</Button>
      </CompactEmpty>
    )
  }

  const columns: TableColumnsType<T> = [
    {
      title: t('agentRouter.routeName'),
      key: 'name',
      render: (_, profile) => (
        <NameLine>
          <strong>{profile.name}</strong>
        </NameLine>
      )
    },
    {
      title: t('agentRouter.accessMode'),
      dataIndex: 'accessMode',
      key: 'accessMode',
      width: 90,
      render: (accessMode: T['accessMode']) => <Tag>{accessMode === 'api' ? 'API' : 'TokenPlan'}</Tag>
    },
    {
      title: t('agentRouter.apiKey'),
      key: 'credential',
      width: 180,
      render: (_, profile) => {
        const credential = getCredential(profile)
        return (
          <ProfileIdentity>
            <strong>{profile.credentialName || credential?.label || profile.credentialId}</strong>
            {credential ? <span>{maskCredential(credential.value)}</span> : null}
          </ProfileIdentity>
        )
      }
    },
    {
      title: t('agentRouter.actions'),
      key: 'actions',
      width: 210,
      render: (_, profile) => (
        <RowActions onClick={(event) => event.stopPropagation()}>
          <Switch
            size="small"
            checked={profile.id === activeProfileId}
            disabled={busy || profile.id === activeProfileId}
            aria-label={profile.name}
            onChange={() => onToggle(profile, true)}
          />
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEdit(String(profile.id))}>
            {t('agentRouter.edit')}
          </Button>
          <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={() => setProfileToRemove(profile)}>
            {t('agentRouter.remove')}
          </Button>
        </RowActions>
      )
    }
  ]

  const openFromKeyboard = (event: KeyboardEvent, profileId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onEdit(profileId)
    }
  }

  return (
    <>
      <TableContainer data-testid={testId}>
        <Table<T>
          dataSource={profiles}
          columns={columns}
          pagination={false}
          rowKey="id"
          size="small"
          tableLayout="fixed"
          onRow={(profile) => ({
            role: 'button',
            tabIndex: 0,
            onClick: () => onEdit(String(profile.id)),
            onKeyDown: (event) => openFromKeyboard(event, String(profile.id))
          })}
        />
      </TableContainer>
      <Modal
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

const CompactEmpty = styled(Empty)`
  margin: 13px 0 12px;
  .ant-empty-image { height: 30px; margin-bottom: 4px; }
  .ant-empty-description { font-size: 11px; }
`
const TableContainer = styled.div`
  .ant-table { background: transparent; }
  .ant-table-thead > tr > th { color: var(--color-text-3); font-size: 11px; font-weight: 600; background: transparent; }
  .ant-table-tbody > tr > td { height: 58px; }
  .ant-table-tbody > tr { cursor: pointer; }
`
const ProfileIdentity = styled.div`
  min-width: 0; display: flex; flex-direction: column; gap: 2px;
  > span { overflow: hidden; color: var(--color-text-3); font-size: 11px; white-space: nowrap; text-overflow: ellipsis; }
`
const NameLine = styled.div`
  min-width: 0; display: flex; align-items: center; gap: 5px;
  strong { overflow: hidden; color: var(--color-text-1); font-size: 13px; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }
`
const RowActions = styled.div`
  display: flex; align-items: center; justify-content: flex-start; gap: 0;
  .ant-btn { padding-inline: 5px; font-size: 11px; }
`
