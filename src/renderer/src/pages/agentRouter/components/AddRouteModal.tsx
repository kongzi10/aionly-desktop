import { DownOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons'
import type { AgentRouteTemplate, CreateAgentRouteRequest, RedactedTargetEntry } from '@shared/agentRouter'
import { Button, Checkbox, Empty, Form, message, Radio, Select } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { AgentRouterCredential, RouteModel } from '../hooks/useAgentRouterSources'
import { useTokenPlanModels } from '../hooks/useTokenPlanModels'
import { ModelIdSelect } from './ModelIdSelect'
import { ConfirmDialog, getModalPopupContainer, ModalHint, RouteFormModal } from './RouteFormModal'

interface FormValues {
  accessMode: 'api' | 'tokenPlan'
  credentialId: string
  modelIds: string[]
}

const HIDDEN_API_KEY = '••••••••••••••••••••••••'

export const AddRouteModal = ({
  open,
  templates,
  onListWorkBuddyRoutes = async () => [],
  apiCredentials,
  tokenPlanCredentials,
  apiModels,
  onCancel,
  onAdd,
  onCreate
}: {
  open: boolean
  templates: AgentRouteTemplate[]
  onListWorkBuddyRoutes?: () => Promise<RedactedTargetEntry[]>
  apiCredentials: AgentRouterCredential[]
  tokenPlanCredentials: AgentRouterCredential[]
  apiModels: RouteModel[]
  onCancel: () => void
  onAdd: (templateIds: string[]) => Promise<void>
  onCreate: (requests: CreateAgentRouteRequest[]) => Promise<void>
}) => {
  const { t } = useTranslation()
  const [messageApi, contextHolder] = message.useMessage()
  const [form] = Form.useForm<FormValues>()
  const [path, setPath] = useState<'create' | 'global'>('create')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [conflictingModelIds, setConflictingModelIds] = useState<string[]>([])
  const confirming = conflictingModelIds.length > 0
  const [showKey, setShowKey] = useState(false)
  const accessMode = Form.useWatch('accessMode', form) ?? 'api'
  const credentialId = Form.useWatch('credentialId', form)
  const modelIds: string[] = Form.useWatch('modelIds', form) ?? []
  const credentials = accessMode === 'api' ? apiCredentials : tokenPlanCredentials
  const credential = credentials.find((item) => item.id === credentialId)
  const { models: tokenPlanModels, loading: modelsLoading } = useTokenPlanModels(open ? credential : undefined)
  const models = accessMode === 'api' ? apiModels : tokenPlanModels
  const selectedModels = models.filter((model) => modelIds.includes(model.id))

  // 当前方式下只有一个凭据时直接选中它。否则用户选完 API 还得手动点一次密钥，
  // 在选中之前「模型 ID」和「创建路由」都会因为 credential 为空而处于禁用态。
  useEffect(() => {
    if (!open || path !== 'create') return
    if (credentialId) return
    if (credentials.length !== 1) return
    form.setFieldValue('credentialId', credentials[0].id)
  }, [open, path, credentialId, credentials, form])

  const close = () => {
    form.resetFields()
    setSelectedIds([])
    setConflictingModelIds([])
    setPath('create')
    setShowKey(false)
    onCancel()
  }

  const submit = async () => {
    if (saving) return
    if (path === 'create' && (!selectedModels.length || !credential)) return
    if (path === 'global' && !selectedIds.length) return
    setSaving(true)
    try {
      if (path === 'global') {
        await onAdd(selectedIds)
      } else if (credential) {
        await onCreate(
          selectedModels.map((model) => ({
            modelId: model.id,
            credentialName: credential.label,
            accessMode,
            tokenPlanId: accessMode === 'tokenPlan' ? credential.planId : undefined,
            apiKey: credential.value,
            modelTypes: model.modelTypes
          }))
        )
      }
      close()
    } catch {
      messageApi.error(t('agentRouter.createFailed'))
    } finally {
      setSaving(false)
    }
  }

  const requestSubmit = async () => {
    if (saving || checking || confirming) return
    setChecking(true)
    try {
      const requestedIds = new Set(
        path === 'global'
          ? templates
              .filter((template) => selectedIds.includes(template.templateId) && !template.joined)
              .map((template) => template.modelId)
          : modelIds
      )
      const conflicts = [...new Set((await onListWorkBuddyRoutes()).map((entry) => entry.id))].filter((id) =>
        requestedIds.has(id)
      )
      if (conflicts.length) setConflictingModelIds(conflicts)
      else await submit()
    } finally {
      setChecking(false)
    }
  }

  return (
    <>
      {contextHolder}
      <RouteFormModal
        open={open}
        width={560}
        centered
        title={t('agentRouter.addModelsToWorkBuddy')}
        onCancel={() => {
          if (!saving && !checking) close()
        }}
        destroyOnHidden
        footer={[
          <Button key="cancel" onClick={close} disabled={saving || checking}>
            {t('common.cancel')}
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={saving || checking}
            disabled={
              path === 'global' ? selectedIds.length === 0 : !credential || !selectedModels.length || modelsLoading
            }
            onClick={() => void requestSubmit()}>
            {path === 'create'
              ? t('agentRouter.createRoute')
              : t('agentRouter.addSelectedModels', { count: selectedIds.length })}
          </Button>
        ]}>
        <PathSwitch role="tablist" aria-label={t('agentRouter.addModelsToWorkBuddy')}>
          <PathTab
            type="button"
            role="tab"
            aria-selected={path === 'create'}
            $active={path === 'create'}
            onClick={() => {
              if (!saving && !checking) setPath('create')
            }}>
            {t('agentRouter.createRoute')}
          </PathTab>
          <PathTab
            type="button"
            role="tab"
            aria-selected={path === 'global'}
            $active={path === 'global'}
            onClick={() => {
              if (!saving && !checking) setPath('global')
            }}>
            {t('agentRouter.useGlobalConfiguration')}
          </PathTab>
        </PathSwitch>
        {path === 'create' ? (
          <Form
            form={form}
            disabled={saving || checking}
            labelCol={{ flex: '86px' }}
            labelAlign="left"
            colon={false}
            wrapperCol={{ flex: 1 }}
            initialValues={{ accessMode: 'api' }}>
            <Form.Item name="accessMode" label={t('agentRouter.accessMode')}>
              <Radio.Group
                onChange={() => {
                  form.setFieldsValue({ credentialId: undefined, modelIds: [] } as Partial<FormValues>)
                  setShowKey(false)
                }}
                options={[
                  { value: 'api', label: 'API' },
                  { value: 'tokenPlan', label: 'TokenPlan' }
                ]}
              />
            </Form.Item>
            <Form.Item name="credentialId" label={t('agentRouter.apiKey')}>
              <Select
                placeholder={t('agentRouter.selectCredential')}
                onChange={() => form.setFieldValue('modelIds', [])}
                getPopupContainer={getModalPopupContainer}
                optionLabelProp="selectedLabel"
                options={credentials.map((item) => ({
                  value: item.id,
                  label: item.label,
                  selectedLabel: showKey ? item.value : HIDDEN_API_KEY
                }))}
                suffixIcon={
                  <SuffixControls>
                    <KeyVisibility
                      type="button"
                      aria-label={t('agentRouter.toggleApiKeyVisibility')}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={(event) => {
                        event.stopPropagation()
                        setShowKey((visible) => !visible)
                      }}>
                      {showKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    </KeyVisibility>
                    <DownOutlined />
                  </SuffixControls>
                }
              />
            </Form.Item>
            <Form.Item name="modelIds" label={t('agentRouter.modelId')}>
              <ModelIdSelect
                models={models}
                loading={modelsLoading}
                disabled={!credential || modelsLoading || saving || checking}
              />
            </Form.Item>
          </Form>
        ) : (
          <>
            <ModalHint>{t('agentRouter.selectGlobalTemplates')}</ModalHint>
            {templates.length === 0 ? (
              <EmptyBox>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('agentRouter.noGlobalTemplates')} />
              </EmptyBox>
            ) : (
              <TemplateList>
                {templates.map((template) => {
                  const joined = template.joined === true
                  const selected = selectedIds.includes(template.templateId)
                  return (
                    <TemplateRow key={template.templateId} $selected={selected} $disabled={joined}>
                      <Checkbox
                        checked={selected}
                        disabled={joined}
                        onChange={(event) =>
                          setSelectedIds((current) =>
                            event.target.checked
                              ? [...current, template.templateId]
                              : current.filter((id) => id !== template.templateId)
                          )
                        }>
                        <Identity>
                          <strong>{template.modelId}</strong>
                          <Meta>
                            <ModeChip>{template.accessMode === 'api' ? 'API' : 'TokenPlan'}</ModeChip>
                            <span>{template.credentialName}</span>
                            <Masked>{template.maskedKey}</Masked>
                          </Meta>
                        </Identity>
                      </Checkbox>
                      {joined ? <Joined>{t('agentRouter.alreadyAdded')}</Joined> : null}
                    </TemplateRow>
                  )
                })}
              </TemplateList>
            )}
          </>
        )}
      </RouteFormModal>
      <ConfirmDialog
        open={confirming}
        title={t('agentRouter.confirmCloseSameModel', { modelIds: conflictingModelIds.join('、') })}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        onCancel={() => setConflictingModelIds([])}
        onOk={() => {
          setConflictingModelIds([])
          void submit()
        }}
      />
    </>
  )
}

const PathSwitch = styled.div`
  display: flex;
  gap: 2px;
  margin-bottom: 16px;
  padding: 3px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-background-soft);
`

const PathTab = styled.button<{ $active: boolean }>`
  flex: 1;
  height: 28px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: ${(props) => (props.$active ? 'var(--modal-background)' : 'transparent')};
  color: ${(props) => (props.$active ? 'var(--ar-accent-strong)' : 'var(--color-text-3)')};
  font-size: 12.5px;
  font-weight: ${(props) => (props.$active ? 650 : 500)};
  white-space: nowrap;
  cursor: pointer;
  box-shadow: ${(props) => (props.$active ? '0 2px 6px rgb(0 0 0 / 8%)' : 'none')};
  transition:
    color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    color: var(--color-text-1);
  }

  &:focus-visible {
    outline: 2px solid var(--ar-accent);
    outline-offset: 1px;
  }
`

const TemplateList = styled.div`
  display: flex;
  flex-direction: column;
  max-height: 320px;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: 12px;
`

const TemplateRow = styled.div<{ $selected: boolean; $disabled: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  box-sizing: border-box;
  min-height: 54px;
  padding: 8px 12px;
  background: ${(props) => (props.$selected ? 'var(--ar-accent-tint)' : 'transparent')};
  opacity: ${(props) => (props.$disabled ? 0.5 : 1)};
  box-shadow: ${(props) => (props.$selected ? 'inset 2px 0 0 var(--ar-accent)' : 'none')};

  & + & {
    border-top: 1px solid var(--color-border-soft);
  }

  &:hover {
    background: var(--color-background-soft);
  }

  .ant-checkbox-wrapper {
    flex: 1;
    min-width: 0;
    margin: 0;
    align-items: center;
  }

  .ant-checkbox + span {
    flex: 1;
    min-width: 0;
    padding-inline-start: 10px;
  }
`

const Identity = styled.span`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;

  strong {
    overflow: hidden;
    color: var(--color-text-1);
    font-size: 12.5px;
    font-weight: 650;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
`

const Meta = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--color-text-3);
  font-size: 11px;
  white-space: nowrap;

  > span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`

const ModeChip = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  height: 18px;
  padding: 0 7px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-background);
  color: var(--color-text-2);
  font-size: 10px;
  font-weight: 600;
`

const Masked = styled.span`
  font-family: monospace;
  font-size: 10.5px;
`

const Joined = styled.span`
  flex: 0 0 auto;
  color: var(--color-text-3);
  font-size: 10.5px;
`

const EmptyBox = styled.div`
  padding: 16px 0;
  border: 1px dashed var(--color-border);
  border-radius: 12px;
`

const SuffixControls = styled.span`
  height: 100%;
  display: inline-flex;
  align-items: center;
  gap: 8px;
`

const KeyVisibility = styled.button`
  padding: 0;
  display: inline-flex;
  align-items: center;
  border: 0;
  background: transparent;
  color: var(--color-text-3);
  cursor: pointer;
`
