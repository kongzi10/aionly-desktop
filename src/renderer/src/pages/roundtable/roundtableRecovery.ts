import { loggerService } from '@logger'
import { getDefaultTopic } from '@renderer/services/AssistantService'
import type { Assistant, Topic } from '@renderer/types'

const logger = loggerService.withContext('RoundtableRecovery')

/**
 * 群聊存量话题归位（一次性恢复）。
 *
 * 背景：历史版本中，切换身份/重启后群聊页兜底选中 workspaceAssistants[0]（最新创建的角色），
 * 用户在此期间「新建对话」产生的话题被误挂到角色 assistant 下；修复选取逻辑后，
 * 需要把这些话题搬回会话载体，否则它们会反过来"消失"。
 *
 * 安全性：
 * - 只移动「真实使用过」的话题（有消息 / 手动改过名 / 固定 / 设置过 prompt），不删除任何数据；
 * - 消息按 topicId 存于 IndexedDB（topics 表主键即 topicId，无 assistantId 索引），
 *   在 redux 中移动话题归属不影响消息读取；
 * - 纯函数计算补丁，由调用方 dispatch，天然幂等（配合 settings.roundtableTopicRecoveryDone 每身份仅执行一次）。
 */

export interface RoundtableTopicRecoveryPatch {
  assistantId: string
  topics: Topic[]
}

export interface RoundtableTopicRecoveryResult {
  patches: RoundtableTopicRecoveryPatch[]
  movedCount: number
}

/** 判定话题是否被真实使用过（区别于创建角色时自带的初始默认话题） */
export function isUsedTopic(topic: Topic): boolean {
  return (
    (topic.messages?.length ?? 0) > 0 ||
    Boolean(topic.isNameManuallyEdited) ||
    Boolean(topic.pinned) ||
    Boolean(topic.prompt)
  )
}

/**
 * 计算归位补丁：把 others（角色 assistant）中"用过"的话题移入 carrier。
 * - 被掏空的角色重置为 [getDefaultTopic(role.id)]，保留剩余空话题；
 * - 有移动时返回 carrier 补丁（原 topics + 移入 topics，assistantId 重写为 carrier.id）。
 */
export function computeRoundtableTopicRecovery(carrier: Assistant, others: Assistant[]): RoundtableTopicRecoveryResult {
  const movedTopics: Topic[] = []
  const patches: RoundtableTopicRecoveryPatch[] = []

  for (const role of others) {
    const keep: Topic[] = []
    let changed = false
    for (const topic of role.topics ?? []) {
      if (isUsedTopic(topic)) {
        movedTopics.push({ ...topic, assistantId: carrier.id })
        changed = true
      } else {
        keep.push(topic)
      }
    }
    if (changed) {
      patches.push({ assistantId: role.id, topics: keep.length > 0 ? keep : [getDefaultTopic(role.id)] })
    }
  }

  if (movedTopics.length > 0) {
    patches.unshift({ assistantId: carrier.id, topics: [...(carrier.topics ?? []), ...movedTopics] })
  }

  return { patches, movedCount: movedTopics.length }
}

/** 供组件内调用的日志包装：记录恢复规模，便于线上核查 */
export function logRoundtableTopicRecovery(carrier: Assistant, result: RoundtableTopicRecoveryResult): void {
  if (result.movedCount === 0) {
    logger.info('no topics to recover', { carrierId: carrier.id })
    return
  }
  logger.info(`moved ${result.movedCount} topic(s) back to carrier`, {
    carrierId: carrier.id,
    patchedAssistants: result.patches.map((patch) => patch.assistantId)
  })
}
