import { DownOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons'
import type { AgentRouteModel, AgentRouteTemplate, CreateAgentRouteRequest } from '@shared/agentRouter'
import { Button, Checkbox, Empty, Form, message, Modal, Select, Tabs } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { AgentRouterCredential, RouteModel } from '../hooks/useAgentRouterSources'
import { useTokenPlanModels } from '../hooks/useTokenPlanModels'
import { ModelIdSelect } from './ModelIdSelect'
import { RouteFormModal } from './RouteFormModal'

interface FormValues {
  accessMode: 'api' | 'tokenPlan'
  credentialId: string
  modelIds: string[]
}

const HIDDEN_API_KEY = '••••••••••••••••••••••••'

export const AddRouteModal = ({
  open,
  templates,
  routes = [],
  onRevealCredential,
  apiCredentials,
  tokenPlanCredentials,
  apiModels,
  onCancel,
  onAdd,
  onCreate
}: {
  open: boolean
  templates: AgentRouteTemplate[]
  routes?: AgentRouteModel[]
  onRevealCredential?: (route: AgentRouteModel) => Promise<string>
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
            displayName: 'AiOnly',
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
      let conflicts: AgentRouteModel[] = []
      if (path === 'global') {
        const selected = templates.filter((template) => selectedIds.includes(template.templateId) && !template.joined)
        const ids = new Set(selected.map((template) => template.modelId))
        conflicts = routes.filter((route) => route.enabled && ids.has(route.modelId))
      } else if (credential) {
        const matching = routes.filter((route) => modelIds.includes(route.modelId))
        if (matching.some((route) => route.enabled)) {
          const existing = await Promise.all(
            matching.map(async (route) => ({
              route,
              key: await onRevealCredential?.(route).catch(() => undefined)
            }))
          )
          const newIds = new Set(
            modelIds.filter(
              (id) => !existing.some(({ route, key }) => route.modelId === id && key === credential.value)
            )
          )
          conflicts = matching.filter((route) => route.enabled && newIds.has(route.modelId))
        }
      }
      if (conflicts.length) setConflictingModelIds([...new Set(conflicts.map((route) => route.modelId))])
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
        <Tabs
          activeKey={path}
          onChange={(key) => {
            if (!saving && !checking) setPath(key as 'create' | 'global')
          }}
          items={[
            { key: 'create', label: t('agentRouter.createRoute') },
            { key: 'global', label: t('agentRouter.useGlobalConfiguration') }
          ]}
        />
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
              <Select
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
                onChange={() => form.setFieldValue('modelIds', [])}
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
                            {template.accessMode === 'api' ? 'API' : 'TokenPlan'} · {template.credentialName} ·{' '}
                            {template.maskedKey}
                          </span>
                        </Identity>
                      </Checkbox>
                      <CardMeta>{joined ? <Joined>{t('agentRouter.alreadyAdded')}</Joined> : null}</CardMeta>
                    </Card>
                  )
                })
              )}
            </List>
          </>
        )}
      </RouteFormModal>
      <Modal
        open={confirming}
        centered
        width={400}
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
