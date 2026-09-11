// import NewAppButton from './NewAppButton'
import { getMiniProgramList } from '@renderer/api/miniProgram'
import { Navbar, NavbarMain } from '@renderer/components/app/Navbar'
import App from '@renderer/components/MinApp/MinApp'
import Scrollbar from '@renderer/components/Scrollbar'
// import { useMinapps } from '@renderer/hooks/useMinapps'
import { useRuntime } from '@renderer/hooks/useRuntime'
import { useNavbarPosition, useSettings } from '@renderer/hooks/useSettings'
import { Button, Input } from 'antd'
import { Bot, Image, Search, SettingsIcon } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import DeepSeekHarnessButton from './components/DeepSeekHarnessButton'
import ToolboxEntryButton from './components/ToolboxEntryButton'
import ToolboxSection from './components/ToolboxSection'
import VeryClawButton from './components/VeryClawButton'
import MinappSettingsPopup from './MiniappSettings/MinappSettingsPopup'
// import {WEB_UI_HOST} from "@shared/config/constant";
// import AiOnlyLogo from "@renderer/assets/images/providers/aiOnly.png";

const AppsPage: FC = () => {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  // const { minapps } = useMinapps()
  const { isTopNavbar } = useNavbarPosition()
  const { minappShow } = useRuntime()
  const { defaultPaintingProvider } = useSettings()
  const navigate = useNavigate()
  const [apiApps, setApiApps] = useState([])

  const queryParams = useRef({
    // programName: '', // String | 小程序名称
    //status: '',  // String | 启用状态
    pageNum: 1,
    pageSize: 100 // TODO: 先查100条，足够用了，目前也就两个
  })

  /*const filteredApps = search
    ? minapps.filter(
        (app) => app.name.toLowerCase().includes(search.toLowerCase()) || app.url.includes(search.toLowerCase())
      )
    : minapps*/

  // Disable right-click menu in blank area
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  // 查询小程序列表
  const fetchMiniProgramList = useCallback(async () => {
    const res = await getMiniProgramList(queryParams.current)
    const data = res.rows || []
    const apps = data.map((item: any) => {
      return {
        id: item.id,
        name: item.programName,
        url: item.url,
        logo: item.logoUrl,
        bodered: true,
        style: {
          borderRadius: 10
        },
        supportedRegions: ['CN', 'Global']
      }
    })
    setApiApps(apps)
  }, [])

  useEffect(() => {
    fetchMiniProgramList().then()
  }, [fetchMiniProgramList])

  return (
    <Container onContextMenu={handleContextMenu} className="page-container">
      <Navbar className={minappShow ? 'opacity-0' : ''}>
        <NavbarMain>
          {t('minapp.title')}
          {/*<Input
            placeholder={t('common.search')}
            className="nodrag"
            style={{
              width: '30%',
              height: 28,
              borderRadius: 15
            }}
            size="small"
            variant="filled"
            suffix={<Search size={18} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button
            type="text"
            className="nodrag"
            icon={<SettingsIcon size={18} color="var(--color-text-2)" />}
            onClick={MinappSettingsPopup.show}
          />*/}
        </NavbarMain>
      </Navbar>
      <ContentContainer id="content-container">
        <MainContainer>
          <RightContainer>
            {isTopNavbar && (
              <HeaderContainer>
                <Input
                  placeholder={t('common.search')}
                  className="nodrag"
                  style={{ width: '30%', borderRadius: 15 }}
                  variant="filled"
                  suffix={<Search size={18} />}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Button
                  type="text"
                  className="nodrag"
                  icon={<SettingsIcon size={18} color="var(--color-text-2)" />}
                  onClick={() => MinappSettingsPopup.show()}
                />
              </HeaderContainer>
            )}
            <AppsContainerWrapper>
              <AppsContainer>
                <ToolboxSection title={t('minapp.toolbox.built_in')}>
                  <ToolboxEntryButton
                    icon={<Image size={32} strokeWidth={2} className="lucide-custom" aria-hidden="true" />}
                    tone="blue"
                    label={t('title.paintings')}
                    onClick={() => navigate(`/paintings/${defaultPaintingProvider}`)}
                  />
                  <ToolboxEntryButton
                    icon={<Bot size={32} strokeWidth={2} className="lucide-custom" aria-hidden="true" />}
                    tone="cyan"
                    label={t('agent.sidebar_title')}
                    onClick={() => navigate('/agents')}
                  />
                </ToolboxSection>
                <ToolboxSection title={t('minapp.toolbox.extensions')}>
                  <VeryClawButton />
                  <DeepSeekHarnessButton />
                </ToolboxSection>
                <ToolboxSection title={t('minapp.toolbox.mini_app')}>
                  {apiApps.map((app: any) => (
                    <App key={app.id} app={app} variant="toolbox" />
                  ))}
                  {/*<NewAppButton />*/}
                </ToolboxSection>
              </AppsContainer>
            </AppsContainerWrapper>
          </RightContainer>
        </MainContainer>
      </ContentContainer>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`

const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  justify-content: center;
  height: 100%;
  background-color: var(--color-background);
`

const HeaderContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  height: 60px;
  width: 100%;
  gap: 10px;
`

const MainContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  height: calc(100vh - var(--navbar-height) - 10px);
  width: 100%;
`

const RightContainer = styled(Scrollbar)`
  display: flex;
  flex: 1 1 0%;
  min-width: 0;
  flex-direction: column;
  height: 100%;
  align-items: center;
  height: calc(100vh - var(--navbar-height));
`

const AppsContainerWrapper = styled(Scrollbar)`
  display: flex;
  flex: 1;
  flex-direction: row;
  justify-content: flex-start;
  box-sizing: border-box;
  padding: 32px 28px 48px;
  width: 100%;
  margin-bottom: 20px;
  [navbar-position='top'] & {
    padding: 20px 28px 40px;
  }
`

const AppsContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  width: 100%;
  gap: 32px;
`

export default AppsPage
