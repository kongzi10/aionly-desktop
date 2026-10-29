// import NewAppButton from './NewAppButton'
import { getMiniProgramList } from '@renderer/api/miniProgram'
import { Navbar, NavbarMain } from '@renderer/components/app/Navbar'
import App from '@renderer/components/MinApp/MinApp'
import Scrollbar from '@renderer/components/Scrollbar'
// import { useMinapps } from '@renderer/hooks/useMinapps'
import { useRuntime } from '@renderer/hooks/useRuntime'
import { useSettings } from '@renderer/hooks/useSettings'
import { Bot, Image, Search, X } from 'lucide-react'
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
// import {WEB_UI_HOST} from "@shared/config/constant";
// import AiOnlyLogo from "@renderer/assets/images/providers/aiOnly.png";

const AppsPage: FC = () => {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  // const { minapps } = useMinapps()
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
    void fetchMiniProgramList()
  }, [fetchMiniProgramList])

  // 搜索词过滤：未搜索时三段常驻（小程序为空则由分区自己给占位），搜索时隐掉没有命中的分区
  const keyword = search.trim().toLowerCase()
  const searching = keyword.length > 0
  const matched = (text: string) => !keyword || text.toLowerCase().includes(keyword)

  const paintingsVisible = matched(t('title.paintings'))
  const agentsVisible = matched(t('agent.sidebar_title'))
  const veryClawVisible = matched(t('minapp.veryclaw.name'))
  const deepSeekVisible = matched('DeepSeek Harness')
  const matchedMiniApps = (apiApps as any[]).filter((app) => matched(app.name ?? ''))

  const showBuiltIn = !searching || paintingsVisible || agentsVisible
  const showExtensions = !searching || veryClawVisible || deepSeekVisible
  const showMiniApps = !searching || matchedMiniApps.length > 0
  const hasResult = showBuiltIn || showExtensions || showMiniApps

  return (
    <Container onContextMenu={handleContextMenu} className="page-container nav-module-layout">
      <Navbar className={minappShow ? 'opacity-0' : ''}>
        <NavbarMain>{t('minapp.title')}</NavbarMain>
      </Navbar>
      <ContentContainer id="content-container" className="nav-module-surface">
        <PageScroller>
          <Page>
            <Hero>
              <HeroLead>
                <HeroBadge aria-hidden="true">
                  {/* 与左侧栏「工具箱」菜单同款图标 */}
                  <i className="iconfont icon-gongjuxiang" />
                </HeroBadge>
                <HeroCopy>
                  <HeroTitle>{t('minapp.toolbox.subtitle')}</HeroTitle>
                  <HeroHint>{t('minapp.toolbox.subtitle_hint')}</HeroHint>
                </HeroCopy>
              </HeroLead>
              <HeroActions>
                <SearchField>
                  <Search size={15} strokeWidth={2.2} aria-hidden="true" />
                  <input
                    className="nodrag"
                    type="search"
                    value={search}
                    placeholder={t('common.search')}
                    aria-label={t('common.search')}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search ? (
                    <ClearButton type="button" aria-label={t('common.clear')} onClick={() => setSearch('')}>
                      <X size={13} strokeWidth={2.6} />
                    </ClearButton>
                  ) : null}
                </SearchField>
              </HeroActions>
            </Hero>
            <AppsContainer>
              {showBuiltIn && (
                <ToolboxSection title={t('minapp.toolbox.built_in')} tone="blue" tourId="toolbox-built-in">
                  {paintingsVisible && (
                    <ToolboxEntryButton
                      icon={<Image size={28} strokeWidth={2} className="lucide-custom" aria-hidden="true" />}
                      tone="blue"
                      label={t('title.paintings')}
                      description={t('minapp.toolbox.paintings_description')}
                      onClick={() => navigate(`/paintings/${defaultPaintingProvider}`)}
                    />
                  )}
                  {agentsVisible && (
                    <ToolboxEntryButton
                      icon={<Bot size={28} strokeWidth={2} className="lucide-custom" aria-hidden="true" />}
                      tone="cyan"
                      label={t('agent.sidebar_title')}
                      description={t('minapp.toolbox.agents_description')}
                      onClick={() => navigate('/agents')}
                    />
                  )}
                </ToolboxSection>
              )}
              {showExtensions && (
                <ToolboxSection title={t('minapp.toolbox.extensions')} tone="cyan" tourId="toolbox-extensions">
                  {veryClawVisible && <VeryClawButton />}
                  {deepSeekVisible && <DeepSeekHarnessButton />}
                </ToolboxSection>
              )}
              {showMiniApps && (
                <ToolboxSection
                  title={t('minapp.toolbox.mini_app')}
                  tone="violet"
                  tourId="toolbox-mini-apps"
                  emptyText={t('minapp.toolbox.mini_app_empty')}>
                  {matchedMiniApps.map((app: any) => (
                    <App key={app.id} app={app} variant="toolbox" />
                  ))}
                  {/*<NewAppButton />*/}
                </ToolboxSection>
              )}
              {!hasResult && (
                <EmptyState>
                  <Search size={20} strokeWidth={1.8} aria-hidden="true" />
                  <span>{t('common.no_results')}</span>
                </EmptyState>
              )}
            </AppsContainer>
          </Page>
        </PageScroller>
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
  flex-direction: column;
  min-height: 0;
  background-color: var(--color-background);
`

const PageScroller = styled(Scrollbar)`
  flex: 1;
  min-height: 0;
  width: 100%;
`

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  box-sizing: border-box;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 22px 28px 44px;

  [navbar-position='top'] & {
    padding: 18px 28px 36px;
  }
`

const Hero = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  box-sizing: border-box;
  width: 100%;
  padding: 16px 18px;
  overflow: hidden;
  border: 1px solid var(--color-border-soft);
  border-radius: 18px;
  background: var(--color-background-soft);

  body.light & {
    border-color: rgb(140 180 245 / 26%);
    /* 浅蓝纯色底，无渐变、无柔光叠加 */
    background: rgb(233 241 255);
    box-shadow: 0 16px 38px rgb(77 122 190 / 10%);
  }

  body.dark & {
    background: rgb(96 150 255 / 10%);
  }

  @media (max-width: 720px) {
    flex-direction: column;
    align-items: stretch;
  }
`

const HeroLead = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`

const HeroBadge = styled.span`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 13px;
  border: 1px solid rgb(140 180 245 / 34%);
  background: rgb(255 255 255 / 92%);
  color: rgb(106 160 245);
  box-shadow: 0 4px 10px rgb(96 150 255 / 14%);

  i {
    font-size: 20px;
    line-height: 1;
  }

  body.dark & {
    border-color: rgb(120 160 230 / 22%);
    background: rgb(39 46 62);
    color: rgb(114 154 226);
  }
`

const HeroCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
`

const HeroTitle = styled.h1`
  overflow: hidden;
  margin: 0;
  color: var(--color-text);
  font-size: 15px;
  font-weight: 650;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const HeroHint = styled.p`
  overflow: hidden;
  margin: 0;
  color: var(--color-text-3);
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const HeroActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;

  @media (max-width: 720px) {
    width: 100%;
  }
`

const SearchField = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  width: 240px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid rgb(150 188 240 / 34%);
  border-radius: 999px;
  /* Hero 底色改为浅蓝后，输入框用白色实底拉开层次 */
  background: rgb(255 255 255);
  color: var(--color-text-3);
  cursor: text;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease;

  &:focus-within {
    border-color: rgb(90 143 215 / 45%);
    background: rgb(250 252 255);
    box-shadow: 0 0 0 3px rgb(94 154 232 / 14%);
  }

  body.dark & {
    background: rgb(38 45 60);
  }

  input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--color-text);
    font: inherit;
    font-size: 13px;

    &::placeholder {
      color: var(--color-text-3);
    }

    &::-webkit-search-cancel-button {
      display: none;
    }
  }

  @media (max-width: 720px) {
    flex: 1;
    width: auto;
  }
`

const ClearButton = styled.button`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgb(111 115 139 / 14%);
  color: var(--color-text-2);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;

  &:hover {
    background: rgb(90 143 215 / 20%);
    color: var(--color-primary);
  }
`

const AppsContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  width: 100%;
  gap: 16px;
`

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 52px 0;
  border: 1px dashed rgb(132 172 226 / 28%);
  border-radius: 18px;
  color: var(--color-text-3);
  font-size: 13px;
`

export default AppsPage
