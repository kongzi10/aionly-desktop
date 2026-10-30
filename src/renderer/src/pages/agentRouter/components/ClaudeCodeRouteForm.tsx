import type { AgentRouteAccessMode, ClaudeCodeRouteProfile } from '@shared/agentRouter'
import { Button, Form, Input, Radio, Select, Spin } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { AgentRouterCredential, RouteModel } from '../hooks/useAgentRouterSources'
import { useTokenPlanModels } from '../hooks/useTokenPlanModels'
import { AgentCredentialSelect } from './AgentCredentialSelect'
import { getModalPopupContainer } from './RouteFormModal'

export interface ClaudeCodeFormValue {
  profileId?: string
  name: string
  credential: AgentRouterCredential
  models: ClaudeCodeRouteProfile['models']
}

interface Props {
  apiCredentials: AgentRouterCredential[]
  tokenPlanCredentials: AgentRouterCredential[]
  apiModels: RouteModel[]
  profile?: ClaudeCodeRouteProfile
  busy: boolean
  onSave: (value: ClaudeCodeFormValue) => void
  onCancel: () => void
}

interface ModelSlotState {
  model?: string
  displayName?: string
}

const ROLES = ['sonnet', 'opus', 'haiku'] as const
type Role = (typeof ROLES)[number]

const ROLE_LABEL: Record<Role, string> = { sonnet: 'Sonnet', opus: 'Opus', haiku: 'Haiku' }

export const ClaudeCodeRouteForm = ({
  apiCredentials,
  tokenPlanCredentials,
  apiModels,
  profile,
  busy,
  onSave,
  onCancel
}: Props) => {
  const { t } = useTranslation()
  const [name, setName] = useState(profile?.name ?? '')
  const [accessMode, setAccessMode] = useState<AgentRouteAccessMode>(profile?.accessMode ?? 'api')
  const [credentialId, setCredentialId] = useState<string>()
  const [slots, setSlots] = useState<Record<Role, ModelSlotState>>({
    opus: { model: profile?.models.opus, displayName: profile?.models.opusName },
    sonnet: { model: profile?.models.sonnet, displayName: profile?.models.sonnetName },
    haiku: { model: profile?.models.haiku, displayName: profile?.models.haikuName }
  })
  const [defaultModel, setDefaultModel] = useState(profile?.models.default)
  const credentials = accessMode === 'api' ? apiCredentials : tokenPlanCredentials
  const credential = credentials.find((item) => item.id === credentialId)
  const tokenPlan = useTokenPlanModels(accessMode === 'tokenPlan' ? credential : undefined)
  const models = accessMode === 'api' ? apiModels : tokenPlan.models

  useEffect(() => {
    setName(profile?.name ?? '')
    setAccessMode(profile?.accessMode ?? 'api')
    setCredentialId(undefined)
    setSlots({
      opus: { model: profile?.models.opus, displayName: profile?.models.opusName },
      sonnet: { model: profile?.models.sonnet, displayName: profile?.models.sonnetName },
      haiku: { model: profile?.models.haiku, displayName: profile?.models.haikuName }
    })
    setDefaultModel(profile?.models.default)
  }, [profile])

  useEffect(() => {
    if (!profile || credentialId) return
    // Prefer the stored id; fall back to label matching for profiles saved before credentialId existed.
    const savedCredential =
      credentials.find((item) => item.id === profile.credentialId) ??
      credentials.find((item) => item.kind === profile.accessMode && item.label === profile.credentialName)
    if (savedCredential) setCredentialId(savedCredential.id)
  }, [credentials, credentialId, profile])

  const modelOptions = useMemo(() => models.map((model) => ({ label: model.id, value: model.id })), [models])
  const complete = Boolean(name.trim() && credential)
  const modelsUnavailable = accessMode === 'tokenPlan' && (tokenPlan.loading || tokenPlan.error)
  const filledSlots = ROLES.filter((role) => slots[role].model).length
  const clearRoute = () => {
    setCredentialId(undefined)
    setSlots({ opus: {}, sonnet: {}, haiku: {} })
    setDefaultModel(undefined)
  }
  const updateSlot = (role: Role, patch: ModelSlotState) =>
    setSlots((current) => ({ ...current, [role]: { ...current[role], ...patch } }))

  return (
    <Panel data-testid="claude-code-route-form">
      <Field label={t('agentRouter.claudeCode.profileName')}>
        <Input
          aria-label={t('agentRouter.claudeCode.profileName')}
          placeholder={t('agentRouter.claudeCode.profileName')}
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
            setSlots({ opus: {}, sonnet: {}, haiku: {} })
            setDefaultModel(undefined)
          }}
          placeholder={profile?.credentialName || t('agentRouter.claudeCode.selectCredential')}
        />
      </Field>
      <MappingSection>
        <MappingHeader>
          <strong>{t('agentRouter.claudeCode.modelMapping')}</strong>
          <SlotCounter $filled={filledSlots > 0}>
            {filledSlots}/{ROLES.length}
          </SlotCounter>
        </MappingHeader>
        <GridHead>
          <span>{t('agentRouter.claudeCode.modelRole')}</span>
          <span>{t('agentRouter.claudeCode.displayName')}</span>
          <span>{t('agentRouter.modelId')}</span>
        </GridHead>
        {ROLES.map((role) => (
          <MappingRow key={role}>
            <RoleBadge>{ROLE_LABEL[role]}</RoleBadge>
            <Input
              value={slots[role].displayName ?? ''}
              placeholder={defaultDisplayNameOf(role)}
              onChange={(event) => updateSlot(role, { displayName: event.target.value || undefined })}
            />
            <Select
              value={slots[role].model}
              options={modelOptions}
              getPopupContainer={getModalPopupContainer}
              onChange={(value) =>
                updateSlot(role, {
                  model: value,
                  displayName: models.find((model) => model.id === value)?.name || value
                })
              }
              disabled={!credential || modelsUnavailable}
              allowClear
              showSearch
            />
          </MappingRow>
        ))}
      </MappingSection>
      <Field label={t('agentRouter.claudeCode.defaultFallbackModel')}>
        <Select
          value={defaultModel}
          options={modelOptions}
          getPopupContainer={getModalPopupContainer}
          onChange={setDefaultModel}
          disabled={!credential || modelsUnavailable}
          allowClear
          showSearch
        />
      </Field>
      {tokenPlan.loading ? <Spin size="small" /> : null}
      {tokenPlan.error ? <Hint>{t('agentRouter.claudeCode.modelLoadFailed')}</Hint> : null}
      <Actions>
        <Button disabled={busy} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button
          type="primary"
          disabled={busy || !complete || modelsUnavailable}
          onClick={() =>
            credential &&
            onSave({
              profileId: profile?.id,
              name: name.trim(),
              credential,
              models: {
                opus: slots.opus.model,
                sonnet: slots.sonnet.model,
                haiku: slots.haiku.model,
                default: defaultModel,
                opusName: slots.opus.model ? slots.opus.displayName : undefined,
                sonnetName: slots.sonnet.model ? slots.sonnet.displayName : undefined,
                haikuName: slots.haiku.model ? slots.haiku.displayName : undefined
              }
            })
          }>
          {t('agentRouter.claudeCode.save')}
        </Button>
      </Actions>
    </Panel>
  )
}

const defaultDisplayNameOf = (role: Role): string => {
  if (role === 'opus') return 'claude-opus-4-8'
  if (role === 'sonnet') return 'claude-sonnet-5'
  return 'claude-haiku-4.5'
}

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;

  .ant-select-single {
    height: 32px;
    width: 100%;
  }
`

const Field = styled(Form.Item)`
  margin-bottom: 0;

  .ant-form-item-label {
    flex: 0 0 92px;
    padding: 0;
  }

  .ant-form-item-label > label {
    height: 32px;
    color: var(--color-text-2);
    font-size: 12.5px;
    font-weight: 600;
  }
`

const MappingSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 2px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-background-soft);
`

const MappingHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;

  strong {
    color: var(--color-text-1);
    font-size: 12.5px;
    font-weight: 650;
  }
`

const SlotCounter = styled.span<{ $filled: boolean }>`
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 8px;
  border: 1px solid ${(props) => (props.$filled ? 'transparent' : 'var(--color-border)')};
  border-radius: 999px;
  background: ${(props) => (props.$filled ? 'var(--ar-accent)' : 'transparent')};
  color: ${(props) => (props.$filled ? 'var(--ar-accent-ink)' : 'var(--color-text-3)')};
  font-size: 10.5px;
  font-weight: 600;
`

const MappingGridColumns = `88px minmax(0, 1fr) minmax(0, 1fr)`

const GridHead = styled.div`
  display: grid;
  grid-template-columns: ${MappingGridColumns};
  gap: 8px;
  padding-bottom: 2px;

  span {
    color: var(--color-text-3);
    font-size: 11px;
  }
`

const MappingRow = styled.div`
  display: grid;
  grid-template-columns: ${MappingGridColumns};
  gap: 8px;
  align-items: center;
`

const RoleBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--modal-background);
  color: var(--color-text-2);
  font-size: 11.5px;
  font-weight: 650;
  letter-spacing: 0.01em;
`

const Hint = styled.div`
  color: var(--color-error);
  font-size: 11.5px;
`

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 2px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border-soft);
`
