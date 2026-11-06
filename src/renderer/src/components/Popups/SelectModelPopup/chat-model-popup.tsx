import { useAllProviders, useProviders } from '@renderer/hooks/useProvider'
import type { Model, Provider } from '@renderer/types'
import { sortBy } from 'lodash'
import React, { useMemo } from 'react'

import SelectModelPopupView, { createModelPopup } from './aionly/base-popup'

interface PopupParams {
  model?: Model
  filter?: (model: Model) => boolean
  showTagFilter?: boolean
  /** 搜索栏右侧展示「开通模型」入口（首页选择模型弹窗使用） */
  showOpenModelButton?: boolean
}

interface Props extends PopupParams {
  resolve: (value: Model | undefined) => void
}

const PopupContainer: React.FC<Props> = ({
  model,
  filter,
  showTagFilter = true,
  showOpenModelButton = false,
  resolve
}) => {
  const { providers } = useProviders()
  const allProviders = useAllProviders()

  const filteredProviders = useMemo(() => {
    const providerOrderMap = new Map(allProviders.map((provider, i) => [provider.id, i]))
    const filtered = providers.reduce<Provider[]>((result, provider) => {
      const models = filter ? provider.models.filter(filter) : provider.models
      if (models.length === 0) return result
      result.push({ ...provider, models })
      return result
    }, [])
    return sortBy(filtered, (provider) => providerOrderMap.get(provider.id) ?? Infinity)
  }, [providers, allProviders, filter])

  return (
    <SelectModelPopupView
      providers={filteredProviders}
      model={model}
      modelFilter={filter}
      showTagFilter={showTagFilter}
      showOpenModelButton={showOpenModelButton}
      showPinnedModels={true}
      resolve={resolve}
    />
  )
}

export const SelectChatModelPopup = createModelPopup<PopupParams, Model>(PopupContainer)
