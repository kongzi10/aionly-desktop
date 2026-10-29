import { loggerService } from '@logger'
import defaultAvatar from '@renderer/assets/images/avatar-default.png'
import { SHOW_IN_USER_MENUS } from '@renderer/config/sidebar'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useMinappPopup } from '@renderer/hooks/useMinappPopup'
import { modelGenerating, useRuntime } from '@renderer/hooks/useRuntime'
import { getSidebarIconLabel } from '@renderer/i18n/label'
import { type HomePushItem, resolveHomeContentAction } from '@renderer/pages/home/homeContent'
import { getHomePushList } from '@renderer/pages/home/homeContentApi'
import { applyProfileSwitch } from '@renderer/services/ProfileLifecycleService'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { clearToken, selectUserInfo } from '@renderer/store/user'
import { Avatar, Popover } from 'antd'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'

interface Props {
  children?: React.ReactNode
}

const logger = loggerService.withContext('UserAvatar')

const Container = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-app-region: none;

  .ant-avatar{
    background-color: var(--color-gray-2);
  }
`

const AvatarOverlay = styled.div`
  position: absolute;
  z-index: 100000;
  bottom: 52px;
  left: 12px;
  width: 210px;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid rgb(255 255 255 / 80%);
  border-radius: 12px;
  background: rgb(255 255 255 / 94%);
  box-shadow: 0 12px 32px rgb(55 98 160 / 18%);
  color: #152b54;
  font-size: 12px;

  p {
    margin: 6px 0 10px;
    color: #667b9d;
    line-height: 1.5;
  }

  button {
    float: right;
    border: 0;
    border-radius: 6px;
    padding: 5px 10px;
    background: var(--color-primary);
    color: white;
    cursor: pointer;
  }
`

const UserInfoContainer = styled.div<{ theme: string }>`
  width: 180px;

  .user-info{
    display: flex;
    gap: 10px;
    align-items: center;
    padding-bottom: 10px;
    border-bottom:  1px solid ${({ theme }) => (theme === 'dark' ? 'var(--color-gray-3)' : 'var(--color-gray-4)')};

    .ant-avatar{
      background-color: var(--color-gray-2);
    }
  }

  .id-text{
    color: var(--color-gray-1);
    font-size: 12px;
  }
`

const MenuContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
`

const MenuItem = styled.div<{ theme: string }>`
  width: 100%;
  box-sizing: border-box;
  -webkit-app-region: none;
  padding: 5px 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 10px;
  .icon {
    // color: var(--color-icon);
  }
  &:hover {
    background-color: ${({ theme }) => (theme === 'dark' ? 'var(--color-black)' : 'var(--color-gray-4)')};
    opacity: 0.8;
    cursor: pointer;
    .icon {
      color: var(--color-icon-white);
    }
  }
  &.active {
    background-color: ${({ theme }) => (theme === 'dark' ? 'var(--color-black)' : 'var(--color-gray-4)')};
    .icon {
      color: var(--color-primary);
    }
    color: var(--color-primary);
  }
`

const UserAvatar: React.FC<Props> = () => {
  const { t } = useTranslation()
  const { hideMinappPopup, closeAllMinapps } = useMinappPopup()
  const userInfo: any = useAppSelector(selectUserInfo)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { theme /*settedTheme, toggleTheme*/ } = useTheme()
  const { pathname } = useLocation()
  const { minappShow } = useRuntime()
  const [overlay, setOverlay] = useState<HomePushItem | null>(null)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (pathname !== '/') {
      setOverlay(null)
      setOverlayVisible(false)
      return
    }
    let mounted = true
    void getHomePushList('avatar_overlay')
      .then((items) => {
        if (mounted) setOverlay(items[0] ?? null)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [pathname])

  const overlayAction = resolveHomeContentAction(overlay?.buttonUrl)
  const openOverlayAction = () => {
    if (!overlayAction) return
    setOverlayVisible(false)
    if (overlayAction.type === 'route') navigate(overlayAction.target)
    else void window.api.shell.openExternal(overlayAction.target)
  }

  const menus = SHOW_IN_USER_MENUS

  const handleLogout = (module: string) => {
    const title = `${module}.tip`
    const content = `${module}.confirm`
    const okText = `${module}.ok`
    const cancelText = `${module}.cancel`
    window.modal.confirm({
      centered: true,
      title: t(title),
      content: t(content),
      okText: t(okText),
      cancelText: t(cancelText),
      onOk: async () => {
        try {
          await window.api.profile.deactivate()
          closeAllMinapps()
          dispatch(clearToken())
          await applyProfileSwitch({ profileId: null, bootstrap: null })
        } catch (error) {
          logger.error('Failed to deactivate profile', error as Error)
          window.toast.error(t('common.error'))
          throw error
        }
      }
    })
  }

  const handleMenuClick = async (item: any) => {
    const notRealRoutePath = ['/identity', '/logout']
    if (notRealRoutePath.includes(item.path)) {
      const menuHandler = {
        '/identity': () => handleLogout('identity'),
        '/logout': () => handleLogout('logout')
      }
      menuHandler[item.path]?.()
    } else {
      hideMinappPopup()
      await modelGenerating()
      navigate(item.path)
    }
  }

  const UserInfoPanel = (
    <UserInfoContainer theme={theme} className="user-info-panel">
      <div className="user-info">
        {/*<div className="item money">
          <PayCircleOutlined />
          <span className="label">金币</span>
          <span className="text">{hzBalance.toFixed(2)}</span>
        </div>*/}
        <div className="avatar">
          <Avatar src={userInfo?.avatarUrl ?? defaultAvatar} size={34} />
        </div>
        <div className="info">
          <div className="nick-name">{userInfo?.nickName}</div>
          <div className="id-text">ID: {userInfo?.accountId}</div>
        </div>
      </div>

      <MenuContainer className="menu-list">
        {menus.map((item) => (
          <MenuItem
            theme={theme}
            className={pathname.startsWith(item.path) && !minappShow ? 'item active' : 'item'}
            key={item.path}
            onClick={() => handleMenuClick(item)}>
            <i className={`icon iconfont ${item.icon}`}></i>
            <span className="text">{getSidebarIconLabel(item.name)}</span>
          </MenuItem>
        ))}
        {/*<div
          className="item"
          onClick={async () => {
            hideMinappPopup()
            await to('/settings/provider')
          }}
        >
            <Icon theme={theme} className={pathname.startsWith('/settings') && !minappShow ? 'active' : ''}>
              <i className="icon iconfont icon-shezhi"></i>
            </Icon>
          <span className="text">{t('settings.title')}</span>
        </div>*/}
      </MenuContainer>
    </UserInfoContainer>
  )

  return (
    <Container
      className="user-avatar"
      data-tour="user-avatar"
      onMouseEnter={() => setOverlayVisible(Boolean(overlay) && !menuOpen)}
      onMouseLeave={() => setOverlayVisible(false)}>
      <Popover
        content={UserInfoPanel}
        placement={'top'}
        align={{ offset: [10, -10] }}
        zIndex={99999}
        getPopupContainer={() => document.body}
        trigger="click"
        open={menuOpen}
        onOpenChange={(open) => {
          setMenuOpen(open)
          if (open) setOverlayVisible(false)
        }}>
        <Avatar src={userInfo?.avatarUrl ?? defaultAvatar} size={40}></Avatar>
      </Popover>
      {overlayVisible && overlay && (
        <AvatarOverlay role="region" aria-label={overlay.title}>
          <strong>{overlay.title}</strong>
          {overlay.description && <p>{overlay.description}</p>}
          {overlay.buttonText && overlayAction && (
            <button type="button" onClick={openOverlayAction}>
              {overlay.buttonText}
            </button>
          )}
        </AvatarOverlay>
      )}
    </Container>
  )
}

export default UserAvatar
