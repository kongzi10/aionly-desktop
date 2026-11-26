import { loggerService } from '@logger'
import { type ExperienceModelRow, getChangeModelListApi } from '@renderer/api/experience'
import { useCallback, useEffect, useRef, useState } from 'react'

import { type ModelQuota, resolveFreeQuota } from './useModelQuota'

const logger = loggerService.withContext('useExperienceModels')

/** 免费体验模型行：接口原始行 + 归一化后的额度（无额度配置时为 undefined） */
export interface ExperienceModelItem extends ExperienceModelRow {
  quota?: ModelQuota
}

interface UseExperienceModelsOptions {
  /** 是否启用（关闭时不发请求，如特性开关回滚） */
  enabled?: boolean
  /** 模型属性过滤：text_model / image_generation 等，与弹窗场景一致 */
  modelAttribute?: string
  /** 模型类型：1文本（默认） */
  modelType?: string
}

interface UseExperienceModelsReturn {
  /** 已去重（baseId/id + serviceName）并附带 quota 的免费体验模型 */
  models: ExperienceModelItem[]
  loading: boolean
  /** 请求失败标记（用于错误态 + 重试） */
  error: boolean
  /** 手动刷新（开通成功 / 错误重试后调用） */
  refetch: () => void
}

/**
 * 免费体验模型列表（selectType=office），与网站端体验中心同源接口。
 * 弹窗打开时拉取一次；搜索过滤由弹窗前端完成（与按量付费页签口径一致）。
 */
export function useExperienceModels({
  enabled = true,
  modelAttribute,
  modelType
}: UseExperienceModelsOptions = {}): UseExperienceModelsReturn {
  const [models, setModels] = useState<ExperienceModelItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const fetchIdRef = useRef(0)

  const fetchModels = useCallback(async () => {
    const fetchId = ++fetchIdRef.current
    setLoading(true)
    setError(false)
    try {
      const res: any = await getChangeModelListApi({
        selectType: 'office',
        ...(modelAttribute ? { modelAttribute } : {}),
        ...(modelType ? { type: modelType } : {})
      })
      if (fetchId !== fetchIdRef.current) return
      if (res?.code === 200 && Array.isArray(res.rows)) {
        // 去重：同一 (baseId/id, serviceName) 只保留第一条，与按量付费列表口径一致
        const seen = new Set<string>()
        const rows: ExperienceModelItem[] = []
        for (const row of res.rows as ExperienceModelRow[]) {
          const k = `${row.baseId ?? row.id}-${row.serviceName ?? ''}`
          if (seen.has(k)) continue
          seen.add(k)
          rows.push({ ...row, quota: resolveFreeQuota(row) })
        }
        setModels(rows)
      } else {
        logger.warn('免费体验模型接口返回异常', res)
        setModels([])
        setError(true)
      }
    } catch (e) {
      if (fetchId !== fetchIdRef.current) return
      logger.error('获取免费体验模型失败', e as Error)
      setModels([])
      setError(true)
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false)
      }
    }
  }, [modelAttribute, modelType])

  useEffect(() => {
    if (enabled) {
      void fetchModels()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return { models, loading, error, refetch: fetchModels }
}
