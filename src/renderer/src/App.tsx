import '@renderer/databases'

import { ensureAiOnlyModelsLoaded } from '@renderer/hooks/useAiOnlyModels'
import { PROFILE_RUNTIME_CHANGED_EVENT } from '@renderer/services/ProfileRendererRuntime'
import { refreshServiceInfo } from '@renderer/services/serviceInfoService'
import { persistor, store } from '@renderer/store'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'

import TopViewContainer from './components/TopView'
import AntdProvider from './context/AntdProvider'
import { CodeStyleProvider } from './context/CodeStyleProvider'
import { NotificationProvider } from './context/NotificationProvider'
import StyleSheetManager from './context/StyleSheetManager'
import { ThemeProvider } from './context/ThemeProvider'
import { DshThemeSync } from './pages/minapps/components/DshThemeSync'
import Router from './Router'

function App(): React.ReactElement {
  const [runtimeVersion, setRuntimeVersion] = useState(0)

  useEffect(() => {
    const handleProfileChange = () => setRuntimeVersion((version) => version + 1)
    window.addEventListener(PROFILE_RUNTIME_CHANGED_EVENT, handleProfileChange)
    return () => window.removeEventListener(PROFILE_RUNTIME_CHANGED_EVENT, handleProfileChange)
  }, [])

  return <ProfileApp key={runtimeVersion} />
}

function ProfileApp(): React.ReactElement {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false
          }
        }
      })
  )

  useEffect(() => () => queryClient.clear(), [queryClient])

  // 重启/profile 切换后已登录但模型列表为空时，补拉一次模型列表
  useEffect(() => {
    void ensureAiOnlyModelsLoaded()
  }, [])

  // 重启（自动登录跳过登录页）/切换身份后补拉一次服务配置（serviceInfo），
  // 避免 planStatus 缺失导致左侧导航 token plan、设置页 TokenPlan 按钮等入口消失。
  // ProfileApp 以 runtimeVersion 为 key，profile 切换后重挂载即会重新执行
  useEffect(() => {
    void refreshServiceInfo()
  }, [])

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <StyleSheetManager>
          <ThemeProvider>
            <DshThemeSync />
            <AntdProvider>
              <NotificationProvider>
                <CodeStyleProvider>
                  <PersistGate loading={null} persistor={persistor}>
                    <TopViewContainer>
                      <Router />
                    </TopViewContainer>
                  </PersistGate>
                </CodeStyleProvider>
              </NotificationProvider>
            </AntdProvider>
          </ThemeProvider>
        </StyleSheetManager>
      </QueryClientProvider>
    </Provider>
  )
}

export default App
