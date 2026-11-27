import { CrownFilled } from '@ant-design/icons'
import { selectTokenPlanHourlyDayUsageApi } from '@renderer/api/billManagement'
import DiscountTag from '@renderer/components/Tags/Model/DiscountTag'
import ModelLabelTags from '@renderer/components/Tags/Model/ModelLabelTags'
import { warning as showWarning } from '@renderer/components/TopView/toast'
import { DynamicVirtualList, type DynamicVirtualListRef } from '@renderer/components/VirtualList'
import { isNotSupportTextDeltaModel } from '@renderer/config/models'
import { createActivePayLaterFilter, transformToModel, useAiOnlyModels } from '@renderer/hooks/useAiOnlyModels'
import { useModelLabels } from '@renderer/hooks/useModelLabels'
import { invalidatePublishPriceDiscountCache, usePublishPriceDiscount } from '@renderer/hooks/usePublishPriceDiscount'
import useUserTokenPlan from '@renderer/hooks/useUserTokenPlan'
import { getRoundtableMaxModels, isRoundtableMember } from '@renderer/pages/roundtable/roundtablePolicy'
import { selectRoundtableRoleAssistants } from '@renderer/pages/roundtable/roundtableRole'
import { useRoundtableRoleActions } from '@renderer/pages/roundtable/useRoundtableRoleActions'
import { getModelUniqId } from '@renderer/services/ModelService'
import { useAppSelector } from '@renderer/store'
import { selectUserInfo } from '@renderer/store/user'
import type { Assistant, MentionItem, Model, RoundtableMention } from '@renderer/types'
import { normalizeRoundtableMentions } from '@renderer/types'
import { classNames } from '@renderer/utils'
import { Avatar, Button, Empty, Input, Modal, Popover, Spin } from 'antd'
import { first } from 'lodash'
import { Check, ChevronRight, Library, Plus, Search, X } from 'lucide-react'
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { createModelPopup } from './aionly/base-popup'
import OpenNewModelButton from './OpenNewModelButton'
import SelectModelSearchBar from './searchbar'
import type { FlatListItem, FlatListModel } from './types'

const ITEM_HEIGHT = 36
/** 左栏虚拟列表最大可视高度（双栏主体固定高度内滚动） */
const LEFT_LIST_MAX_HEIGHT = 424

export interface SelectRoundtableModelsPopupParams {
  /** 初始已选成员：兼容旧格式裸 Model[] 与新格式 RoundtableMention[] */
  selectedMembers?: MentionItem[]
  /** 模型过滤条件（如带图片时仅允许视觉模型） */
  modelFilter?: (model: any) => boolean
  /** 搜索栏右侧展示「开通新模型」入口 */
  showOpenModelButton?: boolean
}

interface Props extends SelectRoundtableModelsPopupParams {
  resolve: (value: RoundtableMention[] | undefined) => void
}

/** 列表构建的中间条目：原始接口行 + 转换后的 Model + 唯一键 */
interface ModelEntry {
  raw: any
  model: Model
  uniqId: string
}

/**
 * 角色选择面板（Popover 内容）：搜索框 + 「默认角色」+ roundtable 角色列表。
 * onSelect(undefined) 表示恢复默认角色（跟随话题助理）。
 */
export const RolePanel: React.FC<{
  roles: Assistant[]
  selectedId?: string
  onSelect: (assistantId: string | undefined) => void
  /** 新建角色入口（创建成功后由父级绑定到对应成员） */
  onAddRole?: () => void
  /** 角色库入口（管理已有角色） */
  onOpenLibrary?: () => void
}> = ({ roles, selectedId, onSelect, onAddRole, onOpenLibrary }) => {
  const { t } = useTranslation()
  const [keyword, setKeyword] = useState('')

  const filteredRoles = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return roles
    return roles.filter((role) => (role?.name || '').toLowerCase().includes(kw))
  }, [roles, keyword])

  return (
    <RolePanelWrap>
      <Input
        size="small"
        allowClear
        autoFocus
        prefix={<Search size={13} style={{ color: 'var(--color-text-3)' }} />}
        placeholder={t('roundtable.role.search_placeholder')}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />
      <RoleOptions>
        <RoleOption className={classNames({ active: !selectedId })} onClick={() => onSelect(undefined)}>
          <span className="emoji">🤖</span>
          <span className="label">{t('roundtable.role.default')}</span>
          {!selectedId && <Check size={14} className="check" />}
        </RoleOption>
        {filteredRoles.map((role) => (
          <RoleOption
            key={role.id}
            className={classNames({ active: selectedId === role.id })}
            onClick={() => onSelect(role.id)}>
            <span className="emoji">{role.emoji || '🙂'}</span>
            <span className="label">{role.name}</span>
            {selectedId === role.id && <Check size={14} className="check" />}
          </RoleOption>
        ))}
        {filteredRoles.length === 0 && <RoleEmpty>{t('roundtable.role.empty')}</RoleEmpty>}
      </RoleOptions>
      {(onAddRole || onOpenLibrary) && (
        <RoleActions>
          {onAddRole && (
            <button type="button" onClick={onAddRole}>
              <Plus size={13} />
              {t('chat.add.assistant.title')}
            </button>
          )}
          {onOpenLibrary && (
            <button type="button" onClick={onOpenLibrary}>
              <Library size={13} />
              {t('assistants.presets.title')}
            </button>
          )}
        </RoleActions>
      )}
    </RolePanelWrap>
  )
}

/**
 * 群聊（圆桌 V2）成员选择弹窗：双栏布局。
 * 左栏：模型库（搜索 + 分组虚拟列表，模型位置不随选中态变化），
 * 右栏：已选成员列表（模型 × 角色独立绑定，支持单个/批量设置角色）。
 * 确认返回 RoundtableMention[]，取消/关闭返回 undefined。
 */
const SelectRoundtableModelsPopupView: React.FC<Props> = ({
  selectedMembers,
  modelFilter,
  showOpenModelButton = false,
  resolve
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)
  const listRef = useRef<DynamicVirtualListRef>(null)
  // 左栏列表区域容器：实测剩余可用高度，避免列表溢出压到底栏
  const listAreaRef = useRef<HTMLDivElement>(null)
  const [listAreaHeight, setListAreaHeight] = useState(0)
  const [_searchText, _setSearchText] = useState('')
  const searchText = useDeferredValue(_searchText)

  const setSearchText = useCallback((text: string) => {
    _setSearchText(text)
  }, [])

  // 记录已收起的分组（值为 serviceName），默认全部展开
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())
  // 角色 Popover 当前打开的 key（成员行 uniqId / 'batch'），null = 全部关闭
  const [rolePopoverKey, setRolePopoverKey] = useState<string | null>(null)

  // 管理滚动和焦点状态
  const [focusedKey, _setFocusedKey] = useState('')
  const [isMouseOver, setIsMouseOver] = useState(false)

  const userInfo: any = useAppSelector(selectUserInfo)
  const { getUserEnabledPlan } = useUserTokenPlan(userInfo?.userId)
  const [tokenPlanModels, setTokenPlanModels] = useState<any[]>([])
  const [userEnabledPlan] = useState<any>(getUserEnabledPlan())

  // 群聊可绑定角色（workspace='roundtable' 的 Assistant）
  const roleAssistants = useAppSelector(selectRoundtableRoleAssistants)
  const roleById = useMemo(() => new Map(roleAssistants.map((role) => [role.id, role])), [roleAssistants])

  // 已选成员（模型 × 角色）：内部状态，确认后才回传
  const [members, setMembers] = useState<RoundtableMention[]>(() => normalizeRoundtableMentions(selectedMembers))

  // 当前选中模型 uniq id 集合（左栏勾选态 / 置顶派生自 members）
  const selectedModelUniqIds = useMemo(() => new Set(members.map((member) => getModelUniqId(member.model))), [members])

  // 群聊选择上限：会员 4 / 免费 2
  const effectiveMaxCount = useMemo(() => getRoundtableMaxModels(isRoundtableMember(userInfo)), [userInfo])

  const maxModelsMessage = useCallback(() => {
    showWarning(isRoundtableMember(userInfo) ? t('roundtable.max_models_member') : t('roundtable.max_models_free'))
  }, [t, userInfo])

  const toggleModel = useCallback(
    (model: Model) => {
      const uniqId = getModelUniqId(model)
      setMembers((prev) => {
        if (prev.some((member) => getModelUniqId(member.model) === uniqId)) {
          return prev.filter((member) => getModelUniqId(member.model) !== uniqId)
        }
        if (prev.length >= effectiveMaxCount) {
          maxModelsMessage()
          return prev
        }
        return [...prev, { model }]
      })
    },
    [effectiveMaxCount, maxModelsMessage]
  )

  const removeMember = useCallback((uniqId: string) => {
    setMembers((prev) => prev.filter((member) => getModelUniqId(member.model) !== uniqId))
  }, [])

  /** 设置单个成员的角色；assistantId 为 undefined 表示恢复默认角色 */
  const setRole = useCallback((uniqId: string, assistantId: string | undefined) => {
    setMembers((prev) =>
      prev.map((member) => (getModelUniqId(member.model) === uniqId ? { ...member, assistantId } : member))
    )
    setRolePopoverKey(null)
  }, [])

  /** 批量设置角色：应用到当前全部已选成员 */
  const applyBatchRole = useCallback((assistantId: string | undefined) => {
    setMembers((prev) => prev.map((member) => ({ ...member, assistantId })))
    setRolePopoverKey(null)
  }, [])

  // 角色管理共享动作（新建角色 / 角色库），与输入栏成员 chip 的角色切换入口行为一致
  const { createRole, openRoleLibrary: openLibrary } = useRoundtableRoleActions()

  /** 打开角色库（与首页面板一致：内嵌 AssistantPresetsPage 的模态） */
  const openRoleLibrary = useCallback(() => {
    setRolePopoverKey(null)
    openLibrary()
  }, [openLibrary])

  /** 新建角色（workspace='roundtable'），创建成功后绑定到目标成员（uniqId）或全员（'batch'） */
  const handleAddRole = useCallback(
    (target: string) => {
      setRolePopoverKey(null)
      createRole((assistantId) => {
        setMembers((prev) =>
          prev.map((member) =>
            target === 'batch' || getModelUniqId(member.model) === target ? { ...member, assistantId } : member
          )
        )
      })
    },
    [createRole]
  )

  const { models, loading, setLoading, fetchNextPage, getFilteredModels, hasMore, reset } = useAiOnlyModels({
    pageSize: 1000, // TODO: 临时规避分组加载数据抖动问题，与 SelectModelPopup 保持一致
    autoFetch: !userEnabledPlan
  })

  // 限时折扣活动：UserModelPackageVo.modelId 即 ai_model.id，作为活动 map 的合并键
  const discountModels = useMemo(() => [...models, ...tokenPlanModels], [models, tokenPlanModels])
  const { getDiscount } = usePublishPriceDiscount(discountModels, (m: any) => m.modelId)

  // 推荐标签（人气模型/最新推荐等）：字典 labelId → 名称，列表接口透传 recommendLabel/modelLabel
  const { getLabelItems } = useModelLabels()

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

  // 开通新模型成功后刷新弹窗内的模型列表（与单选弹窗 base-popup 的刷新逻辑保持一致）
  const handleOpenModelSuccess = useCallback(() => {
    invalidatePublishPriceDiscountCache()
    if (userEnabledPlan) {
      void fetchSelectTokenPlanHourlyDayUsage()
    } else {
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEnabledPlan, reset])

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

  // 监听左栏列表区域实际可用高度（弹窗内为固定高度布局，实测可兼容标题/底栏高度变化）
  useEffect(() => {
    const el = listAreaRef.current
    if (!el) return
    setListAreaHeight(el.clientHeight)
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 0
      setListAreaHeight(height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // 构建左栏列表：过滤 → 去重 → 搜索 → 已选置顶 + 按 serviceName 分组（组标题可折叠）
  const { listItems, modelItems } = useMemo(() => {
    const items: FlatListItem[] = []
    let filterModels = !userEnabledPlan ? getFilteredModels(createActivePayLaterFilter()) : tokenPlanModels

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

    // 预转换条目（uniqId 口径与 toggleModel / members 一致）
    const entries: ModelEntry[] = filterModels.map((raw: any) => {
      const model = transformToModel(raw)
      return { raw, model, uniqId: getModelUniqId(model) }
    })

    const buildModelItem = (entry: ModelEntry): FlatListModel => ({
      key: `${entry.raw.baseId || entry.model.id}-${entry.raw.serviceName}`,
      type: 'model',
      name: (
        <ModelName>
          <span className="min-w-0 truncate">{entry.model.name}</span>
          {entry.raw.memberSpecial == 1 && (
            <IconVip>
              <CrownFilled />
              <span>vip</span>
            </IconVip>
          )}
          <ModelLabelTags items={getLabelItems(entry.raw)} />
          <DiscountTag activity={getDiscount(entry.raw)} />
        </ModelName>
      ),
      tags: null,
      icon: (
        <Avatar src={entry.raw.modelFileUrl} size={24}>
          {first(entry.model.name) || 'M'}
        </Avatar>
      ),
      model: entry.model,
      isSelected: selectedModelUniqIds.has(entry.uniqId)
    })

    // 不按选中态重排：模型始终停留在原分组原位（选中态仅由勾选框与右栏已选条体现），
    // 避免勾选/取消勾选时列表整体跳动、模型位置到处变化，影响选择操作
    // 按 serviceName 分组
    const groupedByService = entries.reduce(
      (acc, entry) => {
        const serviceName = entry.raw.serviceName || 'Unknown'
        if (!acc[serviceName]) {
          acc[serviceName] = []
        }
        acc[serviceName].push(entry)
        return acc
      },
      {} as Record<string, ModelEntry[]>
    )

    Object.entries(groupedByService).forEach(([serviceName, groupEntries]) => {
      items.push({
        key: `group-${serviceName}`,
        type: 'group',
        name: serviceName,
        icon: null,
        actions: null,
        isSelected: false
      })

      if (!collapsedGroups.has(serviceName)) {
        groupEntries.forEach((entry) => items.push(buildModelItem(entry)))
      }
    })

    const modelItems = items.filter((item) => item.type === 'model')
    return { listItems: items, modelItems }
  }, [
    getFilteredModels,
    tokenPlanModels,
    userEnabledPlan,
    modelFilter,
    searchText,
    collapsedGroups,
    selectedModelUniqIds,
    getDiscount,
    getLabelItems
  ])

  const listHeight = useMemo(() => {
    // 左栏为单列虚拟列表且弹窗主体固定高度：视口直接铺满 ListArea 实测可用高度
    // （上限 LEFT_LIST_MAX_HEIGHT）。此前按「条目数 / 2」计算行数，视口只有内容一半高，
    // 导致列表区域过矮、行被裁切并出现多余滚动条
    const available = listAreaHeight > 0 ? Math.floor(listAreaHeight) : LEFT_LIST_MAX_HEIGHT
    return Math.max(Math.min(available, LEFT_LIST_MAX_HEIGHT), ITEM_HEIGHT)
  }, [listAreaHeight])

  const handleItemClick = useCallback(
    (item: FlatListItem) => {
      if (item.type === 'model') {
        toggleModel(item.model)
      }
    },
    [toggleModel]
  )

  const handleClear = useCallback(() => {
    setMembers([])
  }, [])

  const handleConfirm = useCallback(() => {
    // 过滤掉模型缺失的异常成员后回传
    resolve(members.filter((member) => !!member.model && !!member.model.id))
    setOpen(false)
  }, [members, resolve])

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
      return (
        <ModelItem
          className={classNames({
            focused: isFocused,
            selected: item.isSelected
          })}
          onClick={() => handleItemClick(item)}
          onMouseOver={() => !isFocused && _setFocusedKey(item.key)}>
          <ModelItemLeft>
            <CheckBox className={item.isSelected ? 'checked' : undefined}>
              {item.isSelected && <Check size={13} strokeWidth={3} />}
            </CheckBox>
            {item.icon}
            {item.name}
            {item.tags}
          </ModelItemLeft>
        </ModelItem>
      )
    },
    [focusedKey, handleItemClick, collapsedGroups, toggleGroupCollapsed]
  )

  return (
    <Modal
      open={open}
      centered
      onCancel={() => setOpen(false)}
      afterClose={() => {
        resolve(undefined)
        SelectRoundtableModelsPopup.hide()
      }}
      width={860}
      title={null}
      styles={{
        content: {
          borderRadius: 10,
          overflow: 'hidden',
          padding: 0
        },
        body: {
          height: 560,
          maxHeight: 'inherit',
          // 全局 ant.css 给 .ant-modal-body 设了 overflow-y: auto 会裁剪星光飞散动画，
          // 本弹窗列表为虚拟滚动（自身容器内滚动），body 无需滚动，覆盖为 visible
          overflow: 'visible',
          padding: 0
        }
      }}
      footer={null}>
      <PopupBody onMouseMove={() => !isMouseOver && setIsMouseOver(true)}>
        <PopupHeader>
          <div className="title">{t('roundtable.popup.title')}</div>
          <div className="subtitle">{t('roundtable.popup.subtitle')}</div>
        </PopupHeader>
        <TwoColumn>
          <LeftColumn>
            <SelectModelSearchBar
              onSearch={setSearchText}
              extra={showOpenModelButton ? <OpenNewModelButton onSuccess={handleOpenModelSuccess} /> : undefined}
            />
            <ListArea ref={listAreaRef}>
              <Spin spinning={loading}>
                {modelItems.length > 0 ? (
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
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('models.no_matches')} />
                  </EmptyState>
                )}
              </Spin>
            </ListArea>
          </LeftColumn>
          <RightColumn>
            <RightHeader>
              <span className="count">
                {t('roundtable.popup.selected_count', { count: members.length, max: effectiveMaxCount })}
              </span>
              <Popover
                trigger="click"
                placement="bottomRight"
                open={rolePopoverKey === 'batch'}
                onOpenChange={(visible) => setRolePopoverKey(visible ? 'batch' : null)}
                content={
                  <RolePanel
                    key={rolePopoverKey ?? 'closed'}
                    roles={roleAssistants}
                    selectedId={undefined}
                    onSelect={applyBatchRole}
                    onAddRole={() => handleAddRole('batch')}
                    onOpenLibrary={openRoleLibrary}
                  />
                }>
                <Button size="small" disabled={members.length === 0}>
                  {t('roundtable.popup.batch_role')}
                </Button>
              </Popover>
            </RightHeader>
            <MemberList>
              {members.length === 0 ? (
                <MemberEmpty>
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('roundtable.popup.empty_members')} />
                </MemberEmpty>
              ) : (
                members.map((member) => {
                  const uniqId = getModelUniqId(member.model)
                  const role = member.assistantId ? roleById.get(member.assistantId) : undefined
                  return (
                    <MemberRow key={uniqId}>
                      <Avatar src={(member.model as any).modelFileUrl} size={28}>
                        {first(member.model.name) || 'M'}
                      </Avatar>
                      <MemberInfo>
                        <div className="name">{member.model.name}</div>
                        <div className="provider">{(member.model as any).serviceName || member.model.provider}</div>
                      </MemberInfo>
                      <Popover
                        trigger="click"
                        placement="bottomRight"
                        open={rolePopoverKey === uniqId}
                        onOpenChange={(visible) => setRolePopoverKey(visible ? uniqId : null)}
                        content={
                          <RolePanel
                            key={rolePopoverKey ?? 'closed'}
                            roles={roleAssistants}
                            selectedId={member.assistantId}
                            onSelect={(assistantId) => setRole(uniqId, assistantId)}
                            onAddRole={() => handleAddRole(uniqId)}
                            onOpenLibrary={openRoleLibrary}
                          />
                        }>
                        <RoleButton title={t('roundtable.role.select')}>
                          <span className="emoji">{role?.emoji || '🤖'}</span>
                          <span className="label">{role?.name || t('roundtable.role.default')}</span>
                          <ChevronRight size={12} className="arrow" />
                        </RoleButton>
                      </Popover>
                      <RemoveButton onClick={() => removeMember(uniqId)}>
                        <X size={14} />
                      </RemoveButton>
                    </MemberRow>
                  )
                })
              )}
            </MemberList>
          </RightColumn>
        </TwoColumn>
        <Footer>
          <SelectedCount>
            {t('models.multi.selected_count', { count: members.length, max: effectiveMaxCount })}
          </SelectedCount>
          <FooterButtons>
            <Button disabled={members.length === 0} onClick={handleClear}>
              {t('settings.input.clear.all')}
            </Button>
            <Button type="primary" onClick={handleConfirm}>
              {t('common.confirm')}
            </Button>
          </FooterButtons>
        </Footer>
      </PopupBody>
    </Modal>
  )
}

const PopupBody = styled.div`
  display: flex;
  flex-direction: column;
  height: 560px;
  /* 保持可见：搜索栏右侧「开通新模型」按钮的星光飞散动画需要溢出到容器外 */
  overflow: visible;
`

const PopupHeader = styled.div`
  padding: 16px 20px 8px;

  .title {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
    line-height: 1.4;
  }

  .subtitle {
    margin-top: 2px;
    font-size: 12px;
    color: var(--color-text-3);
    line-height: 1.4;
  }
`

const TwoColumn = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 12px;
  padding: 4px 12px 0;
`

const LeftColumn = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`

/** 左栏列表区域：占据搜索栏以下的剩余高度，供 ResizeObserver 实测可用高度 */
const ListArea = styled.div`
  flex: 1;
  min-height: 0;
`

const RightColumn = styled.div`
  display: flex;
  flex-direction: column;
  width: 300px;
  flex-shrink: 0;
  border-left: 1px solid var(--color-border);
  padding-left: 12px;
`

const RightHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 4px 8px;
  flex-shrink: 0;

  .count {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text);
  }
`

const MemberList = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 2px;
`

const MemberEmpty = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
`

const MemberRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  transition: background-color 0.15s;

  &:hover {
    background-color: var(--color-background-mute);
  }
`

const MemberInfo = styled.div`
  flex: 1;
  min-width: 0;

  .name {
    font-size: 13px;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .provider {
    font-size: 11px;
    color: var(--color-text-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

const RoleButton = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  max-width: 110px;
  padding: 2px 8px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  font-size: 12px;
  color: var(--color-text-2);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .emoji {
    font-size: 12px;
    line-height: 1;
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .arrow {
    flex-shrink: 0;
    transform: rotate(90deg);
    opacity: 0.6;
  }
`

const RemoveButton = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  color: var(--color-text-3);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    color: var(--color-error, #f56c6c);
    background-color: var(--color-background-mute);
  }
`

const RolePanelWrap = styled.div`
  width: 220px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const RoleOptions = styled.div`
  max-height: 240px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const RoleOption = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-text);
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    background-color: var(--color-background-mute);
  }

  &.active {
    color: var(--color-primary);
  }

  .emoji {
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
  }

  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .check {
    flex-shrink: 0;
    color: var(--color-primary);
  }
`

const RoleEmpty = styled.div`
  padding: 12px 0;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-3);
`

const RoleActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--color-border);

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    flex: 1;
    padding: 4px 8px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: transparent;
    font-size: 12px;
    color: var(--color-text-2);
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      border-color: var(--color-primary);
      color: var(--color-primary);
    }
  }
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
  margin-right: 8px;
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

const EmptyState = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
`

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px 14px;
  flex-shrink: 0;
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

export const SelectRoundtableModelsPopup = createModelPopup<SelectRoundtableModelsPopupParams, RoundtableMention[]>(
  SelectRoundtableModelsPopupView
)

export default SelectRoundtableModelsPopupView
