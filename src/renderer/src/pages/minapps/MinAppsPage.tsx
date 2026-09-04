// import NewAppButton from './NewAppButton'
import { getMiniProgramList } from '@renderer/api/miniProgram'
import { Navbar, NavbarMain } from '@renderer/components/app/Navbar'
import App from '@renderer/components/MinApp/MinApp'
import Scrollbar from '@renderer/components/Scrollbar'
// import { useMinapps } from '@renderer/hooks/useMinapps'
import { useRuntime } from '@renderer/hooks/useRuntime'
import { useNavbarPosition, useSettings } from '@renderer/hooks/useSettings'
import { Button, Input } from 'antd'
import { Image, Languages, Search, SettingsIcon } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import DeepSeekHarnessButton from './components/DeepSeekHarnessButton'
import ToolboxEntryButton from './components/ToolboxEntryButton'
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

  // Calculate the required number of lines
  const itemsPerRow = Math.floor(930 / 115) // Maximum width divided by the width of each item (including spacing)
  const rowCount = Math.ceil((apiApps.length + 3) / itemsPerRow) // +2 for the fixed module entries, +1 for the fixed DeepSeek Harness entry
  // Each line height is 85px (60px icon + 5px margin + 12px text + spacing)
  // DeepSeek Harness 名称换行占两行，其所在行需额外 ~16px
  const containerHeight = rowCount * 85 + (rowCount - 1) * 25 + 16 // 25px is the line spacing.

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
              <AppsContainer style={{ height: containerHeight }}>
                <ToolboxEntryButton
                  icon={<Image size={36} strokeWidth={2} className="lucide-custom" aria-hidden="true" />}
                  tone="blue"
                  label={t('title.paintings')}
                  onClick={() => navigate(`/paintings/${defaultPaintingProvider}`)}
                />
                <ToolboxEntryButton
                  icon={<Languages size={36} strokeWidth={2} className="lucide-custom" aria-hidden="true" />}
                  tone="cyan"
                  label={t('title.translate')}
                  onClick={() => navigate('/translate')}
                />
                <DeepSeekHarnessButton />
                {apiApps.map((app: any) => (
                  <App key={app.id} app={app} />
                ))}
                {/*<NewAppButton />*/}
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
  justify-content: center;
  padding: 50px 0;
  width: 100%;
  margin-bottom: 20px;
  [navbar-position='top'] & {
    padding: 20px 0;
  }
`

const AppsContainer = styled.div`
  display: grid;
  min-width: 0;
  max-width: 930px;
  margin: 0 20px;
  width: 100%;
  grid-template-columns: repeat(auto-fill, 90px);
  gap: 25px;
  justify-content: center;

  > div {
    justify-content: flex-start;
  }
`

export default AppsPage
