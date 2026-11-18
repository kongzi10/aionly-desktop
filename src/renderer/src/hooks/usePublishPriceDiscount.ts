import { queryPublishPriceDiscountApi } from '@renderer/api/openManagement'
import type { PublishPriceDiscountActivity, PublishPriceDiscountMap } from '@renderer/types/publishDiscount'
import type { TFunction } from 'i18next'
import { useCallback, useEffect, useMemo, useState } from 'react'

/** 活动列表本地缓存有效期（ms），有效期内重复打开弹窗直接复用缓存 */
const CACHE_TTL = 60_000

let cache: { map: PublishPriceDiscountMap; fetchedAt: number } | null = null
let inflight: Promise<PublishPriceDiscountMap> | null = null

/**
 * 拉取当前登录用户生效的刊例价折扣活动（全量，活动 map 本身很小）。
 * 失败静默降级：返回空 map（或旧缓存），不阻塞模型列表主流程。
 */
async function loadActivities(): Promise<PublishPriceDiscountMap> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) return cache.map
  if (!inflight) {
    inflight = (async () => {
      try {
        const res: any = await queryPublishPriceDiscountApi()
        const map: PublishPriceDiscountMap = res?.code === 200 ? (res.data ?? {}) : {}
        cache = { map, fetchedAt: Date.now() }
        return map
      } catch {
        return cache?.map ?? {}
      } finally {
        inflight = null
      }
    })()
  }
  return inflight
}

/** 开通模型成功等动作后失效活动缓存，使下次获取拿到最新活动 */
export function invalidatePublishPriceDiscountCache() {
  cache = null
}

/** 活动是否处于可展示窗口（后端登录态接口已过滤，前端以 endTime 兜底） */
export function isActivityDisplayable(
  activity?: PublishPriceDiscountActivity | null
): activity is PublishPriceDiscountActivity {
  if (!activity) return false
  return new Date(activity.endTime).getTime() > Date.now()
}

/** 标签文案与官网同口径：discount=0 → 限时免费；否则 限时X折（50 → 限时5折） */
export function formatDiscountLabel(discount: number, t: TFunction): string {
  const d = Number(discount)
  if (!Number.isFinite(d)) return ''
  if (d === 0) return t('modelTag.limitedFree')
  return t('modelTag.limitedDiscount', { discount: d / 10, off: 100 - d })
}

/**
 * 限时折扣活动 hook：返回 getDiscount(model)，取该模型当前生效的活动（无则 null）。
 *
 * @param models 模型列表（任意含合并键的结构）
 * @param keyOf 提取合并键（ai_model.id）：ModelVo 取 id，UserModelPackageVo 取 modelId
 */
export function usePublishPriceDiscount<T>(models: T[], keyOf: (model: T) => unknown) {
  const [map, setMap] = useState<PublishPriceDiscountMap>(() => cache?.map ?? {})

  const idsKey = useMemo(
    () =>
      models
        .map((m) => String(keyOf(m) ?? ''))
        .filter(Boolean)
        .join(','),
    [models, keyOf]
  )

  useEffect(() => {
    let alive = true
    void loadActivities().then((next) => {
      if (alive) setMap(next)
    })
    return () => {
      alive = false
    }
  }, [idsKey])

  const getDiscount = useCallback(
    (model: T): PublishPriceDiscountActivity | null => {
      const key = String(keyOf(model) ?? '')
      if (!key) return null
      const activity = map[key]
      return isActivityDisplayable(activity) ? activity : null
    },
    [map, keyOf]
  )

  return { getDiscount }
}
