import { selectTokenPlanHourlyDayUsageApi } from '@renderer/api/billManagement'
import ModelAvatar from '@renderer/components/Avatar/ModelAvatar'
import {
  type AiOnlyModel,
  fetchAiOnlyModelsApi,
  isModelPackageActive,
  ModelAttribute,
  transformToModel,
  useAiOnlyModels
} from '@renderer/hooks/useAiOnlyModels'
import useUserTokenPlan from '@renderer/hooks/useUserTokenPlan'
import { useAppSelector } from '@renderer/store'
import { selectUserInfo } from '@renderer/store/user'
// import { getModelUniqId } from '@renderer/services/ModelService'
import type { Model, Provider } from '@renderer/types'
import { matchKeywordsInString } from '@renderer/utils'
// import { getFancyProviderName } from '@renderer/utils/naming'
import type { SelectProps } from 'antd'
import { Avatar, Select, Spin } from 'antd'
// import { sortBy } from 'lodash'
import type { BaseSelectRef } from 'rc-select'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface ModelOption {
  label: React.ReactNode
  title: string
  value: string
}

interface GroupedModelOption {
  label: string
  title: string
  options: ModelOption[]
}

type SelectOption = ModelOption | GroupedModelOption

interface ModelSelectorProps extends SelectProps {
  providers?: Provider[]
  predicate?: (model: Model) => boolean
  grouped?: boolean
  showAvatar?: boolean
  showSuffix?: boolean
  autoFetch?: boolean
  apiModels?: any[] | null | undefined
}

/**
 * 模型选择器，封装了 antd Select
 * - 通过传入模型服务商列表和模型 predicate 来构造选项
 * - 支持按服务商分组
 * - 可以控制 avatar 和 suffix 显示与否
 * @param providers 服务商列表
 * @param predicate 模型过滤条件
 * @param grouped 是否按服务商分组
 * @param showAvatar 是否显示模型图标
 * @param showSuffix 是否在模型名称后显示服务商作为后缀
 */
/** 远程模糊搜索防抖间隔（ms） */
const SEARCH_DEBOUNCE_MS = 300
/** 远程模糊搜索单次拉取的最大条数 */
const SEARCH_PAGE_SIZE = 50

const ModelSelector = ({
  // providers,
  predicate,
  grouped = true,
  showAvatar = true,
  // showSuffix = true,
  autoFetch = true,
  apiModels,
  loading: externalLoading,
  onSearch: externalOnSearch,
  onPopupScroll: externalOnPopupScroll,
  filterOption: externalFilterOption,
  ref,
  ...props
}: ModelSelectorProps & { ref?: React.Ref<BaseSelectRef> | null }) => {
  const { t } = useTranslation()

  const userInfo: any = useAppSelector(selectUserInfo)
  const { getUserEnabledPlan } = useUserTokenPlan(userInfo?.userId)
  const [tokenPlanModels, setTokenPlanModels] = useState<any[]>([])
  const [userEnabledPlan] = useState<any>(getUserEnabledPlan())

  // 单个 provider 的模型选项
  /*const getModelOptions = useCallback(
    (p: Provider, fancyName: string) => {
      const suffix = showSuffix ? <span style={{ opacity: 0.45 }}>{` | ${fancyName}`}</span> : null
      return sortBy(p.models, 'name')
        .filter((model) => predicate?.(model) ?? true)
        .map((m) => ({
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {showAvatar && <ModelAvatar model={m} size={18} />}
              <span>
                {m.name}
                {suffix}
              </span>
            </div>
          ),
          title: `${m.name} | ${fancyName}`,
          value: getModelUniqId(m)
        }))
    },
    [predicate, showAvatar, showSuffix]
  )

  // 所有 provider 的模型选项
  const options = useMemo((): SelectOption[] => {
    if (!providers) return []

    if (grouped) {
      return providers.flatMap((p) => {
        const fancyName = getFancyProviderName(p)
        const modelOptions = getModelOptions(p, fancyName)
        return modelOptions.length > 0
          ? [
              {
                label: fancyName,
                title: p.name,
                options: modelOptions
              } as GroupedModelOption
            ]
          : []
      })
    }
    return providers.flatMap((p) => getModelOptions(p, getFancyProviderName(p)))
  }, [providers, grouped, getModelOptions])*/

  const labelRender = useCallback(
    (props) => {
      const { label } = props
      if (label) {
        return label
      } else {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {showAvatar && <Avatar size={18} />}
            <span>{t('knowledge.error.model_invalid')}</span>
          </div>
        )
      }
    },
    [showAvatar, t]
  )

  /** 从接口查询文本模型 **/
  // 只有 userEnabledPlan 有值时才调用 useAiOnlyModels
  const { loading, setLoading, getFilteredModels, handleScroll } = useAiOnlyModels({
    pageSize: 20,
    autoFetch: autoFetch && !userEnabledPlan, // 用户启用了tokenPlan后，不需要走这个接口
    type: '1',
    modelAttribute: ModelAttribute.TextModel
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

  // 将 AiOnlyModel 转换为 ModelOption
  const getAiOnlyModelOption = useCallback(
    (m: any, serviceName: string) => {
      // 构造符合 getModelUniqId 格式的 value
      const modelValue = JSON.stringify({
        id: m.model || m.baseId,
        provider: 'aionly',
        group: serviceName,
        name: m.modelName,
        modelFileUrl: m.modelFileUrl
      })
      return {
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {showAvatar && <ModelAvatar model={m} size={18} />}
            <span>{m.modelName}</span>
          </div>
        ),
        title: `${m.modelName} | ${serviceName}`,
        value: modelValue
      }
    },
    [showAvatar]
  )

  /**
   * 远程模糊搜索：分页接口只加载了部分数据，本地过滤搜不到未加载分页里的模型，
   * 输入关键词时改为调用后端 modelName 模糊查询（防抖），清空关键词后还原。
   */
  const [searchText, setSearchText] = useState('')
  const [remoteModels, setRemoteModels] = useState<AiOnlyModel[]>([])
  // remoteModels 对应的关键词：仅当输入框关键词与已到达的远程结果一致时才切换数据源，
  // 防抖等待期间继续展示本地过滤结果，避免下拉框闪现空列表
  const [remoteKeyword, setRemoteKeyword] = useState('')
  const [remoteSearching, setRemoteSearching] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const searchRequestIdRef = useRef(0)

  const handleSearch = useCallback(
    (text: string) => {
      externalOnSearch?.(text)
      setSearchText(text)

      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
        searchTimerRef.current = undefined
      }

      // 关键词清空：作废在途请求并还原本地数据
      if (!text) {
        searchRequestIdRef.current++
        setRemoteKeyword('')
        setRemoteSearching(false)
        return
      }

      // tokenPlan 套餐数据本身就是全量，前端过滤即可
      if (userEnabledPlan) {
        return
      }

      searchTimerRef.current = setTimeout(async () => {
        const requestId = ++searchRequestIdRef.current
        setRemoteSearching(true)
        try {
          const { models } = await fetchAiOnlyModelsApi({ modelName: text, pageSize: SEARCH_PAGE_SIZE })
          // 丢弃过期请求的结果；停用的量包模型（status='1'）不展示
          if (requestId === searchRequestIdRef.current) {
            setRemoteModels(models.filter(isModelPackageActive))
            setRemoteKeyword(text)
          }
        } finally {
          if (requestId === searchRequestIdRef.current) {
            setRemoteSearching(false)
          }
        }
      }, SEARCH_DEBOUNCE_MS)
    },
    [externalOnSearch, userEnabledPlan]
  )

  useEffect(
    () => () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
      }
    },
    []
  )

  // 构建 AiOnly 模型选项，优先使用父组件传入的 apiModels，否则从 hook 获取
  // 远程搜索结果到达后展示服务端返回的结果，清空关键词后还原本地已加载的数据
  const isRemoteSearch = !!searchText && searchText === remoteKeyword && !userEnabledPlan

  const aionlyOptions = useMemo((): SelectOption[] => {
    let filteredModels = userEnabledPlan
      ? tokenPlanModels
      : isRemoteSearch
        ? remoteModels
        : (apiModels ?? getFilteredModels())

    // 应用 predicate 过滤
    if (predicate) {
      filteredModels = filteredModels.filter(predicate)
    }

    if (grouped) {
      // 按 serviceName 分组
      const groupMap = new Map<string, any[]>()
      filteredModels.forEach((m) => {
        const serviceName = m.serviceName || 'Unknown'
        if (!groupMap.has(serviceName)) {
          groupMap.set(serviceName, [])
        }
        groupMap.get(serviceName)!.push(m)
      })

      const result = Array.from(groupMap.entries()).map(([serviceName, groupModels]) => ({
        label: serviceName,
        title: serviceName,
        options: groupModels.map((m) => getAiOnlyModelOption(m, serviceName))
      }))
      return result
    }

    // 不分组，直接返回所有模型
    const result = filteredModels.map((m) => getAiOnlyModelOption(m, m.serviceName || 'Unknown'))
    return result
  }, [
    tokenPlanModels,
    apiModels,
    getFilteredModels,
    grouped,
    getAiOnlyModelOption,
    predicate,
    userEnabledPlan,
    isRemoteSearch,
    remoteModels
  ])

  /**
   * 兜底选项：当前选中值不在已加载的选项中时（分页接口尚未加载到该模型），
   * 用 value 中保存的模型信息生成一个临时选项，避免选中框显示"未选择模型"。
   * 数据加载到真实选项后（value 相同）兜底自动消失。
   */
  const fallbackOption = useMemo((): ModelOption | null => {
    const rawValue = props.value
    if (typeof rawValue !== 'string' || !rawValue) {
      return null
    }

    const exists = aionlyOptions.some((opt) =>
      'options' in opt ? opt.options.some((o) => o.value === rawValue) : opt.value === rawValue
    )
    if (exists) {
      return null
    }

    try {
      const parsed = JSON.parse(rawValue) as {
        id?: string
        name?: string
        modelName?: string
        modelFileUrl?: string
      }
      const name = parsed?.name || parsed?.modelName
      if (!name) {
        return null
      }
      const fallbackModel = {
        id: parsed.id,
        name,
        modelFileUrl: parsed.modelFileUrl,
        provider: 'aionly'
      }
      return {
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {showAvatar && <ModelAvatar model={fallbackModel} size={18} />}
            <span>{name}</span>
          </div>
        ),
        title: name,
        value: rawValue
      }
    } catch {
      // value 不是合法 JSON（如旧格式数据），无法反解出模型信息，保持原有展示
      return null
    }
  }, [props.value, aionlyOptions, showAvatar])

  // 兜底选项放在最前，保证下拉打开时能立即看到并选中当前已保存的模型
  const mergedOptions = useMemo(
    () => (fallbackOption ? [fallbackOption, ...aionlyOptions] : aionlyOptions),
    [fallbackOption, aionlyOptions]
  )

  // 远程搜索结果已由服务端按关键词过滤，本地不再过滤
  const handleFilterOption = useCallback(
    (input: string, option: any) => {
      if (isRemoteSearch) {
        return true
      }
      return typeof externalFilterOption === 'function'
        ? externalFilterOption(input, option)
        : modelSelectFilter(input, option)
    },
    [isRemoteSearch, externalFilterOption]
  )

  const handlePopupRender = useCallback(
    (menu) => {
      return <Spin spinning={remoteSearching || (externalLoading ?? loading)}>{menu}</Spin>
    },
    [remoteSearching, externalLoading, loading]
  )

  // 搜索状态下展示的是服务端搜索结果，不再滚动分页；
  // 未搜索时优先使用父组件传入的滚动加载，否则走内部 hook（无 tokenPlan 才启用）
  const handlePopupScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (isRemoteSearch) {
        return
      }
      if (externalOnPopupScroll) {
        externalOnPopupScroll(e)
        return
      }
      if (!userEnabledPlan) {
        handleScroll(e)
      }
    },
    [isRemoteSearch, externalOnPopupScroll, userEnabledPlan, handleScroll]
  )

  return (
    <Select
      ref={ref}
      options={mergedOptions}
      filterOption={handleFilterOption}
      labelRender={labelRender}
      showSearch
      loading={loading || remoteSearching}
      onSearch={handleSearch}
      onPopupScroll={handlePopupScroll}
      popupRender={handlePopupRender}
      {...props}
    />
  )
}

export default memo(ModelSelector)

/**
 * 用于 antd Select 组件的 filterOption，统一搜索行为：
 * - 优先使用 title 匹配
 * - 其次使用 label 匹配
 * - 最后使用 value 匹配
 *
 * @param input 用户输入的搜索字符串
 * @param option Select 选项对象，包含 label 或 value
 * @returns 是否匹配
 */
export function modelSelectFilter(input: string, option: any): boolean {
  const target =
    typeof option?.title === 'string'
      ? option.title
      : typeof option?.label === 'string'
        ? option.label
        : typeof option?.value === 'string'
          ? option.value
          : ''
  return matchKeywordsInString(input, target)
}
