import { Modal } from 'antd'
import styled from 'styled-components'

export const RouteFormModal = styled(Modal)`
  &&& .ant-modal-content { padding: 24px; border-radius: 12px; }
  &&& .ant-modal-content .ant-modal-header { padding: 0; margin: 0 0 24px; }
  &&& .ant-modal-content .ant-modal-body { padding: 0; }
  .ant-modal-title { font-size: 16px; font-weight: 650; }
  &&& .ant-modal-content .ant-modal-footer { margin: 24px 0 0; padding: 16px 0 0; border-top: 1px solid var(--color-border); }
  .ant-form-item { margin-bottom: 20px; }
  .ant-form-item:last-child { margin-bottom: 0; }
  .ant-form-item-row { flex-wrap: nowrap; align-items: flex-start; }
  .ant-form-item-label { flex: 0 0 86px; padding: 0; }
  .ant-form-item-label > label { height: 36px; font-weight: 600; }
  .ant-form-item-control { min-width: 0; flex: 1; }
  .ant-select-single { height: 36px; width: 100%; }
  .ant-select-selector { border-radius: 8px; background: var(--color-background-soft) !important; }
  .ant-tabs-nav { margin-bottom: 24px; }
`
