import { CrownFilled } from '@ant-design/icons'
import { selectTokenPlanHourlyDayUsageApi } from '@renderer/api/billManagement'
import { DynamicVirtualList, type DynamicVirtualListRef } from '@renderer/components/VirtualList'
import { isNotSupportTextDeltaModel } from '@renderer/config/models'
import { transformToModel, useAiOnlyModels } from '@renderer/hooks/useAiOnlyModels'
import useUserTokenPlan from '@renderer/hooks/useUserTokenPlan'
import { getRoundtableMaxModels, isRoundtableMember } from '@renderer/pages/roundtable/roundtablePolicy'
import { getModelUniqId } from '@renderer/services/ModelService'
import { useAppSelector } from '@renderer/store'
import { selectUserInfo } from '@renderer/store/user'
import type { Model } from '@renderer/types'
import { classNames } from '@renderer/utils'
import { Avatar, Button, Empty, message, Modal, Spin } from 'antd'
import { first } from 'lodash'
import { Check, ChevronRight } from 'lucide-react'
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { createModelPopup } from './aionly/base-popup'
import SelectModelSearchBar from './searchbar'
import type { FlatListItem } from './types'

const PAGE_SIZE = 12
const ITEM_HEIGHT = 36

export interface SelectMultiModelsPopupParams {
  /** 初始已选中的模型列表 */
  selectedModels?: Model[]
  /** 模型过滤条件（如带图片时仅允许视觉模型） */
  modelFilter?: (model: any) => boolean
  /** 数量上限提示文案使用的场景，与圆桌/多智能体回复的上限文案保持一致 */
  mode?: 'chat' | 'roundtable'
  /** 数量上限覆盖；默认按会员身份取 getRoundtableMaxModels */
  maxCount?: number
}

interface Props extends SelectMultiModelsPopupParams {
  resolve: (value: Model[] | undefined) => void
}

/**
 * 多选模型弹窗，与对话中选择主模型的 SelectModelPopup 保持同样的样式：
 * 搜索 + 按供应商（serviceName）分组 + 可折叠分组 + 虚拟列表。
 * 用于圆桌对话和对话中的多模型（多智能体回复）选择模型。
 */
const SelectMultiModelsPopupView: React.FC<Props> = ({
  selectedModels = [],
  modelFilter,
  mode = 'chat',
  maxCount,
  resolve
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)
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

  // 管理滚动和焦点状态
  const [focusedKey, _setFocusedKey] = useState('')
  const [isMouseOver, setIsMouseOver] = useState(false)

  const userInfo: any = useAppSelector(selectUserInfo)
  const { getUserEnabledPlan } = useUserTokenPlan(userInfo?.userId)
  const [tokenPlanModels, setTokenPlanModels] = useState<any[]>([])
  const [userEnabledPlan] = useState<any>(getUserEnabledPlan())

  // 已选模型：key 为 getModelUniqId，保持插入顺序用于确定返回结果
  const [selectedMap, setSelectedMap] = useState<Map<string, Model>>(
    () => new Map(selectedModels.map((m) => [getModelUniqId(m), m]))
  )

  const effectiveMaxCount = useMemo(
    () => maxCount ?? getRoundtableMaxModels(isRoundtableMember(userInfo)),
    [maxCount, userInfo]
  )

  const maxModelsMessage = useCallback(() => {
    if (mode === 'roundtable') {
      message.warning(
        isRoundtableMember(userInfo) ? t('roundtable.max_models_member') : t('roundtable.max_models_free')
      )
    } else {
      message.warning(isRoundtableMember(userInfo) ? t('chat.max_models_member') : t('chat.max_models_free'))
    }
  }, [mode, t, userInfo])

  const toggleModel = useCallback(
    (model: Model) => {
      const modelId = getModelUniqId(model)
      setSelectedMap((prev) => {
        const next = new Map(prev)
        if (next.has(modelId)) {
          next.delete(modelId)
          return next
        }
        if (next.size >= effectiveMaxCount) {
          maxModelsMessage()
          return prev
        }
        next.set(modelId, model)
        return next
      })
    },
    [effectiveMaxCount, maxModelsMessage]
  )

  const { models, loading, setLoading, fetchNextPage, getFilteredModels, hasMore } = useAiOnlyModels({
    pageSize: 1000, // TODO: 临时规避分组加载数据抖动问题，与 SelectModelPopup 保持一致
    autoFetch: !userEnabledPlan
  })

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
    if (!!userEnabledPlan) {
      return
    }
    const scrollElement = instance.scrollElement
    if (scrollElement) {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight

      if (distanceFromBottom < 50 && hasMore && !loading) {
        fetchNextPage()
      }
    }
  }

  // 构建列表数据：过滤 → 去重 → 搜索 → 按 serviceName 分组（组标题可折叠）
  const { listItems, modelItems } = useMemo(() => {
    const items: FlatListItem[] = []
    let filterModels = !userEnabledPlan ? getFilteredModels() : tokenPlanModels

    if (modelFilter) {
      filterModels = filterModels
        .map((x: any) => ({
          ...x,
          origin_id: x.id,
          id: x.baseId || x.model,
          name: x.modelName,
          provider: 'aionly',
          supported_text_delta: !isNotSupportTextDeltaModel(x)
        }))
        .filter(modelFilter)
    }

    // 去重：同一 (id, serviceName) 只保留第一条
    const seen = new Set<string>()
    filterModels = filterModels.filter((m: any) => {
      const k = `${m.id}-${m.serviceName}`
      return seen.has(k) ? false : (seen.add(k), true)
    })

    // 搜索过滤：同时匹配供应商与模型名
    if (searchText.trim()) {
      const lowerSearchText = searchText.toLowerCase()
      filterModels = filterModels.filter((m: any) =>
        `${m.serviceName || ''}${m.modelName || ''}`.toLowerCase().includes(lowerSearchText)
      )
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

    Object.entries(groupedByService).forEach(([serviceName, groupModels]) => {
      items.push({
        key: `group-${serviceName}`,
        type: 'group',
        name: serviceName,
        icon: null,
        actions: null,
        isSelected: false
      })

      if (!collapsedGroups.has(serviceName)) {
        ;(groupModels as typeof filterModels).forEach((rawModel) => {
          const model = transformToModel(rawModel)
          const modelId = getModelUniqId(model)
          items.push({
            key: `${(rawModel).baseId || model.id}-${rawModel.serviceName}`,
            type: 'model',
            name: (
              <ModelName>
                <span className="min-w-0 truncate">{model.name}</span>
                {rawModel.memberSpecial == 1 && (
                  <IconVip>
                    <CrownFilled />
                    <span>vip</span>
                  </IconVip>
                )}
              </ModelName>
            ),
            tags: null,
            icon: (
              <Avatar src={rawModel.modelFileUrl} size={24}>
                {first(model.name) || 'M'}
              </Avatar>
            ),
            model,
            isSelected: selectedMap.has(modelId)
          })
        })
      }
    })

    const modelItems = items.filter((item) => item.type === 'model')
    return { listItems: items, modelItems }
  }, [
    models,
    tokenPlanModels,
    searchText,
    collapsedGroups,
    modelFilter,
    getFilteredModels,
    userEnabledPlan,
    selectedMap
  ])

  const listHeight = useMemo(() => {
    return Math.min(PAGE_SIZE, listItems.length) * ITEM_HEIGHT
  }, [listItems.length])

  const handleItemClick = useCallback(
    (item: FlatListItem) => {
      if (item.type === 'model') {
        toggleModel(item.model)
      }
    },
    [toggleModel]
  )

  const handleConfirm = useCallback(() => {
    resolve(Array.from(selectedMap.values()))
    setOpen(false)
  }, [resolve, selectedMap])

  const handleClear = useCallback(() => {
    setSelectedMap(new Map())
  }, [])

  // 处理键盘导航：Enter 切换聚焦项，Escape 取消
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const modelCount = modelItems.length

      if (!open || modelCount === 0 || e.isComposing) return

      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault()
        e.stopPropagation()
        setIsMouseOver(false)
      }

      const currentIndex = modelItems.findIndex((item) => item.key === focusedKey)

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
        case 'Enter': {
          if (currentIndex >= 0) {
            const selectedItem = modelItems[currentIndex]
            if (selectedItem) {
              handleItemClick(selectedItem)
            }
          }
          return
        }
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          setOpen(false)
          resolve(undefined)
          return
      }

      if (nextIndex < 0) return

      const nextKey = modelItems[nextIndex]?.key || ''
      if (nextKey) {
        _setFocusedKey(nextKey)
        const index = listItems.findIndex((item) => item.key === nextKey)
        if (index >= 0) {
          listRef.current?.scrollToIndex(index, { align: 'auto' })
        }
      }
    },
    [modelItems, open, focusedKey, resolve, handleItemClick, listItems]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const getItemKey = useCallback((index: number) => listItems[index].key, [listItems])
  const estimateSize = useCallback(() => ITEM_HEIGHT, [])
  const isSticky = useCallback((index: number) => listItems[index].type === 'group', [listItems])

  const rowRenderer = useCallback(
    (item: FlatListItem) => {
      const isFocused = item.key === focusedKey
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
          </GroupItem>
        )
      }
      const modelItem = item
      return (
        <ModelItem
          className={classNames({
            focused: isFocused,
            selected: modelItem.isSelected
          })}
          onClick={() => handleItemClick(item)}
          onMouseOver={() => !isFocused && _setFocusedKey(item.key)}>
          <ModelItemLeft>
            <CheckBox className={modelItem.isSelected ? 'checked' : undefined}>
              {modelItem.isSelected && <Check size={13} strokeWidth={3} />}
            </CheckBox>
            {modelItem.icon}
            {modelItem.name}
            {modelItem.tags}
          </ModelItemLeft>
        </ModelItem>
      )
    },
    [focusedKey, handleItemClick, collapsedGroups, toggleGroupCollapsed]
  )

  return (
    <Modal
      open={open}
      onCancel={() => setOpen(false)}
      afterClose={() => {
        resolve(undefined)
        SelectMultiModelsPopup.hide()
      }}
      width={600}
      title={t('assistants.presets.edit.model.select.title')}
      styles={{
        content: {
          borderRadius: 10,
          overflow: 'hidden',
          paddingBottom: 16
        },
        body: {
          maxHeight: 'inherit'
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
              scrollPaddingStart={ITEM_HEIGHT}
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
      <Footer>
        <SelectedCount>
          {t('models.multi.selected_count', { count: selectedMap.size, max: effectiveMaxCount })}
        </SelectedCount>
        <FooterButtons>
          <Button disabled={selectedMap.size === 0} onClick={handleClear}>
            {t('settings.input.clear.all')}
          </Button>
          <Button type="primary" onClick={handleConfirm}>
            {t('common.confirm')}
          </Button>
        </FooterButtons>
      </Footer>
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

const CheckBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  color: var(--color-white);
  transition: all 0.15s ease;

  &.checked {
    background-color: var(--color-primary-soft);
    border-color: var(--color-primary-soft);
  }
`

const IconVip = styled.div`
  display: inline-block;
  text-align: center;
  color: var(--color-white);
  width: 52px;
  padding: 2px 0;
  background: linear-gradient(90deg, #ffaa00 0%, #f77a1d 100%);
  border-radius: 4px;
  font-size: 12px;
  margin-left: 15px;
`

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 0;
`

const SelectedCount = styled.span`
  font-size: 12px;
  color: var(--color-text-2);
`

const FooterButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const EmptyState = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
`

export const SelectMultiModelsPopup = createModelPopup<SelectMultiModelsPopupParams, Model[]>(
  SelectMultiModelsPopupView
)

export default SelectMultiModelsPopupView
