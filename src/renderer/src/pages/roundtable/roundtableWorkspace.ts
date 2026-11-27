import type { Assistant, AssistantWorkspace } from '@renderer/types'

export function getAssistantWorkspace(assistant: Assistant): AssistantWorkspace {
  return assistant.workspace ?? 'chat'
}

export function filterAssistantsByWorkspace(assistants: Assistant[], workspace: AssistantWorkspace): Assistant[] {
  return assistants.filter((assistant) => getAssistantWorkspace(assistant) === workspace)
}

/**
 * 选取群聊「会话载体」assistant（对话列表 topics 的持有者）。
 *
 * 背景：角色与会话载体共用 workspace='roundtable' 桶，且 addAssistant 为头插（unshift），
 * 数组第 0 位是「最新创建的角色」而非会话载体；切换身份触发组件重挂载后，
 * 若按 workspaceAssistants[0] 兜底会选中角色，导致对话列表"消失"。
 *
 * 规则：
 * 1. 持久化 id（settings.roundtableAssistantId，按身份存储）命中 → 直接返回；
 * 2. 否则取「最旧」者（数组末位）：会话载体一定先于角色创建（首次进入群聊页时生成），
 *    头插语义下恒位于过滤后数组的末位；
 * 3. 空数组返回 undefined，由调用方走新建默认载体逻辑。
 */
export function pickRoundtableCarrier(workspaceAssistants: Assistant[], persistedId?: string): Assistant | undefined {
  if (workspaceAssistants.length === 0) {
    return undefined
  }
  if (persistedId) {
    const persisted = workspaceAssistants.find((assistant) => assistant.id === persistedId)
    if (persisted) {
      return persisted
    }
  }
  return workspaceAssistants[workspaceAssistants.length - 1]
}

export function replaceWorkspaceAssistants(
  assistants: Assistant[],
  workspaceAssistants: Assistant[],
  workspace: AssistantWorkspace
): Assistant[] {
  let index = 0

  return assistants.map((assistant) => {
    if (getAssistantWorkspace(assistant) !== workspace) return assistant
    return workspaceAssistants[index++] ?? assistant
  })
}
