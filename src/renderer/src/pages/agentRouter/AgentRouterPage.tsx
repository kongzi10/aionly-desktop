import { ReloadOutlined } from '@ant-design/icons'
import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { formatErrorMessageWithPrefix } from '@renderer/utils/error'
import { message } from 'antd'
import { Plus } from 'lucide-react'
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
import { ConfirmDialog } from './components/RouteFormModal'
import { RouteList } from './components/RouteList'
import { TargetStatusCard } from './components/TargetStatusCard'
import { useAgentRouter } from './hooks/useAgentRouter'
import { useClaudeCodeRouter } from './hooks/useClaudeCodeRouter'
import { useCodexRouter } from './hooks/useCodexRouter'

type ChipTone = 'success' | 'warning' | 'muted'
type TargetId = 'workbuddy' | 'claude-code' | 'codex'

const AgentRouterPage = () => {
  const { t } = useTranslation()
  const [messageApi, contextHolder] = message.useMessage()
  const onError = (error: unknown) =>
    messageApi.error(formatErrorMessageWithPrefix(error, t('agentRouter.actionFailed')))
  const router = useAgentRouter()
  const claudeCode = useClaudeCodeRouter({ onError })
  const codex = useCodexRouter({ onError })
  const [adding, setAdding] = useState(false)
  const [creatingTemplate, setCreatingTemplate] = useState(false)
  const [activeTab, setActiveTab] = useState<'routes' | 'global'>('routes')
  const [activeTarget, setActiveTarget] = useState<TargetId>('workbuddy')
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [profileModalNew, setProfileModalNew] = useState(false)
  const [pendingApply, setPendingApply] = useState<{ target: 'claude-code' | 'codex'; profileId: string } | null>(null)

  const openProfileModal = (isNew: boolean) => {
    setProfileModalNew(isNew)
    setProfileModalOpen(true)
  }

  /** 目标卡的状态胶囊：profile 类目标按「配置是否可写」判定，避免 needsAttention 被误报为未识别 */
  const readyChip = (exists?: boolean, readable?: boolean, writable?: boolean): ChipTone =>
    exists && readable && writable ? 'success' : 'muted'

  const claudeCodeReady = readyChip(claudeCode.target?.exists, claudeCode.target?.readable, claudeCode.target?.writable)
  const claudeCodeChip: ChipTone =
    claudeCodeReady === 'success' ? 'success' : claudeCode.target?.detectionState === 'notFound' ? 'warning' : 'muted'

  const targetCards = [
    {
      id: 'workbuddy' as TargetId,
      label: t('agentRouter.target.workbuddy.label'),
      logo: workbuddyLogo,
      chip: (router.target?.detectionState === 'detected' ? 'success' : 'muted') as ChipTone,
      status: router.target?.detectionState === 'detected' ? t('agentRouter.detected') : t('agentRouter.notDetected'),
      meta: (
        <>
          <span>{t('agentRouter.routes')}</span>
          <b>
            {router.routes.filter((route) => route.enabled).length}/{router.routes.length}
          </b>
        </>
      )
    },
    {
      id: 'codex' as TargetId,
      label: t('agentRouter.target.codex.label'),
      logo: codexLogo,
      chip: (codex.target && codex.target.detectionState !== 'notFound' ? 'success' : 'muted') as ChipTone,
      status:
        codex.target && codex.target.detectionState !== 'notFound'
          ? t('agentRouter.detected')
          : t('agentRouter.notDetected'),
      meta: <span>{t('agentRouter.planCount', { count: codex.library.profiles.length })}</span>
    },
    {
      id: 'claude-code' as TargetId,
      label: t('agentRouter.target.claudeCode.label'),
      logo: claudeCodeLogo,
      chip: claudeCodeChip,
      status:
        claudeCodeChip === 'warning'
          ? t('agentRouter.configNotFoundShort')
          : claudeCodeChip === 'success'
            ? t('agentRouter.detected')
            : t('agentRouter.notDetected'),
      meta: <span>{t('agentRouter.planCount', { count: claudeCode.library.profiles.length })}</span>
    }
  ]

  const refreshing =
    activeTarget === 'workbuddy'
      ? router.refreshing
      : activeTarget === 'claude-code'
        ? claudeCode.refreshing
        : codex.refreshing
  const refresh =
    activeTarget === 'workbuddy' ? router.refresh : activeTarget === 'claude-code' ? claudeCode.refresh : codex.refresh

  const primaryAction =
    activeTab === 'global'
      ? { label: t('agentRouter.createGlobalTemplate'), run: () => setCreatingTemplate(true) }
      : activeTarget === 'workbuddy'
        ? { label: t('agentRouter.addRoute'), run: () => setAdding(true) }
        : activeTarget === 'claude-code'
          ? {
              label: t('agentRouter.claudeCode.newProfile'),
              run: () => {
                claudeCode.newProfile()
                openProfileModal(true)
              }
            }
          : {
              label: t('agentRouter.codex.newProfile'),
              run: () => {
                codex.newProfile()
                openProfileModal(true)
              }
            }

  return (
    <Page className="page-container nav-module-layout">
      {contextHolder}
      {/* 不显示页面标题；NavbarCenter 仅作弹性占位，把右侧余额 / 主题 / 窗口按钮推到最右 */}
      <Navbar>
        <NavbarCenter style={{ borderRight: 'none' }} />
      </Navbar>
      <Content className="nav-module-surface" data-testid="agent-router-content">
        <TopBar>
          <Segments role="tablist" aria-label={t('agentRouter.title')}>
            <Segment
              type="button"
              role="tab"
              aria-selected={activeTab === 'routes'}
              $active={activeTab === 'routes'}
              onClick={() => setActiveTab('routes')}>
              {t('agentRouter.routesTab')}
            </Segment>
            <Segment
              type="button"
              role="tab"
              aria-selected={activeTab === 'global'}
              $active={activeTab === 'global'}
              onClick={() => setActiveTab('global')}>
              {t('agentRouter.globalTemplatesTab')}
            </Segment>
          </Segments>
          <PrimaryAction type="button" onClick={primaryAction.run}>
            <Plus size={14} strokeWidth={2.6} className="lucide-custom" aria-hidden="true" />
            {primaryAction.label}
          </PrimaryAction>
        </TopBar>
        <Body data-testid="agent-router-shell" data-tour="agent-router-content">
          {activeTab === 'global' ? (
            <GlobalPane data-testid="global-template-page">
              <PaneHeader>
                <PaneTitle>
                  <strong>{t('agentRouter.globalTemplates')}</strong>
                  <CountChip>{router.globalTemplates.length}</CountChip>
                </PaneTitle>
                <Hint>{t('agentRouter.globalTemplatesDescription')}</Hint>
              </PaneHeader>
              <GlobalTemplateList
                templates={router.globalTemplates}
                onDelete={(id) => void router.deleteGlobalTemplate(id)}
              />
            </GlobalPane>
          ) : (
            <Split>
              <Rail data-testid="agent-router-targets">
                <RailHeader>
                  <span>{t('agentRouter.targetNavigation')}</span>
                  <RefreshKey
                    type="button"
                    aria-label={t('agentRouter.refresh')}
                    title={t('agentRouter.refresh')}
                    disabled={refreshing}
                    onClick={() => void refresh()}>
                    <ReloadOutlined spin={refreshing} />
                  </RefreshKey>
                </RailHeader>
                {targetCards.map((target) => (
                  <RailItem
                    key={target.id}
                    type="button"
                    $active={activeTarget === target.id}
                    aria-pressed={activeTarget === target.id}
                    onClick={() => setActiveTarget(target.id)}>
                    <RailLogo>
                      <img src={target.logo} alt={target.label} />
                    </RailLogo>
                    <RailInfo>
                      <RailName>{target.label}</RailName>
                      <RailMeta>
                        <Dot $tone={target.chip} />
                        <span>{target.status}</span>
                        <Sep aria-hidden="true">·</Sep>
                        {target.meta}
                      </RailMeta>
                    </RailInfo>
                  </RailItem>
                ))}
              </Rail>
              {activeTarget === 'workbuddy' ? (
                <Main data-testid="workbuddy-target-page">
                  <PaneHeader>
                    <PaneTitle>
                      <strong>{t('agentRouter.routes')}</strong>
                      <CountChip>
                        {t('agentRouter.enabledRouteCount', {
                          enabled: router.routes.filter((route) => route.enabled).length,
                          total: router.routes.length
                        })}
                      </CountChip>
                    </PaneTitle>
                    <EditionSwitch role="group" aria-label={t('agentRouter.target.workbuddy.label')}>
                      <EditionOption
                        type="button"
                        $active={router.workBuddyEdition === 'domestic'}
                        aria-pressed={router.workBuddyEdition === 'domestic'}
                        disabled={router.busy || router.refreshing}
                        onClick={() => {
                          if (router.workBuddyEdition !== 'domestic') {
                            void router.switchWorkBuddyEdition('domestic').catch(onError)
                          }
                        }}>
                        {t('agentRouter.workbuddyDomesticEdition')}
                      </EditionOption>
                      <EditionOption
                        type="button"
                        $active={router.workBuddyEdition === 'overseas'}
                        aria-pressed={router.workBuddyEdition === 'overseas'}
                        disabled={router.busy || router.refreshing}
                        onClick={() => {
                          if (router.workBuddyEdition !== 'overseas') {
                            void router.switchWorkBuddyEdition('overseas').catch(onError)
                          }
                        }}>
                        {t('agentRouter.workbuddyOverseasEdition')}
                      </EditionOption>
                    </EditionSwitch>
                  </PaneHeader>
                  <TargetStatusCard target={router.target} onSelect={router.selectConfig} />
                  <ScrollArea data-testid="routes-panel">
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
                  </ScrollArea>
                </Main>
              ) : activeTarget === 'claude-code' ? (
                <Main data-testid="claude-code-target-page">
                  <PaneHeader>
                    <PaneTitle>
                      <strong>{t('agentRouter.plans')}</strong>
                      <CountChip>{t('agentRouter.planCount', { count: claudeCode.library.profiles.length })}</CountChip>
                    </PaneTitle>
                  </PaneHeader>
                  <TargetStatusCard
                    target={claudeCode.target}
                    onSelect={() => void claudeCode.selectConfig()}
                    showEntryCounts={false}
                    missingConfigWillBeCreated
                  />
                  <ScrollArea data-testid="routes-panel">
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
                        setPendingApply({ target: 'claude-code', profileId: profile.id })
                      }}
                      onRemove={(profile) => void claudeCode.removeSelected(profile.id)}
                    />
                  </ScrollArea>
                </Main>
              ) : (
                <Main data-testid="codex-target-page">
                  <PaneHeader>
                    <PaneTitle>
                      <strong>{t('agentRouter.plans')}</strong>
                      <CountChip>{t('agentRouter.planCount', { count: codex.library.profiles.length })}</CountChip>
                    </PaneTitle>
                  </PaneHeader>
                  <TargetStatusCard
                    target={codex.target}
                    onSelect={() => void codex.selectConfig()}
                    showEntryCounts={false}
                    missingConfigWillBeCreated
                  />
                  <ScrollArea data-testid="routes-panel">
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
                        setPendingApply({ target: 'codex', profileId: profile.id })
                      }}
                      onRemove={(profile) => void codex.removeSelected(profile.id)}
                    />
                  </ScrollArea>
                </Main>
              )}
            </Split>
          )}
        </Body>
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
          const shouldApply =
            value.profileId === claudeCode.library.activeProfileId ||
            (!claudeCode.library.activeProfileId && claudeCode.target?.detectionState === 'notFound')
          void claudeCode
            .saveDraft(value)
            .then(async (savedProfileId) => {
              if (!shouldApply || (await claudeCode.applyProfile(savedProfileId))) setProfileModalOpen(false)
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
      <ConfirmDialog
        open={Boolean(pendingApply)}
        title={t('agentRouter.overwriteWarningTitle')}
        okText={t('agentRouter.apply')}
        cancelText={t('common.cancel')}
        onCancel={() => setPendingApply(null)}
        onOk={() => {
          if (!pendingApply) return
          if (pendingApply.target === 'claude-code') void claudeCode.applyProfile(pendingApply.profileId)
          else void codex.applyProfile(pendingApply.profileId)
          setPendingApply(null)
        }}>
        {t('agentRouter.overwriteWarning')}
      </ConfirmDialog>
    </Page>
  )
}

const Page = styled.main`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100vh;
  min-width: 0;
  overflow: hidden;
`

const Content = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
  min-height: 0;
  padding: 16px 20px 20px;
  overflow: hidden;
  border-radius: var(--base-border-radius);
  background: var(--color-background);
`

const TopBar = styled.div`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 32px;
`

const Segments = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--color-border-soft);
  border-radius: 999px;
  background: var(--color-background-soft);

  body.light & {
    border-color: rgb(150 188 240 / 26%);
    background: rgb(240 245 253);
  }
`

const Segment = styled.button<{ $active: boolean }>`
  height: 26px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: ${(props) => (props.$active ? 'var(--color-background)' : 'transparent')};
  color: ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-text-3)')};
  font-size: 12.5px;
  font-weight: ${(props) => (props.$active ? 650 : 500)};
  white-space: nowrap;
  cursor: pointer;
  box-shadow: ${(props) => (props.$active ? '0 3px 8px rgb(77 122 190 / 12%)' : 'none')};
  transition:
    color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    color: var(--color-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 1px;
  }
`

const PrimaryAction = styled.button`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 6px 16px rgb(60 116 234 / 22%);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;

  svg {
    color: inherit;
  }

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 22px rgb(60 116 234 / 26%);
  }

  &:active {
    transform: translateY(0);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    &:hover {
      transform: none;
    }
  }
`

const Body = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
`

const Split = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`

const Rail = styled.div`
  display: flex;
  flex: 0 0 228px;
  flex-direction: column;
  gap: 4px;
  box-sizing: border-box;
  min-height: 0;
  padding-right: 18px;
  overflow: hidden;
  border-right: 1px solid var(--color-border-soft);

  body.light & {
    border-right-color: rgb(132 172 226 / 16%);
  }
`

const RailHeader = styled.div`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 26px;
  padding: 0 2px 0 4px;

  > span {
    overflow: hidden;
    color: var(--color-text-3);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
`

const RefreshKey = styled.button`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid rgb(150 188 240 / 26%);
  border-radius: 50%;
  background: var(--color-background);
  color: var(--color-text-3);
  font-size: 12px;
  cursor: pointer;
  transition: box-shadow 0.2s ease;

  &:hover:not(:disabled) {
    box-shadow: 0 4px 10px rgb(77 122 190 / 14%);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 1px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
`

const RailItem = styled.button<{ $active: boolean }>`
  position: relative;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  min-height: 56px;
  padding: 8px 10px 8px 13px;
  border: 1px solid ${(props) => (props.$active ? 'rgb(90 143 215 / 46%)' : 'transparent')};
  border-radius: 12px;
  background: var(--color-background-soft);
  text-align: left;
  cursor: pointer;
  box-shadow: ${(props) => (props.$active ? '0 8px 18px rgb(77 122 190 / 12%)' : 'none')};
  transition: box-shadow 0.2s ease;

  &::before {
    position: absolute;
    top: 50%;
    left: 0;
    width: 3px;
    height: 22px;
    border-radius: 0 3px 3px 0;
    background: var(--color-primary);
    opacity: ${(props) => (props.$active ? 1 : 0)};
    transform: translateY(-50%);
    transition: opacity 0.2s ease;
    content: '';
  }

  body.light & {
    background: ${(props) => (props.$active ? 'rgb(255 255 255)' : 'rgb(246 250 255)')};
  }

  body.dark & {
    background: ${(props) => (props.$active ? 'rgb(255 255 255 / 9%)' : 'rgb(255 255 255 / 4%)')};
  }

  &:hover {
    box-shadow: 0 8px 18px rgb(77 122 190 / 12%);
  }

  &:active {
    box-shadow: none;
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 1px;
  }
`

const RailLogo = styled.span`
  display: grid;
  flex: 0 0 26px;
  place-items: center;
  width: 26px;
  height: 26px;

  img {
    display: block;
    width: 24px;
    height: 24px;
    object-fit: contain;
  }
`

const RailInfo = styled.span`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
`

const RailName = styled.span`
  overflow: hidden;
  color: var(--color-text-1);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.35;
  white-space: nowrap;
  text-overflow: ellipsis;
`

const RailMeta = styled.span`
  display: flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  color: var(--color-text-3);
  font-size: 11px;
  line-height: 1.3;
  white-space: nowrap;

  b {
    color: var(--color-text-2);
    font-weight: 650;
  }
`

const Dot = styled.span<{ $tone: ChipTone }>`
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${(props) =>
    props.$tone === 'success' ? '#22aa78' : props.$tone === 'warning' ? '#e99a2e' : 'rgb(160 174 196)'};

  body.dark & {
    background: ${(props) =>
      props.$tone === 'success'
        ? 'rgb(84 205 155)'
        : props.$tone === 'warning'
          ? 'rgb(240 176 84)'
          : 'rgb(126 140 162)'};
  }
`

const Sep = styled.span`
  flex: 0 0 auto;
  opacity: 0.6;
`

const Main = styled.section`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  min-height: 0;
  padding-left: 18px;
  overflow: hidden;
`

const GlobalPane = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: auto;
`

const PaneHeader = styled.div`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 26px;
`

const PaneTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;

  strong {
    color: var(--color-text-1);
    font-size: 14px;
    font-weight: 650;
    white-space: nowrap;
  }
`

const CountChip = styled.span`
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgb(96 150 255 / 10%);
  color: var(--color-primary);
  font-size: 10.5px;
  font-weight: 600;
  white-space: nowrap;
`

const Hint = styled.span`
  overflow: hidden;
  color: var(--color-text-3);
  font-size: 11.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
`

const ScrollArea = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
`

const EditionSwitch = styled.div`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border: 1px solid rgb(150 188 240 / 26%);
  border-radius: 999px;
  background: var(--color-background-soft);
  white-space: nowrap;

  body.light & {
    background: rgb(240 245 253);
  }
`

const EditionOption = styled.button<{ $active: boolean }>`
  height: 22px;
  padding: 0 10px;
  border: 0;
  border-radius: 999px;
  background: ${(props) => (props.$active ? 'var(--color-background)' : 'transparent')};
  color: ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-text-3)')};
  font-size: 11.5px;
  font-weight: ${(props) => (props.$active ? 650 : 500)};
  white-space: nowrap;
  cursor: pointer;
  box-shadow: ${(props) => (props.$active ? '0 2px 6px rgb(77 122 190 / 12%)' : 'none')};
  transition: color 0.2s ease;

  &:hover:not(:disabled) {
    color: var(--color-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 1px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`

export default AgentRouterPage
