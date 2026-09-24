import type { CodexRouteProfile } from '@shared/agentRouter'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { AgentRouterCredential, RouteModel } from '../hooks/useAgentRouterSources'
import type { CodexFormValue } from './CodexProfileForm'
import { CodexProfileForm } from './CodexProfileForm'
import { RouteFormModal } from './RouteFormModal'

interface Props {
  open: boolean
  isNew: boolean
  profile?: CodexRouteProfile
  apiCredentials: AgentRouterCredential[]
  tokenPlanCredentials: AgentRouterCredential[]
  apiModels: RouteModel[]
  busy: boolean
  onSave: (value: CodexFormValue) => void
  onRemove: () => void
  onCancel: () => void
}

export const CodexProfileModal = ({
  open,
  isNew,
  profile,
  apiCredentials,
  tokenPlanCredentials,
  apiModels,
  busy,
  onSave,
  onRemove,
  onCancel
}: Props) => {
  const { t } = useTranslation()
  return (
    <StyledModal
      open={open}
      title={isNew ? t('agentRouter.codex.newProfile') : t('agentRouter.codex.editProfile')}
      width={640}
      centered
      footer={null}
      onCancel={onCancel}>
      <CodexProfileForm
        key={profile?.id ?? 'new'}
        apiCredentials={apiCredentials}
        tokenPlanCredentials={tokenPlanCredentials}
        apiModels={apiModels}
        profile={profile}
        busy={busy}
        onSave={onSave}
        onRemove={onRemove}
        onCancel={onCancel}
      />
    </StyledModal>
  )
}

const StyledModal = styled(RouteFormModal)`
  .ant-radio-group { display: flex; width: 100%; }
  .ant-radio-button-wrapper { flex: 1; text-align: center; }
`
