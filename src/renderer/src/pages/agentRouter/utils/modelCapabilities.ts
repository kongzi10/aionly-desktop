import { isEmbeddingModel, isRerankModel } from '@renderer/config/models/embedding'
import { isReasoningModel } from '@renderer/config/models/reasoning'
import { isFunctionCallingModel } from '@renderer/config/models/tooluse'
import { isVisionModel } from '@renderer/config/models/vision'
import { isWebSearchModel } from '@renderer/config/models/websearch'
import type { Model } from '@renderer/types'
import type { AgentRouteModelType } from '@shared/agentRouter'

const modelTypeDetectors: ReadonlyArray<{
  type: AgentRouteModelType
  detects: (model: Model) => boolean
}> = [
  { type: 'vision', detects: isVisionModel },
  { type: 'web_search', detects: isWebSearchModel },
  { type: 'reasoning', detects: isReasoningModel },
  { type: 'function_calling', detects: isFunctionCallingModel },
  { type: 'rerank', detects: isRerankModel },
  { type: 'embedding', detects: isEmbeddingModel }
]

export const resolveAgentRouteModelTypes = (model: Model): AgentRouteModelType[] =>
  modelTypeDetectors
    .filter(({ type, detects }) => {
      const override = model.capabilities?.find((capability) => capability.type === type)?.isUserSelected
      return override ?? detects(model)
    })
    .map(({ type }) => type)
