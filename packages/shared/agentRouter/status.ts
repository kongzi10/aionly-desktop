import type { AgentRouteDetailStatus, AgentRouteDisplayStatus } from './types'

export const toDisplayStatus = (status: AgentRouteDetailStatus): AgentRouteDisplayStatus => {
  if (status === 'synced') {
    return 'effective'
  }

  if (status === 'pendingAdd' || status === 'pendingUpdate' || status === 'pendingRemove') {
    return 'pending'
  }

  return 'actionRequired'
}
