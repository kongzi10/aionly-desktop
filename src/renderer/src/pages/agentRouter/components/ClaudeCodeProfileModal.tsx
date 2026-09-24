import type { ClaudeCodeRouteProfile } from '@shared/agentRouter'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { AgentRouterCredential, RouteModel } from '../hooks/useAgentRouterSources'
import type { ClaudeCodeFormValue } from './ClaudeCodeRouteForm'
import { ClaudeCodeRouteForm } from './ClaudeCodeRouteForm'
import { RouteFormModal } from './RouteFormModal'

interface Props {
  open: boolean
  isNew: boolean
  profile?: ClaudeCodeRouteProfile
  apiCredentials: AgentRouterCredential[]
  tokenPlanCredentials: AgentRouterCredential[]
  apiModels: RouteModel[]
  busy: boolean
  onSave: (value: ClaudeCodeFormValue) => void
  onCancel: () => void
}

export const ClaudeCodeProfileModal = ({
  open,
  isNew,
  profile,
  apiCredentials,
  tokenPlanCredentials,
  apiModels,
  busy,
  onSave,
  onCancel
}: Props) => {
  const { t } = useTranslation()
  return (
    <StyledModal
      open={open}
      title={isNew ? t('agentRouter.claudeCode.newProfile') : t('agentRouter.claudeCode.editProfile')}
      width={640}
      centered
      footer={null}
      onCancel={onCancel}>
      <ClaudeCodeRouteForm
        key={profile?.id ?? 'new'}
        apiCredentials={apiCredentials}
        tokenPlanCredentials={tokenPlanCredentials}
        apiModels={apiModels}
        profile={profile}
        busy={busy}
        onSave={onSave}
        onCancel={onCancel}
      />
    </StyledModal>
  )
}

const StyledModal = styled(RouteFormModal)`
  .ant-radio-group { display: flex; width: 100%; }
  .ant-radio-button-wrapper { flex: 1; text-align: center; }
`
