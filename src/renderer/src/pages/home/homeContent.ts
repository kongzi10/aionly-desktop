export type HomeContentAction = { type: 'route' | 'url'; target: string }

export type HomeContentItem = {
  id: string
  slot: 'ticker' | 'announcement' | 'avatar'
  title: string
  description?: string
  imageUrl?: string
  action?: HomeContentAction
  priority?: number
  startsAt?: string
  endsAt?: string
}

export type HomeContent = {
  ticker: HomeContentItem[]
  announcements: HomeContentItem[]
  avatarPromotion: HomeContentItem | null
}

const EMPTY_CONTENT = { ticker: [], announcements: [], avatarPromotion: null } satisfies HomeContent
const INTERNAL_ROUTES = new Set([
  '/chat',
  '/tokenPlan',
  '/settings/model',
  '/settings/provider',
  '/roundtable',
  '/agent-router'
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function resolveHomeContentAction(action: unknown): HomeContentAction | null {
  if (!isRecord(action) || typeof action.target !== 'string') return null
  const target = action.target.trim()
  if (action.type === 'route' && INTERNAL_ROUTES.has(target)) return { type: 'route', target }
  if (action.type !== 'url') return null
  try {
    const url = new URL(target)
    if (url.protocol === 'https:') return { type: 'url', target: url.href }
  } catch {
    return null
  }
  return null
}

function activeDate(value: unknown, now: number, bound: 'start' | 'end'): boolean {
  if (value === undefined || value === null || value === '') return true
  if (typeof value !== 'string') return false
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return false
  return bound === 'start' ? timestamp <= now : timestamp > now
}

function parseItem(value: unknown, now: number): HomeContentItem | null {
  if (!isRecord(value)) return null
  const slot = value.slot
  if (slot !== 'ticker' && slot !== 'announcement' && slot !== 'avatar') return null
  if (typeof value.id !== 'string' || typeof value.title !== 'string') return null
  const id = value.id.trim()
  const title = value.title.trim()
  if (!id || !title) return null
  if (!activeDate(value.startsAt, now, 'start') || !activeDate(value.endsAt, now, 'end')) return null

  const item: HomeContentItem = { id, slot, title }
  if (typeof value.description === 'string') item.description = value.description.trim()
  if (typeof value.priority === 'number' && Number.isFinite(value.priority)) item.priority = value.priority
  if (typeof value.imageUrl === 'string') {
    try {
      const url = new URL(value.imageUrl)
      if (url.protocol === 'https:') item.imageUrl = url.href
    } catch {
      // Invalid remote images are ignored; the content remains usable.
    }
  }
  const action = resolveHomeContentAction(value.action)
  if (action) item.action = action
  return item
}

export function normalizePublishedHomeContent(response: unknown, now = Date.now()): HomeContent {
  if (!isRecord(response) || !Array.isArray(response.items)) return { ...EMPTY_CONTENT }
  const items = response.items
    .map((value) => parseItem(value, now))
    .filter((item): item is HomeContentItem => item !== null)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

  return {
    ticker: items.filter((item) => item.slot === 'ticker'),
    announcements: items.filter((item) => item.slot === 'announcement'),
    avatarPromotion: items.find((item) => item.slot === 'avatar') ?? null
  }
}
