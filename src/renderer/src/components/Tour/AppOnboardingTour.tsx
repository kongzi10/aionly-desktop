import './AppOnboardingTour.css'

import { loggerService } from '@logger'
import type { TourStepProps } from 'antd'
import { Tour } from 'antd'
import type { FC } from 'react'
import { useCallback } from 'react'
import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

const logger = loggerService.withContext('AppOnboardingTour')

/** 最小化的翻译函数类型，便于单测注入 mock */
type TranslateFn = (key: string) => string

/** Tour 弹层层级：需高于 Sidebar 的 minappShow(10000) 与 Popover(99999) */
const TOUR_Z_INDEX = 100001
const TOUR_CARD_STYLE = { width: '320px', maxWidth: 'calc(100vw - 32px)' } satisfies TourStepProps['style']

interface TourStepConfig {
  /** data-tour 属性选择器；为 null 表示无目标（居中展示） */
  selector: string | null
  /** 进入该步骤前需要切换到的路由；为 undefined 表示不切换页面 */
  route?: string
  /** 显示步骤所需的导航入口；页面内目标可在切页后再挂载 */
  requiredSelector?: string
  placement?: TourStepProps['placement']
  className?: string
  titleKey: string
  descriptionKey: string
}

/**
 * 步骤编排：欢迎 → 对话操作 → 各模块入口及页面内关键区域 → 账号 → 收尾。
 * 页面内目标在切换路由后才挂载，因此步骤的 target 必须在使用时查询。
 */
const TOUR_STEP_CONFIGS: TourStepConfig[] = [
  // 欢迎步：无目标、居中展示
  { selector: null, titleKey: 'tour.welcome.title', descriptionKey: 'tour.welcome.description' },
  // 左侧栏逐模块：先在主页介绍对话入口，再进入各模块页面讲解
  {
    selector: '[data-tour="nav-chat"]',
    route: '/',
    requiredSelector: '[data-tour="nav-chat"]',
    titleKey: 'tour.module.chat.title',
    descriptionKey: 'tour.module.chat.description'
  },
  {
    selector: '[data-tour="add-assistant"]',
    route: '/',
    requiredSelector: '[data-tour="nav-chat"]',
    placement: 'bottom',
    titleKey: 'tour.addAssistant.title',
    descriptionKey: 'tour.addAssistant.description'
  },
  {
    selector: '[data-tour="new-topic"]',
    route: '/',
    requiredSelector: '[data-tour="nav-chat"]',
    placement: 'bottom',
    titleKey: 'tour.newTopic.title',
    descriptionKey: 'tour.newTopic.description'
  },
  {
    selector: '[data-tour="inputbar"]',
    route: '/',
    requiredSelector: '[data-tour="nav-chat"]',
    placement: 'top',
    titleKey: 'tour.input.title',
    descriptionKey: 'tour.input.description'
  },
  {
    selector: '[data-tour="nav-roundtable"]',
    route: '/roundtable',
    requiredSelector: '[data-tour="nav-roundtable"]',
    titleKey: 'tour.module.roundtable.title',
    descriptionKey: 'tour.module.roundtable.description'
  },
  {
    selector: '[data-tour="roundtable-add-model"]',
    route: '/roundtable',
    requiredSelector: '[data-tour="nav-roundtable"]',
    placement: 'bottom',
    titleKey: 'tour.module.roundtableAddModel.title',
    descriptionKey: 'tour.module.roundtableAddModel.description'
  },
  {
    selector: '[data-tour="roundtable-inputbar"]',
    route: '/roundtable',
    requiredSelector: '[data-tour="nav-roundtable"]',
    placement: 'top',
    titleKey: 'tour.module.roundtableInput.title',
    descriptionKey: 'tour.module.roundtableInput.description'
  },
  {
    selector: '[data-tour="nav-translate"]',
    route: '/translate',
    requiredSelector: '[data-tour="nav-translate"]',
    titleKey: 'tour.module.translate.title',
    descriptionKey: 'tour.module.translate.description'
  },
  {
    selector: '[data-tour="translate-input"]',
    route: '/translate',
    requiredSelector: '[data-tour="nav-translate"]',
    placement: 'right',
    titleKey: 'tour.module.translateInput.title',
    descriptionKey: 'tour.module.translateInput.description'
  },
  {
    selector: '[data-tour="translate-output"]',
    route: '/translate',
    requiredSelector: '[data-tour="nav-translate"]',
    placement: 'left',
    titleKey: 'tour.module.translateOutput.title',
    descriptionKey: 'tour.module.translateOutput.description'
  },
  {
    selector: '[data-tour="nav-minapp"]',
    route: '/apps',
    requiredSelector: '[data-tour="nav-minapp"]',
    titleKey: 'tour.module.minapp.title',
    descriptionKey: 'tour.module.minapp.description'
  },
  {
    selector: '[data-tour="toolbox-built-in"]',
    route: '/apps',
    requiredSelector: '[data-tour="nav-minapp"]',
    placement: 'bottom',
    titleKey: 'tour.module.toolboxBuiltIn.title',
    descriptionKey: 'tour.module.toolboxBuiltIn.description'
  },
  {
    selector: '[data-tour="toolbox-extensions"]',
    route: '/apps',
    requiredSelector: '[data-tour="nav-minapp"]',
    placement: 'bottom',
    titleKey: 'tour.module.toolboxExtensions.title',
    descriptionKey: 'tour.module.toolboxExtensions.description'
  },
  {
    selector: '[data-tour="toolbox-mini-apps"]',
    route: '/apps',
    requiredSelector: '[data-tour="nav-minapp"]',
    placement: 'bottom',
    titleKey: 'tour.module.toolboxMiniApps.title',
    descriptionKey: 'tour.module.toolboxMiniApps.description'
  },
  {
    selector: '[data-tour="nav-tokenplan"]',
    route: '/tokenPlan',
    requiredSelector: '[data-tour="nav-tokenplan"]',
    titleKey: 'tour.module.tokenplan.title',
    descriptionKey: 'tour.module.tokenplan.description'
  },
  {
    selector: '[data-tour="tokenplan-content"]',
    route: '/tokenPlan',
    requiredSelector: '[data-tour="nav-tokenplan"]',
    placement: 'top',
    className: 'app-onboarding-tour-tokenplan-content',
    titleKey: 'tour.module.tokenplanContent.title',
    descriptionKey: 'tour.module.tokenplanContent.description'
  },
  {
    selector: '[data-tour="nav-agent-router"]',
    route: '/agent-router',
    requiredSelector: '[data-tour="nav-agent-router"]',
    titleKey: 'tour.module.agentRouter.title',
    descriptionKey: 'tour.module.agentRouter.description'
  },
  {
    selector: '[data-tour="agent-router-content"]',
    route: '/agent-router',
    requiredSelector: '[data-tour="nav-agent-router"]',
    placement: 'right',
    titleKey: 'tour.module.agentRouterContent.title',
    descriptionKey: 'tour.module.agentRouterContent.description'
  },
  {
    selector: '[data-tour="user-avatar"]',
    requiredSelector: '[data-tour="user-avatar"]',
    placement: 'bottom',
    titleKey: 'tour.account.title',
    descriptionKey: 'tour.account.description'
  },
  { selector: null, titleKey: 'tour.finish.title', descriptionKey: 'tour.finish.description' }
]

/**
 * 仅根据可见导航入口过滤步骤；页面内目标可在切换路由后挂载。
 */
export function buildTourSteps(t: TranslateFn): TourStepProps[] {
  return buildTourStepsWithRoutes(t).steps
}

/**
 * 在 buildTourSteps 基础上附带每步对应的路由，供 onChange 驱动页面切换；
 * 路由取自步骤配置，与元素过滤后的顺序保持一致。
 */
export function buildTourStepsWithRoutes(t: TranslateFn): { routes: (string | undefined)[]; steps: TourStepProps[] } {
  const routes: (string | undefined)[] = []
  const steps = TOUR_STEP_CONFIGS.filter(
    (config) => !config.requiredSelector || document.querySelector(config.requiredSelector)
  ).map((config): TourStepProps => {
    routes.push(config.route)
    const selector = config.selector
    return {
      // rc-tour 支持目标暂时不存在，但其类型未包含函数返回 HTMLElement | null。
      target: selector ? ((() => document.querySelector<HTMLElement>(selector)) as TourStepProps['target']) : null,
      placement: selector ? (config.placement ?? 'right') : 'center',
      className: config.className,
      style: TOUR_CARD_STYLE,
      title: t(config.titleKey),
      description: t(config.descriptionKey)
    }
  })
  return { routes, steps }
}

interface AppOnboardingTourProps {
  tourOpen: boolean
  endTour: () => void
}

const AppOnboardingTour: FC<AppOnboardingTourProps> = ({ tourOpen, endTour }) => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  // 记录已导航到的路由，避免同页步骤间点击「上一步/下一步」时重复触发导航
  const lastRouteRef = useRef<string | undefined>(undefined)

  const { routes, steps } = useMemo(() => {
    if (!tourOpen) return { routes: [] as (string | undefined)[], steps: [] }
    try {
      return buildTourStepsWithRoutes(t)
    } catch (error) {
      logger.warn('Failed to build onboarding tour steps', error as Error)
      return { routes: [] as (string | undefined)[], steps: [] }
    }
  }, [tourOpen, t, location.pathname])

  const handleClose = useCallback(() => endTour(), [endTour])

  /** 步骤切换时同步切换页面；首步(current=0)不导航，保持用户当前所在页 */
  const handleChange = useCallback(
    (current: number) => {
      const route = routes[current]
      if (!route || route === lastRouteRef.current) return
      lastRouteRef.current = route
      navigate(route)
    },
    [navigate, routes]
  )

  return (
    <Tour
      rootClassName="app-onboarding-tour"
      open={tourOpen}
      steps={steps}
      onChange={handleChange}
      onClose={handleClose}
      closable={false}
      mask={{ color: 'rgba(0, 0, 0, 0.38)' }}
      zIndex={TOUR_Z_INDEX}
      indicatorsRender={() => null}
      actionsRender={(buttons, { current, total }) => (
        <>
          {current < total - 1 && (
            <button className="app-onboarding-tour-skip" type="button" onClick={handleClose}>
              {t('tour.skip')} ({current + 1}/{total})
            </button>
          )}
          {buttons}
        </>
      )}
      arrow
    />
  )
}

export default AppOnboardingTour
