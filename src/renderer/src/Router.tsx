import '@renderer/databases'

import { useLoginState } from '@renderer/hooks/useLoginState'
import LoginPage from '@renderer/pages/login'
import type { FC } from 'react'
import { useMemo } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'

import AuthRoute from './AuthRoute'
import Sidebar from './components/app/Sidebar'
import { ErrorBoundary } from './components/ErrorBoundary'
import TabsContainer from './components/Tab/TabContainer'
import NavigationHandler from './handler/NavigationHandler'
// import { useOnboardingState } from './hooks/useOnboardingState'
import { useNavbarPosition } from './hooks/useSettings'
import AgentRouterPage from './pages/agentRouter/AgentRouterPage'
import AgentPage from './pages/agents/AgentPage'
import CodeToolsPage from './pages/code/CodeToolsPage'
import FilesPage from './pages/files/FilesPage'
import HomePage from './pages/home/HomePage'
import KnowledgePage from './pages/knowledge/KnowledgePage'
import LaunchpadPage from './pages/launchpad/LaunchpadPage'
import MinAppPage from './pages/minapps/MinAppPage'
import MinAppsPage from './pages/minapps/MinAppsPage'
import NotesPage from './pages/notes/NotesPage'
// import { OnboardingPage } from './pages/onboarding'
import OpenClawPage from './pages/openclaw/OpenClawPage'
import PaintingsRoutePage from './pages/paintings/PaintingsRoutePage'
import RoundtablePage from './pages/roundtable/RoundtablePage'
import SettingsPage from './pages/settings/SettingsPage'
import AssistantPresetsPage from './pages/store/assistants/presets/AssistantPresetsPage'
import TokenPlanPage from './pages/tokenPlan/TokenPlanPage'
import TranslatePage from './pages/translate/TranslatePage'

const Router: FC = () => {
  const { completeLogin } = useLoginState()

  const { navbarPosition } = useNavbarPosition()

  const protectedRoutes = useMemo(
    () => (
      <ErrorBoundary>
        <AuthRoute>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/roundtable" element={<RoundtablePage />} />
            <Route path="/agents" element={<AgentPage />} />
            <Route path="/agent-router" element={<AgentRouterPage />} />
            <Route path="/store" element={<AssistantPresetsPage />} />
            <Route path="/paintings/*" element={<PaintingsRoutePage />} />
            <Route path="/translate" element={<TranslatePage />} />
            <Route path="/files" element={<FilesPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/apps/:appId" element={<MinAppPage />} />
            <Route path="/apps" element={<MinAppsPage />} />
            <Route path="/code" element={<CodeToolsPage />} />
            <Route path="/openclaw" element={<OpenClawPage />} />
            <Route path="/settings/*" element={<SettingsPage />} />
            <Route path="/launchpad" element={<LaunchpadPage />} />
            <Route path="/tokenPlan" element={<TokenPlanPage />} />
          </Routes>
        </AuthRoute>
      </ErrorBoundary>
    ),
    []
  )

  if (navbarPosition === 'left') {
    return (
      <HashRouter>
        <NavigationHandler />
        <Routes>
          <Route path="/login" element={<LoginPage onComplete={completeLogin} />} />
          <Route
            path="/*"
            element={
              <>
                <Sidebar />
                {protectedRoutes}
              </>
            }
          />
        </Routes>
      </HashRouter>
    )
  }

  return (
    <HashRouter>
      <NavigationHandler />
      <Routes>
        <Route path="/login" element={<LoginPage onComplete={completeLogin} />} />
        <Route path="/*" element={<TabsContainer>{protectedRoutes}</TabsContainer>} />
      </Routes>
    </HashRouter>
  )
}

export default Router
