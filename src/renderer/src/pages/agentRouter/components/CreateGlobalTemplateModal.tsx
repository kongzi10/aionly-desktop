import { DownOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons'
import type { CreateAgentRouteTemplateRequest } from '@shared/agentRouter'
import { Form, Select } from 'antd'
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
  onCreate: (requests: CreateAgentRouteTemplateRequest[]) => Promise<void>
}) => {
  const { t } = useTranslation()
  const [form] = Form.useForm<FormValues>()
  const [saving, setSaving] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const accessMode = Form.useWatch('accessMode', form) ?? 'api'
  const credentialId = Form.useWatch('credentialId', form)
  const modelIds: string[] = Form.useWatch('modelIds', form) ?? []
  const credentials = accessMode === 'api' ? apiCredentials : tokenPlanCredentials
  const credential = credentials.find((item) => item.id === credentialId)
  const { models: tokenPlanModels, loading: modelsLoading } = useTokenPlanModels(open ? credential : undefined)
  const models = accessMode === 'api' ? apiModels : tokenPlanModels
  const selectedModels = models.filter((model) => modelIds.includes(model.id))

  const submit = async () => {
    if (saving || !selectedModels.length || !credential) return
    setSaving(true)
    try {
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
      form.resetFields()
      onCancel()
    } catch {
      return
    } finally {
      setSaving(false)
    }
  }

  const changeMode = () => {
    form.setFieldsValue({ credentialId: undefined, modelIds: [] } as unknown as Partial<FormValues>)
    setShowKey(false)
  }

  return (
    <RouteFormModal
      open={open}
      width={560}
      centered
      title={t('agentRouter.createGlobalTemplate')}
      onCancel={() => {
        if (!saving) onCancel()
      }}
      onOk={() => void submit()}
      confirmLoading={saving}
      okButtonProps={{ disabled: !credential || !selectedModels.length || modelsLoading }}
      cancelButtonProps={{ disabled: saving }}
      destroyOnHidden>
      <Form
        form={form}
        labelCol={{ flex: '86px' }}
        labelAlign="left"
        colon={false}
        wrapperCol={{ flex: 1 }}
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
          <ModelIdSelect models={models} loading={modelsLoading} disabled={!credential || modelsLoading || saving} />
        </Form.Item>
      </Form>
    </RouteFormModal>
  )
}

const SuffixControls = styled.span`height:100%;display:inline-flex;align-items:center;gap:8px;`
const KeyVisibility = styled.button`padding:0;display:inline-flex;align-items:center;border:0;background:transparent;color:var(--color-text-3);cursor:pointer;`
