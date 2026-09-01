import AiOnlyProviderLogo from '@renderer/assets/images/logo.png'
import AI302ProviderLogo from '@renderer/assets/images/providers/302ai.webp'
import AiHubMixProviderLogo from '@renderer/assets/images/providers/aihubmix.webp'
import PPIOProviderLogo from '@renderer/assets/images/providers/ppio.png'
import SiliconFlowProviderLogo from '@renderer/assets/images/providers/silicon.png'
import TokenFluxProviderLogo from '@renderer/assets/images/providers/tokenflux.png'
import topImage from '@renderer/assets/images/settings/top.png'
import { HStack } from '@renderer/components/Layout'
import { PROVIDER_URLS } from '@renderer/config/providers'
import { useMinappPopup } from '@renderer/hooks/useMinappPopup'
import { useIsPayLaterUser } from '@renderer/hooks/usePayLaterUser'
import { useProvider } from '@renderer/hooks/useProvider'
import ApiOptionsSettingsPopup from '@renderer/pages/settings/ProviderSettings/ApiOptionsSettings/ApiOptionsSettingsPopup'
import { useAppSelector } from '@renderer/store'
import { selectUserInfo } from '@renderer/store/user'
import { isSystemProvider } from '@renderer/types'
import { providerBills, providerCharge } from '@renderer/utils/oauth'
import { isSupportAnthropicPromptCacheProvider } from '@renderer/utils/provider'
import { Button } from 'antd'
import Link from 'antd/es/typography/Link'
import type { FC } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  providerId: string
  fancyProviderName: string
}

const PROVIDER_LOGO_MAP = {
  '302ai': AI302ProviderLogo,
  silicon: SiliconFlowProviderLogo,
  aihubmix: AiHubMixProviderLogo,
  ppio: PPIOProviderLogo,
  tokenflux: TokenFluxProviderLogo,
  aionly: AiOnlyProviderLogo
}

const ProviderOAuth: FC<Props> = ({ providerId, fancyProviderName }) => {
  const { t } = useTranslation()
  const { provider /*updateProvider*/ } = useProvider(providerId)
  const { handleToBillManagement, handleToRecharge } = useMinappPopup()
  const isPayLaterUser = useIsPayLaterUser()
  const userInfo: any = useAppSelector(selectUserInfo)

  // TODO: 这里需要更新ApiKey
  /*const _setApiKey = (newKey: string) => {
    updateProvider({ apiKey: newKey, enabled: true })
  }*/

  let providerWebsite =
    PROVIDER_URLS[provider.id]?.api?.url.replace('https://', '').replace('api.', '') || provider.name
  if (provider.id === 'ppio') {
    providerWebsite = 'ppio.com'
  }

  // 费用账单
  const handleClickBills = () => {
    const config = providerBills(provider.id)
    handleToBillManagement(config)
  }

  // 余额充值
  const handleClickRecharge = () => {
    const config = providerCharge(provider.id)
    handleToRecharge(config)
  }

  return (
    <Container topImage={topImage}>
      <div className="left flex items-center gap-3">
        <div className="logo">
          <img src={PROVIDER_LOGO_MAP[provider.id]} alt={provider.name} />
        </div>
        <div className="info">
          <div className="name">{fancyProviderName}</div>
          <Description>
            <Trans
              i18nKey="settings.provider.oauth.description"
              components={{
                website: (
                  <OfficialWebsite
                    key="website"
                    href={PROVIDER_URLS[provider.id].websites.official}
                    target="_blank"
                    rel="noreferrer"
                  />
                )
              }}
              values={{ provider: providerWebsite }}
            />
          </Description>
          <div className="mt-2 flex items-center gap-2">
            <Link target="_blank" href={PROVIDER_URLS[provider.id].websites.official} style={{ display: 'flex' }}>
              <LinkButton>{t('settings.provider.api.options.website')}</LinkButton>
            </Link>
            {(!isSystemProvider(provider) || isSupportAnthropicPromptCacheProvider(provider)) && (
              <LinkButton onClick={() => ApiOptionsSettingsPopup.show({ providerId: provider.id })}>
                {t('settings.provider.api.options.label')}
              </LinkButton>
            )}
          </div>
        </div>
      </div>

      {/*<OAuthButton provider={provider} onSuccess={setApiKey}>
        {t('settings.provider.oauth.button', { provider: getProviderLabel(provider.id) })}
      </OAuthButton>*/}

      <div className="right">
        {/* 子账号没有余额充值和账单，后付用户不显示充值按钮（确认非后付才渲染，避免闪现） */}
        {userInfo?.userSubjectType != '2' && (
          <HStack gap={10}>
            <Button type="primary" onClick={handleClickBills}>
              {t('settings.provider.bills')}
            </Button>
            {isPayLaterUser === false && (
              <OrangeButton onClick={handleClickRecharge}>{t('settings.provider.charge')}</OrangeButton>
            )}
          </HStack>
        )}
      </div>
    </Container>
  )
}

const Container = styled.div<{ topImage: string | undefined | null }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
  padding: 20px;
  border-radius: 6px;
  background: url(${(props) => props.topImage}) center center / 100% 100% no-repeat;

  body.dark & {
    background: var(--color-background-mute);
  }

  .logo{
    width: 60px;
    border-radius: 50%;
    background-color: #fff;
    padding: 10px;
    img{
      width: 100%;
    }
  }
`

const Description = styled.div`
  font-size: 11px;
  color: var(--color-text-2);
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
`

const OfficialWebsite = styled.a`
  text-decoration: none;
  color: var(--color-text-2);
`

const LinkButton = styled.span`
  display: inline-block;
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  &:hover{
    background-color: var(--color-primary);
    color: #fff;
  }
`

const OrangeButton = styled(Button)`
  background-color: rgba(255, 96, 0, 1);
  color: #fff;
  &:hover{
    background-color: rgba(255, 96, 0, 0.8) !important;
    color: #fff !important;
    border-color: rgba(255, 96, 0, 0.8) !important;
  }
`

export default ProviderOAuth
