import { DeleteOutlined } from '@ant-design/icons'
import type { AgentRouteTemplate } from '@shared/agentRouter'
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
    return (
      <EmptyBox>
        <strong>{t('agentRouter.noGlobalTemplates')}</strong>
        <span>{t('agentRouter.globalTemplatesDescription')}</span>
      </EmptyBox>
    )

  return (
    <List>
      {templates.map((template) => (
        <Row key={template.templateId}>
          <Identity>
            <ModelLine>
              <strong>{template.modelId}</strong>
              <RouteModelTypes compact modelTypes={template.modelTypes} />
            </ModelLine>
            <KeyLine>
              <span>{template.credentialName}</span>
              <code>{template.maskedKey}</code>
            </KeyLine>
          </Identity>
          <AccessChip $mode={template.accessMode}>{template.accessMode === 'api' ? 'API' : 'TokenPlan'}</AccessChip>
          <IconKey
            type="button"
            $danger
            aria-label={t('agentRouter.deleteGlobalTemplate')}
            title={t('agentRouter.deleteGlobalTemplate')}
            onClick={() => onDelete(template.templateId)}>
            <DeleteOutlined />
          </IconKey>
        </Row>
      ))}
    </List>
  )
}

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 1px 0 2px;
`

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
  min-height: 62px;
  padding: 9px 10px 9px 14px;
  border: 1px solid rgb(132 172 226 / 18%);
  border-radius: 12px;
  background: rgb(246 250 255);
  transition: box-shadow 0.2s ease;

  body.dark & {
    background: rgb(255 255 255 / 5%);
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

const KeyLine = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;

  span {
    overflow: hidden;
    color: var(--color-text-2);
    font-size: 11.5px;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  code {
    color: var(--color-text-3);
    font-family: monospace;
    font-size: 11px;
  }
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

const IconKey = styled.button<{ $danger?: boolean }>`
  display: inline-flex;
  flex: 0 0 auto;
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
  transition: background-color 0.2s ease;

  &:hover:not(:disabled) {
    background: ${(props) => (props.$danger ? 'rgb(217 83 79 / 12%)' : 'rgb(96 150 255 / 12%)')};
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 1px;
  }
`

const EmptyBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 2px 0;
  padding: 44px 16px;
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
