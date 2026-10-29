import ModelAvatar from '@renderer/components/Avatar/ModelAvatar'
import HorizontalScrollContainer from '@renderer/components/HorizontalScrollContainer'
import { getModelUniqId } from '@renderer/services/ModelService'
import type { Model } from '@renderer/types'
import { Tooltip } from 'antd'
import { X } from 'lucide-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const MentionModelsInput: FC<{
  selectedModels: Model[]
  onRemoveModel: (model: Model) => void
}> = ({ selectedModels, onRemoveModel }) => {
  const { t } = useTranslation()

  return (
    <Container data-mentioned-models>
      <HorizontalScrollContainer dependencies={[selectedModels]} gap="6px">
        {selectedModels.map((model) => (
          <ModelChip key={getModelUniqId(model)}>
            <ModelAvatar model={model} size={16} />
            <Tooltip title={model.group ? `${model.name} · ${model.group}` : model.name} mouseEnterDelay={0.4}>
              <ModelName>{model.name}</ModelName>
            </Tooltip>
            <RemoveButton
              type="button"
              aria-label={`${t('common.delete')} ${model.name}`}
              onClick={() => onRemoveModel(model)}>
              <X size={12} strokeWidth={1.8} />
            </RemoveButton>
          </ModelChip>
        ))}
      </HorizontalScrollContainer>
    </Container>
  )
}

const Container = styled.div`
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 0 48px 6px 15px;
`

const ModelChip = styled.div`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  height: 28px;
  max-width: 210px;
  padding: 0 5px 0 6px;
  border: 1px solid rgb(90 143 215 / 22%);
  border-radius: 9px;
  background: rgb(94 154 232 / 9%);
  color: var(--color-text);
`

const ModelName = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 1;
`

const RemoveButton = styled.button`
  display: inline-flex;
  flex: 0 0 18px;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--color-text-3);
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: rgb(94 154 232 / 18%);
    color: var(--color-text);
  }
`

export default MentionModelsInput
