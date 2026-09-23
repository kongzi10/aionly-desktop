import type { ToolActionKey, ToolRenderContext, ToolStateKey } from '@renderer/pages/home/Inputbar/types'

import { useMentionModelsPanel } from './useMentionModelsPanel'

interface ManagerProps {
  context: ToolRenderContext<readonly ToolStateKey[], readonly ToolActionKey[]>
}

/** 注册 @ 输入触发器和 QuickPanel 根菜单，把模型选择入口指到 SelectMultiModelsPopup 弹窗 */
const MentionModelsQuickPanelManager = ({ context }: ManagerProps) => {
  const {
    quickPanel,
    state: { mentionedModels, couldMentionNotVisionModel },
    actions: { setMentionedModels, onTextChange }
  } = context

  useMentionModelsPanel(
    {
      quickPanel,
      mentionedModels,
      setMentionedModels,
      couldMentionNotVisionModel,
      setText: onTextChange as React.Dispatch<React.SetStateAction<string>>
    },
    'manager'
  )

  return null
}

export default MentionModelsQuickPanelManager
