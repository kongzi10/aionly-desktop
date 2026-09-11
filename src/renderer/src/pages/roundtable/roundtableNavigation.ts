export type PrimarySidebarMenu = {
  path: string
  name: string
  icon: string
  iconActive: string
}

const BASE_MENUS: PrimarySidebarMenu[] = [
  {
    path: '/',
    name: 'assistants',
    icon: 'icon-duihuamoren',
    iconActive: 'icon-duihuaxuanzhong'
  },
  {
    path: '/roundtable',
    name: 'roundtable',
    icon: 'roundtable',
    iconActive: 'roundtable'
  },
  {
    path: '/translate',
    name: 'translate',
    icon: 'icon-fanyimoren',
    iconActive: 'icon-fanyixuanzhong'
  },
  {
    path: '/apps',
    name: 'minapp',
    icon: 'icon-gongjuxiang',
    iconActive: 'icon-gongjuxiang'
  }
]

const AGENT_ROUTER_MENU: PrimarySidebarMenu = {
  path: '/agent-router',
  name: 'agent_router',
  icon: 'icon-lianjie',
  iconActive: 'icon-lianjie'
}

export const getPrimarySidebarMenus = (hasTokenPlan: boolean): PrimarySidebarMenu[] => {
  if (!hasTokenPlan) return [...BASE_MENUS, AGENT_ROUTER_MENU]

  return [
    ...BASE_MENUS,
    {
      path: '/tokenPlan',
      name: 'token plan',
      icon: 'icon-ziyuan1',
      iconActive: 'icon-ziyuan2'
    },
    AGENT_ROUTER_MENU
  ]
}

export const hasTokenPlanAccess = (planStatus: unknown): boolean => Number(planStatus) === 1
