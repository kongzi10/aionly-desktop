import type { RootState } from '@renderer/store'
import type { Assistant, Model } from '@renderer/types'

/**
 * 群聊可绑定角色列表（workspace='roundtable' 的 Assistant）。
 * 注意：store/assistants.ts 处于「Feature PR BLOCKED」状态，故选择器放在本模块；
 * 手写按输入引用的 memo，避免 useAppSelector 每次返回新数组引发无谓重渲染。
 */
let lastAssistantsInput: Assistant[] | undefined
let lastRoundtableRoles: Assistant[] = []
export const selectRoundtableRoleAssistants = (state: RootState): Assistant[] => {
  const assistants = (state.assistants?.assistants ?? []) as Assistant[]
  if (assistants !== lastAssistantsInput) {
    lastAssistantsInput = assistants
    lastRoundtableRoles = assistants.filter((assistant) => assistant?.workspace === 'roundtable')
  }
  return lastRoundtableRoles
}

/** 按 id 查角色名（查不到返回 undefined，调用方回退「默认角色」文案） */
export const selectRoundtableRoleNameById = (state: RootState, assistantId?: string): string | undefined => {
  if (!assistantId) {
    return undefined
  }
  const found = ((state.assistants?.assistants ?? []) as Assistant[]).find((assistant) => assistant?.id === assistantId)
  return found?.name
}

/**
 * 解析成员绑定的角色助理（纯函数，供发送/重发/重新生成三链路复用）。
 * 回退规则（PRD）：
 * - assistantId 缺省（旧数据 / 默认角色）→ 返回话题助理 fallback
 * - assistantId 等于话题助理自身 → 返回 fallback
 * - 角色已被删除（store 查不到）→ 返回 fallback
 */
export function resolveRoundtableRoleAssistant(
  state: Pick<RootState, 'assistants'>,
  assistantId: string | undefined,
  fallback: Assistant
): Assistant {
  if (!assistantId || assistantId === fallback.id) {
    return fallback
  }
  const found = state.assistants.assistants.find((assistant) => assistant.id === assistantId)
  return found ?? fallback
}

/**
 * 将角色配置合并到话题助理配置上：
 * - 角色的人设字段（prompt / settings / knowledge_bases / mcpServers / enableWebSearch 等）覆盖话题默认
 * - topics 保留话题助理的（topic prompt 拼接与话题归属仍按原话题助理解析）
 * - model 以成员绑定模型为准
 * role === base 时仅覆盖 model，避免无谓的对象展开差异。
 */
export function applyRoleToAssistant(base: Assistant, role: Assistant, model?: Model): Assistant {
  if (role === base) {
    return model ? { ...base, model } : base
  }
  return { ...base, ...role, topics: base.topics, model: model ?? role.model ?? base.model }
}
