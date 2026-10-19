import { ACTIVE_PROFILE_STORAGE_KEY } from '@renderer/services/ProfileStorageService'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isOnboardingTourCompleted,
  ONBOARDING_TOUR_COMPLETED_KEY,
  requestOnboardingTour,
  useOnboardingTour
} from '../useOnboardingTour'

const PROFILE_ID = '0123456789abcdef0123456789abcdef'
const prefixedKey = `profile:${PROFILE_ID}:${ONBOARDING_TOUR_COMPLETED_KEY}`

const activateProfile = () => localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, PROFILE_ID)

describe('useOnboardingTour', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not launch the tour while no profile is active', () => {
    const { result } = renderHook(() => useOnboardingTour())

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current.tourOpen).toBe(false)
    expect(result.current.tourPending).toBe(false)
    expect(localStorage.getItem(prefixedKey)).toBeNull()
    expect(localStorage.getItem(ONBOARDING_TOUR_COMPLETED_KEY)).toBeNull()
  })

  it('persists the completion mark only after the tour ends', () => {
    activateProfile()

    const { result } = renderHook(() => useOnboardingTour())

    expect(result.current.tourPending).toBe(true)
    expect(isOnboardingTourCompleted()).toBe(false)

    act(() => {
      vi.advanceTimersByTime(900)
    })
    expect(result.current.tourOpen).toBe(true)
    expect(isOnboardingTourCompleted()).toBe(false)

    act(() => {
      result.current.endTour()
    })
    expect(result.current.tourPending).toBe(false)
    expect(isOnboardingTourCompleted()).toBe(true)
  })

  it('opens the tour after the launch delay', () => {
    activateProfile()

    const { result } = renderHook(() => useOnboardingTour())

    expect(result.current.tourOpen).toBe(false)
    expect(result.current.tourPending).toBe(true)

    act(() => {
      vi.advanceTimersByTime(899)
    })
    expect(result.current.tourOpen).toBe(false)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.tourOpen).toBe(true)
    expect(result.current.tourPending).toBe(true)
  })

  it('does not launch the tour when it is already completed', () => {
    activateProfile()
    localStorage.setItem(prefixedKey, 'true')

    const { result } = renderHook(() => useOnboardingTour())

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current.tourOpen).toBe(false)
    expect(result.current.tourPending).toBe(false)
    expect(localStorage.getItem(ONBOARDING_TOUR_COMPLETED_KEY)).toBeNull()
  })

  it('supports starting the tour on demand even when it is already completed', () => {
    activateProfile()
    localStorage.setItem(prefixedKey, 'true')

    const { result } = renderHook(() => useOnboardingTour())

    act(() => {
      result.current.startTour()
    })

    expect(result.current.tourOpen).toBe(true)
    expect(result.current.tourPending).toBe(true)
  })

  it('allows manually opening the guide while no profile is active', () => {
    const { result } = renderHook(() => useOnboardingTour())

    act(() => {
      result.current.startTour()
    })

    expect(result.current.tourOpen).toBe(true)
    expect(result.current.tourPending).toBe(true)
    expect(localStorage.getItem(ONBOARDING_TOUR_COMPLETED_KEY)).toBeNull()
  })

  it('keeps a request pending across an unmounted listener until the guide mounts', async () => {
    const first = renderHook(() => useOnboardingTour())
    first.unmount()

    await act(async () => {
      requestOnboardingTour()
    })

    const second = renderHook(() => useOnboardingTour())
    expect(second.result.current.tourOpen).toBe(true)
  })

  it('closes the tour via endTour', () => {
    activateProfile()

    const { result } = renderHook(() => useOnboardingTour())

    act(() => {
      result.current.startTour()
    })
    expect(result.current.tourOpen).toBe(true)

    act(() => {
      result.current.endTour()
    })
    expect(result.current.tourOpen).toBe(false)
    expect(result.current.tourPending).toBe(false)
  })

  it('does not update state after unmount when the launch timer fires', () => {
    activateProfile()

    const { unmount } = renderHook(() => useOnboardingTour())

    unmount()

    expect(() =>
      act(() => {
        vi.advanceTimersByTime(5000)
      })
    ).not.toThrow()
  })
})
