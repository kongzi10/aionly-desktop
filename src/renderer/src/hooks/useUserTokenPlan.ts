import { loggerService } from '@logger'
import { ENABLED_PLAN_STORAGE_KEY } from '@shared/config/constant'

export function readUserEnabledPlan(userId: string, storage: Storage = localStorage) {
  try {
    const raw = storage.getItem(`${ENABLED_PLAN_STORAGE_KEY}_${userId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const useUserTokenPlan = (userId: string) => {
  const KEY = `${ENABLED_PLAN_STORAGE_KEY}_${userId}`

  const logger = loggerService.withContext('TokenPlanCache')

  const getUserEnabledPlan = () => {
    return readUserEnabledPlan(userId)
  }

  const setUserEnabledPlan = (plan: any) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(plan))
    } catch {
      logger.error('Failed to store enabled plan')
    }
  }

  const clearUserEnabledPlan = () => {
    try {
      localStorage.removeItem(KEY)
    } catch {
      logger.error('Failed to clear enabled plan')
    }
  }

  return {
    KEY,
    getUserEnabledPlan,
    setUserEnabledPlan,
    clearUserEnabledPlan
  }
}

export default useUserTokenPlan
