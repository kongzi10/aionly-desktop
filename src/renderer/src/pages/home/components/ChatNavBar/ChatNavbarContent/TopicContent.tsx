// import EmojiIcon from '@renderer/components/EmojiIcon'
import { WarningFilled } from '@ant-design/icons'
import HorizontalScrollContainer from '@renderer/components/HorizontalScrollContainer'
import { useFetchAndSetupModels } from '@renderer/hooks/useAiOnlyModels'
import { useProvider } from '@renderer/hooks/useProvider'
import AiOnlyAddModelPopup from '@renderer/pages/settings/ProviderSettings/AiOnlyModel/add/AddModelPopup'
import { selectAiOnlyModels } from '@renderer/store/user'
// import AssistantSettingsPopup from '@renderer/pages/settings/AssistantSettings'
import type { Assistant } from '@renderer/types'
import { Button } from 'antd'
// import { getLeadingEmoji } from '@renderer/utils'
// import { ChevronRight } from 'lucide-react'
// import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import styled from 'styled-components'

import SelectModelButton from '../../SelectModelButton'
import Tools from '../Tools'

type TopicContentProps = {
  assistant: Assistant
}

const TopicContent = ({ assistant }: TopicContentProps) => {
  const { t } = useTranslation()
  // const assistantName = useMemo(() => assistant.name || t('chat.default.name'), [assistant.name, t])
  const { provider } = useProvider('aionly')

  // 获取 aiOnly 模型列表
  const aiOnlyModels = useSelector(selectAiOnlyModels)
  const setupModels = useFetchAndSetupModels()

  const handleOpenModel = async () => {
    const result = await AiOnlyAddModelPopup.show({ provider })
    if (result.success) {
      await setupModels(10)
    }
  }

  return (
    <>
      <HorizontalScrollContainer className="ml-2 flex-initial">
        <div className="flex flex-nowrap items-center gap-2">
          {/* Assistant Label */}
          {/*<div
            className="flex h-full cursor-pointer items-center gap-1.5"
            onClick={() => AssistantSettingsPopup.show({ assistant })}>
            <EmojiIcon emoji={assistant.emoji || getLeadingEmoji(assistantName)} size={24} />
            <span className="max-w-40 truncate text-xs">{assistantName}</span>
          </div>*/}

          {/* Separator */}
          {/*<ChevronRight className="h-4 w-4 text-gray-400" />*/}

          {/* Model Button */}
          {aiOnlyModels && aiOnlyModels.length > 0 ? (
            <span className="single-model-selector">
              <SelectModelButton assistant={assistant} />
            </span>
          ) : (
            <>
              <TipText className="tips">
                <WarningFilled />
                {t('chat.topics.no_model')}
              </TipText>
              <Button type="primary" size="small" onClick={handleOpenModel}>
                {t('chat.topics.open_model_text')}
              </Button>
            </>
          )}
        </div>
      </HorizontalScrollContainer>
      {aiOnlyModels && aiOnlyModels.length > 0 && <Tools assistant={assistant} />}
    </>
  )
}

const TipText = styled.span`
  color: var(--color-red-600);
  font-size: 14px;
`

export default TopicContent
