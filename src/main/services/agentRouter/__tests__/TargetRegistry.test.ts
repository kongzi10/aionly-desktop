import { describe, expect, it } from 'vitest'

import { getTargetDetector, listTargetDetectors } from '../TargetRegistry'

describe('TargetRegistry', () => {
  it('lists only the available WorkBuddy detector', () => {
    const ids = listTargetDetectors().map((detector) => detector.targetId)
    expect(ids).toEqual(['workbuddy'])
  })

  it('resolves a detector by target id', () => {
    expect(getTargetDetector('workbuddy').targetId).toBe('workbuddy')
    expect(() => getTargetDetector('codex')).toThrow('No detector registered')
  })

  it('each detector reports at least one default config path', () => {
    for (const detector of listTargetDetectors()) {
      expect(detector.defaultConfigPaths().length).toBeGreaterThan(0)
    }
  })
})
