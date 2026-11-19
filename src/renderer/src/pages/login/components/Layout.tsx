import { getServiceApi } from '@renderer/api/seat'
import bgLoginDark from '@renderer/assets/images/login/bg-login-dark.jpg'
import bgLoginF from '@renderer/assets/images/login/bg-login-f.jpg'
import lwImg from '@renderer/assets/images/login/lw.png'
import i18n from '@renderer/i18n'
import { useAppDispatch } from '@renderer/store'
import { setServiceInfo } from '@renderer/store/user'
import { type FC, useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'

interface Props {
  children?: React.ReactNode
}

const Container = styled.div`
  width: 100%;
  display: flex;
  height: 100%;
  .ant-form-item-with-help .ant-form-item-explain{
    font-size: 12px;
  }
`

const LeftPanel = styled.div`
  width: 40%;
  background: url(${bgLoginF}) center center / 100% 100% no-repeat;
  position: relative;
  [theme-mode='dark'] & {
    background: url(${bgLoginDark}) center center / 100% 100% no-repeat;
  }
`

const RightPanel = styled.div`
  width: 60%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  .inner{
    width: 432px;
  }

  .ant-tabs-nav {
    &::before {
      display: none;
    }

    .ant-tabs-tab {
      padding: 0 0 10px;
    }
  }
`

const LogoImage = styled.img`
  max-width: 200px;
  margin-left: 64px;
  margin-top: 36px;
`

const NewUserGiftWrap = styled.div`
  width: 88%;
  height: 56px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 30px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  // border: 1px solid #ddd;
  position: absolute;
  bottom: 10%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  font-family: 'Alibaba PuHuiTi 3';
  color: #ff6600;
  font-size: 18px;
`

const Layout: FC<Props> = ({ children }) => {
  const dispatch = useAppDispatch()

  const [logoUrl, setLogoUrl] = useState<null | undefined | string>(undefined)

  const fetchService = useCallback(() => {
    // 供应商 信息设置(网页tab,logo,网页title)
    getServiceApi(window.location.hostname).then((res: any) => {
      const agentInfo = res.data
      setLogoUrl(agentInfo?.logoUrl ?? undefined)
      // localStorage.setItem('agentInfo', JSON.stringify(agentInfo))
      dispatch(setServiceInfo(agentInfo))
    })
  }, [dispatch])

  useEffect(() => {
    fetchService()
  }, [fetchService])

  return (
    <Container>
      <LeftPanel>
        {logoUrl && <LogoImage src={logoUrl} alt="logo" />}
        <NewUserGiftWrap>
          <img className="w-8" src={lwImg} alt="lw" />
          {i18n.t('login.new_user_gift')}
        </NewUserGiftWrap>
      </LeftPanel>
      <RightPanel>
        <div className="inner">{children}</div>
      </RightPanel>
    </Container>
  )
}

export default Layout
