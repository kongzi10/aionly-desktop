import { loggerService } from '@logger'
import { listUnopenedPayLaterModelsApi } from '@renderer/api/openManagement'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const logger = loggerService.withContext('useNewShelfModelPush')

/** 头像浮窗新模型名额：最新上架的前 3 个模型构成固定窗口（开通完即不再显示新模型条目）；运营推送另占 2 个名额（见 UserAvatar 的 OPERATION_PUSH_MAX），合并轮播总量 ≤5 */
export const NEW_MODEL_PUSH_MAX = 3

/** 可开通的模型属性范围（文本/图片模型）；其余属性（语音等）不推送，不进入候选池 */
const ACTIVATABLE_ATTRIBUTES = new Set(['text_model', 'image_generation'])

/** 新上架模型条目：与运营推送（HomePushItem）区分，按钮动作 = 确认框直连开通对应模型 */
export type NewModelPushItem = {
  kind: 'new_model'
  id: string
  modelId: string
  title: string
  description: string
  buttonText: string
}

/**
 * /ai/model/listUnopenedPayLaterModels（UnopenedPayLaterModelVo）中客户端消费的字段。
 * createTime 即上架时间（≈ai_model.create_time，上架即创建的运营口径），
 * 后端未发布透传改动时可能缺失，排序回退按 id 倒序（自增 id 越大越新）。
 */
export type UnopenedPayLaterModel = {
  id: string | number
  modelName?: string | null
  modelAttribute?: string | null
  omniModality?: string | null
  memberSpecial?: string | null
  serviceName?: string | null
  hasVipPermission?: boolean | null
  hasCallPermission?: boolean | null
  createTime?: string | number | null
}

/** 全模态/决策模型标识（omniModality：0大语言模型 1全模态 2决策模型）；添加模型弹窗与新上架推送屏蔽展示 */
export function isHiddenOmniOrDecisionModel(model: Pick<UnopenedPayLaterModel, 'omniModality'>): boolean {
  const omniModality = model?.omniModality
  if (omniModality === null || omniModality === undefined || omniModality === '') return false
  return String(omniModality) === '1' || String(omniModality) === '2'
}

/** 候选池过滤：属性可开通 + 非全模态/决策模型 + 有调用权限 +（非 VIP 专享 或 有 VIP 权限），与 AddModelPopup 的置灰规则保持一致 */
export function isActivatableModel(model: UnopenedPayLaterModel): boolean {
  if (!model || model.id === null || model.id === undefined || model.id === '') return false
  if (!model.modelName) return false
  if (!model.modelAttribute || !ACTIVATABLE_ATTRIBUTES.has(model.modelAttribute)) return false
  if (isHiddenOmniOrDecisionModel(model)) return false
  if (model.hasCallPermission === false) return false
  if (model.memberSpecial === '1' && model.hasVipPermission === false) return false
  return true
}

/** 兼容时间戳数字、数字字符串与日期字符串（后端 Date 序列化格式可能为任一形态） */
function toTimestamp(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const text = String(value).trim()
  if (!text) return null
  if (/^\d+$/.test(text)) return Number(text)
  const time = new Date(text).getTime()
  return Number.isNaN(time) ? null : time
}

/** 按上架时间倒序（最新在前）；createTime 缺失的条目排在最后，并以 id 倒序兜底 */
export function sortModelsByShelfDesc(models: UnopenedPayLaterModel[]): UnopenedPayLaterModel[] {
  return [...models].sort((a, b) => {
    const ta = toTimestamp(a.createTime)
    const tb = toTimestamp(b.createTime)
    if (ta !== null && tb !== null && ta !== tb) return tb - ta
    if (ta !== null && tb === null) return -1
    if (ta === null && tb !== null) return 1
    const ia = Number(a.id)
    const ib = Number(b.id)
    if (Number.isFinite(ia) && Number.isFinite(ib) && ia !== ib) return ib - ia
    return String(b.id).localeCompare(String(a.id))
  })
}

/**
 * 头像浮窗新上架模型推送（见 docs/头像浮窗新上架模型开通提示需求开发文档.md）。
 *
 * 候选池 = 已上架且当前用户未开通先用后付的文本/图片模型，按上架时间倒序
 * 取前 NEW_MODEL_PUSH_MAX 个（最新 3 个模型）作为固定窗口集；
 * 与运营 avatar_overlay 推送合并轮播：新模型条目优先占位，运营推送补足剩余名额（总量 ≤3）；
 * 任一入口开通成功（MODEL_PAY_LATER_ACTIVATED 事件 / removeActivated）后本地移除，
 * 第 4 名及以后不补位 — 最新 3 个模型全部开通后不再显示新模型条目；
 * 有运营推送则展示运营内容，没有则浮窗关闭。
 */
export function useNewShelfModelPush(enabled: boolean) {
  const { t } = useTranslation()
  const [pool, setPool] = useState<UnopenedPayLaterModel[]>([])
  // 首次拉取是否已完成（成功或失败均算）：合并轮播时等双方列表就绪再一次性展示，避免条目跳变
  const [loaded, setLoaded] = useState(false)
  // 拉取在途期间 enabled 可能翻转为 false（如用户手动关闭浮窗），用 ref 做竞态防御
  const enabledRef = useRef(enabled)
  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  const refresh = useCallback(async () => {
    try {
      const res = (await listUnopenedPayLaterModelsApi()) as { data?: unknown } | null
      const data = Array.isArray(res?.data) ? (res.data as UnopenedPayLaterModel[]) : []
      // 固定窗口：只取最新上架的前 3 个模型，3 个开通完不再推送（第 4 名不补位）
      const models = sortModelsByShelfDesc(data.filter(isActivatableModel)).slice(0, NEW_MODEL_PUSH_MAX)
      if (!enabledRef.current) return
      setPool(models)
      logger.info(`New shelf model pool refreshed, size: ${models.length}`)
    } catch (error) {
      // 静默降级：接口异常（含未登录/token 失效）不影响运营推送与其余 UI
      logger.warn('Failed to load unopened pay-later models for avatar overlay', error as Error)
      setPool([])
    } finally {
      setLoaded(true)
    }
  }, [])

  /** 本地移除已开通模型（窗口仅含最新 3 个，开通完条目即为空，第 4 名不补位）；重复调用幂等 */
  const removeActivated = useCallback((modelIds: (string | number)[]) => {
    const ids = new Set(modelIds.map(String))
    if (ids.size === 0) return
    setPool((prev) => prev.filter((model) => !ids.has(String(model.id))))
  }, [])

  // 启用时拉取候选池；禁用（开关关闭/手动关闭浮窗）时清空，避免残留展示
  useEffect(() => {
    if (!enabled) {
      setPool((prev) => (prev.length > 0 ? [] : prev))
      setLoaded(false)
      return
    }
    void refresh()
  }, [enabled, refresh])

  // 任一入口（设置页、首页公告条、本浮窗等）开通成功后，实时移除窗口内对应条目
  useEffect(() => {
    if (!enabled) return
    const unsubscribe = EventEmitter.on(
      EVENT_NAMES.MODEL_PAY_LATER_ACTIVATED,
      (event: { modelIds?: (string | number)[] }) => {
        removeActivated(Array.isArray(event?.modelIds) ? event.modelIds : [])
      }
    )
    return () => unsubscribe()
  }, [enabled, removeActivated])

  const items = useMemo<NewModelPushItem[]>(
    () =>
      pool.slice(0, NEW_MODEL_PUSH_MAX).map((model) => ({
        kind: 'new_model',
        id: `new-model-${model.id}`,
        modelId: String(model.id),
        title: t('homeLanding.newModelPushTitle', { name: model.modelName }),
        description: model.serviceName
          ? t('homeLanding.newModelPushDesc', { service: model.serviceName })
          : t('homeLanding.newModelPushDescGeneric'),
        buttonText: t('homeLanding.announcementActivate')
      })),
    [pool, t]
  )

  return { items, poolSize: pool.length, loaded, removeActivated, refresh }
}
