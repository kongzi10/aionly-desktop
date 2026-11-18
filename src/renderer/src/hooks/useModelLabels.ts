import { listModelLabelsApi } from '@renderer/api/openManagement'
import { FEATURE_MODEL_LABEL_TAGS } from '@renderer/config/featureFlags'
import { useCallback, useEffect, useState } from 'react'

export interface ModelLabelItem {
  /** 标签ID（字典键；透传值为名称时与 name 相同） */
  id: string
  /** 标签展示名称 */
  name: string
}

/**
 * 字典 labelId → 标签名称（前端静态兜底，远端字典未返回/请求失败时使用）。
 * 列表接口透传字段 recommendLabel/modelLabel 携带 labelId（支持逗号分隔字符串或数组）；
 * 若透传值已是名称（非纯数字且不在字典中）则直接作为标签名展示。
 */
const STATIC_MODEL_LABEL_DICT: Record<string, string> = {
  '1': '人气模型',
  '2': '最新推荐'
}

/** 远端字典（ai_model_label 有效标签）本地缓存有效期（ms）；字典为运营配置，低频变更 */
const DICT_CACHE_TTL = 300_000

let remoteDict: Record<string, string> | null = null
let remoteDictFetchedAt = 0
let remoteDictVersion = 0
let inflight: Promise<void> | null = null

/**
 * 拉取远端标签字典（/ai/modelLabel/getList），构建 labelId → labelName 映射。
 * 失败静默降级：继续使用旧缓存或静态兜底字典，不阻塞模型列表渲染。
 */
async function loadModelLabelDict(): Promise<void> {
  if (!FEATURE_MODEL_LABEL_TAGS) return
  if (remoteDict && Date.now() - remoteDictFetchedAt < DICT_CACHE_TTL) return
  if (!inflight) {
    inflight = (async () => {
      try {
        const res: any = await listModelLabelsApi()
        if (res?.code === 200 && Array.isArray(res.data)) {
          const next: Record<string, string> = {}
          for (const row of res.data) {
            const id = row?.labelId != null ? String(row.labelId) : ''
            const name = typeof row?.labelName === 'string' ? row.labelName.trim() : ''
            if (id && name) next[id] = name
          }
          remoteDict = next
          remoteDictFetchedAt = Date.now()
          remoteDictVersion += 1
        }
      } catch {
        // 静默降级：沿用缓存/静态兜底字典
      } finally {
        inflight = null
      }
    })()
  }
  return inflight
}

/** 失效远端字典缓存，使下次 hook 挂载重新拉取（字典变更/测试重置用） */
export function invalidateModelLabelDictCache() {
  remoteDict = null
  remoteDictFetchedAt = 0
  inflight = null
}

/** 当前生效字典：远端字典优先，静态字典兜底；同 ID 冲突以远端为准 */
function effectiveDict(): Record<string, string> {
  return remoteDict ? { ...STATIC_MODEL_LABEL_DICT, ...remoteDict } : STATIC_MODEL_LABEL_DICT
}

/** 将透传值（字符串/数字/数组）拆分为标签 token 列表 */
function parseLabelTokens(value: unknown): string[] {
  if (value == null || value === '') return []
  const rawList = Array.isArray(value) ? value : [value]
  const tokens: string[] = []
  for (const raw of rawList) {
    if (raw == null) continue
    for (const token of String(raw).split(/[,，;；、]+/)) {
      const trimmed = token.trim()
      if (trimmed) tokens.push(trimmed)
    }
  }
  return tokens
}

/** token → 标签项；未知纯数字ID（字典缺失）不展示，避免直接露出ID */
function toLabelItem(token: string, dict: Record<string, string>): ModelLabelItem | null {
  const dictName = dict[token]
  if (dictName) return { id: token, name: dictName }
  if (/^\d+$/.test(token)) return null
  return { id: token, name: token }
}

/** 解析模型透传的推荐标签（recommendLabel/modelLabel），去重后返回标签项列表；dict 缺省取当前生效字典 */
export function getModelLabelItems(model: unknown, dict: Record<string, string> = effectiveDict()): ModelLabelItem[] {
  if (!FEATURE_MODEL_LABEL_TAGS) return []
  const m = model as Record<string, unknown> | null | undefined
  if (!m || typeof m !== 'object') return []
  const tokens = [...parseLabelTokens(m.recommendLabel), ...parseLabelTokens(m.modelLabel)]
  const seen = new Set<string>()
  const items: ModelLabelItem[] = []
  for (const token of tokens) {
    const item = toLabelItem(token, dict)
    if (!item || seen.has(item.name)) continue
    seen.add(item.name)
    items.push(item)
  }
  return items
}

/**
 * 推荐标签（人气模型/最新推荐/旗舰模型/已弃用等）hook：返回 getLabelItems(model)，
 * 取该模型透传字段 recommendLabel/modelLabel 对应的标签项列表（无则空数组）。
 * 挂载时触发远端标签字典拉取；字典就绪/更新后 getLabelItems 引用变化，宿主组件自动重渲染。
 */
export function useModelLabels() {
  const [dict, setDict] = useState<Record<string, string>>(effectiveDict)

  useEffect(() => {
    let alive = true
    const versionBefore = remoteDictVersion
    void loadModelLabelDict().then(() => {
      if (alive && remoteDictVersion !== versionBefore) setDict(effectiveDict())
    })
    return () => {
      alive = false
    }
  }, [])

  const getLabelItems = useCallback((model: unknown): ModelLabelItem[] => getModelLabelItems(model, dict), [dict])
  return { getLabelItems }
}
