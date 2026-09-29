import { DownOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import type { AgentRouteAccessMode, CodexRouteProfile } from '@shared/agentRouter'
import { Button, Form, Input, Radio, Select, Spin, Tooltip } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { AgentRouterCredential, RouteModel } from '../hooks/useAgentRouterSources'
import { useTokenPlanModels } from '../hooks/useTokenPlanModels'
import { AgentCredentialSelect } from './AgentCredentialSelect'

export interface CodexFormValue {
  profileId?: string
  name: string
  credential: AgentRouterCredential
  model: string
}

interface Props {
  apiCredentials: AgentRouterCredential[]
  tokenPlanCredentials: AgentRouterCredential[]
  apiModels: RouteModel[]
  profile?: CodexRouteProfile
  busy: boolean
  onSave: (value: CodexFormValue) => void
  onRemove: () => void
  onCancel: () => void
}

export const CodexProfileForm = ({
  apiCredentials,
  tokenPlanCredentials,
  apiModels,
  profile,
  busy,
  onSave,
  onRemove,
  onCancel
}: Props) => {
  const { t } = useTranslation()
  const [name, setName] = useState(profile?.name ?? '')
  const [accessMode, setAccessMode] = useState<AgentRouteAccessMode>(profile?.accessMode ?? 'api')
  const [credentialId, setCredentialId] = useState<string>()
  const [model, setModel] = useState(profile?.model)
  const credentials = accessMode === 'api' ? apiCredentials : tokenPlanCredentials
  const credential = credentials.find((item) => item.id === credentialId)
  const tokenPlan = useTokenPlanModels(accessMode === 'tokenPlan' ? credential : undefined)
  const models = accessMode === 'api' ? apiModels : tokenPlan.models

  useEffect(() => {
    setName(profile?.name ?? '')
    setAccessMode(profile?.accessMode ?? 'api')
    setCredentialId(undefined)
    setModel(profile?.model)
  }, [profile])

  useEffect(() => {
    if (!profile || credentialId) return
    const savedCredential = credentials.find(
      (item) => item.kind === profile.accessMode && item.label === profile.credentialName
    )
    if (savedCredential) setCredentialId(savedCredential.id)
  }, [credentials, credentialId, profile])

  const modelOptions = useMemo(() => models.map((item) => ({ label: item.id, value: item.id })), [models])
  const complete = Boolean(name.trim() && credential && model)
  const modelsUnavailable = accessMode === 'tokenPlan' && (tokenPlan.loading || tokenPlan.error)
  const clearRoute = () => {
    setCredentialId(undefined)
    setModel(undefined)
  }

  return (
    <Panel data-testid="codex-profile-form">
      <Field label={t('agentRouter.codex.profileName')}>
        <Input
          aria-label={t('agentRouter.codex.profileName')}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <Field label={t('agentRouter.accessMode')}>
        <Radio.Group
          value={accessMode}
          options={[
            { label: 'API', value: 'api' },
            { label: 'TokenPlan', value: 'tokenPlan' }
          ]}
          onChange={(event) => {
            setAccessMode(event.target.value)
            clearRoute()
          }}
        />
      </Field>
      <Field label={t('agentRouter.apiKey')}>
        <AgentCredentialSelect
          key={accessMode}
          value={credentialId}
          credentials={credentials}
          onChange={(value) => {
            setCredentialId(value)
            if (accessMode === 'tokenPlan') setModel(undefined)
          }}
          placeholder={profile?.credentialName || t('agentRouter.codex.selectCredential')}
        />
      </Field>
      <Field label={t('agentRouter.modelId')}>
        <Select
          value={model}
          options={modelOptions}
          onChange={setModel}
          disabled={!credential || modelsUnavailable}
          allowClear
          showSearch
          suffixIcon={
            <SelectSuffix>
              <Tooltip title={t('agentRouter.codex.responsesOnlyHint')}>
                <ExclamationCircleOutlined aria-label={t('agentRouter.codex.responsesOnlyHint')} />
              </Tooltip>
              <DownOutlined aria-hidden="true" />
            </SelectSuffix>
          }
        />
      </Field>
      {tokenPlan.loading ? <Spin size="small" /> : null}
      {tokenPlan.error ? <Hint>{t('agentRouter.codex.modelLoadFailed')}</Hint> : null}
      <Actions>
        <Button disabled={busy} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        {profile ? (
          <Button danger disabled={busy} onClick={onRemove}>
            {t('agentRouter.remove')}
          </Button>
        ) : null}
        <Button
          type="primary"
          disabled={busy || !complete || modelsUnavailable}
          onClick={() =>
            credential &&
            model &&
            onSave({
              profileId: profile?.id,
              name: name.trim(),
              credential,
              model
            })
          }>
          {t('agentRouter.codex.save')}
        </Button>
      </Actions>
    </Panel>
  )
}

const Panel = styled.div`
  display: flex; flex-direction: column; gap: 4px;
`
const Field = styled(Form.Item)`margin-bottom:0;`
const Hint = styled.div`color: var(--color-error);`
const SelectSuffix = styled.span`
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-3);

  > .anticon:first-child {
    color: var(--color-error, #ff4d4f);
    pointer-events: auto;
  }
`
const Actions = styled.div`
  display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; padding-top: 10px; border-top: 1px solid var(--color-border);
`
