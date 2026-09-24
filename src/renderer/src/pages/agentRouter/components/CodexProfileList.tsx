import type { CodexRouteProfile } from '@shared/agentRouter'
import { useTranslation } from 'react-i18next'

import type { AgentRouterCredential } from '../hooks/useAgentRouterSources'
import { AgentProfileTable } from './AgentProfileTable'

interface Props {
  profiles: CodexRouteProfile[]
  credentials?: AgentRouterCredential[]
  activeProfileId?: string
  busy?: boolean
  onEdit: (profileId: string) => void
  onToggle: (profile: CodexRouteProfile, enabled: boolean) => void
  onRemove?: (profile: CodexRouteProfile) => void
  onNew: () => void
}

export const CodexProfileList = ({
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
      testId="codex-profile-cards"
      profiles={profiles}
      credentials={credentials}
      activeProfileId={activeProfileId}
      busy={busy}
      emptyDescription={t('agentRouter.codex.profilesEmpty')}
      newLabel={t('agentRouter.codex.newProfile')}
      removeConfirmationTitle={t('agentRouter.codex.confirmRemoveProfile')}
      onEdit={onEdit}
      onToggle={onToggle}
      onRemove={onRemove}
      onNew={onNew}
    />
  )
}
