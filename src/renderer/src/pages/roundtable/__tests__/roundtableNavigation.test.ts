import { describe, expect, it } from 'vitest'

import { getPrimarySidebarMenus, hasTokenPlanAccess } from '../roundtableNavigation'

describe('getPrimarySidebarMenus', () => {
  it('accepts numeric and string token plan status values', () => {
    expect(hasTokenPlanAccess(1)).toBe(true)
    expect(hasTokenPlanAccess('1')).toBe(true)
    expect(hasTokenPlanAccess(0)).toBe(false)
  })

  it('opens with home, then regular chat and roundtable', () => {
    const menus = getPrimarySidebarMenus(false)

    expect(menus.slice(0, 4).map(({ name, path }) => ({ name, path }))).toEqual([
      { name: 'home', path: '/' },
      { name: 'assistants', path: '/chat' },
      { name: 'roundtable', path: '/roundtable' },
      { name: 'translate', path: '/translate' }
    ])
  })

  it('preserves plan-only navigation without changing the roundtable position', () => {
    const menus = getPrimarySidebarMenus(true)

    expect(menus.some((menu) => menu.path === '/tokenPlan')).toBe(true)
    expect(menus.findIndex((menu) => menu.path === '/roundtable')).toBe(2)
  })

  it('uses a dedicated roundtable icon instead of the regular chat glyph', () => {
    const menus = getPrimarySidebarMenus(false)
    const chat = menus.find((menu) => menu.name === 'assistants')
    const roundtable = menus.find((menu) => menu.name === 'roundtable')

    expect(roundtable?.icon).toBe('roundtable')
    expect(roundtable?.icon).not.toBe(chat?.icon)
  })
})
