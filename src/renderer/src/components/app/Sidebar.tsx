import logo from '@renderer/assets/images/logo.png'
import UserAvatar from '@renderer/components/UserAvatar'
import { isMac } from '@renderer/config/constant'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useFullscreen } from '@renderer/hooks/useFullscreen'
import { useMinappPopup } from '@renderer/hooks/useMinappPopup'
// import { useMinapps } from '@renderer/hooks/useMinapps'
import useNavBackgroundColor from '@renderer/hooks/useNavBackgroundColor'
import { modelGenerating, useRuntime } from '@renderer/hooks/useRuntime'
import { getSidebarIconLabel /*getThemeModeLabel*/ } from '@renderer/i18n/label'
import { useAppSelector } from '@renderer/store'
import { selectServiceInfo } from '@renderer/store/user'
// import { ThemeMode } from '@renderer/types'
import { Avatar /*Tooltip*/ } from 'antd'
/*import {
  Code,
  FileSearch,
  Folder,
  Languages,
  LayoutGrid,
  MessageSquare,
  // Monitor,
  // Moon,
  MousePointerClick,
  NotepadText,
  Palette,
  Settings,
  Sparkle,
  // Sun
} from 'lucide-react'*/
import type { FC } from 'react'
import { useMemo } from 'react'
// import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'

// import { OpenClawSidebarIcon } from '../Icons/SVGIcon'
// import { SidebarOpenedMinappTabs, SidebarPinnedApps } from './PinnedMinapps'

const Sidebar: FC = () => {
  const { hideMinappPopup } = useMinappPopup()
  const { minappShow } = useRuntime()
  // const { sidebarIcons } = useSettings()
  // const { pinned } = useMinapps()

  // const { pathname } = useLocation()
  // const navigate = useNavigate()
  //
  // const { theme, settedTheme, toggleTheme } = useTheme()
  // const { t } = useTranslation()

  const backgroundColor = useNavBackgroundColor()

  // const showPinnedApps = pinned.length > 0 && sidebarIcons.visible.includes('minapp')

  // const to = async (path: string) => {
  //   await modelGenerating()
  //   navigate(path)
  // }

  const isFullscreen = useFullscreen()

  return (
    <Container
      $isFullscreen={isFullscreen}
      id="app-sidebar"
      style={{ backgroundColor, zIndex: minappShow ? 10000 : 'initial' }}>
      {/*{isEmoji(avatar) ? (
        <EmojiAvatar onClick={onEditUser} className="sidebar-avatar" size={31} fontSize={18}>
          {avatar}
        </EmojiAvatar>
      ) : (
        <AvatarImg src={avatar || UserAvatar} draggable={false} className="nodrag" onClick={onEditUser} />
      )}*/}
      <AvatarImg src={logo} draggable={false} className="nodrag" />
      <MainMenusContainer>
        <Menus onClick={hideMinappPopup}>
          <MainMenus />
        </Menus>
        {/*<SidebarOpenedMinappTabs />
        {showPinnedApps && (
          <AppsContainer>
            <Divider />
            <Menus>
              <SidebarPinnedApps />
            </Menus>
          </AppsContainer>
        )}*/}
      </MainMenusContainer>
      <Menus>
        <UserAvatar />
        {/*<Tooltip title={t('settings.theme.title') + ': ' + getThemeModeLabel(settedTheme)} placement="right">
          <Icon theme={theme} onClick={toggleTheme}>
            {settedTheme === ThemeMode.dark ? (
              <Moon size={20} className="icon" />
            ) : settedTheme === ThemeMode.light ? (
              <Sun size={20} className="icon" />
            ) : (
              <Monitor size={20} className="icon" />
            )}
          </Icon>
        </Tooltip>*/}
        {/*<Tooltip title={t('settings.title')} mouseEnterDelay={0.8} placement="right">
          <StyledLink
            onClick={async () => {
              hideMinappPopup()
              await to('/settings/provider')
            }}>
            <Icon theme={theme} className={pathname.startsWith('/settings') && !minappShow ? 'active' : ''}>
              <Settings size={20} className="icon" />
            </Icon>
          </StyledLink>
        </Tooltip>*/}
      </Menus>
    </Container>
  )
}

const MainMenus: FC = () => {
  const { hideMinappPopup } = useMinappPopup()
  const { pathname } = useLocation()
  const { minappShow } = useRuntime()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const serviceInfo = useAppSelector(selectServiceInfo)

  const isRoute = (path: string): string => (pathname === path && !minappShow ? 'active' : '')
  const isRoutes = (path: string): string => (pathname.startsWith(path) && path !== '/' && !minappShow ? 'active' : '')

  /*const iconMap = {
    assistants: <MessageSquare size={18} className="icon" />,
    agents: <MousePointerClick size={18} className="icon" />,
    store: <Sparkle size={18} className="icon" />,
    paintings: <Palette size={18} className="icon" />,
    translate: <Languages size={18} className="icon" />,
    minapp: <LayoutGrid size={18} className="icon" />,
    knowledge: <FileSearch size={18} className="icon" />,
    files: <Folder size={18} className="icon" />,
    notes: <NotepadText size={18} className="icon" />,
    code_tools: <Code size={18} className="icon" />,
    openclaw: <OpenClawSidebarIcon style={{ width: 18, height: 18 }} className="icon" />
  }

  const pathMap = {
    assistants: '/',
    agents: '/agents',
    store: '/store',
    paintings: `/paintings/${defaultPaintingProvider}`,
    translate: '/translate',
    minapp: '/apps',
    knowledge: '/knowledge',
    files: '/files',
    code_tools: '/code',
    notes: '/notes',
    openclaw: '/openclaw'
  }*/

  // 显示在左侧的菜单
  const showInLeftMenus = useMemo(() => {
    const base = [
      {
        path: '/',
        name: 'assistants',
        icon: 'icon-duihuamoren',
        iconActive: 'icon-duihuaxuanzhong'
      },
      {
        path: '/agents',
        name: 'agents',
        icon: 'icon-zhinengtimoren',
        iconActive: 'icon-zhinengtixuanzhong'
      },
      {
        // 工具箱(原小程序),绘画/翻译已收纳至工具箱页面
        path: '/apps',
        name: 'minapp',
        icon: 'icon-gongjuxiang',
        iconActive: 'icon-gongjuxiang'
      }
    ]
    const agentRouterMenu = {
      path: '/agent-router',
      name: 'agent_router',
      icon: 'icon-lianjie',
      iconActive: 'icon-lianjie'
    }
    if (serviceInfo?.planStatus == 1) {
      return [
        ...base,
        {
          path: '/tokenPlan',
          name: 'token plan',
          icon: 'icon-ziyuan1',
          iconActive: 'icon-ziyuan2'
        },
        agentRouterMenu
      ]
    }
    return [...base, agentRouterMenu]
  }, [serviceInfo?.planStatus])

  // console.log('sidebarIcons', sidebarIcons)

  /**
   * 原来是sidebarIcons.visible.map
   * 现改成showInLeftMenus--表示在左侧显示的菜单
   *
   **/
  return showInLeftMenus.map((menu) => {
    // console.log('menu', menu)
    // const path = pathMap[icon]
    const path = menu.path
    const isActive = path === '/' ? isRoute(path) : isRoutes(path)

    return (
      <StyledLink
        key={menu.path}
        onClick={async () => {
          hideMinappPopup()
          await modelGenerating()
          navigate(path)
        }}>
        <Icon theme={theme} className={isActive}>
          {/*{iconMap[menu.name]}*/}
          <i className={`iconfont icon ${isActive ? menu.iconActive : menu.icon}`}></i>
          <div className="name">{getSidebarIconLabel(menu.name)}</div>
        </Icon>
      </StyledLink>
    )
  })
}

const Container = styled.div<{ $isFullscreen: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0 12px;
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  height: ${({ $isFullscreen }) => (isMac && !$isFullscreen ? 'calc(100vh - var(--navbar-height))' : '100vh')};
  -webkit-app-region: drag !important;
  margin-top: ${({ $isFullscreen }) => (isMac && !$isFullscreen ? 'env(titlebar-area-height)' : 0)};

  .sidebar-avatar {
    margin-bottom: ${isMac ? '12px' : '12px'};
    margin-top: ${isMac ? '0px' : '2px'};
    -webkit-app-region: none;
  }
`

const AvatarImg = styled(Avatar)`
  width: 40px;
  height: 40px;
  // background-color: var(--color-background-soft);
  margin-bottom: ${isMac ? '12px' : '12px'};
  margin-top: ${isMac ? '0px' : '2px'};
  border: none;
  cursor: pointer;
`

const MainMenusContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
  padding: 0 5px;
`

const Menus = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
`

const Icon = styled.div<{ theme: string }>`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
  -webkit-app-region: none;
  border-radius: 8px;
  padding: 5px 0;
  border: 0.5px solid transparent;
  .icon {
    color: var(--color-icon);
  }
  .name{
    font-size: 10px;
  }
  &:hover {
    background-color: ${({ theme }) => (theme === 'dark' ? 'var(--color-black)' : 'var(--color-white)')};
    opacity: 0.8;
    cursor: pointer;
    .icon {
      color: var(--color-icon-white);
    }
  }
  &.active {
    background-color: ${({ theme }) => (theme === 'dark' ? 'var(--color-black)' : 'var(--color-white)')};
    border-color: var(--color-border);
    .icon {
      color: var(--color-primary);
    }
    color: var(--color-primary);
  }

  @keyframes borderBreath {
    0% {
      opacity: 0.1;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0.1;
    }
  }

  &.opened-minapp {
    position: relative;
  }
  &.opened-minapp::after {
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    border-radius: inherit;
    opacity: 0.3;
    border: 0.5px solid var(--color-primary);
  }
`

const StyledLink = styled.div`
  width: 100%;
  text-decoration: none;
  -webkit-app-region: none;
  &* {
    user-select: none;
  }
`

/*const AppsContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
  overflow-x: hidden;
  margin-bottom: 10px;
  -webkit-app-region: none;
  &::-webkit-scrollbar {
    display: none;
  }
`

const Divider = styled.div`
  width: 50%;
  margin: 8px 0;
  border-bottom: 0.5px solid var(--color-border);
`*/

export default Sidebar
