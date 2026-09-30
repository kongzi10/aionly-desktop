import { describe, expect, it } from 'vitest'

import { withExpandedMultiModelCards } from '../multiModelImageCapture'

describe('withExpandedMultiModelCards', () => {
  it('expands multi-model message scrollers during capture and restores their styles', async () => {
    const container = document.createElement('div')
    container.innerHTML =
      '<div class="roundtable-response-card"><div class="message-content-container" style="max-height: 240px; height: 100%; overflow-y: auto; flex: 1 1 0%"></div></div>'
    const content = container.querySelector<HTMLElement>('.message-content-container')!

    await withExpandedMultiModelCards(container, async () => {
      expect(content.style.maxHeight).toBe('none')
      expect(content.style.height).toBe('auto')
      expect(content.style.overflowY).toBe('visible')
      expect(content.style.getPropertyPriority('overflow-y')).toBe('important')
      expect(content.style.flex).toBe('0 0 auto')
    })

    expect(content.style.maxHeight).toBe('240px')
    expect(content.style.height).toBe('100%')
    expect(content.style.overflowY).toBe('auto')
    expect(content.style.getPropertyPriority('overflow-y')).toBe('')
    expect(content.style.flex).toBe('1 1 0%')
  })

  it('restores card styles if capture fails', async () => {
    const container = document.createElement('div')
    container.innerHTML =
      '<div class="roundtable-response-card"><div class="message-content-container" style="max-height: 240px; overflow-y: auto"></div></div>'
    const content = container.querySelector<HTMLElement>('.message-content-container')!

    await expect(
      withExpandedMultiModelCards(container, async () => {
        throw new Error('capture failed')
      })
    ).rejects.toThrow('capture failed')

    expect(content.style.maxHeight).toBe('240px')
    expect(content.style.overflowY).toBe('auto')
  })
})
