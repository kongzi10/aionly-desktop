import { selectTokenPlanHourlyDayUsageApi } from '@renderer/api/billManagement'
import { listUnopenedPayLaterModelsApi } from '@renderer/api/openManagement'
import DiscountTag from '@renderer/components/Tags/Model/DiscountTag'
import ModelLabelTags from '@renderer/components/Tags/Model/ModelLabelTags'
import ModelQuotaMeter from '@renderer/components/Tags/Model/ModelQuotaMeter'
import { TopView } from '@renderer/components/TopView'
import { DynamicVirtualList, type DynamicVirtualListRef } from '@renderer/components/VirtualList'
import { FEATURE_SELECT_MODEL_QUOTA_TABS } from '@renderer/config/featureFlags'
import { isNotSupportTextDeltaModel } from '@renderer/config/models'
import {
  createActivePayLaterFilter,
  type ModelAttribute,
  transformToModel,
  useAiOnlyModels
} from '@renderer/hooks/useAiOnlyModels'
import { useExperienceModels } from '@renderer/hooks/useExperienceModels'
import { useModelLabels } from '@renderer/hooks/useModelLabels'
import type { ModelQuota } from '@renderer/hooks/useModelQuota'
import { invalidatePublishPriceDiscountCache, usePublishPriceDiscount } from '@renderer/hooks/usePublishPriceDiscount'
import useUserTokenPlan from '@renderer/hooks/useUserTokenPlan'
import { getModelUniqId } from '@renderer/services/ModelService'
import { useAppSelector } from '@renderer/store'
import { selectUserInfo } from '@renderer/store/user'
import type { Model, Provider } from '@renderer/types'
import { classNames } from '@renderer/utils'
import { Avatar, Button, Empty, Modal, Spin } from 'antd'
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

import OpenNewModelButton from '../OpenNewModelButton'
import QuotaTabHeader, { type ModelTabKey } from '../QuotaTabHeader'
import SelectModelSearchBar from '../searchbar'
import type { FlatListItem, FlatListModel } from '../types'

const PAGE_SIZE = 12
const ITEM_HEIGHT = 36
/** 免费体验页签卡片行高（V3 样式，见 docs/选择模型弹窗免费体验改造/样式方案V3-卡片环形额度.html） */
const FREE_ITEM_HEIGHT = 64

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
  /** 搜索栏右侧展示「开通模型」入口（首页选择模型弹窗使用） */
  showOpenModelButton?: boolean
  /** 模型属性筛选：传入后仅拉取/展示该属性的模型（如绘画页传 ImageModel），默认文本模型 */
  modelAttribute?: ModelAttribute
  /** 与 modelAttribute 配合的模型类型参数（图片模型为 '3'），默认 '1' */
  modelType?: string
  /** 「开通新模型」入口打开开通弹窗时默认选中的模型类型（如 'image_generation'） */
  openModelType?: 'text_model' | 'image_generation'
}

interface Props extends SelectModelPopupParams {
  resolve: (value: Model | undefined) => void
}

const SelectModelPopupView: React.FC<Props> = ({
  model,
  modelFilter,
  fromType,
  showOpenModelButton = false,
  modelAttribute,
  modelType,
  openModelType,
  resolve
}) => {
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

  // 双页签（按量付费/免费体验）：特性开关一键回滚，关闭时行为与改造前完全一致
  const quotaTabsEnabled = FEATURE_SELECT_MODEL_QUOTA_TABS
  const [activeTab, setActiveTab] = useState<ModelTabKey>('pay')
  const isFreeTab = quotaTabsEnabled && activeTab === 'free'

  // 免费体验模型（selectType=office，与网站端体验中心同源接口；额度已归一到 quota 字段）
  const {
    models: freeModels,
    loading: freeLoading,
    error: freeError,
    refetch: refetchFree
  } = useExperienceModels({
    enabled: quotaTabsEnabled,
    modelAttribute: modelAttribute ?? 'text_model',
    modelType: modelType ?? '1'
  })

  // 「已开通 n / 共 m」统计用：未开通按量模型 key 集合；拉取失败降级为空（共 m = 已开通 ∪ 免费体验）
  const [unopenedKeys, setUnopenedKeys] = useState<string[]>([])
  useEffect(() => {
    if (!quotaTabsEnabled) return
    listUnopenedPayLaterModelsApi()
      .then((res: any) => {
        const rows = Array.isArray(res?.data) ? res.data : []
        setUnopenedKeys(rows.map((u: any) => `${u.baseId ?? u.id ?? ''}-${u.serviceName ?? ''}`))
      })
      .catch(() => setUnopenedKeys([]))
  }, [quotaTabsEnabled])

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

  const { models, loading, setLoading, fetchNextPage, getFilteredModels, hasMore, reset } = useAiOnlyModels({
    pageSize: 1000, // TODO: 临时规避分组加载数据抖动问题，后续改动，按实际使用，一次加载1000条也够用了
    autoFetch: !userEnabledPlan, // TODO: 当用户启用了tokenPlan时，不自动加载模型数据
    type: modelType,
    modelAttribute
  })

  // 限时折扣活动：UserModelPackageVo.modelId 即 ai_model.id，作为活动 map 的合并键
  const discountModels = useMemo(() => [...models, ...tokenPlanModels], [models, tokenPlanModels])
  const { getDiscount } = usePublishPriceDiscount(discountModels, (m: any) => m.modelId)

  // 推荐标签（人气模型/最新推荐等）：字典 labelId → 名称，列表接口透传 recommendLabel/modelLabel
  const { getLabelItems } = useModelLabels()

  // 按量付费模型源（未经搜索/分组折叠处理，供列表构建与统计复用）
  const payModels = useMemo(
    () => (!userEnabledPlan ? getFilteredModels(createActivePayLaterFilter()) : tokenPlanModels),
    [userEnabledPlan, getFilteredModels, tokenPlanModels]
  )

  // 「已开通 n / 共 m」统计：m = 已开通 ∪ 未开通按量 ∪ 免费体验 的去重并集（baseId/id + serviceName 口径）
  const quotaStats = useMemo(() => {
    if (!quotaTabsEnabled) return undefined
    const key = (m: any) => `${m.baseId ?? m.id ?? ''}-${m.serviceName ?? ''}`
    const openedSet = new Set(payModels.map(key))
    const union = new Set(openedSet)
    unopenedKeys.forEach((k) => union.add(k))
    freeModels.forEach((m) => union.add(key(m)))
    return { openedCount: openedSet.size, totalCount: union.size }
  }, [quotaTabsEnabled, payModels, unopenedKeys, freeModels])

  // 汇总条：免费额度总剩余（仅免费页签展示；无任何额度配置时隐藏）
  const freeTotalRest = useMemo(() => {
    if (!isFreeTab) return undefined
    const withQuota = freeModels.filter((m) => !!m.quota)
    if (withQuota.length === 0) return undefined
    return {
      total: withQuota.reduce((sum, m) => sum + (m.quota?.rest ?? 0), 0),
      unit: withQuota[0].quota?.unit ?? ('tokens' as const)
    }
  }, [isFreeTab, freeModels])

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
      // 指定模型属性时（如绘画页仅展示图片模型），套餐模型按属性过滤
      setTokenPlanModels(modelAttribute ? modelList.filter((m: any) => m.modelAttribute === modelAttribute) : modelList)
    } finally {
      setLoading(false)
    }
  }

  // 开通模型成功后刷新弹窗内的模型列表（与输入框「开通模型」按钮的刷新逻辑保持一致）
  const handleOpenModelSuccess = useCallback(() => {
    invalidatePublishPriceDiscountCache()
    if (userEnabledPlan) {
      void fetchSelectTokenPlanHourlyDayUsage()
    } else {
      reset()
    }
    // 双页签开启时同步刷新免费体验列表（额度/开通状态可能变化）
    if (quotaTabsEnabled) {
      refetchFree()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEnabledPlan, reset, quotaTabsEnabled, refetchFree])

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

  // 创建模型列表项（free=true 时为「免费体验」页签卡片行：两行名称+标签、大头像、右侧额度环）
  const createModelItem = useCallback(
    (model: any, free = false): FlatListModel => {
      const modelId = getModelUniqId(model)
      // 使用与去重逻辑一致的唯一标识：baseId-serviceName
      const uniqueKey = `${model.baseId || model.id}-${model.serviceName}`
      const quota: ModelQuota | undefined = free ? model.quota : undefined
      const pills = (
        <>
          {/* 免费标签：与网站模型广场/添加模型弹窗口径一致（ai_model.free_flag，pagePcList 透传） */}
          {model.freeFlag == '1' && <FreePill>{t('models.type.free')}</FreePill>}
          {model.memberSpecial == '1' && <VipPill>VIP</VipPill>}
          <ModelLabelTags items={getLabelItems(model)} />
          <DiscountTag activity={getDiscount(model)} />
        </>
      )
      return {
        key: uniqueKey,
        type: 'model',
        name: free ? (
          <ModelName className="free">
            <div className="nm">{model.modelName}</div>
            <div className="tags">{pills}</div>
          </ModelName>
        ) : (
          <ModelName>
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="min-w-0 truncate">{model.modelName}</span>
              {pills}
            </div>
          </ModelName>
        ),
        tags: null,
        icon: (
          <Avatar src={model?.modelFileUrl} size={free ? 36 : 24}>
            {first(model.modelName) || 'M'}
          </Avatar>
        ),
        model,
        isSelected: modelId === currentModelId,
        quota,
        // 额度耗尽的免费模型禁选（置灰 + hover 提示，点击不生效）
        disabled: free && quota?.tone === 'empty'
      }
    },
    [currentModelId, getDiscount, getLabelItems, t]
  )

  // 构建列表数据（按量付费/免费体验双页签共用 分组 + 搜索 + 折叠逻辑）
  const { listItems, modelItems } = useMemo(() => {
    const items: FlatListItem[] = []

    // 将接口行补齐为 resolve 可消费的 Model（id/name/provider；agent 场景含 origin）
    const augmentModel = (x: any) => {
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
    }

    // 免费体验行始终 augment（保证 resolve 返回的 model 结构与按量行一致）；
    // 按量行维持原逻辑（仅 modelFilter 存在时 augment 并过滤）
    let filterModels: any[] = isFreeTab ? freeModels : payModels
    if (isFreeTab) {
      filterModels = filterModels.map(augmentModel).filter((m: any) => (modelFilter ? modelFilter(m) : true))
    } else if (modelFilter) {
      filterModels = filterModels.map(augmentModel).filter(modelFilter)
    }

    // 去重：同一 (id, serviceName) 只保留第一条
    const seen = new Set<string>()
    filterModels = filterModels.filter((m: any) => {
      const k = `${m.id}-${m.serviceName}`
      return seen.has(k) ? false : (seen.add(k), true)
    })

    // 搜索过滤：按 modelName 搜索（免费页签同样为前端过滤，与按量口径一致）
    if (searchText.trim()) {
      const lowerSearchText = searchText.toLowerCase()
      filterModels = filterModels.filter((m: any) => (m.modelName || '').toLowerCase().includes(lowerSearchText))
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
          items.push(createModelItem(model, isFreeTab))
        })
      }
    })

    // 获取可选择的模型项（过滤掉分组标题）
    const modelItems = items.filter((item) => item.type === 'model')
    return { listItems: items, modelItems }
  }, [payModels, freeModels, isFreeTab, createModelItem, searchText, collapsedGroups, modelFilter, fromType])

  const listHeight = useMemo(() => {
    const rowHeight = isFreeTab ? FREE_ITEM_HEIGHT : ITEM_HEIGHT
    return Math.min(PAGE_SIZE, listItems.length) * rowHeight
  }, [listItems.length, isFreeTab])

  // 处理程序化滚动（加载、搜索开始、搜索清空、tag 筛选）
  useLayoutEffect(() => {
    // if (isLoading) return
  }, [listItems, modelItems, isLoading, listHeight])

  const handleItemClick = useCallback(
    (item: FlatListItem) => {
      // console.log('handleItemClick', item)
      if (item.type === 'model') {
        // 额度耗尽的免费模型禁选：点击不生效（行上带 exhausted 提示）
        if (item.disabled) return
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

  // 页签切换：重置聚焦项并回到列表顶部
  const handleTabChange = useCallback(
    (tab: ModelTabKey) => {
      setActiveTab(tab)
      setFocusedItemKey('')
      listRef.current?.scrollToOffset(0)
    },
    [setFocusedItemKey]
  )

  const onAfterClose = useCallback(async () => {
    resolve(undefined)
    SelectModelPopup.hide()
  }, [resolve])

  const getItemKey = useCallback((index: number) => listItems[index].key, [listItems])
  // 免费页签模型行为卡片行高（分组头仍为 ITEM_HEIGHT）
  const estimateSize = useCallback(
    (index: number) => (isFreeTab && listItems[index]?.type === 'model' ? FREE_ITEM_HEIGHT : ITEM_HEIGHT),
    [isFreeTab, listItems]
  )
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
            selected: item.isSelected,
            'free-card': isFreeTab,
            disabled: !!item.disabled
          })}
          title={item.disabled ? t('selectModel.quota.exhausted') : undefined}
          onClick={() => handleItemClick(item)}
          onMouseOver={() => !isFocused && setFocusedItemKey(item.key)}>
          <ModelItemLeft>
            {item.icon}
            {item.name}
            {item.tags}
          </ModelItemLeft>
          {item.quota && <ModelQuotaMeter quota={item.quota} />}
        </ModelItem>
      )
    },
    [focusedItemKey, handleItemClick, setFocusedItemKey, collapsedGroups, toggleGroupCollapsed, isFreeTab, t]
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
          maxHeight: 'inherit',
          // 全局 ant.css 给 .ant-modal-body 设了 overflow-y: auto，滚动容器会裁剪
          // 搜索栏「开通新模型」按钮向上飞散的星光；本弹窗列表为虚拟滚动（自身容器
          // 内滚动），body 无需滚动，故覆盖为 visible 保证星光完整显示
          overflow: 'visible'
          //padding: 0
        }
      }}
      footer={null}>
      <ListContainer onMouseMove={() => !isMouseOver && setIsMouseOver(true)}>
        {quotaTabsEnabled && (
          <QuotaTabHeader
            activeTab={activeTab}
            onTabChange={handleTabChange}
            totalRest={freeTotalRest?.total}
            totalRestUnit={freeTotalRest?.unit}
            openedCount={quotaStats?.openedCount ?? 0}
            totalCount={quotaStats?.totalCount}
          />
        )}
        <SelectModelSearchBar
          onSearch={setSearchText}
          extra={
            showOpenModelButton ? (
              <OpenNewModelButton modelType={openModelType} onSuccess={handleOpenModelSuccess} />
            ) : undefined
          }
        />
        <Spin spinning={loading || (isFreeTab && freeLoading)}>
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
          ) : isFreeTab ? (
            <EmptyState>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={freeError ? t('selectModel.free.loadFailed') : t('selectModel.free.empty')}>
                {freeError ? (
                  <Button size="small" onClick={() => refetchFree()}>
                    {t('selectModel.free.retry')}
                  </Button>
                ) : (
                  <Button size="small" onClick={() => handleTabChange('pay')}>
                    {t('selectModel.free.goPayLater')}
                  </Button>
                )}
              </Empty>
            </EmptyState>
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
  /* 保持可见：搜索栏右侧「开通新模型」按钮的星光飞散动画需要溢出到容器外（标题区域），
     虚拟列表滚动由 DynamicVirtualList 自身的滚动容器裁剪，不依赖此处 */
  overflow: visible;
`

const ModelName = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
  margin: 0 8px;
  min-width: 0;
  gap: 5px;

  /* 免费体验卡片行：名称 + 标签两行布局（V3 样式） */
  &.free {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    margin: 0 10px 0 8px;

    .nm {
      font-size: 13.5px;
      font-weight: 600;
      line-height: 1.3;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--color-text);
    }

    .tags {
      display: flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
    }
  }
`

// 与添加模型弹窗 .free-tag 同款的免费 pill（口径同网站模型广场 ai_model.free_flag）
const FreePill = styled.span`
  flex-shrink: 0;
  height: 20px;
  padding: 0 8px;
  border: 1px solid #b7eb8f;
  border-radius: 10px;
  background: #f6ffed;
  color: #389e0d;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
`

// 与添加模型弹窗 .vip-tag 同款的 VIP pill（该弹窗此前无 VIP 标签，见方案 §11-Q2）
const VipPill = styled.span`
  flex-shrink: 0;
  height: 20px;
  padding: 0 8px;
  border: 1px solid #e8a33d;
  border-radius: 10px;
  background: #fff6dc;
  color: #b5761c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
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

  /* 免费体验页签：卡片行（V3 样式，行高 FREE_ITEM_HEIGHT=64） */
  &.free-card {
    height: ${FREE_ITEM_HEIGHT - 8}px;
    margin: 1px 8px 7px;
    padding: 0 12px;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    transition:
      border-color 0.15s,
      box-shadow 0.15s,
      background-color 0.1s ease;

    &.focused {
      background-color: transparent;
      border-color: var(--color-primary);
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.07);
    }

    &.selected {
      background-color: var(--color-background-mute);
      border-color: var(--color-primary);

      &::before {
        display: none;
      }
    }

    /* 额度耗尽：置灰禁选 */
    &.disabled {
      opacity: 0.6;
      cursor: not-allowed;

      &:hover,
      &.focused {
        border-color: var(--color-border);
        box-shadow: none;
      }
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
