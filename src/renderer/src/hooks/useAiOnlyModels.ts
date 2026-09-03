import { loggerService } from '@logger'
import { selectTokenPlanHourlyDayUsageApi } from '@renderer/api/billManagement'
import { pageListApi } from '@renderer/api/openManagement'
import { isNotSupportTextDeltaModel } from '@renderer/config/models'
import useUserTokenPlan from '@renderer/hooks/useUserTokenPlan'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { selectUserInfo, setAiOnlyModels } from '@renderer/store/user'
import { getDefaultEndpointTypeById } from '@renderer/tools'
import type { ApiModel, Model, Provider } from '@renderer/types'
import { isModelPackageActive } from '@renderer/utils/model'
import { isNewApiProvider } from '@renderer/utils/provider'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useDefaultModel } from './useAssistant'

const logger = loggerService.withContext('useAiOnlyModels')

// re-export 供 ModelSelector 等组件复用（其测试 mock 了本模块，需从本模块导入）
export { isModelPackageActive }

// 默认模型过滤器：只保留"先用后付"套餐的有效模型（过滤掉用户已停用的）
const DEFAULT_MODEL_FILTER = (model: AiOnlyModel) => model.packageNum === '先用后付' && isModelPackageActive(model)

export const filterModels = (models: AiOnlyModel[], filter: (model: AiOnlyModel) => boolean = DEFAULT_MODEL_FILTER) => {
  if (models && Array.isArray(models)) {
    return models.filter(filter)
  }
  return []
}

/**
 * 直接调用 API 获取 AiOnly 模型列表（不依赖 hook 状态）
 * @param params - 查询参数
 * @returns Promise<{ models: AiOnlyModel[], total: number }>
 */
export async function fetchAiOnlyModelsApi(
  params: Partial<ModelPageParams>
): Promise<{ models: AiOnlyModel[]; total: number }> {
  const defaultParams: ModelPageParams = {
    type: '1',
    modelAttribute: ModelAttribute.TextModel,
    pageNum: 1,
    pageSize: 10,
    total: 0,
    orderByStatus: 1,
    orderByTime: 'desc',
    domain: window.location.hostname || 'localhost:5173'
  }

  const finalParams = { ...defaultParams, ...params }

  try {
    const res: any = await pageListApi(finalParams)
    if (res?.code === 200 && res.rows) {
      const modelList: AiOnlyModel[] = res?.rows?.map((item: any) => ({
        ...item,
        name: item.modelName,
        provider: 'aionly',
        group: item.serviceName,
        endpoint_type: item.endpoint_type ?? getDefaultEndpointTypeById(item)
      }))
      return { models: modelList || [], total: res.total || 0 }
    }
    return { models: [], total: 0 }
  } catch (error) {
    logger.error('Failed to fetch AiOnly models', { error })
    return { models: [], total: 0 }
  }
}

export enum ModelAttribute {
  TextModel = 'text_model',
  ImageModel = 'image_generation'
}

export interface ModelPageParams {
  type: string
  modelAttribute: ModelAttribute
  modelName?: string
  pageNum: number
  pageSize: number
  total: number
  orderByStatus: number // 1=先有效再停用再失效/下架
  orderByTime: string // 有效组内按时间倒序
  domain: string
}

export interface AiOnlyModel {
  id: string
  modelName: string
  name?: string
  object?: 'model'
  serviceName: string
  modelFileUrl?: string
  provider: string
  group: string
  [key: string]: any
}

export interface UseAiOnlyModelsOptions {
  /** 初始页码，默认 1 */
  initialPageNum?: number
  /** 每页大小，默认 10 */
  pageSize?: number
  /** 模型属性类型，默认 TextModel */
  modelAttribute?: ModelAttribute
  /** 类型，默认 '1' */
  type?: string
  /** 排序状态，默认 1（先有效再停用再失效/下架） */
  orderByStatus?: number
  /** 排序时间，默认 'desc'（有效组内按时间倒序） */
  orderByTime?: string
  /** 域名，默认 window.location.hostname */
  domain?: string
  /** 是否自动加载第一页，默认 true */
  autoFetch?: boolean
  /** 滚动加载触发距离（距离底部多少像素时触发），默认 50 */
  scrollThreshold?: number
}

export interface UseAiOnlyModelsResult {
  /** 模型列表 */
  models: AiOnlyModel[]
  /** 加载状态 */
  loading: boolean
  /** 分页参数 */
  pageParams: ModelPageParams
  /** 获取指定页的模型 */
  fetchModels: (pageNum: number) => Promise<void>
  /** 加载下一页 */
  fetchNextPage: () => Promise<void>
  /** 重置并重新加载 */
  reset: (newParams?: Partial<ModelPageParams>) => void
  /** 是否还有更多数据 */
  hasMore: boolean
  /** 滚动事件处理器，用于无限滚动加载 */
  handleScroll: (e: React.UIEvent<HTMLDivElement>) => void
}

// 完整复制 handleAddModel 的处理逻辑
export function processModelLikeAddModel(model: Model, provider: Provider): Model {
  // 1. 设置 supported_text_delta
  let processedModel = {
    ...model,
    supported_text_delta: !isNotSupportTextDeltaModel(model)
  }

  // 2. 如果是 newApi provider，设置 endpoint_type
  if (isNewApiProvider(provider)) {
    const endpointTypes = model.supported_endpoint_types
    if (endpointTypes && endpointTypes.length > 0) {
      processedModel = {
        ...processedModel,
        endpoint_type: endpointTypes.includes('image-generation') ? 'image-generation' : endpointTypes[0]
      }
    }
  }

  return processedModel
}

// 把的接口数据转成 Model 格式
export function transformToModel(item: any, provider?: Provider): Model {
  const modelItem = {
    ...item,
    id: item.baseId || item.model,
    provider: provider?.id || 'aionly',
    name: item.modelName,
    group: item.group || item.serviceName,
    owned_by: item.owned_by || 'AiOnly',
    description: item.description || '',
    capabilities: item.capabilities || [],
    type: item.type || 'model',
    pricing: item.pricing,
    endpoint_type: item.endpoint_type ?? getDefaultEndpointTypeById(item),
    supported_endpoint_types: item.supported_endpoint_types,
    supported_text_delta: !isNotSupportTextDeltaModel({ ...item, id: item.baseId || item.model })
  }
  return {
    ...modelItem,
    origin: modelItem
  }
}

// Model → ApiModel
export function modelToApiModel(model: Model): ApiModel {
  return {
    id: `aionly:${model.id}`,
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    name: model.name,
    owned_by: 'AiOnly',
    provider: 'aionly',
    provider_name: 'aionly',
    provider_type: 'openai',
    provider_model_id: model.id
  }
}

/**
 * AiOnly 模型列表分页 Hook
 *
 * @example
 * ```tsx
 * const { models, loading, handleScroll, hasMore } = useAiOnlyModels({
 *   pageSize: 20,
 *   autoFetch: true
 * })
 *
 * return (
 *   <div onScroll={handleScroll}>
 *     {models.map(model => <div key={model.modelName}>{model.name}</div>)}
 *     {loading && <div>Loading...</div>}
 *   </div>
 * )
 * ```
 */
export function useAiOnlyModels(options: UseAiOnlyModelsOptions = {}): {
  models: AiOnlyModel[]
  loading: boolean
  setLoading: (loading: boolean) => void
  pageParams: ModelPageParams
  setPageParams: (pageParams: (prev: any) => any) => void
  fetchModels: (pageNum: number) => Promise<void>
  fetchNextPage: () => Promise<void>
  hasMore: boolean
  reset: (newParams?: Partial<ModelPageParams>) => void
  getFilteredModels: (filter?: (model: AiOnlyModel) => boolean) => AiOnlyModel[]
  handleScroll: (e: React.UIEvent<HTMLDivElement>) => void
} {
  const {
    initialPageNum = 1,
    pageSize = 10,
    modelAttribute = ModelAttribute.TextModel,
    type = '1',
    orderByStatus = 1,
    orderByTime = 'desc',
    domain = window.location.hostname || 'localhost:5173',
    autoFetch = true,
    scrollThreshold = 50
  } = options

  const [models, setModels] = useState<AiOnlyModel[]>([])
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)
  const initializedRef = useRef(false) // 防止重复初始化

  const pageParamsRef = useRef<ModelPageParams>({
    type,
    modelAttribute,
    pageNum: initialPageNum,
    pageSize,
    total: 0,
    orderByStatus,
    orderByTime,
    domain
  })

  const [pageParams, setPageParams] = useState<ModelPageParams>(pageParamsRef.current)

  const fetchModels = useCallback(async (pageNum: number) => {
    if (loadingRef.current) return

    loadingRef.current = true
    setLoading(true)

    try {
      // 复用 fetchAiOnlyModelsApi 获取数据
      const { models: modelList, total } = await fetchAiOnlyModelsApi({
        ...pageParamsRef.current,
        pageNum
      })

      logger.info('Data rows count', { count: modelList.length })

      // 更新状态
      setModels((prevModels) => {
        // 如果是第一页，直接替换；否则追加
        const newModels = pageNum === 1 ? modelList : [...prevModels, ...modelList]
        logger.info('Updated models count', { count: newModels.length })
        return newModels
      })

      const newParams = {
        ...pageParamsRef.current,
        total,
        pageNum
      }
      pageParamsRef.current = newParams
      setPageParams(newParams)
    } catch (e: any) {
      logger.error('Failed to fetch models', { error: e })
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [])

  const fetchNextPage = useCallback(async () => {
    const nextPage = pageParamsRef.current.pageNum + 1
    await fetchModels(nextPage)
  }, [fetchModels])

  const reset = useCallback(
    (newParams?: Partial<ModelPageParams>) => {
      setModels([])
      // 如果传入了新参数，先合并到 ref
      if (newParams) {
        pageParamsRef.current = {
          ...pageParamsRef.current,
          ...newParams,
          pageNum: 1,
          total: 0
        }
      } else {
        pageParamsRef.current = {
          ...pageParamsRef.current,
          pageNum: 1,
          total: 0
        }
      }
      setPageParams(pageParamsRef.current)
      void fetchModels(initialPageNum)
    },
    [fetchModels, initialPageNum]
  )

  const hasMore = models.length < pageParams.total

  // 滚动事件处理器，用于无限滚动加载
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (loadingRef.current || !hasMore) {
        logger.info('handleScroll early return', {
          reason: loadingRef.current ? 'loading' : 'no more data'
        })
        return
      }

      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
      const distanceToBottom = scrollHeight - scrollTop - clientHeight

      // 距底部 scrollThreshold 像素以内触发加载
      if (distanceToBottom < scrollThreshold) {
        void fetchNextPage()
      }
    },
    [hasMore, scrollThreshold, fetchNextPage, models.length, pageParams.total]
  )

  // 获取过滤后的模型列表数据
  const getFilteredModels = useCallback(
    (filter: (model: AiOnlyModel) => boolean = DEFAULT_MODEL_FILTER) => {
      return models.filter(filter)
    },
    [models]
  )

  // 自动加载第一页
  useEffect(() => {
    if (autoFetch && !initializedRef.current) {
      initializedRef.current = true
      logger.info('Auto-fetching first page')
      void fetchModels(initialPageNum)
    }
    return () => {
      initializedRef.current = false
    }
  }, [autoFetch, fetchModels, initialPageNum])

  return {
    models,
    loading,
    setLoading,
    pageParams,
    setPageParams,
    fetchModels,
    fetchNextPage,
    hasMore,
    reset,
    getFilteredModels,
    handleScroll
  }
}

/**
 * 将 AiOnlyModel 转换为标准 Model 类型
 */
export function convertToStandardModel(aiOnlyModel: AiOnlyModel): {
  id: string
  name: string
  provider: string
  group: string
  origin: Record<string, any>
} {
  return {
    id: `agent/${aiOnlyModel.baseId}`,
    name: aiOnlyModel.modelName,
    provider: aiOnlyModel.provider,
    group: aiOnlyModel.serviceName || aiOnlyModel.group,
    origin: {
      ...aiOnlyModel,
      id: `aionly:${aiOnlyModel.baseId}`,
      name: aiOnlyModel.modelName,
      object: 'model',
      owned_by: 'AIOnly',
      provider: 'aionly',
      provider_model_id: aiOnlyModel.baseId,
      provider_name: 'aionly',
      provider_type: 'openai'
    }
  }
}

export interface SimpleModel {
  id: string
  modelName: string
  name: string
  object: string
  serviceName: string
  modelFileUrl?: string
  provider: string
  group: string
  origin: any
}

export interface FetchAndSetupModelsOptions {
  /** 分页大小，默认 10 */
  pageSize?: number
  /** Redux dispatch 函数 */
  dispatch: any
  /** 获取用户启用tokenPlan数据*/
  getUserEnabledPlan: () => any
  /** 设置默认模型的回调 */
  setDefaultModel?: (model: SimpleModel) => void
  /** 设置快捷模型的回调 */
  setQuickModel?: (model: SimpleModel) => void
  /** 设置翻译模型的回调 */
  setTranslateModel?: (model: SimpleModel) => void
  /** Redux action: setAiOnlyModels */
  setAiOnlyModelsAction: any
}

/**
 * 封装完整的"获取→过滤→转换→存储→设置默认"流程
 * 内部函数，由 useFetchAndSetupModels hook 调用
 */
async function fetchAndSetupModels(options: FetchAndSetupModelsOptions): Promise<Model[]> {
  const {
    pageSize = 10,
    dispatch,
    getUserEnabledPlan,
    setDefaultModel,
    setQuickModel,
    setTranslateModel,
    setAiOnlyModelsAction
  } = options

  try {
    const userTokenPlan = getUserEnabledPlan()
    let models: any[] = []
    /** 1. 获取模型数据
     * 没有启用tokenPlan，则获取平台模型数据
     * 启用tokenPlan，则获取tokenPlan对应的模型数据
     * */
    if (!userTokenPlan) {
      const res = await fetchAiOnlyModelsApi({ pageSize })
      models = res.models ?? []
    } else {
      const res: any = await selectTokenPlanHourlyDayUsageApi({
        subscribeId: userTokenPlan.id,
        planId: userTokenPlan.planId
      })
      models = res.rows || []
    }

    // 2. 过滤"先用后付"套餐的模型--tokenPlan启用的模型不过滤
    const filteredModels = !userTokenPlan ? filterModels(models) : models

    // 3. 转换为标准 Model 格式
    const transformedModels = filteredModels.map((model) => transformToModel(model))

    // 4. 存储到 Redux
    dispatch(setAiOnlyModelsAction(transformedModels))

    // 5. 设置默认模型
    if (transformedModels.length > 0 && (setDefaultModel || setQuickModel || setTranslateModel)) {
      const defaultModel: any = transformedModels[0]
      const simpleModel: SimpleModel = {
        id: defaultModel.id,
        modelName: defaultModel.modelName,
        name: defaultModel.name,
        object: defaultModel.object,
        serviceName: defaultModel.serviceName,
        modelFileUrl: defaultModel.modelFileUrl,
        provider: defaultModel.provider,
        group: defaultModel.group,
        origin: defaultModel
      }
      setDefaultModel?.(simpleModel)
      setQuickModel?.(simpleModel)
      setTranslateModel?.(simpleModel)
    }

    return transformedModels
  } catch (error) {
    logger.error('Failed to fetch and setup models', { error })
    throw error
  }
}

/**
 * 封装完整的"获取→过滤→转换→存储→设置默认"流程的 Hook
 *
 * @example
 * ```tsx
 * const setupModels = useFetchAndSetupModels()
 * await setupModels(10)
 * ```
 */
export function useFetchAndSetupModels() {
  const dispatch = useAppDispatch()
  const userInfo: any = useAppSelector(selectUserInfo)
  const { getUserEnabledPlan } = useUserTokenPlan(userInfo?.userId)
  const { setDefaultModel, setQuickModel, setTranslateModel } = useDefaultModel()

  return useCallback(
    async (pageSize = 10) => {
      await fetchAndSetupModels({
        pageSize,
        dispatch,
        getUserEnabledPlan,
        setAiOnlyModelsAction: setAiOnlyModels,
        setDefaultModel,
        setQuickModel,
        setTranslateModel
      })
    },
    [dispatch, setDefaultModel, setQuickModel, setTranslateModel]
  )
}
