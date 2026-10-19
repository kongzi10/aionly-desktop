import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { TourStepProps } from 'antd'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AppOnboardingTour, { buildTourSteps, buildTourStepsWithRoutes } from '../AppOnboardingTour'

const tourState = { tourOpen: false, endTour: vi.fn() }

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

const setTourOpen = (open: boolean) => {
  tourState.tourOpen = open
}

const TOUR_TARGET_NAMES = [
  'nav-chat',
  'nav-roundtable',
  'nav-translate',
  'nav-minapp',
  'nav-tokenplan',
  'nav-agent-router',
  'add-assistant',
  'inputbar',
  'user-avatar'
]

const mountTourTargets = (names: string[] = TOUR_TARGET_NAMES) => {
  const elements = names.map((name) => {
    const el = document.createElement('div')
    el.setAttribute('data-tour', name)
    document.body.appendChild(el)
    return el
  })
  return elements
}

const FULL_STEP_TITLES = [
  'tour.welcome.title',
  'tour.module.chat.title',
  'tour.addAssistant.title',
  'tour.newTopic.title',
  'tour.input.title',
  'tour.module.roundtable.title',
  'tour.module.roundtableAddModel.title',
  'tour.module.roundtableInput.title',
  'tour.module.translate.title',
  'tour.module.translateInput.title',
  'tour.module.translateOutput.title',
  'tour.module.minapp.title',
  'tour.module.toolboxBuiltIn.title',
  'tour.module.toolboxExtensions.title',
  'tour.module.toolboxMiniApps.title',
  'tour.module.tokenplan.title',
  'tour.module.tokenplanContent.title',
  'tour.module.agentRouter.title',
  'tour.module.agentRouterContent.title',
  'tour.account.title',
  'tour.finish.title'
]

const resolveTarget = (step: TourStepProps) => (typeof step.target === 'function' ? step.target() : step.target)

const LocationRecorder = ({ onLocation }: { onLocation: (pathname: string) => void }) => {
  const location = useLocation()
  onLocation(location.pathname)
  return null
}

const RoundtableTarget = () => {
  const location = useLocation()
  return location.pathname === '/roundtable' ? <div data-tour="roundtable-add-model" /> : null
}

describe('buildTourSteps', () => {
  afterEach(cleanup)

  it('falls back to centered welcome and finish steps when no target element exists', () => {
    const steps = buildTourSteps((key: string) => key)

    expect(steps).toHaveLength(2)
    expect(resolveTarget(steps[0])).toBeNull()
    expect(steps[0].placement).toBe('center')
    expect(steps[0].title).toBe('tour.welcome.title')
    expect(resolveTarget(steps[1])).toBeNull()
    expect(steps[1].placement).toBe('center')
    expect(steps[1].title).toBe('tour.finish.title')
  })

  it('builds one step per sidebar module plus home and account steps in order', () => {
    const elements = mountTourTargets()

    const steps = buildTourSteps((key: string) => key)

    expect(steps.map((step) => step.title)).toEqual(FULL_STEP_TITLES)
    // 欢迎步与收尾步居中展示，不锚定任何元素
    expect(steps[0].placement).toBe('center')
    expect(resolveTarget(steps[0])).toBeNull()
    expect(steps[20].placement).toBe('center')
    expect(resolveTarget(steps[20])).toBeNull()
    // 侧栏模块步骤锚定对应菜单项
    expect(resolveTarget(steps[1])).toBe(elements[0])
    expect(resolveTarget(steps[5])).toBe(elements[1])
    expect(resolveTarget(steps[8])).toBe(elements[2])
    expect(resolveTarget(steps[11])).toBe(elements[3])
    expect(resolveTarget(steps[15])).toBe(elements[4])
    expect(resolveTarget(steps[17])).toBe(elements[5])

    elements.forEach((el) => el.remove())
  })

  it('drops steps whose target element is missing while preserving the order', () => {
    const elements = mountTourTargets(TOUR_TARGET_NAMES.filter((name) => name !== 'nav-tokenplan'))

    const steps = buildTourSteps((key: string) => key)

    expect(steps.map((step) => step.title)).toEqual(
      FULL_STEP_TITLES.filter((title) => !title.startsWith('tour.module.tokenplan'))
    )

    elements.forEach((el) => el.remove())
  })

  it('resolves a page content target after that page mounts', () => {
    const elements = mountTourTargets()
    const steps = buildTourSteps((key: string) => key)
    expect(resolveTarget(steps[6])).toBeNull()

    const content = document.createElement('div')
    content.setAttribute('data-tour', 'roundtable-add-model')
    document.body.appendChild(content)
    expect(resolveTarget(steps[6])).toBe(content)

    content.remove()
    elements.forEach((el) => el.remove())
  })

  it('targets each control and section in the requested module order', () => {
    const targets = [
      [2, 'add-assistant'],
      [3, 'new-topic'],
      [4, 'inputbar'],
      [6, 'roundtable-add-model'],
      [7, 'roundtable-inputbar'],
      [9, 'translate-input'],
      [10, 'translate-output'],
      [12, 'toolbox-built-in'],
      [13, 'toolbox-extensions'],
      [14, 'toolbox-mini-apps'],
      [16, 'tokenplan-content']
    ] as const
    const elements = mountTourTargets([...TOUR_TARGET_NAMES, ...targets.map(([, name]) => name)])
    const steps = buildTourSteps((key: string) => key)

    for (const [stepIndex, name] of targets) {
      expect(resolveTarget(steps[stepIndex])).toBe(document.querySelector(`[data-tour="${name}"]`))
    }

    elements.forEach((el) => el.remove())
  })

  it('positions large content steps within the window', () => {
    const elements = mountTourTargets()
    const steps = buildTourSteps((key: string) => key)

    expect(steps[9].placement).toBe('right')
    expect(steps[10].placement).toBe('left')
    expect(steps[16].className).toBe('app-onboarding-tour-tokenplan-content')

    elements.forEach((el) => el.remove())
  })
})

describe('buildTourStepsWithRoutes', () => {
  afterEach(cleanup)

  it('maps each sidebar module step to its route for page switching', () => {
    const elements = mountTourTargets()

    const { steps, routes } = buildTourStepsWithRoutes((key: string) => key)

    expect(steps).toHaveLength(FULL_STEP_TITLES.length)
    expect(routes).toEqual([
      undefined,
      '/',
      '/',
      '/',
      '/',
      '/roundtable',
      '/roundtable',
      '/roundtable',
      '/translate',
      '/translate',
      '/translate',
      '/apps',
      '/apps',
      '/apps',
      '/apps',
      '/tokenPlan',
      '/tokenPlan',
      '/agent-router',
      '/agent-router',
      undefined,
      undefined
    ])

    elements.forEach((el) => el.remove())
  })
})

describe('AppOnboardingTour', () => {
  beforeEach(() => {
    setTourOpen(false)
    tourState.endTour.mockClear()
  })

  afterEach(cleanup)

  it('renders nothing while the tour is closed', () => {
    render(
      <MemoryRouter>
        <AppOnboardingTour tourOpen={tourState.tourOpen} endTour={tourState.endTour} />
      </MemoryRouter>
    )

    expect(screen.queryByText('tour.welcome.title')).toBeNull()
    expect(screen.queryByText('tour.finish.title')).toBeNull()
  })

  it('shows the first step and closes on demand when opened', () => {
    mountTourTargets()
    setTourOpen(true)

    render(
      <MemoryRouter>
        <AppOnboardingTour tourOpen={tourState.tourOpen} endTour={tourState.endTour} />
      </MemoryRouter>
    )

    expect(screen.getByText('tour.welcome.title')).toBeInTheDocument()
    expect(document.querySelector('.ant-tour')).toHaveStyle({ width: '320px' })
    expect(screen.getByText('tour.skip (1/21)')).toBeInTheDocument()
    expect(document.querySelector('.ant-tour-indicator')).toBeNull()
    const mask = document.querySelector('.ant-tour-mask')
    expect(mask).not.toBeNull()
    expect((mask as HTMLElement).style.backgroundColor).toBe('')
    expect(mask?.querySelector('svg > rect')?.getAttribute('fill')).toBe('rgba(0, 0, 0, 0.38)')

    const skipButton = document.querySelector('.app-onboarding-tour-skip')
    expect(skipButton).not.toBeNull()
    act(() => {
      fireEvent.click(skipButton as HTMLElement)
    })

    expect(tourState.endTour).toHaveBeenCalledTimes(1)
  })

  it('switches pages via navigation when advancing into sidebar module steps', () => {
    mountTourTargets()
    setTourOpen(true)
    const paths: string[] = []

    render(
      <MemoryRouter initialEntries={['/settings/about']}>
        <LocationRecorder onLocation={(pathname) => paths.push(pathname)} />
        <RoundtableTarget />
        <AppOnboardingTour tourOpen={tourState.tourOpen} endTour={tourState.endTour} />
      </MemoryRouter>
    )

    const nextButton = () => document.querySelector('.ant-tour-next-btn') as HTMLElement
    // welcome(0) → chat(1)：切到对话页
    act(() => {
      fireEvent.click(nextButton())
    })
    // chat(1) → addAssistant(2) → newTopic(3) → input(4)：停留在对话页
    act(() => {
      fireEvent.click(nextButton())
    })
    act(() => {
      fireEvent.click(nextButton())
    })
    act(() => {
      fireEvent.click(nextButton())
    })
    // input(4) → roundtable(5)：切到圆桌页
    act(() => {
      fireEvent.click(nextButton())
    })

    expect(paths).toContain('/')
    expect(paths.at(-1)).toBe('/roundtable')

    act(() => {
      fireEvent.click(nextButton())
    })
    expect(screen.getByText('tour.module.roundtableAddModel.title')).toBeInTheDocument()
    expect(document.querySelector('.ant-tour-mask defs mask rect:nth-of-type(2)')).not.toBeNull()
  })
})
