import { getModelUniqId } from '@renderer/services/ModelService'
import type { Model, RoundtableMention } from '@renderer/types'

/**
 * 群聊「模型 × 角色」绑定的内存暂存（配合 roundtableFeatureFlag 的开关使用）。
 * 输入栏状态（mentionedModels）仅保存 Model[]，角色绑定暂存在此：
 * - 双栏弹窗确认后写入完整 RoundtableMention[]
 * - 发送时按当前 mentionedModels 逐模型查绑定，拼成 message.mentions 写出
 * - chip 删除后对应模型不再出现在 mentionedModels 中，发送时自然不携带，无脏数据
 * 仅内存态（重启恢复为空）；读取侧始终以 normalizeRoundtableMentions 兼容两种格式。
 */
let pendingRoundtableMentions: RoundtableMention[] = []

/**
 * 角色绑定回退源：暂存仅内存态，重启后为空，而 mentionedModels 会从草稿缓存恢复，
 * 导致输入框 chip 丢失角色名。由 Inputbar 注册「当前话题最近一条用户消息的 mentions」
 * 作为回退源，恢复历史绑定（pending 中已有该模型的记录时以 pending 为准）。
 */
let mentionFallbackProvider: (() => RoundtableMention[]) | null = null

export const setPendingRoundtableMentions = (mentions: RoundtableMention[]): void => {
  pendingRoundtableMentions = mentions
}

export const getPendingRoundtableMentions = (): RoundtableMention[] => pendingRoundtableMentions

export const setRoundtableMentionFallback = (provider: (() => RoundtableMention[]) | null): void => {
  mentionFallbackProvider = provider
}

/** 按模型 uniqId 查找暂存的角色绑定（未绑定返回 undefined） */
export const findPendingRoundtableMention = (model: Model): RoundtableMention | undefined => {
  const uniqId = getModelUniqId(model)
  const pending = pendingRoundtableMentions.find((mention) => getModelUniqId(mention.model) === uniqId)
  if (pending) return pending
  return mentionFallbackProvider?.().find((mention) => getModelUniqId(mention.model) === uniqId)
}

/**
 * 更新单个模型的角色绑定（assistantId 为 undefined 表示恢复默认角色）。
 * 供输入栏成员 chip 的角色切换器使用：pending 中无该模型记录时新建一条
 * （如绑定来自历史回退源），有则覆盖，pending 优先级始终高于回退源。
 */
export const updatePendingRoundtableMentionRole = (model: Model, assistantId: string | undefined): void => {
  const uniqId = getModelUniqId(model)
  const exists = pendingRoundtableMentions.some((mention) => getModelUniqId(mention.model) === uniqId)
  pendingRoundtableMentions = exists
    ? pendingRoundtableMentions.map((mention) =>
        getModelUniqId(mention.model) === uniqId ? { ...mention, assistantId } : mention
      )
    : [...pendingRoundtableMentions, { model, assistantId }]
}
