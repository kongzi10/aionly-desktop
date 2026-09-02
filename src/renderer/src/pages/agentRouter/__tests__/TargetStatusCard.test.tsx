import type { TargetSnapshot } from '@shared/agentRouter'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TargetStatusCard } from '../components/TargetStatusCard'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      key === 'agentRouter.managedCount' ? `managed ${options?.count ?? 0}` : key
  })
}))

describe('TargetStatusCard', () => {
  it('does not render the local WorkBuddy configuration path', () => {
    const target: TargetSnapshot = {
      targetId: 'workbuddy',
      configPath: 'C:\\Users\\kongz\\.workbuddy\\models.json',
      exists: true,
      readable: true,
      writable: true,
      detectionState: 'detected',
      formatVersion: 'workbuddy-models-v1',
      revision: 'sha256:test',
      managedEntryCount: 0,
      externalEntryCount: 0,
      issues: []
    }

    render(<TargetStatusCard target={target} onSelect={vi.fn()} />)

    expect(screen.queryByText(target.configPath)).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain('C:\\Users\\kongz')
  })
})
