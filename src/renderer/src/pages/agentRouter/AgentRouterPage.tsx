import { PlusOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { formatErrorMessageWithPrefix } from '@renderer/utils/error'
import { Button, message, Modal } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import claudeCodeLogo from './assets/claude-code.svg'
import codexLogo from './assets/codex.svg'
import workbuddyLogo from './assets/workbuddy.svg'
import { AddRouteModal } from './components/AddRouteModal'
import { ClaudeCodeProfileList } from './components/ClaudeCodeProfileList'
import { ClaudeCodeProfileModal } from './components/ClaudeCodeProfileModal'
import { CodexProfileList } from './components/CodexProfileList'
import { CodexProfileModal } from './components/CodexProfileModal'
import { CreateGlobalTemplateModal } from './components/CreateGlobalTemplateModal'
import { GlobalTemplateList } from './components/GlobalTemplateList'
import { RouteList } from './components/RouteList'
import { TargetStatusCard } from './components/TargetStatusCard'
import { useAgentRouter } from './hooks/useAgentRouter'
import { useClaudeCodeRouter } from './hooks/useClaudeCodeRouter'
import { useCodexRouter } from './hooks/useCodexRouter'

const AgentRouterPage = () => {
  const { t } = useTranslation()
  const [messageApi, contextHolder] = message.useMessage()
  const [modalApi, modalContextHolder] = Modal.useModal()
  const onError = (error: unknown) =>
    messageApi.error(formatErrorMessageWithPrefix(error, t('agentRouter.actionFailed')))
  const router = useAgentRouter()
  const claudeCode = useClaudeCodeRouter({ onError })
  const codex = useCodexRouter({ onError })
  const [adding, setAdding] = useState(false)
  const [creatingTemplate, setCreatingTemplate] = useState(false)
  const [activeTab, setActiveTab] = useState<'routes' | 'global'>('routes')
  const [activeTarget, setActiveTarget] = useState<'workbuddy' | 'claude-code' | 'codex'>('workbuddy')
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [profileModalNew, setProfileModalNew] = useState(false)

  const openProfileModal = (isNew: boolean) => {
    setProfileModalNew(isNew)
    setProfileModalOpen(true)
  }

  return (
    <Page className="page-container">
      {contextHolder}
      {modalContextHolder}
      <Navbar>
        <NavbarCenter style={{ borderRight: 'none' }}>{t('agentRouter.title')}</NavbarCenter>
      </Navbar>
      <Content data-testid="agent-router-content">
        <TabBar role="tablist">
          <TabButton
            role="tab"
            aria-selected={activeTab === 'routes'}
            $active={activeTab === 'routes'}
            onClick={() => setActiveTab('routes')}>
            {t('agentRouter.routesTab')}
          </TabButton>
          <TabButton
            role="tab"
            aria-selected={activeTab === 'global'}
            $active={activeTab === 'global'}
            onClick={() => setActiveTab('global')}>
            {t('agentRouter.globalTemplatesTab')}
          </TabButton>
        </TabBar>
        {activeTab === 'global' ? (
          <GlobalSection data-testid="global-template-page">
            <RouteSectionHeading>
              <HeadingCopy>
                <strong>{t('agentRouter.globalTemplates')}</strong>
                <span>{t('agentRouter.globalTemplatesDescription')}</span>
              </HeadingCopy>
              <Button icon={<PlusOutlined />} onClick={() => setCreatingTemplate(true)}>
                {t('agentRouter.createGlobalTemplate')}
              </Button>
            </RouteSectionHeading>
            <GlobalTemplateList
              templates={router.globalTemplates}
              onDelete={(id) => void router.deleteGlobalTemplate(id)}
            />
          </GlobalSection>
        ) : (
          <WorkArea data-testid="agent-router-shell">
            <TargetList data-testid="agent-router-targets">
              <TargetSectionTitle>
                <span>{t('agentRouter.agentTargetsTitle')}</span>
                <Button
                  type="text"
                  size="small"
                  icon={<ReloadOutlined spin={router.refreshing} />}
                  aria-label={t('agentRouter.refresh')}
                  title={t('agentRouter.refresh')}
                  onClick={
                    activeTarget === 'workbuddy'
                      ? router.refresh
                      : activeTarget === 'claude-code'
                        ? claudeCode.refresh
                        : codex.refresh
                  }
                  disabled={
                    activeTarget === 'workbuddy'
                      ? router.refreshing
                      : activeTarget === 'claude-code'
                        ? claudeCode.refreshing
                        : codex.refreshing
                  }
                />
              </TargetSectionTitle>
              <TargetPill
                type="button"
                $active={activeTarget === 'workbuddy'}
                aria-pressed={activeTarget === 'workbuddy'}
                onClick={() => setActiveTarget('workbuddy')}>
                <TargetLogo>
                  <img src={workbuddyLogo} alt={t('agentRouter.target.workbuddy.label')} />
                </TargetLogo>
                <div>
                  <TargetNameRow>
                    <strong>{t('agentRouter.target.workbuddy.label')}</strong>
                    <StatusTag $tone={router.target?.detectionState === 'detected' ? 'success' : 'muted'}>
                      {t(
                        router.target?.detectionState === 'detected'
                          ? 'agentRouter.detected'
                          : 'agentRouter.notDetected'
                      )}
                    </StatusTag>
                  </TargetNameRow>
                </div>
              </TargetPill>
              <TargetPill
                type="button"
                $active={activeTarget === 'codex'}
                aria-pressed={activeTarget === 'codex'}
                onClick={() => setActiveTarget('codex')}>
                <TargetLogo>
                  <img src={codexLogo} alt={t('agentRouter.target.codex.label')} />
                </TargetLogo>
                <div>
                  <TargetNameRow>
                    <strong>{t('agentRouter.target.codex.label')}</strong>
                    <StatusTag $tone={codex.target && codex.target.detectionState !== 'notFound' ? 'success' : 'muted'}>
                      {t(
                        codex.target && codex.target.detectionState !== 'notFound'
                          ? 'agentRouter.detected'
                          : 'agentRouter.notDetected'
                      )}
                    </StatusTag>
                  </TargetNameRow>
                </div>
              </TargetPill>
              <TargetPill
                type="button"
                $active={activeTarget === 'claude-code'}
                aria-pressed={activeTarget === 'claude-code'}
                onClick={() => setActiveTarget('claude-code')}>
                <TargetLogo>
                  <img src={claudeCodeLogo} alt={t('agentRouter.target.claudeCode.label')} />
                </TargetLogo>
                <div>
                  <TargetNameRow>
                    <strong>{t('agentRouter.target.claudeCode.label')}</strong>
                    <StatusTag
                      $tone={
                        claudeCode.target && claudeCode.target.detectionState !== 'notFound' ? 'success' : 'muted'
                      }>
                      {t(
                        claudeCode.target && claudeCode.target.detectionState !== 'notFound'
                          ? 'agentRouter.detected'
                          : 'agentRouter.notDetected'
                      )}
                    </StatusTag>
                  </TargetNameRow>
                </div>
              </TargetPill>
            </TargetList>
            {activeTarget === 'workbuddy' ? (
              <MainContent data-testid="workbuddy-target-page">
                <RouteSectionHeading>
                  <HeadingCopy>
                    <strong>{t('agentRouter.target.workbuddy.label')}</strong>
                  </HeadingCopy>
                  <Actions>
                    <Button icon={<SettingOutlined />} onClick={router.selectConfig}>
                      {t('agentRouter.changeConfig')}
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdding(true)}>
                      {t('agentRouter.addRoute')}
                    </Button>
                  </Actions>
                </RouteSectionHeading>
                <TargetStatusCard target={router.target} onSelect={router.selectConfig} />
                <RoutesPanel data-testid="routes-panel">
                  <RouteList
                    routes={router.routes}
                    credentials={router.credentialSummaries}
                    apiCredentials={router.apiCredentials}
                    tokenPlanCredentials={router.tokenPlanCredentials}
                    apiModels={router.apiModels}
                    onRemove={(route) => void router.removeRoute(route)}
                    onUpdateRoute={router.updateAgentRoute}
                    onRevealCredential={router.revealAgentRouteCredential}
                    onEnabledChange={(route, enabled) => void router.setRouteEnabled(route, enabled)}
                    busy={router.busy}
                    routeTogglesDisabled={router.target?.detectionState !== 'detected'}
                  />
                </RoutesPanel>
              </MainContent>
            ) : activeTarget === 'claude-code' ? (
              <MainContent data-testid="claude-code-target-page">
                <RouteSectionHeading>
                  <HeadingCopy>
                    <strong>{t('agentRouter.target.claudeCode.label')}</strong>
                  </HeadingCopy>
                  <Actions>
                    <Button icon={<SettingOutlined />} onClick={() => void claudeCode.selectConfig()}>
                      {t('agentRouter.changeConfig')}
                    </Button>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        claudeCode.newProfile()
                        openProfileModal(true)
                      }}>
                      {t('agentRouter.claudeCode.newProfile')}
                    </Button>
                  </Actions>
                </RouteSectionHeading>
                <TargetStatusCard
                  target={claudeCode.target}
                  onSelect={() => void claudeCode.selectConfig()}
                  showEntryCounts={false}
                />
                <RoutesPanel>
                  <ClaudeCodeProfileList
                    profiles={claudeCode.library.profiles}
                    credentials={[...claudeCode.apiCredentials, ...claudeCode.tokenPlanCredentials]}
                    activeProfileId={claudeCode.library.activeProfileId}
                    busy={claudeCode.busy}
                    onEdit={(profileId) => {
                      claudeCode.selectProfile(profileId)
                      openProfileModal(false)
                    }}
                    onToggle={(profile) => {
                      claudeCode.selectProfile(profile.id)
                      modalApi.confirm({
                        title: t('agentRouter.overwriteWarningTitle'),
                        content: t('agentRouter.overwriteWarning'),
                        okText: t('agentRouter.apply'),
                        cancelText: t('common.cancel'),
                        onOk: () => claudeCode.applyProfile(profile.id)
                      })
                    }}
                    onRemove={(profile) => void claudeCode.removeSelected(profile.id)}
                    onNew={() => {
                      claudeCode.newProfile()
                      openProfileModal(true)
                    }}
                  />
                </RoutesPanel>
              </MainContent>
            ) : (
              <MainContent data-testid="codex-target-page">
                <RouteSectionHeading>
                  <HeadingCopy>
                    <strong>{t('agentRouter.target.codex.label')}</strong>
                  </HeadingCopy>
                  <Actions>
                    <Button icon={<SettingOutlined />} onClick={() => void codex.selectConfig()}>
                      {t('agentRouter.changeConfig')}
                    </Button>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        codex.newProfile()
                        openProfileModal(true)
                      }}>
                      {t('agentRouter.codex.newProfile')}
                    </Button>
                  </Actions>
                </RouteSectionHeading>
                <TargetStatusCard
                  target={codex.target}
                  onSelect={() => void codex.selectConfig()}
                  showEntryCounts={false}
                />
                <RoutesPanel>
                  <CodexProfileList
                    profiles={codex.library.profiles}
                    credentials={[...codex.apiCredentials, ...codex.tokenPlanCredentials]}
                    activeProfileId={codex.library.activeProfileId}
                    busy={codex.busy}
                    onEdit={(profileId) => {
                      codex.selectProfile(profileId)
                      openProfileModal(false)
                    }}
                    onToggle={(profile) => {
                      codex.selectProfile(profile.id)
                      modalApi.confirm({
                        title: t('agentRouter.overwriteWarningTitle'),
                        content: t('agentRouter.overwriteWarning'),
                        okText: t('agentRouter.apply'),
                        cancelText: t('common.cancel'),
                        onOk: () => codex.applyProfile(profile.id)
                      })
                    }}
                    onRemove={(profile) => void codex.removeSelected(profile.id)}
                    onNew={() => {
                      codex.newProfile()
                      openProfileModal(true)
                    }}
                  />
                </RoutesPanel>
              </MainContent>
            )}
          </WorkArea>
        )}
      </Content>
      <AddRouteModal
        open={adding}
        templates={router.globalTemplates}
        onListWorkBuddyRoutes={router.listWorkBuddyRoutes}
        apiCredentials={router.apiCredentials}
        tokenPlanCredentials={router.tokenPlanCredentials}
        apiModels={router.apiModels}
        onCancel={() => setAdding(false)}
        onAdd={router.copyTemplatesToAgent}
        onCreate={router.createAgentRoute}
      />
      <CreateGlobalTemplateModal
        open={creatingTemplate}
        apiCredentials={router.apiCredentials}
        tokenPlanCredentials={router.tokenPlanCredentials}
        apiModels={router.apiModels}
        onCancel={() => setCreatingTemplate(false)}
        onCreate={async (request) => {
          try {
            await router.createGlobalTemplate(request)
          } catch (error) {
            messageApi.error(t('agentRouter.createFailed'))
            throw error
          }
        }}
      />
      <ClaudeCodeProfileModal
        open={profileModalOpen && activeTarget === 'claude-code'}
        isNew={profileModalNew}
        profile={claudeCode.profile}
        apiCredentials={claudeCode.apiCredentials}
        tokenPlanCredentials={claudeCode.tokenPlanCredentials}
        apiModels={claudeCode.apiModels}
        busy={claudeCode.busy}
        onSave={(value) => {
          const shouldReapply = value.profileId === claudeCode.library.activeProfileId
          void claudeCode
            .saveDraft(value)
            .then(async (savedProfileId) => {
              if (!shouldReapply || (await claudeCode.applyProfile(savedProfileId))) setProfileModalOpen(false)
            })
            .catch((error) =>
              messageApi.error(formatErrorMessageWithPrefix(error, t('agentRouter.claudeCode.saveFailed')))
            )
        }}
        onCancel={() => setProfileModalOpen(false)}
      />
      <CodexProfileModal
        open={profileModalOpen && activeTarget === 'codex'}
        isNew={profileModalNew}
        profile={codex.profile}
        apiCredentials={codex.apiCredentials}
        tokenPlanCredentials={codex.tokenPlanCredentials}
        apiModels={codex.apiModels}
        busy={codex.busy}
        onSave={(value) => {
          const shouldReapply = value.profileId === codex.library.activeProfileId
          void codex
            .saveDraft(value)
            .then(async (savedProfileId) => {
              if (!shouldReapply || (await codex.applyProfile(savedProfileId))) setProfileModalOpen(false)
            })
            .catch((error) => messageApi.error(formatErrorMessageWithPrefix(error, t('agentRouter.codex.saveFailed'))))
        }}
        onRemove={() => {
          setProfileModalOpen(false)
          void codex.removeSelected()
        }}
        onCancel={() => setProfileModalOpen(false)}
      />
    </Page>
  )
}

const Page = styled.main`display:flex;flex:1;flex-direction:column;height:100vh;min-width:0;overflow:hidden;`
const Content = styled.div`flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;border-radius:var(--base-border-radius);padding:22px 28px 32px;background:var(--color-background);`
const WorkArea = styled.div`flex:1;min-height:0;display:grid;grid-template-columns:196px minmax(0,1fr);gap:24px;overflow:hidden;`
const GlobalSection = styled.section`flex:1;min-height:0;margin-bottom:18px;overflow:auto;border:1px solid var(--color-border);border-radius:10px;background:var(--color-background);>div:first-child{padding:0 12px}`
const TabBar = styled.div`flex-shrink:0;margin-bottom:18px;display:flex;gap:24px;border-bottom:1px solid var(--color-border);`
const TabButton = styled.button<{
  $active: boolean
}>`padding:0 2px 10px;border:0;border-bottom:2px solid ${({ $active }) => ($active ? 'var(--color-primary)' : 'transparent')};background:transparent;color:${({ $active }) => ($active ? 'var(--color-primary)' : 'var(--color-text-2)')};font-size:13px;font-weight:650;cursor:pointer;`
const MainContent = styled.section`min-width:0;min-height:0;display:flex;flex-direction:column;gap:14px;overflow:hidden;`
const TargetList = styled.aside`min-height:0;display:flex;flex-direction:column;gap:3px;overflow:hidden;`
const TargetSectionTitle = styled.div`min-height:38px;padding:6px 2px 4px 10px;display:flex;align-items:center;justify-content:space-between;color:var(--color-text-3);font-size:10px;font-weight:700;`
const TargetPill = styled.button<{
  $active?: boolean
  $disabled?: boolean
}>`min-height:48px;padding:7px 10px;display:flex;align-items:center;gap:9px;border:0;border-radius:9px;text-align:left;color:${({ $active }) => ($active ? 'var(--color-primary)' : 'var(--color-text-1)')};background:${({ $active }) => ($active ? 'color-mix(in srgb,var(--color-primary) 10%,transparent)' : 'transparent')};opacity:${({ $disabled }) => ($disabled ? 0.55 : 1)};>div:last-child{flex:1;min-width:0;display:flex;flex-direction:column}span{color:var(--color-text-3);font-size:9px}`
const TargetLogo = styled.div`
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  flex: 0 0 28px;

  img {
    width: 24px;
    height: 24px;
    display: block;
    object-fit: contain;
  }
`
const TargetNameRow = styled.div`display:flex;align-items:center;justify-content:space-between;gap:6px;`
const StatusTag = styled.span<{
  $tone: 'success' | 'muted' | 'warning'
}>`display:inline-flex;align-items:center;height:16px;padding:0 5px;border-radius:8px;color:${({ $tone }) => ($tone === 'success' ? '#1f9d70' : $tone === 'warning' ? '#d89614' : 'var(--color-text-3)')}!important;background:${({ $tone }) => ($tone === 'success' ? 'rgba(31,157,112,.12)' : $tone === 'warning' ? 'rgba(216,150,20,.13)' : 'var(--color-background-soft)')};font-size:8px!important;font-weight:650;white-space:nowrap;`
const RouteSectionHeading = styled.div`min-height:52px;display:flex;align-items:center;justify-content:space-between;gap:16px;`
const HeadingCopy = styled.div`display:flex;flex-direction:column;gap:3px;strong{font-size:16px}span{color:var(--color-text-3);font-size:11px}`
const Actions = styled.div`display:flex;gap:8px;`
const RoutesPanel = styled.div`flex:1;min-height:0;overflow:auto;border:1px solid var(--color-border);border-radius:10px;`

export default AgentRouterPage
