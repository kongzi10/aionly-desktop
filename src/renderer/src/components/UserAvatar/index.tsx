import { loggerService } from '@logger'
import defaultAvatar from '@renderer/assets/images/avatar-default.png'
import { SHOW_IN_USER_MENUS } from '@renderer/config/sidebar'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useMinappPopup } from '@renderer/hooks/useMinappPopup'
import { modelGenerating, useRuntime } from '@renderer/hooks/useRuntime'
import { getSidebarIconLabel } from '@renderer/i18n/label'
import { type HomePushItem, resolveHomeContentAction } from '@renderer/pages/home/homeContent'
import { getHomePushList } from '@renderer/pages/home/homeContentApi'
import {
  PushActionButton,
  PushCardBase,
  PushCardFoot,
  PushCloseButton,
  PushDots,
  PushSlide,
  PushViewport,
  usePushCarousel
} from '@renderer/pages/home/homePushCard'
import { applyProfileSwitch } from '@renderer/services/ProfileLifecycleService'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { clearToken, selectUserInfo } from '@renderer/store/user'
import { Avatar, Popover } from 'antd'
import { X } from 'lucide-react'
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

// 头像悬浮框：基础样式与思考框一致，固定锚定在头像左上方
// 侧边栏整栏为窗口拖拽区，悬浮框覆盖在其上，必须显式声明 none 从拖拽区中挖出可点击区域（继承不生效）
const AvatarOverlay = styled(PushCardBase)`
  position: absolute;
  // 需低于 antd 弹层遮罩（z-index 1000），弹窗打开时随页面一起被遮罩盖住，避免浮在遮罩上方
  z-index: 999;
  bottom: 52px;
  left: 12px;
  width: 210px;
  padding: 12px;
  -webkit-app-region: none;
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
  const [items, setItems] = useState<HomePushItem[]>([])
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const count = items.length
  const { index, setIndex, pausedRef } = usePushCarousel(count)

  // 挂载时拉取推送并默认展示悬浮框；悬浮框固定锚定在头像左上方，
  // 不随路由/左侧菜单切换关闭，仅手动关闭按钮可隐藏
  useEffect(() => {
    let mounted = true
    void getHomePushList('avatar_overlay')
      .then((list) => {
        if (!mounted) return
        setItems(list)
        setIndex(0)
        setOpen(list.length > 0)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [setIndex])

  const current = count ? items[index % count] : null
  const overlayAction = resolveHomeContentAction(current?.buttonUrl)
  const openOverlayAction = () => {
    if (!overlayAction) return
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
    <Container className="user-avatar" data-tour="user-avatar">
      <Popover
        content={UserInfoPanel}
        placement={'top'}
        align={{ offset: [10, -10] }}
        zIndex={99999}
        getPopupContainer={() => document.body}
        trigger="click"
        open={menuOpen}
        onOpenChange={setMenuOpen}>
        <Avatar src={userInfo?.avatarUrl ?? defaultAvatar} size={40}></Avatar>
      </Popover>
      {open && !menuOpen && current && (
        <AvatarOverlay
          role="region"
          aria-roledescription="carousel"
          aria-label={current.title}
          onMouseEnter={() => {
            pausedRef.current = true
          }}
          onMouseLeave={() => {
            pausedRef.current = false
          }}>
          <PushCloseButton type="button" aria-label={t('homeLanding.closeAvatarPush')} onClick={() => setOpen(false)}>
            <X size={14} />
          </PushCloseButton>
          <PushViewport>
            {items.map((item, i) => (
              <PushSlide key={item.id} $active={i === index % count} aria-hidden={i !== index % count}>
                <strong>{item.title}</strong>
                {item.description && <p>{item.description}</p>}
              </PushSlide>
            ))}
          </PushViewport>
          <PushCardFoot>
            <PushDots>
              {count > 1 &&
                items.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    className={i === index % count ? 'active' : ''}
                    aria-label={item.title}
                    onClick={() => setIndex(i)}
                  />
                ))}
            </PushDots>
            {current.buttonText && overlayAction && (
              <PushActionButton type="button" onClick={openOverlayAction}>
                <span className="text-container">
                  <span className="text">{current.buttonText}</span>
                </span>
              </PushActionButton>
            )}
          </PushCardFoot>
        </AvatarOverlay>
      )}
    </Container>
  )
}

export default UserAvatar
