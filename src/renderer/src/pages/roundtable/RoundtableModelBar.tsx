import { getModelLogo } from '@renderer/config/models'
import { useInputbarTools } from '@renderer/pages/home/Inputbar/context/InputbarToolsProvider'
import { useMentionModelsPanel } from '@renderer/pages/home/Inputbar/tools/components/useMentionModelsPanel'
import { getModelUniqId } from '@renderer/services/ModelService'
import { Button } from 'antd'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import RoundtableCompareIcon from './RoundtableCompareIcon'
import RoundtableModelChip from './RoundtableModelChip'

const RoundtableModelBar = () => {
  const { t } = useTranslation()
  const tools = useInputbarTools()

  const { handleOpenModelPopup } = useMentionModelsPanel({
    mentionedModels: tools.mentionedModels,
    setMentionedModels: tools.setMentionedModels,
    couldMentionNotVisionModel: tools.couldMentionNotVisionModel,
    setText: tools.onTextChange,
    mode: 'roundtable'
  })

  return (
    <Container data-testid="roundtable-model-bar">
      <Models>
        {tools.mentionedModels.map((model) => (
          <RoundtableModelChip
            key={getModelUniqId(model)}
            logo={getModelLogo(model)}
            name={model.name}
            removeLabel={t('common.delete')}
            onOpen={handleOpenModelPopup}
            onRemove={() =>
              tools.setMentionedModels((models) =>
                models.filter((candidate) => getModelUniqId(candidate) !== getModelUniqId(model))
              )
            }
          />
        ))}
        <AddModelButton type="primary" icon={<RoundtableCompareIcon />} onClick={handleOpenModelPopup}>
          {t('roundtable.add_model')}
        </AddModelButton>
      </Models>
    </Container>
  )
}

const Container = styled.div`
  width: 100%;
  padding: 0 0 10px;
  overflow: hidden;
`

const Models = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`

const AddModelButton = styled(Button)`
  height: 32px;
  flex: 0 0 auto;
  border-radius: 16px;
  padding: 0 16px;
  background-color: rgba(0, 94, 255, 1);

  .ant-btn-icon {
    display: flex;
  }
`

export default RoundtableModelBar
