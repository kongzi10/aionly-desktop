import type { ClaudeCodeRouteProfile } from '@shared/agentRouter'
import { useTranslation } from 'react-i18next'

import type { AgentRouterCredential } from '../hooks/useAgentRouterSources'
import { AgentProfileTable } from './AgentProfileTable'

interface Props {
  profiles: ClaudeCodeRouteProfile[]
  credentials?: AgentRouterCredential[]
  activeProfileId?: string
  busy?: boolean
  onEdit: (profileId: string) => void
  onToggle: (profile: ClaudeCodeRouteProfile, enabled: boolean) => void
  onRemove?: (profile: ClaudeCodeRouteProfile) => void
  onNew: () => void
}

export const ClaudeCodeProfileList = ({
  profiles,
  credentials = [],
  activeProfileId,
  busy = false,
  onEdit,
  onToggle,
  onRemove = () => undefined,
  onNew
}: Props) => {
  const { t } = useTranslation()
  return (
    <AgentProfileTable
      testId="claude-code-profile-cards"
      profiles={profiles}
      credentials={credentials}
      activeProfileId={activeProfileId}
      busy={busy}
      emptyDescription={t('agentRouter.claudeCode.profilesEmpty')}
      newLabel={t('agentRouter.claudeCode.newProfile')}
      removeConfirmationTitle={t('agentRouter.claudeCode.confirmRemoveProfile')}
      onEdit={onEdit}
      onToggle={onToggle}
      onRemove={onRemove}
      onNew={onNew}
    />
  )
}
