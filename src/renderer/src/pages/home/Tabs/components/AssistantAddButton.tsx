import AddButton from '@renderer/components/AddButton'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

interface AssistantAddButtonProps {
  onCreateAssistant: () => void
}

const AssistantAddButton: FC<AssistantAddButtonProps> = ({ onCreateAssistant }) => {
  const { t } = useTranslation()

  return (
    <div className="assistant-add-button" data-tour="add-assistant">
      <AddButton onClick={onCreateAssistant}>{t('chat.add.assistant.title')}</AddButton>
    </div>
  )
}

export default AssistantAddButton
