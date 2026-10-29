// import EmojiIcon from '@renderer/components/EmojiIcon'
import { WarningFilled } from '@ant-design/icons'
import HorizontalScrollContainer from '@renderer/components/HorizontalScrollContainer'
import { useFetchAndSetupModels } from '@renderer/hooks/useAiOnlyModels'
import { useProvider } from '@renderer/hooks/useProvider'
import AiOnlyAddModelPopup from '@renderer/pages/settings/ProviderSettings/AiOnlyModel/add/AddModelPopup'
import { selectAiOnlyModels } from '@renderer/store/user'
// import AssistantSettingsPopup from '@renderer/pages/settings/AssistantSettings'
import { Button } from 'antd'
// import { getLeadingEmoji } from '@renderer/utils'
// import { ChevronRight } from 'lucide-react'
// import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import styled from 'styled-components'

import Tools from '../Tools'

const TopicContent = () => {
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
      {(!aiOnlyModels || aiOnlyModels.length === 0) && (
        <HorizontalScrollContainer className="ml-2 flex-initial">
          <div className="flex flex-nowrap items-center gap-2">
            <TipText className="tips">
              <WarningFilled />
              {t('chat.topics.no_model')}
            </TipText>
            <Button type="primary" size="small" onClick={handleOpenModel}>
              {t('chat.topics.open_model_text')}
            </Button>
          </div>
        </HorizontalScrollContainer>
      )}
      {aiOnlyModels && aiOnlyModels.length > 0 && (
        <div className="ml-auto">
          <Tools />
        </div>
      )}
    </>
  )
}

const TipText = styled.span`
  color: var(--color-red-600);
  font-size: 14px;

  body.light #home-page & {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border: 1px solid rgb(255 255 255 / 70%);
    border-radius: 100px;
    background: rgb(233 244 255 / 78%);
    color: #466a9e;
    font-size: 12px;
  }
`

export default TopicContent
