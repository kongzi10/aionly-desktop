import { useInputbarTools } from '@renderer/pages/home/Inputbar/context/InputbarToolsProvider'
import { useMentionModelsPanel } from '@renderer/pages/home/Inputbar/tools/components/useMentionModelsPanel'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import RoundtableCompareIcon from './RoundtableCompareIcon'

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
    <AddModelButton
      type="button"
      data-testid="roundtable-model-bar"
      data-tour="roundtable-add-model"
      onClick={handleOpenModelPopup}>
      <RoundtableCompareIcon width={15} height={15} />
      <span>{t('roundtable.add_model')}</span>
    </AddModelButton>
  )
}

const AddModelButton = styled.button`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 29px;
  padding: 0 9px;
  border: 1px solid rgb(90 143 215 / 22%);
  border-radius: 9px;
  background: rgb(94 154 232 / 9%);
  color: var(--color-primary);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: rgb(94 154 232 / 17%);
    border-color: rgb(90 143 215 / 38%);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
`

export default RoundtableModelBar
