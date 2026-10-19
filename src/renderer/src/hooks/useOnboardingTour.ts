import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import { getActiveProfileId, profileStorage } from '@renderer/services/ProfileStorageService'
import { useCallback, useEffect, useRef, useState } from 'react'

export const ONBOARDING_TOUR_COMPLETED_KEY = 'onboarding-tour-completed'

/** 登录后进入主页时，延迟启动引导，等待首屏关键元素渲染完成 */
const TOUR_LAUNCH_DELAY = 900

export function isOnboardingTourCompleted(): boolean {
  return profileStorage.getItem(ONBOARDING_TOUR_COMPLETED_KEY) === 'true'
}

function markOnboardingTourCompleted(): void {
  if (!getActiveProfileId()) {
    return
  }
  profileStorage.setItem(ONBOARDING_TOUR_COMPLETED_KEY, 'true')
}

/** 设置页等未挂载 Tour 的页面发起的待处理请求（主页挂载后消费） */
let pendingTourRequest = false

/** 供设置页「重新查看新手指引」调用：置位待处理标记并广播事件 */
export function requestOnboardingTour(): void {
  pendingTourRequest = true
  void EventEmitter.emit(EVENT_NAMES.START_ONBOARDING_TOUR)
}

export function useOnboardingTour() {
  const [tourOpen, setTourOpen] = useState(false)
  const [tourPending, setTourPending] = useState(() => Boolean(getActiveProfileId() && !isOnboardingTourCompleted()))
  const launchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const launchTourNow = useCallback(() => {
    if (launchTimerRef.current) {
      clearTimeout(launchTimerRef.current)
      launchTimerRef.current = null
    }
    setTourPending(true)
    setTourOpen(true)
  }, [])

  useEffect(() => {
    if (getActiveProfileId() && !isOnboardingTourCompleted()) {
      setTourPending(true)
      launchTimerRef.current = setTimeout(() => setTourOpen(true), TOUR_LAUNCH_DELAY)
    }

    // 消费挂载前收到的「重新查看指引」请求（如从设置页发起）
    if (pendingTourRequest) {
      pendingTourRequest = false
      launchTourNow()
    }

    const unsubscribe = EventEmitter.on(EVENT_NAMES.START_ONBOARDING_TOUR, () => {
      pendingTourRequest = false
      launchTourNow()
    })

    return () => {
      if (launchTimerRef.current) {
        clearTimeout(launchTimerRef.current)
        launchTimerRef.current = null
      }
      unsubscribe()
    }
  }, [launchTourNow])

  const startTour = useCallback(() => {
    launchTourNow()
  }, [launchTourNow])

  const endTour = useCallback(() => {
    markOnboardingTourCompleted()
    setTourOpen(false)
    setTourPending(false)
  }, [])

  return { tourOpen, tourPending, startTour, endTour }
}
