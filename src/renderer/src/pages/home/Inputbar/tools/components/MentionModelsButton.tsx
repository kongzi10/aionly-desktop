import { ActionIconButton } from '@renderer/components/Buttons'
import type { Model } from '@renderer/types'
import { Tooltip } from 'antd'
import { AtSign } from 'lucide-react'
import type { FC } from 'react'
import type React from 'react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { useMentionModelsPanel } from './useMentionModelsPanel'

interface Props {
  mentionedModels: Model[]
  setMentionedModels: React.Dispatch<React.SetStateAction<Model[]>>
  couldMentionNotVisionModel: boolean
  setText: React.Dispatch<React.SetStateAction<string>>
}

const MentionModelsButton: FC<Props> = ({
  mentionedModels,
  setMentionedModels,
  couldMentionNotVisionModel,
  setText
}) => {
  const { t } = useTranslation()

  const { handleOpenModelPopup } = useMentionModelsPanel({
    mentionedModels,
    setMentionedModels,
    couldMentionNotVisionModel,
    setText
  })

  return (
    <Tooltip placement="top" title={t('assistants.presets.edit.model.select.title')} mouseLeaveDelay={0} arrow>
      <ActionIconButton
        onClick={handleOpenModelPopup}
        active={mentionedModels.length > 0}
        aria-label={t('assistants.presets.edit.model.select.title')}>
        <AtSign size={18} />
      </ActionIconButton>
    </Tooltip>
  )
}

export default memo(MentionModelsButton)
