const MULTI_MODEL_CARD_SELECTOR = '.roundtable-response-card'
const MESSAGE_CONTENT_SELECTOR = '.message-content-container'

interface ContentStyleSnapshot {
  element: HTMLElement
  maxHeight: string
  height: string
  overflowY: string
  overflowYPriority: string
  flex: string
  scrollTop: number
}

export const withExpandedMultiModelCards = async <T>(
  container: HTMLElement | null,
  capture: () => Promise<T>
): Promise<T> => {
  if (!container) return capture()

  const cards = [
    ...(container.matches(MULTI_MODEL_CARD_SELECTOR) ? [container] : []),
    ...container.querySelectorAll<HTMLElement>(MULTI_MODEL_CARD_SELECTOR)
  ]
  const snapshots: ContentStyleSnapshot[] = []

  for (const card of cards) {
    const content = card.querySelector<HTMLElement>(MESSAGE_CONTENT_SELECTOR)
    if (!content) continue

    snapshots.push({
      element: content,
      maxHeight: content.style.maxHeight,
      height: content.style.height,
      overflowY: content.style.overflowY,
      overflowYPriority: content.style.getPropertyPriority('overflow-y'),
      flex: content.style.flex,
      scrollTop: content.scrollTop
    })
    content.style.maxHeight = 'none'
    content.style.height = 'auto'
    content.style.setProperty('overflow-y', 'visible', 'important')
    content.style.flex = 'none'
  }

  try {
    return await capture()
  } finally {
    for (const { element, maxHeight, height, overflowY, overflowYPriority, flex, scrollTop } of snapshots) {
      element.style.maxHeight = maxHeight
      element.style.height = height
      element.style.setProperty('overflow-y', overflowY, overflowYPriority)
      element.style.flex = flex
      element.scrollTop = scrollTop
    }
  }
}
