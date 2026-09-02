import { DownOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons'
import type { CreateAgentRouteTemplateRequest } from '@shared/agentRouter'
import { Form, Modal, Select } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { AgentRouterCredential, RouteModel } from '../hooks/useAgentRouterSources'
import { useTokenPlanModels } from '../hooks/useTokenPlanModels'
import { RouteModelTypes } from './RouteCapabilities'

interface FormValues {
  accessMode: 'api' | 'tokenPlan'
  credentialId: string
  modelId: string
}

const HIDDEN_API_KEY = '••••••••••••••••••••••••'

export const CreateGlobalTemplateModal = ({
  open,
  apiCredentials,
  tokenPlanCredentials,
  apiModels,
  onCancel,
  onCreate
}: {
  open: boolean
  apiCredentials: AgentRouterCredential[]
  tokenPlanCredentials: AgentRouterCredential[]
  apiModels: RouteModel[]
  onCancel: () => void
  onCreate: (request: CreateAgentRouteTemplateRequest) => Promise<void>
}) => {
  const { t } = useTranslation()
  const [form] = Form.useForm<FormValues>()
  const [saving, setSaving] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const accessMode = Form.useWatch('accessMode', form) ?? 'api'
  const credentialId = Form.useWatch('credentialId', form)
  const modelId = Form.useWatch('modelId', form)
  const credentials = accessMode === 'api' ? apiCredentials : tokenPlanCredentials
  const credential = credentials.find((item) => item.id === credentialId)
  const { models: tokenPlanModels, loading: modelsLoading } = useTokenPlanModels(open ? credential : undefined)
  const models = accessMode === 'api' ? apiModels : tokenPlanModels
  const selectedModel = models.find((model) => model.id === modelId)

  const submit = async () => {
    await form.validateFields()
    if (!selectedModel || !credential) return
    setSaving(true)
    try {
      await onCreate({
        modelId: selectedModel.id,
        accessMode,
        tokenPlanId: accessMode === 'tokenPlan' ? credential.planId : undefined,
        apiKey: credential.value,
        modelTypes: selectedModel.modelTypes
      })
      form.resetFields()
      onCancel()
    } catch {
      return
    } finally {
      setSaving(false)
    }
  }

  const changeMode = () => {
    form.setFieldsValue({ credentialId: undefined, modelId: undefined } as unknown as Partial<FormValues>)
    setShowKey(false)
  }

  return (
    <StyledModal
      open={open}
      width={560}
      centered
      title={t('agentRouter.createGlobalTemplate')}
      onCancel={onCancel}
      onOk={() => void submit()}
      confirmLoading={saving}
      destroyOnHidden>
      <Form
        form={form}
        labelCol={{ flex: '86px' }}
        labelAlign="left"
        colon={false}
        style={{ marginTop: 15 }}
        initialValues={{ accessMode: 'api' }}>
        <Form.Item name="accessMode" label={t('agentRouter.accessMode')}>
          <Select
            onChange={changeMode}
            options={[
              { value: 'api', label: 'API' },
              { value: 'tokenPlan', label: 'TokenPlan' }
            ]}
          />
        </Form.Item>
        <Form.Item name="credentialId" label={t('agentRouter.apiKey')} rules={[{ required: true }]}>
          <Select
            onChange={() => form.setFieldValue('modelId', undefined)}
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
          <Select
            loading={modelsLoading}
            disabled={!credential || modelsLoading}
            options={models.map((model) => ({ value: model.id, label: model.id }))}
          />
        </Form.Item>
        {selectedModel ? (
          <ModelTypeSection>
            <RouteModelTypes modelTypes={selectedModel.modelTypes} />
          </ModelTypeSection>
        ) : null}
      </Form>
    </StyledModal>
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
const ModelTypeSection = styled.div`margin-top:4px;padding:16px 0 2px;border-top:1px solid var(--color-border);`
const SuffixControls = styled.span`height:100%;display:inline-flex;align-items:center;gap:8px;`
const KeyVisibility = styled.button`padding:0;display:inline-flex;align-items:center;border:0;background:transparent;color:var(--color-text-3);cursor:pointer;`
