import { ModelAttribute } from '@renderer/hooks/useAiOnlyModels'
import type { Model } from '@renderer/types'
import React from 'react'

import SelectModelPopupView, { createModelPopup } from './aionly/base-popup'

interface PopupParams {
  model?: Model
  /** 搜索栏右侧展示「开通新模型」入口 */
  showOpenModelButton?: boolean
}

interface Props extends PopupParams {
  resolve: (value: Model | undefined) => void
}

/**
 * 绘画页选择模型弹窗：复用对话页选择模型弹窗的样式与功能逻辑
 * （搜索、分组折叠、虚拟滚动、键盘导航、开通新模型入口），数据源仅图片生成模型。
 */
const PopupContainer: React.FC<Props> = ({ model, showOpenModelButton = false, resolve }) => {
  return (
    <SelectModelPopupView
      providers={[]}
      model={model}
      modelAttribute={ModelAttribute.ImageModel}
      modelType="3"
      openModelType="image_generation"
      showTagFilter={false}
      showOpenModelButton={showOpenModelButton}
      showPinnedModels={false}
      resolve={resolve}
    />
  )
}

export const SelectPaintingModelPopup = createModelPopup<PopupParams, Model>(PopupContainer)
