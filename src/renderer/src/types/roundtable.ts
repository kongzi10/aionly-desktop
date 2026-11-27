import type { Model } from './index'

/**
 * 群聊（roundtable）成员提及项：模型 + 独立绑定的角色（可选）。
 * assistantId 指向被引用的角色（workspace='roundtable' 的 Assistant）；
 * 缺省（undefined）表示跟随话题默认角色（沿用现状行为）。
 */
export interface RoundtableMention {
  model: Model
  assistantId?: string
}

/**
 * 消息 mentions 字段条目：兼容旧格式（裸 Model，历史数据 / chat 多模型回复）
 * 与新格式（RoundtableMention，群聊成员化改造）。
 */
export type MentionItem = Model | RoundtableMention

/**
 * 判断是否为「成员化」提及项。裸 Model 的 model 字段为字符串（aionly 原始字段）或缺失；
 * RoundtableMention.model 必须是含 id 的对象。
 */
export function isRoundtableMention(item: unknown): item is RoundtableMention {
  if (typeof item !== 'object' || item === null) {
    return false
  }
  const candidate = item as Partial<RoundtableMention>
  const model = candidate.model
  return typeof model === 'object' && model !== null && typeof model.id === 'string' && !!model.id
}

/** 判断是否为合法的 mentions 条目（新格式或旧格式裸 Model） */
export function isMentionItem(value: unknown): value is MentionItem {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  if (isRoundtableMention(value)) {
    return true
  }
  const candidate = value as Partial<Model>
  return typeof candidate.id === 'string' && !!candidate.id && typeof candidate.name === 'string'
}

/** 从提及项中取出模型（新旧格式统一） */
export function getMentionModel(item: MentionItem): Model {
  return isRoundtableMention(item) ? item.model : item
}

/** 从提及项中取出绑定的角色 id（旧格式恒为 undefined） */
export function getMentionAssistantId(item: MentionItem): string | undefined {
  return isRoundtableMention(item) ? item.assistantId : undefined
}

/**
 * 归一化 mentions 为 RoundtableMention[]：
 * - 裸 Model → { model }（assistantId 缺省 = 默认角色）
 * - 过滤非法项与缺 id/name 的模型
 * - 按 provider:id 去重（与 getModelUniqId 口径一致），保留首次出现顺序
 */
export function normalizeRoundtableMentions(items?: MentionItem[] | null): RoundtableMention[] {
  if (!Array.isArray(items)) {
    return []
  }
  const result: RoundtableMention[] = []
  const seen = new Set<string>()
  for (const item of items) {
    if (!isMentionItem(item)) {
      continue
    }
    const model = getMentionModel(item)
    if (!model?.id || !model?.name) {
      continue
    }
    const uniqKey = `${model.provider}:${model.id}`
    if (seen.has(uniqKey)) {
      continue
    }
    seen.add(uniqKey)
    const assistantId = getMentionAssistantId(item)
    result.push(assistantId ? { model, assistantId } : { model })
  }
  return result
}
