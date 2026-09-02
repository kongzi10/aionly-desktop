import type { AgentRouteDetailStatus } from '@shared/agentRouter'
import { toDisplayStatus } from '@shared/agentRouter'

export const buildStatus = (detailStatus: AgentRouteDetailStatus) => ({
  detailStatus,
  displayStatus: toDisplayStatus(detailStatus),
  reason: detailStatus === 'synced' ? undefined : detailStatus
})
