import '@renderer/databases'

import { PROFILE_RUNTIME_CHANGED_EVENT } from '@renderer/services/ProfileRendererRuntime'
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
