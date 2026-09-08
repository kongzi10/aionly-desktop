import type { Assistant, AssistantWorkspace } from '@renderer/types'

export function getAssistantWorkspace(assistant: Assistant): AssistantWorkspace {
  return assistant.workspace ?? 'chat'
}

export function filterAssistantsByWorkspace(assistants: Assistant[], workspace: AssistantWorkspace): Assistant[] {
  return assistants.filter((assistant) => getAssistantWorkspace(assistant) === workspace)
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
