import LanguageSelect from '@renderer/components/LanguageSelect'
import db from '@renderer/databases'
import useTranslate from '@renderer/hooks/useTranslate'
import type { AutoDetectionMethod, Model, TranslateLanguage } from '@renderer/types'
import { Button, Flex, Modal, Switch, Tooltip } from 'antd'
import { HelpCircle } from 'lucide-react'
import type { FC, ReactNode } from 'react'
import { memo, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled, { css } from 'styled-components'

import TranslateSettingsPopup from '../settings/TranslateSettingsPopup/TranslateSettingsPopup'

// TODO: Just don't send so many props. Migrate them to redux.
const TranslateSettings: FC<{
  visible: boolean
  onClose: () => void
  isScrollSyncEnabled: boolean
  setIsScrollSyncEnabled: (value: boolean) => void
  isBidirectional: boolean
  setIsBidirectional: (value: boolean) => void
  enableMarkdown: boolean
  setEnableMarkdown: (value: boolean) => void
  bidirectionalPair: [TranslateLanguage, TranslateLanguage]
  setBidirectionalPair: (value: [TranslateLanguage, TranslateLanguage]) => void
  translateModel: Model | undefined
  autoDetectionMethod: AutoDetectionMethod
  setAutoDetectionMethod: (method: AutoDetectionMethod) => void
}> = ({
  visible,
  onClose,
  isScrollSyncEnabled,
  setIsScrollSyncEnabled,
  isBidirectional,
  setIsBidirectional,
  enableMarkdown,
  setEnableMarkdown,
  bidirectionalPair,
  setBidirectionalPair,
  autoDetectionMethod,
  setAutoDetectionMethod
}) => {
  const { t } = useTranslation()
  const [localPair, setLocalPair] = useState<[TranslateLanguage, TranslateLanguage]>(bidirectionalPair)
  const { getLanguageByLangcode, settings, updateSettings } = useTranslate()
  const { autoCopy } = settings

  const detectionMethods: { value: AutoDetectionMethod; label: string; tip: string }[] = [
    {
      value: 'auto',
      label: t('translate.detect.method.auto.label'),
      tip: t('translate.detect.method.auto.tip')
    },
    {
      value: 'franc',
      label: t('translate.detect.method.algo.label'),
      tip: t('translate.detect.method.algo.tip')
    },
    { value: 'llm', label: 'LLM', tip: t('translate.detect.method.llm.tip') }
  ]

  useEffect(() => {
    setLocalPair(bidirectionalPair)
  }, [bidirectionalPair, visible])

  const onMoreSetting = () => {
    onClose()
    void TranslateSettingsPopup.show()
  }

  return (
    <Modal
      title={<ModalTitle>{t('translate.settings.title')}</ModalTitle>}
      open={visible}
      onCancel={onClose}
      centered={true}
      footer={null}
      width={520}
      transitionName="animation-move-down">
      <Flex vertical gap={10} style={{ marginTop: 12, paddingBottom: 8 }}>
        <SettingCard>
          <SettingRow>
            <SettingLabel>{t('translate.settings.preview')}</SettingLabel>
            <Switch
              checked={enableMarkdown}
              onChange={(checked) => {
                setEnableMarkdown(checked)
                void db.settings.put({ id: 'translate:markdown:enabled', value: checked })
              }}
            />
          </SettingRow>
        </SettingCard>

        <SettingCard>
          <SettingRow>
            <SettingLabel>{t('translate.settings.autoCopy')}</SettingLabel>
            <Switch checked={autoCopy} onChange={(checked) => updateSettings({ autoCopy: checked })} />
          </SettingRow>
        </SettingCard>

        <SettingCard>
          <SettingRow>
            <SettingLabel>{t('translate.settings.scroll_sync')}</SettingLabel>
            <Switch
              checked={isScrollSyncEnabled}
              onChange={(checked) => {
                setIsScrollSyncEnabled(checked)
                void db.settings.put({ id: 'translate:scroll:sync', value: checked })
              }}
            />
          </SettingRow>
        </SettingCard>

        <SettingCard>
          <SettingRow>
            <SettingLabel>
              {t('translate.detect.method.label')}
              <Hint title={t('translate.detect.method.tip')} />
            </SettingLabel>
            <MethodSwitch role="radiogroup" aria-label={t('translate.detect.method.label')}>
              {detectionMethods.map((method) => (
                <Tooltip key={method.value} title={method.tip} mouseEnterDelay={0.4}>
                  <MethodOption
                    type="button"
                    role="radio"
                    aria-checked={autoDetectionMethod === method.value}
                    $active={autoDetectionMethod === method.value}
                    onClick={() => setAutoDetectionMethod(method.value)}>
                    {method.label}
                  </MethodOption>
                </Tooltip>
              ))}
            </MethodSwitch>
          </SettingRow>
        </SettingCard>

        <SettingCard>
          <SettingRow>
            <SettingLabel>
              {t('translate.settings.bidirectional')}
              <Hint title={t('translate.settings.bidirectional_tip')} />
            </SettingLabel>
            <Switch
              checked={isBidirectional}
              onChange={(checked) => {
                setIsBidirectional(checked)
                // 双向翻译设置不需要持久化，它只是界面状态
              }}
            />
          </SettingRow>
          {isBidirectional && (
            <PairRow>
              <LanguageSelect
                variant="filled"
                style={{ flex: 1 }}
                value={localPair[0].langCode}
                onChange={(value) => {
                  const newPair: [TranslateLanguage, TranslateLanguage] = [getLanguageByLangcode(value), localPair[1]]
                  if (newPair[0] === newPair[1]) {
                    window.toast.warning(t('translate.language.same'))
                    return
                  }
                  setLocalPair(newPair)
                  setBidirectionalPair(newPair)
                  void db.settings.put({
                    id: 'translate:bidirectional:pair',
                    value: [newPair[0].langCode, newPair[1].langCode]
                  })
                }}
              />
              <PairArrow>⇆</PairArrow>
              <LanguageSelect
                variant="filled"
                style={{ flex: 1 }}
                value={localPair[1].langCode}
                onChange={(value) => {
                  const newPair: [TranslateLanguage, TranslateLanguage] = [localPair[0], getLanguageByLangcode(value)]
                  if (newPair[0] === newPair[1]) {
                    window.toast.warning(t('translate.language.same'))
                    return
                  }
                  setLocalPair(newPair)
                  setBidirectionalPair(newPair)
                  void db.settings.put({
                    id: 'translate:bidirectional:pair',
                    value: [newPair[0].langCode, newPair[1].langCode]
                  })
                }}
              />
            </PairRow>
          )}
        </SettingCard>

        <Button block onClick={onMoreSetting} style={{ borderRadius: 10, height: 36 }}>
          {t('settings.moresetting.label')}
        </Button>
      </Flex>
    </Modal>
  )
}

export default memo(TranslateSettings)

const ModalTitle = styled.div`
  color: var(--color-text-1);
  font-size: 16px;
  font-weight: 600;
`

const SettingCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--color-border-soft);
  border-radius: 12px;
  background: var(--color-background-soft);

  body.light & {
    border-color: rgb(132 172 226 / 16%);
    background: rgb(246 249 255 / 78%);
  }
`

const SettingRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 24px;
`

const SettingLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--color-text-1);
  font-size: 13px;
  font-weight: 500;
`

const MethodSwitch = styled.div`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--color-border-soft);
  border-radius: 999px;
  background: var(--color-background-mute);

  body.light & {
    border-color: rgb(132 172 226 / 18%);
    background: rgb(231 239 253 / 78%);
  }
`

const MethodOption = styled.button<{ $active: boolean }>`
  min-width: 50px;
  height: 26px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-2);
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition:
    color 0.2s ease,
    background-color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    color: var(--color-text-1);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--color-primary-mute);
  }

  ${({ $active }) =>
    $active &&
    css`
      border-color: var(--color-border-soft);
      background: var(--color-background);
      color: var(--color-primary);
      font-weight: 600;
      box-shadow: 0 2px 6px rgb(77 122 190 / 14%);

      body.light & {
        border-color: rgb(132 172 226 / 20%);
      }
    `}
`

const PairRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

const PairArrow = styled.span`
  flex: 0 0 auto;
  color: var(--color-text-3);
  font-size: 14px;
`

const Hint = ({ title }: { title: ReactNode }) => (
  <Tooltip title={title}>
    <HintIcon>
      <HelpCircle size={13} />
    </HintIcon>
  </Tooltip>
)

const HintIcon = styled.span`
  display: flex;
  align-items: center;
  color: var(--color-text-3);
  cursor: help;
`
