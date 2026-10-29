export type PushType = 'top_loop' | 'cartoon' | 'avatar_overlay'

export type HomePushItem = {
  id: string
  pushType: PushType
  content?: string
  title?: string
  description?: string
  buttonText?: string
  buttonUrl?: string
}

export type HomeContentAction = { type: 'route' | 'url'; target: string }

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

export function resolveHomeContentAction(buttonUrl: unknown): HomeContentAction | null {
  if (typeof buttonUrl !== 'string') return null
  const target = buttonUrl.trim()
  if (INTERNAL_ROUTES.has(target)) return { type: 'route', target }
  try {
    const url = new URL(target)
    if (url.protocol === 'https:') return { type: 'url', target: url.href }
  } catch {
    return null
  }
  return null
}

export function normalizePushList(response: unknown, pushType: PushType): HomePushItem[] {
  if (!isRecord(response) || Number(response.code) !== 200 || !Array.isArray(response.data)) return []

  return response.data.flatMap((value): HomePushItem[] => {
    if (!isRecord(value) || value.pushType !== pushType) return []
    if (typeof value.id !== 'string' && typeof value.id !== 'number') return []
    const id = String(value.id)
    const content = typeof value.content === 'string' ? value.content.trim() : ''
    const title = typeof value.title === 'string' ? value.title.trim() : ''
    if (pushType === 'top_loop' ? !content : !title) return []

    return [
      {
        id,
        pushType,
        ...(content && { content }),
        ...(title && { title }),
        ...(typeof value.description === 'string' && { description: value.description.trim() }),
        ...(typeof value.buttonText === 'string' && { buttonText: value.buttonText.trim() }),
        ...(typeof value.buttonUrl === 'string' && { buttonUrl: value.buttonUrl.trim() })
      }
    ]
  })
}
