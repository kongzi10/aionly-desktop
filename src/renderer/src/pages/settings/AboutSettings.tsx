import IndicatorLight from '@renderer/components/IndicatorLight'
import UpdateDialogPopup from '@renderer/components/Popups/UpdateDialogPopup'
import { AppLogo } from '@renderer/config/env'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useMinappPopup } from '@renderer/hooks/useMinappPopup'
import { requestOnboardingTour } from '@renderer/hooks/useOnboardingTour'
import { useRuntime } from '@renderer/hooks/useRuntime'
import { useSettings } from '@renderer/hooks/useSettings'
// import i18n from '@renderer/i18n'
import { useAppDispatch } from '@renderer/store'
import { setUpdateState } from '@renderer/store/runtime'
import { ThemeMode } from '@renderer/types'
import { runAsyncFunction } from '@renderer/utils'
import { APP_NAME } from '@shared/config/constant'
import { UPDATE_API_BASE_URL, UPDATE_CHECK_PATH, WEB_UI_HOST } from '@shared/config/constant'
// import { UpgradeChannel } from '@shared/config/constant'
import { Avatar, Button, Progress, Row, Switch, Tag /*Tooltip, Radio*/ } from 'antd'
import { debounce } from 'lodash'
import { ChevronRight, Clock4, Compass, Globe } from 'lucide-react'
import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Markdown from 'react-markdown'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import { SettingContainer, SettingDivider, SettingGroup, SettingRow, SettingTitle } from '.'

const AboutSettings: FC = () => {
  const navigate = useNavigate()
  const [version, setVersion] = useState('')
  const [isPortable /*setIsPortable*/] = useState(false)
  const { t } = useTranslation()
  const { autoCheckUpdate, setAutoCheckUpdate /*testPlan, setTestPlan, testChannel, setTestChannel*/ } = useSettings()
  const { theme } = useTheme()
  const dispatch = useAppDispatch()
  const { update } = useRuntime()
  const { openSmartMinapp } = useMinappPopup()

  const onCheckUpdate = debounce(
    async () => {
      if (update.checking || update.downloading) {
        return
      }

      if (update.downloaded) {
        // Open update dialog directly in renderer
        void UpdateDialogPopup.show({ releaseInfo: update.info || null })
        return
      }

      dispatch(setUpdateState({ checking: true, manualCheck: true }))

      try {
        await window.api.checkForUpdate()
      } catch (error) {
        dispatch(setUpdateState({ manualCheck: false }))
        window.toast.error(t('settings.about.updateError'))
      }

      dispatch(setUpdateState({ checking: false }))
    },
    2000,
    { leading: true, trailing: false }
  )

  const onOpenWebsite = (url: string) => {
    void window.api.openWebsite(url)
  }

  const showReleases = async () => {
    const { appPath, platform } = await window.api.getAppInfo()
    const updateApiUrl = `${UPDATE_API_BASE_URL}${UPDATE_CHECK_PATH}/${platform}`
    openSmartMinapp({
      id: 'aionly-releases',
      name: t('settings.about.releases.title'),
      url: `file://${appPath}/resources/aionly/releases.html?theme=${theme === ThemeMode.dark ? 'dark' : 'light'}&updateApiUrl=${encodeURIComponent(updateApiUrl)}`,
      logo: AppLogo
    })
  }

  /*const currentChannelByVersion =
    [
      { pattern: `-${UpgradeChannel.BETA}.`, channel: UpgradeChannel.BETA },
      { pattern: `-${UpgradeChannel.RC}.`, channel: UpgradeChannel.RC }
    ].find(({ pattern }) => version.includes(pattern))?.channel || UpgradeChannel.LATEST*/

  useEffect(() => {
    void runAsyncFunction(async () => {
      const appInfo = await window.api.getAppInfo()
      setVersion(appInfo.version)
      // setIsPortable(appInfo.isPortable)
    })
    setAutoCheckUpdate(autoCheckUpdate)
  }, [autoCheckUpdate, setAutoCheckUpdate])

  return (
    <SettingContainer theme={theme}>
      <SettingGroup theme={theme}>
        <SettingTitle>
          {t('settings.about.title')}
          {/*<HStack alignItems="center">
            <Link to="https://www.aionly.com">
              <GithubOutlined style={{ marginRight: 4, color: 'var(--color-text)', fontSize: 20 }} />
            </Link>
          </HStack>*/}
        </SettingTitle>
        <SettingDivider />
        <AboutHeader>
          <Row align="middle">
            <AvatarWrapper>
              {update.downloadProgress > 0 && (
                <ProgressCircle
                  type="circle"
                  size={84}
                  percent={update.downloadProgress}
                  showInfo={false}
                  strokeLinecap="butt"
                  strokeColor="#67ad5b"
                />
              )}
              <Avatar src={AppLogo} size={80} style={{ minHeight: 80 }} />
            </AvatarWrapper>
            <VersionWrapper>
              <Title>{APP_NAME}</Title>
              <Description>{t('settings.about.description')}</Description>
              <Tag color="blue" style={{ marginTop: 8, cursor: 'pointer' }}>
                {version.includes('v') ? version : `v${version}`}
              </Tag>
            </VersionWrapper>
          </Row>
          {!isPortable && (
            <CheckUpdateButton
              onClick={onCheckUpdate}
              loading={update.checking}
              disabled={update.downloading || update.checking}>
              {update.downloading
                ? t('settings.about.downloading')
                : update.available
                  ? t('settings.about.checkUpdate.available')
                  : t('settings.about.checkUpdate.label')}
            </CheckUpdateButton>
          )}
        </AboutHeader>
        {!isPortable && (
          <>
            <SettingDivider />
            <SettingRow>
              <SettingRowTitle>{t('settings.general.auto_check_update.title')}</SettingRowTitle>
              <Switch value={autoCheckUpdate} onChange={(v) => setAutoCheckUpdate(v)} />
            </SettingRow>
            <SettingDivider />
            {/*<SettingRow>
              <SettingRowTitle>{t('settings.general.test_plan.title')}</SettingRowTitle>
              <Tooltip title={t('settings.general.test_plan.tooltip')} trigger={['hover', 'focus']}>
                <Switch value={testPlan} onChange={(v) => handleSetTestPlan(v)} />
              </Tooltip>
            </SettingRow>
            {testPlan && (
              <>
                <SettingDivider />
                <SettingRow>
                  <SettingRowTitle>{t('settings.general.test_plan.version_options')}</SettingRowTitle>
                  <Radio.Group
                    size="small"
                    buttonStyle="solid"
                    value={getTestChannel()}
                    onChange={(e) => handleTestChannelChange(e.target.value)}>
                    {getAvailableTestChannels().map((option) => (
                      <Tooltip key={option.value} title={option.tooltip}>
                        <Radio.Button value={option.value}>{option.label}</Radio.Button>
                      </Tooltip>
                    ))}
                  </Radio.Group>
                </SettingRow>
              </>
            )}*/}
          </>
        )}
      </SettingGroup>
      {update.info && update.available && (
        <SettingGroup theme={theme}>
          <SettingRow>
            <SettingRowTitle>
              {t('settings.about.updateAvailable', { version: update.info.version })}
              <IndicatorLight color="green" />
            </SettingRowTitle>
          </SettingRow>
          <UpdateNotesWrapper className="markdown">
            <Markdown>
              {typeof update.info.releaseNotes === 'string'
                ? update.info.releaseNotes.replace(/\n/g, '\n\n')
                : update.info.releaseNotes?.map((note) => note.note).join('\n')}
            </Markdown>
          </UpdateNotesWrapper>
        </SettingGroup>
      )}
      <SettingGroup theme={theme}>
        {/*<SettingRow>
          <SettingRowTitle>
            <BadgeQuestionMark size={18} />
            {t('docs.title')}
          </SettingRowTitle>
          <Button onClick={onOpenDocs}>{t('settings.about.website.button')}</Button>
        </SettingRow>
        <SettingDivider />*/}
        <SettingRow onClick={showReleases}>
          <SettingRowTitle>
            <Clock4 size={18} />
            {t('settings.about.releases.title')}
          </SettingRowTitle>
          <ChevronRight size={20} />
        </SettingRow>
        <SettingDivider />
        <SettingRow
          onClick={() => {
            // 先回主页，确保指引所需的页面元素已挂载
            navigate('/')
            requestOnboardingTour()
          }}>
          <SettingRowTitle>
            <Compass size={18} />
            {t('settings.about.onboardingTour')}
          </SettingRowTitle>
          <ChevronRight size={20} />
        </SettingRow>
        <SettingDivider />
        <SettingRow onClick={() => onOpenWebsite(WEB_UI_HOST)}>
          <SettingRowTitle>
            <Globe size={18} />
            {t('settings.about.website.title')}
          </SettingRowTitle>
          <ChevronRight size={20} />
          {/*<Button onClick={() => onOpenWebsite('https://www.aionly.com')}>{t('settings.about.website.button')}</Button>*/}
        </SettingRow>
        {/*<SettingDivider />
        <SettingRow>
          <SettingRowTitle>
            <Github size={18} />
            {t('settings.about.feedback.title')}
          </SettingRowTitle>
          <Button onClick={() => onOpenWebsite('https://www.aionly.com')}>
            {t('settings.about.feedback.button')}
          </Button>
        </SettingRow>
        <SettingDivider />
        <SettingRow>
          <SettingRowTitle>
            <Building2 size={18} />
            {t('settings.about.enterprise.title')}
          </SettingRowTitle>
          <Button onClick={showEnterprise}>{t('settings.about.website.button')}</Button>
        </SettingRow>
        <SettingDivider />
        <SettingRow>
          <SettingRowTitle>
            <Mail size={18} />
            {t('settings.about.contact.title')}
          </SettingRowTitle>
          <Button onClick={mailto}>{t('settings.about.contact.button')}</Button>
        </SettingRow>
        <SettingDivider />
        <SettingRow>
          <SettingRowTitle>
            <Briefcase size={18} />
            {t('settings.about.careers.title')}
          </SettingRowTitle>
          <Button onClick={() => onOpenWebsite('https://www.aionly.com')}>
            {t('settings.about.careers.button')}
          </Button>
        </SettingRow>
        <SettingDivider />
        <SettingRow>
          <SettingRowTitle>
            <Bug size={18} />
            {t('settings.about.debug.title')}
          </SettingRowTitle>
          <Button onClick={debug}>{t('settings.about.debug.open')}</Button>
        </SettingRow>*/}
      </SettingGroup>
    </SettingContainer>
  )
}

const AboutHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 5px 0;
`

const VersionWrapper = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 80px;
  justify-content: center;
  align-items: flex-start;
`

const Title = styled.div`
  font-size: 20px;
  font-weight: bold;
  color: var(--color-text-1);
  margin-bottom: 5px;
`

const Description = styled.div`
  font-size: 14px;
  color: var(--color-text-2);
  text-align: center;
`

const CheckUpdateButton = styled(Button)``

const AvatarWrapper = styled.div`
  position: relative;
  cursor: pointer;
  margin-right: 15px;
`

const ProgressCircle = styled(Progress)`
  position: absolute;
  top: -2px;
  left: -2px;
`

export const SettingRowTitle = styled.div`
  font-size: 14px;
  line-height: 18px;
  color: var(--color-text-1);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  .anticon {
    font-size: 16px;
    color: var(--color-text-1);
  }
`

const UpdateNotesWrapper = styled.div`
  padding: 12px 0;
  margin: 8px 0;
  //background-color: var(--color-bg-2);
  background-color: var(--color-background);
  border-radius: 6px;
  color: var(--color-text-2);
  font-size: 14px;

  p {
    margin: 0;
  }
`

export default AboutSettings
