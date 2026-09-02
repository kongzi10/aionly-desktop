import type { AgentRouterTargetId } from '@shared/agentRouter'

import { WorkBuddyDetector } from './adapters/WorkBuddyDetector'
import type { TargetDetector } from './TargetAdapter'

const detectors: TargetDetector[] = [new WorkBuddyDetector()]

export const listTargetDetectors = (): TargetDetector[] => detectors

export const getTargetDetector = (targetId: AgentRouterTargetId): TargetDetector => {
  const detector = detectors.find((candidate) => candidate.targetId === targetId)
  if (!detector) throw new Error(`No detector registered for target: ${targetId}`)
  return detector
}
