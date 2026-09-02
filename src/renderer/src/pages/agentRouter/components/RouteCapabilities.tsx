import {
  EmbeddingTag,
  ReasoningTag,
  RerankerTag,
  ToolsCallingTag,
  VisionTag,
  WebSearchTag
} from '@renderer/components/Tags/Model'
import type { AgentRouteModelType } from '@shared/agentRouter'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const ALL_MODEL_TYPES: readonly AgentRouteModelType[] = [
  'vision',
  'web_search',
  'reasoning',
  'function_calling',
  'rerank',
  'embedding'
]

const ModelTypeTag = ({ type, inactive }: { type: AgentRouteModelType; inactive: boolean }) => {
  const commonProps = { inactive, size: 11 }
  return (
    <TagSlot data-testid="model-type-tag" data-inactive={String(inactive)}>
      {type === 'vision' ? <VisionTag showLabel {...commonProps} /> : null}
      {type === 'web_search' ? <WebSearchTag showLabel {...commonProps} /> : null}
      {type === 'reasoning' ? <ReasoningTag showLabel {...commonProps} /> : null}
      {type === 'function_calling' ? <ToolsCallingTag showLabel {...commonProps} /> : null}
      {type === 'rerank' ? <RerankerTag {...commonProps} /> : null}
      {type === 'embedding' ? <EmbeddingTag {...commonProps} /> : null}
    </TagSlot>
  )
}

export const RouteModelTypes = ({
  modelTypes,
  compact = false
}: {
  modelTypes: readonly AgentRouteModelType[]
  compact?: boolean
}) => {
  const { t } = useTranslation()
  const visibleTypes = compact ? modelTypes : ALL_MODEL_TYPES

  if (compact && visibleTypes.length === 0) return null

  return (
    <Container $compact={compact}>
      {!compact ? <Label>{t('agentRouter.modelTypes')}</Label> : null}
      <Tags>
        {visibleTypes.map((type) => (
          <ModelTypeTag key={type} type={type} inactive={!modelTypes.includes(type)} />
        ))}
      </Tags>
    </Container>
  )
}

const Container = styled.div<{ $compact: boolean }>`
  display: flex;
  flex-direction: ${({ $compact }) => ($compact ? 'row' : 'column')};
  align-items: ${({ $compact }) => ($compact ? 'center' : 'flex-start')};
  gap: ${({ $compact }) => ($compact ? '4px' : '10px')};
`
const Label = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-1);
  font-size: 12px;
  font-weight: 650;
`
const Tags = styled.div`display:flex;align-items:center;flex-wrap:wrap;gap:5px;`
const TagSlot = styled.span`display:inline-flex;`
