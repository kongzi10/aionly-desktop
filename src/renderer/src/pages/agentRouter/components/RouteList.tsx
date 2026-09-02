import { DeleteOutlined, DownOutlined, EditOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons'
import type { AgentRouteModel, UpdateAgentRouteRequest } from '@shared/agentRouter'
import type { TableColumnsType } from 'antd'
import { Button, Empty, Form, Input, message, Modal, Select, Switch, Table, Tag } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { AgentRouterCredential, RouteModel } from '../hooks/useAgentRouterSources'
import { RouteModelTypes } from './RouteCapabilities'

interface EditFormValues {
  displayName?: string
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
  tokenPlanModels = [],
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
  tokenPlanModels?: RouteModel[]
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
  if (!routes.length)
    return <CompactEmpty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('agentRouter.noRoutes')} />

  const credentialsById = new Map(credentials.map((credential) => [credential.id, credential]))
  const editCredential = routeToEdit ? credentialsById.get(routeToEdit.credentialId) : undefined
  const editCredentials = editAccessMode === 'tokenPlan' ? tokenPlanCredentials : apiCredentials
  const editModels = editAccessMode === 'tokenPlan' ? tokenPlanModels : apiModels
  const editModel = routeToEdit ? editModels.find((model) => model.id === routeToEdit.modelId) : undefined
  const editModelTypes = editModel?.modelTypes ?? routeToEdit?.modelTypes
  const selectedEditCredential = editCredentials.find((credential) => credential.id === editCredentialId)
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

  const columns: TableColumnsType<AgentRouteModel> = [
    {
      title: t('agentRouter.routeName'),
      dataIndex: 'displayName',
      key: 'displayName',
      render: (_, route) => (
        <RouteIdentity>
          <NameLine>
            <strong>{route.displayName}</strong>
            <RouteModelTypes compact modelTypes={route.modelTypes} />
          </NameLine>
          <span>{route.modelId}</span>
        </RouteIdentity>
      )
    },
    {
      title: t('agentRouter.accessMode'),
      dataIndex: 'accessMode',
      key: 'accessMode',
      width: 80,
      render: (accessMode: AgentRouteModel['accessMode']) => <Tag>{accessMode === 'api' ? 'API' : 'TokenPlan'}</Tag>
    },
    {
      title: t('agentRouter.apiKey'),
      dataIndex: 'credentialId',
      key: 'credentialId',
      width: 135,
      render: (credentialId: string) => {
        const credential = credentialsById.get(credentialId)
        return credential ? (
          <MutedText title={credential.label}>{credential.maskedValue}</MutedText>
        ) : (
          <MutedText>{t('agentRouter.credentialUnavailable')}</MutedText>
        )
      }
    },
    {
      title: t('agentRouter.actions'),
      key: 'actions',
      width: 180,
      align: 'left',
      render: (_, route) => (
        <RowActions>
          <Switch
            size="small"
            checked={routeTogglesDisabled ? false : route.enabled}
            disabled={busy || routeTogglesDisabled}
            onChange={(enabled) => {
              if (enabled && routes.some((item) => item.modelId === route.modelId && item.enabled)) {
                setRouteToEnable(route)
                return
              }
              onEnabledChange(route, enabled)
            }}
          />
          <Button
            type="text"
            size="small"
            disabled={busy}
            icon={<EditOutlined />}
            onClick={() => {
              setRouteToEdit(route)
              setShowEditKey(false)
              setRevealedCurrentKey(undefined)
              editForm.setFieldsValue({
                displayName: route.displayName,
                accessMode: route.accessMode,
                credentialId: CURRENT_CREDENTIAL
              })
            }}>
            {t('agentRouter.edit')}
          </Button>
          <Button
            type="text"
            size="small"
            danger
            disabled={busy}
            icon={<DeleteOutlined />}
            onClick={() => setRouteToRemove(route)}>
            {t('agentRouter.remove')}
          </Button>
        </RowActions>
      )
    }
  ]

  return (
    <TableContainer>
      {contextHolder}
      <Table<AgentRouteModel>
        dataSource={routes}
        columns={columns}
        pagination={false}
        rowKey={(route) => `${route.modelId}:${route.credentialId}`}
        size="small"
        tableLayout="fixed"
      />
      <StyledEditModal
        open={Boolean(routeToEdit)}
        width={560}
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
              displayName: values.displayName,
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
        <Form form={editForm} labelCol={{ flex: '86px' }} labelAlign="left" colon={false} style={{ marginTop: 15 }}>
          <Form.Item name="displayName" label={t('agentRouter.displayName')}>
            <Input aria-label={t('agentRouter.displayName')} placeholder={t('agentRouter.displayNameModelFallback')} />
          </Form.Item>
          <Form.Item name="accessMode" label={t('agentRouter.accessMode')}>
            <Select
              aria-label={t('agentRouter.accessMode')}
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
              value={routeToEdit?.modelId}
              options={[{ value: routeToEdit?.modelId, label: routeToEdit?.modelId }]}
            />
          </Form.Item>
          {editModelTypes ? (
            <ModelTypeSection>
              <RouteModelTypes modelTypes={editModelTypes} />
            </ModelTypeSection>
          ) : null}
        </Form>
      </StyledEditModal>
      <OverwriteModal
        open={Boolean(routeToEnable)}
        centered
        width={380}
        title={t('agentRouter.confirmOverwriteModelId')}
        okText={t('agentRouter.overwrite')}
        cancelText={t('common.cancel')}
        onCancel={() => setRouteToEnable(null)}
        onOk={() => {
          if (routeToEnable) onEnabledChange(routeToEnable, true)
          setRouteToEnable(null)
        }}
      />
      <Modal
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
    </TableContainer>
  )
}

const CompactEmpty = styled(Empty)`
  margin: 13px 0 12px;
  .ant-empty-image { height: 30px; margin-bottom: 4px; }
  .ant-empty-description { font-size: 11px; }
`

const TableContainer = styled.div`
  .ant-table { background: transparent; }
  .ant-table-thead > tr > th { color: var(--color-text-3); font-size: 11px; font-weight: 600; background: transparent; }
  .ant-table-tbody > tr > td { height: 58px; }
`

const RouteIdentity = styled.div`
  min-width: 0; display: flex; flex-direction: column; gap: 2px;
  > span { overflow: hidden; color: var(--color-text-3); font-family: monospace; font-size: 11px; white-space: nowrap; text-overflow: ellipsis; }
`

const NameLine = styled.div`
  min-width: 0; display: flex; align-items: center; gap: 5px;
  strong { flex: 0 1 auto; min-width: 80px; overflow: hidden; color: var(--color-text-1); font-size: 13px; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }
`

const RowActions = styled.div`
  display: flex; align-items: center; justify-content: flex-start; gap: 0;
  .ant-btn { padding-inline: 5px; font-size: 11px; }
`

const MutedText = styled.span`
  color: var(--color-text-3);
  font-size: 12px;
`

const StyledEditModal = styled(Modal)`
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
  .ant-select-selection-item { line-height: 34px !important; }
  .ant-select-arrow { inset-block-start: 50%; margin-top: 0; display: flex; align-items: center; transform: translateY(-50%); }
`
const ModelTypeSection = styled.div`margin-top:4px;padding:16px 0 2px;border-top:1px solid var(--color-border);`

const SuffixControls = styled.span`height:100%;display:inline-flex;align-items:center;gap:8px;`
const KeyVisibility = styled.button`padding:0;display:inline-flex;align-items:center;border:0;background:transparent;color:var(--color-text-3);cursor:pointer;`

const OverwriteModal = styled(Modal)`
  .ant-modal-content { border-radius: 6px; }
  .ant-modal-header { margin-bottom: 18px; }
`
