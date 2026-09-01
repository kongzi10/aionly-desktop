import { selectTokenPlanHourlyDayUsageApi } from '@renderer/api/billManagement'
import { TopView } from '@renderer/components/TopView'
import { DynamicVirtualList, type DynamicVirtualListRef } from '@renderer/components/VirtualList'
import { isNotSupportTextDeltaModel } from '@renderer/config/models'
import { transformToModel, useAiOnlyModels } from '@renderer/hooks/useAiOnlyModels'
import useUserTokenPlan from '@renderer/hooks/useUserTokenPlan'
import { getModelUniqId } from '@renderer/services/ModelService'
import { useAppSelector } from '@renderer/store'
import { selectUserInfo } from '@renderer/store/user'
import type { Model, Provider } from '@renderer/types'
import { classNames } from '@renderer/utils'
import { Avatar, Empty, Modal, Spin } from 'antd'
import { first } from 'lodash'
import { ChevronRight } from 'lucide-react'
import React, {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import SelectModelSearchBar from '../searchbar'
import type { FlatListItem, FlatListModel } from '../types'

const PAGE_SIZE = 12
const ITEM_HEIGHT = 36

export interface SelectModelPopupParams {
  providers: Provider[]
  modelFilter?: (model: any) => boolean
  modelMapper?: (model: any) => any
  apiFilter?: any
  model?: Model
  fromType?: 'chat' | 'agent'
  loading?: boolean
  /** Show tag filter section */
  showTagFilter?: boolean
  showPinnedModels?: boolean
  prioritizedProviderIds?: string[]
}

interface Props extends SelectModelPopupParams {
  resolve: (value: Model | undefined) => void
}

const SelectModelPopupView: React.FC<Props> = ({ model, modelFilter, fromType, resolve }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)
  const [isLoading, _setIsLoading] = useState(false)
  const listRef = useRef<DynamicVirtualListRef>(null)
  const [_searchText, _setSearchText] = useState('')
  const searchText = useDeferredValue(_searchText)

  const setSearchText = useCallback((text: string) => {
    _setSearchText(text)
  }, [])
  // 记录已收起的分组（值为 serviceName），默认全部展开
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())

  const toggleGroupCollapsed = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }, [])

  const userInfo: any = useAppSelector(selectUserInfo)
  const { getUserEnabledPlan } = useUserTokenPlan(userInfo?.userId)
  const [tokenPlanModels, setTokenPlanModels] = useState<any[]>([])
  const [userEnabledPlan] = useState<any>(getUserEnabledPlan())

  // 当前选中的模型ID
  const currentModelId = model ? getModelUniqId(model) : ''

  // 管理滚动和焦点状态
  const [focusedItemKey, _setFocusedItemKey] = useState('')
  const [isMouseOver, setIsMouseOver] = useState(false)

  const setFocusedItemKey = useCallback((key: string) => {
    startTransition(() => {
      _setFocusedItemKey(key)
    })
  }, [])

  const { models, loading, setLoading, fetchNextPage, getFilteredModels, hasMore } = useAiOnlyModels({
    pageSize: 1000, // TODO: 临时规避分组加载数据抖动问题，后续改动，按实际使用，一次加载1000条也够用了
    autoFetch: !userEnabledPlan // TODO: 当用户启用了tokenPlan时，不自动加载模型数据
  })

  // TODO: 当用户启用了tokenPlan时，查询套餐下的模型数据
  const fetchSelectTokenPlanHourlyDayUsage = async () => {
    try {
      setLoading(true)
      const userSelectedPlan: any = getUserEnabledPlan()
      if (!userSelectedPlan) {
        setLoading(false)
        return
      }
      const res: any = await selectTokenPlanHourlyDayUsageApi({
        subscribeId: userSelectedPlan.id,
        planId: userSelectedPlan.planId
      })
      const resData = res.rows || []
      const modelList = resData.map((item: any) => {
        return transformToModel(item)
      })
      setTokenPlanModels(modelList)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const userSelectedPlan: any = getUserEnabledPlan()
    if (!!userSelectedPlan) {
      fetchSelectTokenPlanHourlyDayUsage().then()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEnabledPlan?.id, userEnabledPlan?.planId])

  const handleDynamicListChange = (instance: any) => {
    // 如果启用了tokenPlan，则不进行滚动加载
    if (!!userEnabledPlan) {
      return
    }
    // 检测是否滚动到底部
    const scrollElement = instance.scrollElement
    if (scrollElement) {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight

      if (distanceFromBottom < 50 && hasMore && !loading) {
        fetchNextPage() // 👈 触发加载更多
      }
    }
  }

  // 创建模型列表项
  const createModelItem = useCallback(
    (model: any): FlatListModel => {
      const modelId = getModelUniqId(model)
      // 使用与去重逻辑一致的唯一标识：baseId-serviceName
      const uniqueKey = `${model.baseId || model.id}-${model.serviceName}`
      return {
        key: uniqueKey,
        type: 'model',
        name: (
          <ModelName>
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="min-w-0 truncate">{model.modelName}</span>
            </div>
          </ModelName>
        ),
        tags: null,
        icon: (
          <Avatar src={model?.modelFileUrl} size={24}>
            {first(model.modelName) || 'M'}
          </Avatar>
        ),
        model,
        isSelected: modelId === currentModelId
      }
    },
    [currentModelId]
  )

  // 构建列表数据
  const { listItems, modelItems } = useMemo(() => {
    const items: FlatListItem[] = []
    let filterModels = !userEnabledPlan ? getFilteredModels() : tokenPlanModels

    // 应用 modelFilter（如果提供）
    if (modelFilter) {
      filterModels = filterModels
        .map((x: any) => {
          const baseItem = {
            origin_id: x.id,
            id: x.baseId || x.model,
            name: x.modelName,
            provider: 'aionly'
          }
          if (fromType === 'agent') {
            return {
              ...x,
              ...baseItem,
              origin: {
                id: `aionly:${x.baseId || x.model}`,
                object: 'model',
                created: x.createTime,
                name: x.modelName,
                owned_by: 'AIOnly',
                provider: 'aionly',
                provider_model_id: x.baseId || x.model,
                provider_name: 'AIOnly',
                provider_type: 'openai',
                // 保留原始的 AiOnly 模型信息
                modelName: x.modelName,
                serviceName: x.serviceName,
                modelFileUrl: x.modelFileUrl,
                baseId: x.baseId || x.model
              }
            }
          }

          return {
            ...x,
            ...baseItem,
            supported_text_delta: !isNotSupportTextDeltaModel(x)
          }
        })
        .filter(modelFilter)
    }
    // 去重：同一 (id, serviceName) 只保留第一条
    const seen = new Set<string>()
    filterModels = filterModels.filter((m: any) => {
      const k = `${m.id}-${m.serviceName}`
      return seen.has(k) ? false : (seen.add(k), true)
    })

    // 搜索过滤：按 modelName 搜索
    if (searchText.trim()) {
      const lowerSearchText = searchText.toLowerCase()
      filterModels = filterModels.filter((m: any) => m.modelName.toLowerCase().includes(lowerSearchText))
    }

    // 按 serviceName 分组
    const groupedByService = filterModels.reduce(
      (acc, model) => {
        const serviceName = model.serviceName || 'Unknown'
        if (!acc[serviceName]) {
          acc[serviceName] = []
        }
        acc[serviceName].push(model)
        return acc
      },
      {} as Record<string, typeof filterModels>
    )

    // 为每个分组创建扁平化的列表项（group header + models）
    Object.entries(groupedByService).forEach(([serviceName, models]) => {
      // 添加分组标题
      items.push({
        key: `group-${serviceName}`,
        type: 'group',
        name: serviceName,
        icon: null,
        actions: null,
        isSelected: false
      })

      // 如果分组未收起，添加该分组下的所有模型
      if (!collapsedGroups.has(serviceName)) {
        const typedModels = models as typeof filterModels
        typedModels.forEach((model) => {
          items.push(createModelItem(model))
        })
      }
    })

    // 获取可选择的模型项（过滤掉分组标题）
    const modelItems = items.filter((item) => item.type === 'model')
    return { listItems: items, modelItems }
  }, [
    models,
    createModelItem,
    tokenPlanModels,
    searchText,
    collapsedGroups,
    modelFilter,
    fromType,
    getFilteredModels,
    userEnabledPlan
  ])

  const listHeight = useMemo(() => {
    return Math.min(PAGE_SIZE, listItems.length) * ITEM_HEIGHT
  }, [listItems.length])

  // 处理程序化滚动（加载、搜索开始、搜索清空、tag 筛选）
  useLayoutEffect(() => {
    // if (isLoading) return
  }, [listItems, modelItems, isLoading, listHeight])

  const handleItemClick = useCallback(
    (item: FlatListItem) => {
      // console.log('handleItemClick', item)
      if (item.type === 'model') {
        resolve(item.model)
        setOpen(false)
      }
    },
    [resolve]
  )

  // 处理键盘导航
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const modelCount = modelItems.length

      if (!open || modelCount === 0 || e.isComposing) return

      // 键盘操作时禁用鼠标 hover
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault()
        e.stopPropagation()
        setIsMouseOver(false)
      }

      // 当前聚焦的模型 index
      const currentIndex = modelItems.findIndex((item) => item.key === focusedItemKey)

      let nextIndex = -1

      switch (e.key) {
        case 'ArrowUp':
          nextIndex = (currentIndex < 0 ? 0 : currentIndex - 1 + modelCount) % modelCount
          break
        case 'ArrowDown':
          nextIndex = (currentIndex < 0 ? 0 : currentIndex + 1) % modelCount
          break
        case 'PageUp':
          nextIndex = Math.max(0, (currentIndex < 0 ? 0 : currentIndex) - PAGE_SIZE)
          break
        case 'PageDown':
          nextIndex = Math.min(modelCount - 1, (currentIndex < 0 ? 0 : currentIndex) + PAGE_SIZE)
          break
        case 'Enter':
          if (currentIndex >= 0) {
            const selectedItem = modelItems[currentIndex]
            if (selectedItem) {
              handleItemClick(selectedItem)
            }
          }
          break
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          setOpen(false)
          resolve(undefined)
          break
      }

      // 没有键盘导航，直接返回
      if (nextIndex < 0) return

      const nextKey = modelItems[nextIndex]?.key || ''
      if (nextKey) {
        setFocusedItemKey(nextKey)
        const index = listItems.findIndex((item) => item.key === nextKey)
        if (index >= 0) {
          listRef.current?.scrollToIndex(index, { align: 'auto' })
        }
      }
    },
    [modelItems, open, focusedItemKey, resolve, handleItemClick, setFocusedItemKey, listItems]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const onCancel = useCallback(() => {
    setOpen(false)
  }, [])

  const onAfterClose = useCallback(async () => {
    resolve(undefined)
    SelectModelPopup.hide()
  }, [resolve])

  const getItemKey = useCallback((index: number) => listItems[index].key, [listItems])
  const estimateSize = useCallback(() => ITEM_HEIGHT, [])
  const isSticky = useCallback((index: number) => listItems[index].type === 'group', [listItems])

  const rowRenderer = useCallback(
    (item: FlatListItem) => {
      const isFocused = item.key === focusedItemKey
      if (item.type === 'group') {
        const serviceName = String(item.name)
        const isCollapsed = collapsedGroups.has(serviceName)
        return (
          <GroupItem onClick={() => toggleGroupCollapsed(serviceName)}>
            <ChevronRight
              size={16}
              style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.2s' }}
            />
            {item.name}
            {/* {item.actions}*/}
          </GroupItem>
        )
      }
      return (
        <ModelItem
          className={classNames({
            focused: isFocused,
            selected: item.isSelected
          })}
          onClick={() => handleItemClick(item)}
          onMouseOver={() => !isFocused && setFocusedItemKey(item.key)}>
          <ModelItemLeft>
            {item.icon}
            {item.name}
            {item.tags}
          </ModelItemLeft>
        </ModelItem>
      )
    },
    [focusedItemKey, handleItemClick, setFocusedItemKey, collapsedGroups, toggleGroupCollapsed]
  )

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      afterClose={onAfterClose}
      width={600}
      title={t('paintings.select_model')}
      //transitionName="animation-move-down"
      styles={{
        content: {
          borderRadius: 10,
          //padding: 0,
          overflow: 'hidden',
          paddingBottom: 16
        },
        body: {
          maxHeight: 'inherit'
          //padding: 0
        }
      }}
      footer={null}>
      <ListContainer onMouseMove={() => !isMouseOver && setIsMouseOver(true)}>
        <SelectModelSearchBar onSearch={setSearchText} />
        <Spin spinning={loading}>
          {listItems.length > 0 ? (
            <DynamicVirtualList
              ref={listRef}
              list={listItems}
              size={listHeight}
              getItemKey={getItemKey}
              estimateSize={estimateSize}
              isSticky={isSticky}
              scrollPaddingStart={ITEM_HEIGHT} // 留出 sticky header 高度
              overscan={5}
              scrollerStyle={{ pointerEvents: isMouseOver ? 'auto' : 'none' }}
              onChange={handleDynamicListChange}>
              {rowRenderer}
            </DynamicVirtualList>
          ) : (
            <EmptyState>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </EmptyState>
          )}
        </Spin>
      </ListContainer>
    </Modal>
  )
}

const ListContainer = styled.div`
  position: relative;
  overflow: hidden;
`

const ModelName = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
  margin: 0 8px;
  min-width: 0;
  gap: 5px;
`

const GroupItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  line-height: 1;
  font-size: 12px;
  font-weight: normal;
  height: ${ITEM_HEIGHT}px;
  padding: 5px 18px;
  color: var(--color-text-3);
  z-index: 1;
  background: var(--modal-background);
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    background-color: var(--color-background-mute);
  }

  .action-icon {
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1 !important;
    }
  }
  &:hover .action-icon {
    opacity: 0.3;
  }
`

const ModelItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  font-size: 14px;
  padding: 0 8px;
  margin: 1px 8px;
  height: ${ITEM_HEIGHT - 2}px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.1s ease;

  &.focused {
    background-color: var(--color-background-mute);
  }

  &.selected {
    &::before {
      content: '';
      display: block;
      position: absolute;
      left: -1px;
      top: 13%;
      width: 3px;
      height: 74%;
      background: var(--color-primary-soft);
      border-radius: 8px;
    }
  }

  .pin-icon {
    opacity: 0;
  }

  &:hover .pin-icon {
    opacity: 0.3;
  }
`

const ModelItemLeft = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  overflow: hidden;
  padding-right: 26px;

  .anticon {
    min-width: auto;
    flex-shrink: 0;
  }
`

const EmptyState = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
`

const TopViewKey = 'SelectModelPopup'

export const createModelPopup = <TProps extends object, TResult>(
  Component: React.ComponentType<TProps & { resolve: (value: TResult | undefined) => void }>
) => {
  return class {
    static hide() {
      TopView.hide(TopViewKey)
    }
    static show(params: Omit<TProps, 'resolve'>) {
      return new Promise<TResult | undefined>((resolve) => {
        const props = { ...params, resolve } as TProps & { resolve: (value: TResult | undefined) => void }
        TopView.show(<Component {...props} />, TopViewKey)
      })
    }
  }
}

export const SelectModelPopup = createModelPopup<SelectModelPopupParams, Model>(SelectModelPopupView)

export default SelectModelPopupView
