import { getChildLimit, queryMoneyConfig } from '@renderer/api/balance'
import bullionImage from '@renderer/assets/images/home/bullion.png'
import { isLinux, isMac, isWin } from '@renderer/config/constant'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useFullscreen } from '@renderer/hooks/useFullscreen'
import { useMinappPopup } from '@renderer/hooks/useMinappPopup'
import useNavBackgroundColor from '@renderer/hooks/useNavBackgroundColor'
import { useIsPayLaterUser } from '@renderer/hooks/usePayLaterUser'
import { useRuntime } from '@renderer/hooks/useRuntime'
import { useNavbarPosition } from '@renderer/hooks/useSettings'
import { getThemeModeLabel } from '@renderer/i18n/label'
import { useAppSelector } from '@renderer/store'
import { selectToken, selectUserInfo } from '@renderer/store/user'
import { ThemeMode } from '@renderer/types'
import { useQuery } from '@tanstack/react-query'
import { Divider, Popover, Skeleton, Tooltip } from 'antd'
import { Monitor } from 'lucide-react'
import type { FC, PropsWithChildren } from 'react'
import type { HTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import WindowControls from '../WindowControls'

type Props = PropsWithChildren & HTMLAttributes<HTMLDivElement>

export const Navbar: FC<Props> = ({ children, ...props }) => {
  const { theme, settedTheme, toggleTheme } = useTheme()
  const { t } = useTranslation()

  const backgroundColor = useNavBackgroundColor()
  const isFullscreen = useFullscreen()
  const { isTopNavbar } = useNavbarPosition()
  const { minappShow } = useRuntime()
  const { handleToRecharge } = useMinappPopup()
  const isPayLaterUser = useIsPayLaterUser()
  const userInfo: any = useAppSelector(selectUserInfo)
  const defaultChildLimit = {
    limitTotal: '0.00',
    restotal: '0.00'
  }

  // 获取当前用户token，用于区分不同用户的缓存
  const token = useAppSelector(selectToken)

  // 使用 React Query 获取余额，自动处理缓存和重复请求
  const { data: balanceData, isLoading } = useQuery({
    queryKey: ['balance', token], // 使用独立的queryKey区分余额查询
    queryFn: async () => {
      const res = await queryMoneyConfig()
      return res?.data
    },
    enabled: !isTopNavbar && !minappShow && !!token && userInfo?.userSubjectType != '2', // 只在不是子账户(userSubjectType不为2)且已登录时才请求
    staleTime: 50 * 1000, // 30秒内认为数据是新鲜的，切换账号时能快速更新
    gcTime: 5 * 60 * 1000, // 缓存保留5分钟
    refetchInterval: 30 * 1000, // 每3秒自动刷新一次额度数据
    refetchOnMount: true, // 组件挂载时自动重新请求，确保切换账号后数据更新
    refetchOnWindowFocus: false // 窗口聚焦时不自动重新请求
  })

  const hzBalance = balanceData?.hzBalance ? Number(balanceData.hzBalance) : 0

  // 使用 React Query 获取额度，自动处理缓存和重复请求
  const { data: childLimitData, isLoading: childLimitLoading } = useQuery({
    queryKey: ['childLimit', token], // 使用独立的queryKey区分子账户额度查询
    queryFn: async () => {
      const res = await getChildLimit()
      return res?.data
    },
    enabled: !isTopNavbar && !minappShow && !!token && userInfo?.userSubjectType == '2', // 只在子账户(userSubjectType为2)且已登录时才请求
    staleTime: 50 * 1000, // 50秒内认为数据是新鲜的
    gcTime: 5 * 1000, // 缓存保留5秒
    refetchInterval: 30 * 1000, // 每3秒自动刷新一次额度数据
    refetchOnMount: true, // 组件挂载时自动重新请求，确保切换账号后数据更新
    refetchOnWindowFocus: true // 窗口聚焦时自动重新请求，确保用户回到页面时看到最新额度
  })

  const childLimit = childLimitData || defaultChildLimit

  if (isTopNavbar) {
    return null
  }

  return (
    <NavbarContainer {...props} style={{ backgroundColor }} $isFullScreen={isFullscreen}>
      {children}
      <>
        {/* 主账号金币数（后付用户只展示余额，不显示充值入口；确认非后付才渲染充值，避免闪现） */}
        {userInfo?.userSubjectType != '2' && (
          <RechargeContainer
            onClick={isPayLaterUser === false ? handleToRecharge : undefined}
            $isPayLater={isPayLaterUser !== false}>
            <img className="img-bullion" src={bullionImage} alt="" />
            {isLoading ? (
              <Skeleton.Input active size="small" style={{ width: 60, height: 20, minWidth: 60 }} />
            ) : (
              <span className="money">{hzBalance.toFixed(2)}</span>
            )}
            {isPayLaterUser === false && (
              <>
                <Divider type="vertical" style={{ margin: '0 2px' }} />
                <span className="pay">{t('settings.provider.oauth.topup')}</span>
              </>
            )}
          </RechargeContainer>
        )}
        {/* 子账户额度 */}
        {userInfo?.userSubjectType == '2' && (
          <Popover
            align={{ offset: [0, -8] }}
            content={
              <LimitContainer>
                {childLimit?.limitTotal == null ? (
                  // 服务端额度返回null，视为不限额，只显示一行
                  <div className="item">
                    <div className="value unlimited">{t('user.limit.unlimited')}</div>
                  </div>
                ) : (
                  <>
                    <div className="item">
                      {/* configPeriod: 1=日度限额，2=月度限额，缺省按日度兼容旧接口 */}
                      <div className="title">
                        {childLimit?.configPeriod === '2' ? t('user.limit.limit_month') : t('user.limit.limit_day')}
                      </div>
                      <div className="value">{childLimit?.limitTotal}</div>
                    </div>
                    <div className="item">
                      <div className="title">{t('user.limit.rest')}</div>
                      <div className="value rest">{childLimit?.restotal}</div>
                    </div>
                  </>
                )}
              </LimitContainer>
            }>
            <RechargeContainer>
              <img className="img-bullion" src={bullionImage} alt="" />
              {childLimitLoading ? (
                <Skeleton.Input active size="small" style={{ width: 60, height: 20, minWidth: 60 }} />
              ) : (
                <span className="text">{t('user.limit.title')}</span>
              )}
            </RechargeContainer>
          </Popover>
        )}
        <Tooltip title={t('settings.theme.title') + ': ' + getThemeModeLabel(settedTheme)} placement="bottom">
          <Icon theme={theme} onClick={toggleTheme}>
            {settedTheme === ThemeMode.dark ? (
              /*<Moon size={20} className="icon" />*/
              <i className="icon iconfont icon-yueliang"></i>
            ) : settedTheme === ThemeMode.light ? (
              /* <Sun size={20} className="icon" />*/
              <i className="icon iconfont icon-ai250"></i>
            ) : (
              <Monitor size={20} className="icon" />
            )}
          </Icon>
        </Tooltip>
      </>
      <div style={{ visibility: minappShow ? 'hidden' : 'visible' }}>
        <WindowControls />
      </div>
    </NavbarContainer>
  )
}

export const NavbarLeft: FC<Props> = ({ children, ...props }) => {
  return <NavbarLeftContainer {...props}>{children}</NavbarLeftContainer>
}

export const NavbarCenter: FC<Props> = ({ children, ...props }) => {
  return <NavbarCenterContainer {...props}>{children}</NavbarCenterContainer>
}

export const NavbarRight: FC<Props> = ({ children, ...props }) => {
  const isFullscreen = useFullscreen()
  return (
    <NavbarRightContainer {...props} $isFullscreen={isFullscreen}>
      {children}
    </NavbarRightContainer>
  )
}

export const NavbarMain: FC<Props> = ({ children, ...props }) => {
  const isFullscreen = useFullscreen()
  return (
    <NavbarMainContainer {...props} $isFullscreen={isFullscreen}>
      {children}
    </NavbarMainContainer>
  )
}

export const NavbarHeader: FC<Props> = ({ children, ...props }) => {
  return <NavbarHeaderContent {...props}>{children}</NavbarHeaderContent>
}

const NavbarContainer = styled.div<{ $isFullScreen: boolean }>`
  min-width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  min-height: ${({ $isFullScreen }) => (!$isFullScreen && isMac ? 'env(titlebar-area-height)' : 'var(--navbar-height)')};
  max-height: var(--navbar-height);
  margin-left: ${isMac ? 'calc(var(--sidebar-width) * -1 + 2px)' : 0};
  padding-left: ${({ $isFullScreen }) =>
    isMac ? ($isFullScreen ? 'var(--sidebar-width)' : 'env(titlebar-area-x)') : 0};
  -webkit-app-region: drag;
`

const NavbarLeftContainer = styled.div`
  /* min-width: ${isMac ? 'calc(var(--assistants-width) - 20px)' : 'var(--assistants-width)'}; */
  padding: 0 10px;
  display: flex;
  flex-direction: row;
  align-items: center;
  font-weight: bold;
  color: var(--color-text-1);
`

const NavbarCenterContainer = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0 ${isMac ? '20px' : 0};
  padding-left: 10px;
  font-weight: bold;
  color: var(--color-text-1);
  position: relative;
`

const NavbarRightContainer = styled.div<{ $isFullscreen: boolean }>`
  min-width: var(--topic-list-width);
  display: flex;
  align-items: center;
  padding: 0 12px;
  justify-content: flex-end;
  flex: 1;
`

const NavbarMainContainer = styled.div<{ $isFullscreen: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding-right: ${isMac ? '20px' : 0};
  padding-left: 10px;
  font-weight: bold;
  color: var(--color-text-1);
  padding-right: ${({ $isFullscreen }) => ($isFullscreen ? '12px' : isWin ? '140px' : isLinux ? '120px' : '12px')};
`

const NavbarHeaderContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  min-height: var(--navbar-height);
  max-height: var(--navbar-height);
`

const Icon = styled.div<{ theme: string }>`
  width: 30px;
  height: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  box-sizing: border-box;
  -webkit-app-region: none;
  border: 0.5px solid transparent;
  .icon {
    color: var(--color-icon);
    &.icon-ai250{
      font-size: 18px;
    }
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
    border: 0.5px solid var(--color-border);
    .icon {
      color: var(--color-primary);
    }
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
`
const RechargeContainer = styled.div<{ $isPayLater?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 4px 12px;
  max-height: var(--navbar-height);
  border-color: rgba(255, 255, 255, 0);
  border-radius: 6px;
  box-shadow: 0 0 6px var(--color-white) inset;
  color: #ff6000;
  font-weight: 600;
  margin: 1px 10px 0 0;
  cursor: ${({ $isPayLater }) => ($isPayLater ? 'default' : 'pointer')};
  -webkit-app-region: none;

  &:hover {
    color: ${({ $isPayLater }) => ($isPayLater ? '#ff6000' : '#f00')};
  }

  .img-bullion {
    width: 18px;
    height: 18px;
  }
`

const LimitContainer = styled.div`
  display: flex;
  gap: 30px;
  .title{
    font-size: 14px;
    color: var(--color-text-3);
  }
  .value{
    font-size: 16px;
    color: var(--color-text-1);
    font-weight: 600;
    &.rest{
      color: rgb(247, 127, 38);
    }
    &.unlimited{
      color: red;
    }
  }
`
