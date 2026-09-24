import { describe, expect, it } from 'vitest'

import { getTargetDetector, listTargetDetectors } from '../TargetRegistry'

describe('TargetRegistry', () => {
  it('lists the available WorkBuddy, Claude Code and Codex detectors', () => {
    const ids = listTargetDetectors().map((detector) => detector.targetId)
    expect(ids).toEqual(['workbuddy', 'claude-code', 'codex'])
  })

  it('resolves a detector by target id', () => {
    expect(getTargetDetector('workbuddy').targetId).toBe('workbuddy')
    expect(getTargetDetector('claude-code').targetId).toBe('claude-code')
    expect(getTargetDetector('codex').targetId).toBe('codex')
  })

  it('each detector reports at least one default config path', () => {
    for (const detector of listTargetDetectors()) {
      expect(detector.defaultConfigPaths().length).toBeGreaterThan(0)
    }
  })
})
