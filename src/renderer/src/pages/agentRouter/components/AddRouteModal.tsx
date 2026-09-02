import { DownOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons'
import type { AgentRouteTemplate, CreateAgentRouteRequest } from '@shared/agentRouter'
import { Button, Checkbox, Empty, Form, Input, message, Modal, Select, Tabs } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { AgentRouterCredential, RouteModel } from '../hooks/useAgentRouterSources'
import { RouteModelTypes } from './RouteCapabilities'

interface FormValues {
  accessMode: 'api' | 'tokenPlan'
  credentialId: string
  modelId: string
  displayName?: string
}

const HIDDEN_API_KEY = '••••••••••••••••••••••••'

export const AddRouteModal = ({
  open,
  templates,
  apiCredentials,
  tokenPlanCredentials,
  apiModels,
  tokenPlanModels,
  onCancel,
  onAdd,
  onCreate
}: {
  open: boolean
  templates: AgentRouteTemplate[]
  apiCredentials: AgentRouterCredential[]
  tokenPlanCredentials: AgentRouterCredential[]
  apiModels: RouteModel[]
  tokenPlanModels: RouteModel[]
  onCancel: () => void
  onAdd: (templateIds: string[]) => void
  onCreate: (request: CreateAgentRouteRequest) => Promise<void>
}) => {
  const { t } = useTranslation()
  const [messageApi, contextHolder] = message.useMessage()
  const [form] = Form.useForm<FormValues>()
  const [path, setPath] = useState<'create' | 'global'>('create')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const accessMode = Form.useWatch('accessMode', form) ?? 'api'
  const credentialId = Form.useWatch('credentialId', form)
  const modelId = Form.useWatch('modelId', form)
  const credentials = accessMode === 'api' ? apiCredentials : tokenPlanCredentials
  const models = accessMode === 'api' ? apiModels : tokenPlanModels
  const credential = credentials.find((item) => item.id === credentialId)
  const selectedModel = models.find((model) => model.id === modelId)

  const close = () => {
    form.resetFields()
    setSelectedIds([])
    setPath('create')
    setShowKey(false)
    onCancel()
  }

  const submitCreate = async () => {
    const values = await form.validateFields()
    if (!selectedModel || !credential) return
    setSaving(true)
    try {
      await onCreate({
        modelId: selectedModel.id,
        displayName: values.displayName?.trim() || selectedModel.id,
        accessMode,
        tokenPlanId: accessMode === 'tokenPlan' ? credential.planId : undefined,
        apiKey: credential.value,
        modelTypes: selectedModel.modelTypes
      })
      close()
    } catch (error) {
      if (error instanceof Error && error.message.includes('Duplicate Agent route')) {
        messageApi.warning(t('agentRouter.routeAlreadyExists'))
      }
    } finally {
      setSaving(false)
    }
  }

  const submitGlobal = () => {
    if (selectedIds.length === 0) return
    onAdd(selectedIds)
    close()
  }

  return (
    <>
      {contextHolder}
      <StyledModal
        open={open}
        width={560}
        centered
        title={t('agentRouter.addModelsToWorkBuddy')}
        onCancel={close}
        destroyOnHidden
        footer={[
          <Button key="cancel" onClick={close}>
            {t('common.cancel')}
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={saving}
            disabled={path === 'global' && selectedIds.length === 0}
            onClick={() => void (path === 'create' ? submitCreate() : submitGlobal())}>
            {path === 'create'
              ? t('agentRouter.createRoute')
              : t('agentRouter.addSelectedModels', { count: selectedIds.length })}
          </Button>
        ]}>
        <Tabs
          activeKey={path}
          onChange={(key) => setPath(key as 'create' | 'global')}
          items={[
            { key: 'create', label: t('agentRouter.createRoute') },
            { key: 'global', label: t('agentRouter.useGlobalConfiguration') }
          ]}
        />
        {path === 'create' ? (
          <Form
            form={form}
            labelCol={{ flex: '86px' }}
            labelAlign="left"
            colon={false}
            style={{ marginTop: 15 }}
            initialValues={{ accessMode: 'api' }}>
            <Form.Item name="displayName" label={t('agentRouter.displayName')}>
              <Input placeholder={t('agentRouter.displayNameModelFallback')} />
            </Form.Item>
            <Form.Item name="accessMode" label={t('agentRouter.accessMode')}>
              <Select
                onChange={() => {
                  form.setFieldsValue({ credentialId: undefined, modelId: undefined } as Partial<FormValues>)
                  setShowKey(false)
                }}
                options={[
                  { value: 'api', label: 'API' },
                  { value: 'tokenPlan', label: 'TokenPlan' }
                ]}
              />
            </Form.Item>
            <Form.Item name="credentialId" label={t('agentRouter.apiKey')} rules={[{ required: true }]}>
              <Select
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
            <Form.Item name="modelId" label={t('agentRouter.modelId')} rules={[{ required: true }]}>
              <Select disabled={!credential} options={models.map((model) => ({ value: model.id, label: model.id }))} />
            </Form.Item>
            {selectedModel ? (
              <ModelTypeSection>
                <RouteModelTypes modelTypes={selectedModel.modelTypes} />
              </ModelTypeSection>
            ) : null}
          </Form>
        ) : (
          <>
            <Hint>{t('agentRouter.selectGlobalTemplates')}</Hint>
            <List>
              {templates.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('agentRouter.noGlobalTemplates')} />
              ) : (
                templates.map((template) => {
                  const joined = template.joined === true
                  const selected = selectedIds.includes(template.templateId)
                  return (
                    <Card key={template.templateId} $selected={selected} $disabled={joined}>
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
                          <span>
                            {template.accessMode === 'api' ? 'API' : 'TokenPlan'} · {template.maskedKey}
                          </span>
                        </Identity>
                      </Checkbox>
                      <CardMeta>
                        <RouteModelTypes compact modelTypes={template.modelTypes} />
                        {joined ? <Joined>{t('agentRouter.alreadyAdded')}</Joined> : null}
                      </CardMeta>
                    </Card>
                  )
                })
              )}
            </List>
          </>
        )}
      </StyledModal>
    </>
  )
}

const StyledModal = styled(Modal)`
  .ant-modal-content { padding: 22px 18px 14px; border-radius: 12px; }
  .ant-modal-header { margin: 0 0 20px; }
  .ant-modal-title { font-size: 16px; font-weight: 700; }
  .ant-modal-footer { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--color-border); }
  .ant-form-item { margin-bottom: 16px; }
  .ant-form-item-label > label { font-weight: 650; }
  .ant-input { height: 36px; border-radius: 9px; background: var(--color-background-soft); }
  .ant-select-single { height: 36px; }
  .ant-select-selector { height: 36px !important; min-height: 36px !important; border-radius: 9px !important; background: var(--color-background-soft) !important; }
  .ant-select-selection-wrap { height: 34px; align-self: stretch; align-items: center; }
  .ant-select-selection-item, .ant-select-selection-placeholder { line-height: 34px !important; }
  .ant-select-arrow { inset-block-start: 50%; margin-top: 0; display: flex; align-items: center; transform: translateY(-50%); }
`
const ModelTypeSection = styled.div`grid-column:1/-1;margin-top:4px;padding:16px 0 2px;border-top:1px solid var(--color-border);`
const SuffixControls = styled.span`height:100%;display:inline-flex;align-items:center;gap:8px;`
const KeyVisibility = styled.button`padding:0;display:inline-flex;align-items:center;border:0;background:transparent;color:var(--color-text-3);cursor:pointer;`
const Hint = styled.p`margin:0 0 10px;color:var(--color-text-3);font-size:11px;`
const List = styled.div`max-height:320px;padding:7px;display:flex;flex-direction:column;gap:5px;overflow:auto;border:1px solid var(--color-border);border-radius:10px;background:var(--color-background-soft);`
const Card = styled.div<{
  $selected: boolean
  $disabled: boolean
}>`min-height:50px;padding:7px 10px;display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid ${({ $selected }) => ($selected ? 'color-mix(in srgb,var(--color-primary) 35%,var(--color-border))' : 'transparent')};border-radius:8px;background:${({ $selected }) => ($selected ? 'color-mix(in srgb,var(--color-primary) 10%,var(--color-background))' : 'var(--color-background)')};opacity:${({ $disabled }) => ($disabled ? 0.55 : 1)};.ant-checkbox-wrapper{min-width:0;flex:1}`
const Identity = styled.span`display:flex;flex-direction:column;gap:2px;strong{font-size:12px}span{color:var(--color-text-3);font-size:10px}`
const CardMeta = styled.span`display:flex;align-items:center;gap:7px;`
const Joined = styled.span`color:var(--color-text-3);font-size:10px;`
