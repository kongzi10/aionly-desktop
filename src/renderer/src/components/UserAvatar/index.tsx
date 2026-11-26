import { loggerService } from '@logger'
import { batchAddModelPayLaterApi } from '@renderer/api/balance'
import defaultAvatar from '@renderer/assets/images/avatar-default.png'
import IdentitySwitchDrawer from '@renderer/components/IdentitySwitch'
import { FEATURE_AVATAR_NEW_MODEL_PUSH, FEATURE_IDENTITY_SWITCH } from '@renderer/config/featureFlags'
import { SHOW_IN_USER_MENUS } from '@renderer/config/sidebar'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useMinappPopup } from '@renderer/hooks/useMinappPopup'
import { type NewModelPushItem, useNewShelfModelPush } from '@renderer/hooks/useNewShelfModelPush'
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
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import { applyProfileSwitch } from '@renderer/services/ProfileLifecycleService'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { clearToken, selectUserInfo } from '@renderer/store/user'
import { Avatar, Flex, Popover } from 'antd'
import { TriangleAlert, X } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'

interface Props {
  children?: React.ReactNode
}

/** 浮窗展示条目：新上架模型开通提示（kind=new_model，前 3 名额）或运营推送（kind=push，后 2 名额） */
type OverlayItem = ({ kind: 'push' } & HomePushItem) | NewModelPushItem

const logger = loggerService.withContext('UserAvatar')

/** 运营推送条目名额上限：合并轮播总量 5 = 前 3 个新模型固定窗口（NEW_MODEL_PUSH_MAX）+ 后 2 个运营推送 */
const OPERATION_PUSH_MAX = 2

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

// 开通确认框警示图标：与首行文案顶对齐，颜色取全局警示黄（--color-warning 未定义，使用 status-warning 兜底）
const ConfirmWarningIcon = styled(TriangleAlert)`
  flex: 0 0 auto;
  margin-top: 3px;
  color: var(--color-status-warning, #faad14);
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
  const [remoteLoaded, setRemoteLoaded] = useState(false)
  // 手动关闭：本次会话内不再显示（与原 setOpen(false) 行为一致）
  const [dismissed, setDismissed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  // 切换身份抽屉（FEATURE_IDENTITY_SWITCH 开启时替换原「切换身份=退出登录」确认弹窗）
  const [identityOpen, setIdentityOpen] = useState(false)

  // 挂载时拉取运营推送并默认展示悬浮框；悬浮框固定锚定在头像左上方，
  // 不随路由/左侧菜单切换关闭，仅手动关闭按钮可隐藏
  useEffect(() => {
    let mounted = true
    void getHomePushList('avatar_overlay')
      .then((list) => {
        if (!mounted) return
        setItems(list)
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setRemoteLoaded(true)
      })
    return () => {
      mounted = false
    }
  }, [])

  // 新上架模型推送：最新上架的 3 个模型构成固定窗口，与运营 avatar_overlay 推送合并轮播 —
  // 前 3 个名额为新模型条目、后 2 个名额为运营推送（总量 ≤5）；第 4 名模型不补位，
  // 3 个最新模型开通完后仅剩运营推送条目，无运营配置则浮窗关闭
  const newModelPushEnabled = FEATURE_AVATAR_NEW_MODEL_PUSH && !dismissed
  const { items: newModelItems, loaded: newModelLoaded, removeActivated } = useNewShelfModelPush(newModelPushEnabled)

  // 两路列表就绪后再一次性渲染，避免运营条目被后到的新模型条目顶掉产生跳变
  const overlayReady = remoteLoaded && (!newModelPushEnabled || newModelLoaded)
  const displayItems = useMemo<OverlayItem[]>(() => {
    if (!overlayReady) return []
    return [...newModelItems, ...items.slice(0, OPERATION_PUSH_MAX).map((item) => ({ kind: 'push' as const, ...item }))]
  }, [overlayReady, items, newModelItems])
  const count = displayItems.length
  const { index, setIndex, pausedRef } = usePushCarousel(count)
  const open = !dismissed && count > 0

  const current = count ? displayItems[index % count] : null
  const overlayAction = current?.kind === 'push' ? resolveHomeContentAction(current.buttonUrl) : null
  const openOverlayAction = () => {
    if (!overlayAction) return
    if (overlayAction.type === 'route') navigate(overlayAction.target)
    else void window.api.shell.openExternal(overlayAction.target)
  }

  // 默认规则条目「立即开通」：轻量确认框确认后直接开通对应模型（不再打开添加模型弹窗）；
  // 开通成功后广播事件 + 本地移除对应条目（事件订阅已同步移除，此处为直接回执兜底，两者幂等）
  const handleActivateNewModel = useCallback(
    (item: NewModelPushItem) => {
      window.modal.warning({
        centered: true,
        closable: true,
        icon: null,
        title: t('homeLanding.newModelActivateTitle'),
        content: (
          <Flex align="flex-start" gap={8}>
            <ConfirmWarningIcon size={16} aria-hidden="true" />
            <span>{t('homeLanding.newModelActivateContent')}</span>
          </Flex>
        ),
        okText: t('settings.models.add.activate_model'),
        onOk: async () => {
          try {
            const res = (await batchAddModelPayLaterApi({
              modelIds: [item.modelId],
              autoOpenNewModel: false
            })) as { code?: number } | undefined
            // 业务码非 200/0 时请求封装层已 reject 并全局提示；401 等场景 resolve undefined，一并视为失败
            if (!res || (res.code !== 200 && res.code !== 0)) {
              throw new Error(`Unexpected activation response code: ${String(res?.code)}`)
            }
            window.toast.success(t('homeLanding.newModelActivateSuccess'))
            void EventEmitter.emit(EVENT_NAMES.MODEL_PAY_LATER_ACTIVATED, { modelIds: [item.modelId] })
            removeActivated([item.modelId])
          } catch (error) {
            // 失败时抛出保持确认框打开，便于用户重试
            logger.error('Failed to activate model from avatar overlay', error as Error)
            throw error
          }
        }
      })
    },
    [removeActivated, t]
  )

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
        '/identity': () => {
          if (!FEATURE_IDENTITY_SWITCH) {
            handleLogout('identity')
            return
          }
          hideMinappPopup()
          // 模型生成中：modelGenerating 内部已 toast 拦截并 reject，抽屉不打开（开发文档 §4.2）
          void modelGenerating()
            .then(() => {
              setMenuOpen(false)
              setIdentityOpen(true)
            })
            .catch(() => undefined)
        },
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
          <PushCloseButton
            type="button"
            aria-label={t('homeLanding.closeAvatarPush')}
            onClick={() => setDismissed(true)}>
            <X size={14} />
          </PushCloseButton>
          <PushViewport>
            {displayItems.map((item, i) => (
              <PushSlide key={item.id} $active={i === index % count} aria-hidden={i !== index % count}>
                <strong>{item.title}</strong>
                {item.description && <p>{item.description}</p>}
              </PushSlide>
            ))}
          </PushViewport>
          <PushCardFoot>
            <PushDots>
              {count > 1 &&
                displayItems.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    className={i === index % count ? 'active' : ''}
                    aria-label={item.title}
                    onClick={() => setIndex(i)}
                  />
                ))}
            </PushDots>
            {current.buttonText && (current.kind === 'new_model' || overlayAction) && (
              <PushActionButton
                type="button"
                onClick={current.kind === 'new_model' ? () => handleActivateNewModel(current) : openOverlayAction}>
                <span className="text-container">
                  <span className="text">{current.buttonText}</span>
                </span>
              </PushActionButton>
            )}
          </PushCardFoot>
        </AvatarOverlay>
      )}
      {FEATURE_IDENTITY_SWITCH && <IdentitySwitchDrawer open={identityOpen} onClose={() => setIdentityOpen(false)} />}
    </Container>
  )
}

export default UserAvatar
