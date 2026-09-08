import type { Model } from '@renderer/types'

export const canSendRoundtableMessage = (models: Model[]): boolean => models.length >= 2
