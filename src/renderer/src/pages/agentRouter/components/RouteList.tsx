import { DeleteOutlined, DownOutlined, EditOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons'
import type { AgentRouteModel, UpdateAgentRouteRequest } from '@shared/agentRouter'
import { Form, message, Select, Switch } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { AgentRouterCredential, RouteModel } from '../hooks/useAgentRouterSources'
import { useTokenPlanModels } from '../hooks/useTokenPlanModels'
import { RouteModelTypes } from './RouteCapabilities'
import { ConfirmDialog, getModalPopupContainer, RouteFormModal } from './RouteFormModal'

interface EditFormValues {
  accessMode: 'api' | 'tokenPlan'
  credentialId: string
}

const CURRENT_CREDENTIAL = '__current__'
const HIDDEN_API_KEY = '••••••••••••••••••••••••'

export const RouteList = ({
  routes,
  credentials,
  apiCredentials = [],
  tokenPlanCredentials = [],
  apiModels = [],
  onRemove,
  onUpdateRoute,
  onRevealCredential,
  onEnabledChange,
  busy,
  routeTogglesDisabled = false
}: {
  routes: AgentRouteModel[]
  credentials: { id: string; label: string; maskedValue: string }[]
  apiCredentials?: AgentRouterCredential[]
  tokenPlanCredentials?: AgentRouterCredential[]
  apiModels?: RouteModel[]
  onRemove: (route: AgentRouteModel) => void
  onUpdateRoute: (route: AgentRouteModel, request: UpdateAgentRouteRequest) => Promise<void>
  onRevealCredential?: (route: AgentRouteModel) => Promise<string>
  onEnabledChange: (route: AgentRouteModel, enabled: boolean) => void
  busy: boolean
  routeTogglesDisabled?: boolean
}) => {
  const { t } = useTranslation()
  const [messageApi, contextHolder] = message.useMessage()
  const [routeToRemove, setRouteToRemove] = useState<AgentRouteModel | null>(null)
  const [routeToEdit, setRouteToEdit] = useState<AgentRouteModel | null>(null)
  const [routeToEnable, setRouteToEnable] = useState<AgentRouteModel | null>(null)
  const [showEditKey, setShowEditKey] = useState(false)
  const [revealedCurrentKey, setRevealedCurrentKey] = useState<string>()
  const [editForm] = Form.useForm<EditFormValues>()
  const editAccessMode = Form.useWatch('accessMode', editForm)
  const editCredentialId = Form.useWatch('credentialId', editForm)

  const credentialsById = new Map(credentials.map((credential) => [credential.id, credential]))
  const editCredential = routeToEdit ? credentialsById.get(routeToEdit.credentialId) : undefined
  const editCredentials = editAccessMode === 'tokenPlan' ? tokenPlanCredentials : apiCredentials
  const selectedEditCredential = editCredentials.find((credential) => credential.id === editCredentialId)
  const { models: tokenPlanModels } = useTokenPlanModels(routeToEdit ? selectedEditCredential : undefined)
  const editModels = editAccessMode === 'tokenPlan' ? tokenPlanModels : apiModels
  const editModel = routeToEdit ? editModels.find((model) => model.id === routeToEdit.modelId) : undefined
  const editModelTypes = editModel?.modelTypes ?? routeToEdit?.modelTypes
  const selectedEditKey = editCredentialId === CURRENT_CREDENTIAL ? revealedCurrentKey : selectedEditCredential?.value

  const toggleEditKeyVisibility = async () => {
    if (showEditKey) {
      setShowEditKey(false)
      return
    }
    if (editCredentialId === CURRENT_CREDENTIAL && !revealedCurrentKey && routeToEdit && onRevealCredential) {
      setRevealedCurrentKey(await onRevealCredential(routeToEdit))
    }
    setShowEditKey(true)
  }

  const modals = (
    <>
      <RouteFormModal
        open={Boolean(routeToEdit)}
        width={520}
        centered
        title={t('agentRouter.editRoute')}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        onCancel={() => {
          setRouteToEdit(null)
          setShowEditKey(false)
          setRevealedCurrentKey(undefined)
          editForm.resetFields()
        }}
        destroyOnHidden
        onOk={async () => {
          if (!routeToEdit) return
          const values = await editForm.validateFields()
          const selectedCredential = editCredentials.find((credential) => credential.id === values.credentialId)
          try {
            await onUpdateRoute(routeToEdit, {
              credentialName: selectedCredential?.label,
              accessMode: values.accessMode,
              tokenPlanId:
                values.accessMode === 'tokenPlan' ? (selectedCredential?.planId ?? routeToEdit.tokenPlanId) : undefined,
              apiKey: values.credentialId === CURRENT_CREDENTIAL ? undefined : selectedCredential?.value,
              modelTypes: editModelTypes ?? routeToEdit.modelTypes
            })
            setRouteToEdit(null)
            setShowEditKey(false)
            setRevealedCurrentKey(undefined)
            editForm.resetFields()
          } catch (error) {
            if (error instanceof Error && error.message.includes('Duplicate Agent route')) {
              messageApi.warning(t('agentRouter.routeAlreadyExists'))
            }
          }
        }}>
        <Form form={editForm} labelCol={{ flex: '86px' }} labelAlign="left" colon={false}>
          <Form.Item name="accessMode" label={t('agentRouter.accessMode')}>
            <Select
              aria-label={t('agentRouter.accessMode')}
              getPopupContainer={getModalPopupContainer}
              onChange={(accessMode) => {
                editForm.setFieldValue(
                  'credentialId',
                  accessMode === routeToEdit?.accessMode ? CURRENT_CREDENTIAL : undefined
                )
                setShowEditKey(false)
                setRevealedCurrentKey(undefined)
              }}
              options={[
                { value: 'api', label: 'API' },
                { value: 'tokenPlan', label: 'TokenPlan' }
              ]}
            />
          </Form.Item>
          <Form.Item name="credentialId" label={t('agentRouter.apiKey')} rules={[{ required: true }]}>
            <Select
              aria-label={t('agentRouter.apiKey')}
              getPopupContainer={getModalPopupContainer}
              optionLabelProp="selectedLabel"
              onChange={() => setShowEditKey(false)}
              options={[
                ...(editAccessMode === routeToEdit?.accessMode
                  ? [
                      {
                        value: CURRENT_CREDENTIAL,
                        label: editCredential?.label ?? t('agentRouter.credentialUnavailable'),
                        selectedLabel: showEditKey && selectedEditKey ? selectedEditKey : HIDDEN_API_KEY
                      }
                    ]
                  : []),
                ...editCredentials.map((credential) => ({
                  value: credential.id,
                  label: credential.label,
                  selectedLabel: showEditKey ? credential.value : HIDDEN_API_KEY
                }))
              ]}
              suffixIcon={
                <SuffixControls>
                  <KeyVisibility
                    type="button"
                    aria-label={t('agentRouter.toggleApiKeyVisibility')}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.stopPropagation()
                      void toggleEditKeyVisibility()
                    }}>
                    {showEditKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                  </KeyVisibility>
                  <DownOutlined />
                </SuffixControls>
              }
            />
          </Form.Item>
          <Form.Item label={t('agentRouter.modelId')}>
            <Select
              disabled
              getPopupContainer={getModalPopupContainer}
              value={routeToEdit?.modelId}
              options={[{ value: routeToEdit?.modelId, label: routeToEdit?.modelId }]}
            />
          </Form.Item>
        </Form>
      </RouteFormModal>
      <ConfirmDialog
        open={Boolean(routeToEnable)}
        title={t('agentRouter.confirmOverwriteModelId')}
        okText={t('agentRouter.overwrite')}
        cancelText={t('common.cancel')}
        onCancel={() => setRouteToEnable(null)}
        onOk={() => {
          if (routeToEnable) onEnabledChange(routeToEnable, true)
          setRouteToEnable(null)
        }}
      />
      <ConfirmDialog
        open={Boolean(routeToRemove)}
        title={t('agentRouter.confirmRemoveSelected')}
        okText={t('agentRouter.remove')}
        okButtonProps={{ danger: true }}
        cancelText={t('common.cancel')}
        onCancel={() => setRouteToRemove(null)}
        onOk={() => {
          if (routeToRemove) onRemove(routeToRemove)
          setRouteToRemove(null)
        }}
      />
    </>
  )

  if (!routes.length)
    return (
      <Wrapper>
        {contextHolder}
        <EmptyBox data-testid="routes-empty">
          <strong>{t('agentRouter.noRoutes')}</strong>
          <span>{t('agentRouter.addModelsDescription')}</span>
        </EmptyBox>
        {modals}
      </Wrapper>
    )

  return (
    <Wrapper>
      {contextHolder}
      <Rows data-testid="routes-list">
        {routes.map((route) => {
          const credential = credentialsById.get(route.credentialId)
          const togglesDisabled = busy || routeTogglesDisabled
          return (
            <Row
              key={`${route.modelId}:${route.credentialId}`}
              data-testid="route-row"
              $inactive={!route.enabled}
              $disabled={routeTogglesDisabled}>
              <Identity>
                <ModelLine>
                  <strong>{route.modelId}</strong>
                  <RouteModelTypes compact modelTypes={route.modelTypes} />
                </ModelLine>
                <CredentialLine>
                  {credential ? (
                    <>
                      <strong>{credential.label}</strong>
                      <MutedText>{credential.maskedValue}</MutedText>
                    </>
                  ) : (
                    <MutedText>{t('agentRouter.credentialUnavailable')}</MutedText>
                  )}
                </CredentialLine>
              </Identity>
              <AccessChip $mode={route.accessMode}>{route.accessMode === 'api' ? 'API' : 'TokenPlan'}</AccessChip>
              <RowActions>
                <Switch
                  size="small"
                  checked={routeTogglesDisabled ? false : route.enabled}
                  disabled={togglesDisabled}
                  aria-label={`${route.modelId} ${route.accessMode === 'api' ? 'API' : 'TokenPlan'}`}
                  onChange={(enabled) => {
                    if (enabled && routes.some((item) => item.modelId === route.modelId && item.enabled)) {
                      setRouteToEnable(route)
                      return
                    }
                    onEnabledChange(route, enabled)
                  }}
                />
                <IconKey
                  type="button"
                  aria-label={`${t('agentRouter.edit')} ${route.modelId}`}
                  title={t('agentRouter.edit')}
                  disabled={busy}
                  onClick={() => {
                    setRouteToEdit(route)
                    setShowEditKey(false)
                    setRevealedCurrentKey(undefined)
                    editForm.setFieldsValue({
                      accessMode: route.accessMode,
                      credentialId: CURRENT_CREDENTIAL
                    })
                  }}>
                  <EditOutlined />
                </IconKey>
                <IconKey
                  type="button"
                  $danger
                  aria-label={`${t('agentRouter.remove')} ${route.modelId}`}
                  title={t('agentRouter.remove')}
                  disabled={busy}
                  onClick={() => setRouteToRemove(route)}>
                  <DeleteOutlined />
                </IconKey>
              </RowActions>
            </Row>
          )
        })}
      </Rows>
      {modals}
    </Wrapper>
  )
}

const Wrapper = styled.div`
  padding: 1px 0 2px;
`

const Rows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const Row = styled.div<{ $inactive: boolean; $disabled: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
  min-height: 62px;
  padding: 9px 10px 9px 14px;
  border: 1px solid rgb(132 172 226 / 18%);
  border-radius: 12px;
  background: ${(props) => (props.$inactive ? 'rgb(249 251 254)' : 'rgb(246 250 255)')};
  opacity: ${(props) => (props.$disabled ? 0.62 : 1)};
  transition: box-shadow 0.2s ease;

  body.dark & {
    background: ${(props) => (props.$inactive ? 'rgb(255 255 255 / 3%)' : 'rgb(255 255 255 / 5%)')};
  }

  &:hover {
    box-shadow: 0 8px 20px rgb(77 122 190 / 10%);
  }
`

const Identity = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
`

const ModelLine = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;

  strong {
    flex: 0 1 auto;
    min-width: 60px;
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
  padding: 40px 16px;
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

const SuffixControls = styled.span`height:100%;display:inline-flex;align-items:center;gap:8px;`
const KeyVisibility = styled.button`padding:0;display:inline-flex;align-items:center;border:0;background:transparent;color:var(--color-text-3);cursor:pointer;`
