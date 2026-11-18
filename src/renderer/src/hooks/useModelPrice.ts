import { getOneByModelIdApi, queryModelChargeConfigListApi } from '@renderer/api/modelCharge'
import { useCallback, useRef, useState } from 'react'

/** 价格主数据缓存 TTL：5 分钟 */
const CACHE_TTL = 5 * 60 * 1000

interface CacheEntry {
  row: any
  fetchedAt: number
}

const rowCache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<any | null>>()

export interface UseModelPriceResult {
  status: 'idle' | 'loading' | 'ready'
  /** 价格主数据行（已合并模型基础字段），无数据为 null */
  row: any | null
  /** 是否来自 pagePcList 快照回退 */
  isSnapshot: boolean
  load: (force?: boolean) => Promise<void>
}

/**
 * 模型价格数据 hook：hover 懒加载 + 模块级缓存 + 快照秒开 + 三级回退链
 * 首帧同步渲染 pagePcList 快照（感知 0ms），后台静默拉取权威数据原地替换；
 * 按需请求对齐网站端搜索做法：queryList 下推 modelId 服务端等值过滤（单行返回）
 * → getOneByModelId → modelChargeConfigVo 快照 → null
 */
export function useModelPrice(model: any, moneyType: '1' | '2'): UseModelPriceResult {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready'>('idle')
  const [row, setRow] = useState<any | null>(null)
  const [isSnapshot, setIsSnapshot] = useState(false)
  const modelRef = useRef(model)
  modelRef.current = model

  const modelId = model?.modelId ?? model?.id

  const applyRow = useCallback((next: any | null, snapshot: boolean) => {
    setRow(next)
    setIsSnapshot(snapshot)
    setStatus('ready')
  }, [])

  const load = useCallback(
    async (force = false) => {
      const current = modelRef.current
      const id = current?.modelId ?? current?.id
      const base = {
        modelId: id,
        modelName: current?.modelName ?? current?.name,
        modelAttribute: current?.modelAttribute,
        serviceName: current?.serviceName
      }
      const snapshotRow = current?.modelChargeConfigVo ? { ...base, ...current.modelChargeConfigVo } : null

      if (!id) {
        applyRow(snapshotRow, true)
        return
      }
      const key = `${id}:${moneyType}`
      const hit = rowCache.get(key)
      if (!force && hit && Date.now() - hit.fetchedAt < CACHE_TTL) {
        applyRow({ ...base, ...hit.row }, false)
        return
      }

      // 快照秒开：有 pagePcList 快照时首帧同步就绪（浮窗即刻有内容，脚注标"快照"），
      // 随后后台静默拉权威数据原地替换；无快照才显示骨架屏
      if (snapshotRow) applyRow(snapshotRow, true)
      else setStatus('loading')
      let pending = inflight.get(key)
      if (!pending) {
        pending = (async () => {
          // 优先与控制台「模型价格」页同源 queryList：返回成形口径字段
          // （inputConfiguration 含输入/输出标识与单位、configurationList 缓存明细等）；
          // modelId 下推服务端等值过滤（同网站端搜索下推 modelName 的做法），只组装返回单行
          if (current?.modelAttribute) {
            try {
              const res: any = await queryModelChargeConfigListApi({
                modelAttribute: current.modelAttribute,
                modelId: id
              })
              const list: any[] = res?.code === 200 ? (res.data ?? []) : []
              const found = list.find((item) => String(item?.modelId) === String(id))
              if (found) return found
            } catch {
              /* 进入下一级回退 */
            }
          }
          try {
            const res: any = await getOneByModelIdApi(id)
            if (res?.code === 200 && res.data) return res.data
          } catch {
            /* 进入快照回退 */
          }
          return null
        })()
        inflight.set(key, pending)
        pending.finally(() => inflight.delete(key))
      }

      const remote = await pending
      if (remote) {
        rowCache.set(key, { row: remote, fetchedAt: Date.now() })
        applyRow({ ...base, ...remote }, false)
      } else if (!snapshotRow) {
        applyRow(null, true)
      }
    },
    [moneyType, applyRow]
  )

  // 无 modelId 且从未加载时，直接以快照就绪，避免浮窗永远 loading
  if (status === 'idle' && !modelId && model?.modelChargeConfigVo) {
    applyRow({ ...model.modelChargeConfigVo }, true)
  }

  return { status, row, isSnapshot, load }
}
