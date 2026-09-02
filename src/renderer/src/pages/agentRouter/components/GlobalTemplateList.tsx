import { DeleteOutlined } from '@ant-design/icons'
import type { AgentRouteTemplate } from '@shared/agentRouter'
import { Button, Empty, Tag } from 'antd'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { RouteModelTypes } from './RouteCapabilities'

export const GlobalTemplateList = ({
  templates,
  onDelete
}: {
  templates: AgentRouteTemplate[]
  onDelete: (templateId: string) => void
}) => {
  const { t } = useTranslation()
  if (templates.length === 0)
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('agentRouter.noGlobalTemplates')} />
  return (
    <List>
      {templates.map((template) => (
        <Row key={template.templateId}>
          <Identity>
            <ModelLine>
              <strong>{template.modelId}</strong>
              <RouteModelTypes compact modelTypes={template.modelTypes} />
            </ModelLine>
          </Identity>
          <Meta>
            <AccessMode>{template.accessMode === 'api' ? 'API' : 'TokenPlan'}</AccessMode>
            <KeyIdentity>
              <span>{template.credentialName}</span>
              <Masked>{template.maskedKey}</Masked>
            </KeyIdentity>
            <DeleteButton
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label={t('agentRouter.deleteGlobalTemplate')}
              onClick={() => onDelete(template.templateId)}>
              {t('agentRouter.remove')}
            </DeleteButton>
          </Meta>
        </Row>
      ))}
    </List>
  )
}

const List = styled.div`padding:8px;display:flex;flex-direction:column;gap:6px;`
const Row = styled.div`min-height:58px;padding:9px 8px 9px 12px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:16px;border:1px solid transparent;border-radius:9px;background:var(--color-background-soft);transition:border-color .16s ease,background .16s ease;&:hover{border-color:var(--color-border);background:color-mix(in srgb,var(--color-background-soft) 82%,var(--color-primary) 3%)}`
const Identity = styled.div`min-width:0;`
const ModelLine = styled.div`min-width:0;display:flex;align-items:center;gap:8px;strong{flex:0 1 auto;min-width:80px;overflow:hidden;font-size:12px;white-space:nowrap;text-overflow:ellipsis}`
const Meta = styled.div`min-width:0;display:flex;align-items:center;justify-content:flex-end;gap:6px;`
const AccessMode = styled(Tag)`min-width:62px;margin:0;text-align:center;`
const Masked = styled.code`min-width:92px;color:var(--color-text-3);font-size:11px;`
const DeleteButton = styled(Button)`padding-inline:5px;font-size:11px;`

const KeyIdentity = styled.div`min-width:0;display:flex;flex-direction:column;gap:2px;span{font-size:11px;}`
