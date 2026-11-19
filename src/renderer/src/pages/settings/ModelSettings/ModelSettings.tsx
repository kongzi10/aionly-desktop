import { RedoOutlined } from '@ant-design/icons'
import { HStack } from '@renderer/components/Layout'
import ModelSelector from '@renderer/components/ModelSelector'
import { InfoTooltip } from '@renderer/components/TooltipIcons'
import { isEmbeddingModel, isRerankModel, isTextToImageModel } from '@renderer/config/models'
import { TRANSLATE_PROMPT } from '@renderer/config/prompts'
import { useTheme } from '@renderer/context/ThemeProvider'
import {
  AI_ONLY_MODELS_FULL_PAGE_SIZE,
  createActivePayLaterFilter,
  ModelAttribute,
  useAiOnlyModels
} from '@renderer/hooks/useAiOnlyModels'
import { useDefaultModel } from '@renderer/hooks/useAssistant'
import { useProviders } from '@renderer/hooks/useProvider'
import { useSettings } from '@renderer/hooks/useSettings'
// import { getModelUniqId, hasModel } from '@renderer/services/ModelService'
import { useAppDispatch } from '@renderer/store'
import { setTranslateModelPrompt } from '@renderer/store/settings'
import type { Model } from '@renderer/types'
import { Button, Tooltip } from 'antd'
// import { find } from 'lodash'
import { Languages, MessageSquareMore, Rocket, Settings2 } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { SettingContainer, SettingDescription, SettingGroup, SettingTitle } from '..'
import TranslateSettingsPopup from '../TranslateSettingsPopup/TranslateSettingsPopup'
import DefaultAssistantSettings from './DefaultAssistantSettings'
import TopicNamingModalPopup from './QuickModelPopup'

interface ModelSettingsProps {
  showSettingsButton?: boolean
  showDescription?: boolean
  compact?: boolean
}

const ModelSettings: FC<ModelSettingsProps> = ({
  showSettingsButton = true,
  showDescription = true,
  compact = false
}) => {
  const { defaultModel, quickModel, translateModel, setDefaultModel, setQuickModel, setTranslateModel } =
    useDefaultModel()
  const { providers } = useProviders()

  // const allModels = providers.map((p) => p.models).flat()
  const { theme } = useTheme()
  const { t } = useTranslation()
  const { translateModelPrompt } = useSettings()

  const dispatch = useAppDispatch()

  const modelPredicate = useCallback(
    (m: Model) => !isEmbeddingModel(m) && !isRerankModel(m) && !isTextToImageModel(m),
    []
  )

  const defaultModelValue = useMemo(() => {
    // console.log('defaultModel', defaultModel)
    // return (hasModel(defaultModel) ? getModelUniqId(defaultModel) : undefined)
    return defaultModel ? JSON.stringify(defaultModel) : undefined
  }, [defaultModel])

  const defaultQuickModel = useMemo(() => {
    return quickModel ? JSON.stringify(quickModel) : undefined
    // return hasModel(quickModel) ? getModelUniqId(quickModel) : undefined
  }, [quickModel])

  const defaultTranslateModel = useMemo(() => {
    return translateModel ? JSON.stringify(translateModel) : undefined
    // return hasModel(translateModel) ? getModelUniqId(translateModel) : undefined
  }, [translateModel])

  const onResetTranslatePrompt = () => {
    dispatch(setTranslateModelPrompt(TRANSLATE_PROMPT))
  }

  const containerStyle = compact ? { padding: 0, background: 'transparent' } : undefined
  const groupStyle = compact ? { padding: 0, border: 'none', background: 'transparent' } : undefined

  const { getFilteredModels, loading, handleScroll } = useAiOnlyModels({
    // 一次性拉取全量量包行，避免"首页10条+前端先用后付过滤"导致模型选项被截断
    pageSize: AI_ONLY_MODELS_FULL_PAGE_SIZE,
    autoFetch: true,
    type: '1',
    modelAttribute: ModelAttribute.TextModel
  })

  const aiOnlyApiModels = useMemo(() => {
    return getFilteredModels(createActivePayLaterFilter())
  }, [getFilteredModels])

  const handleSetModel = useCallback((value: string, method: any) => {
    // console.log('value', value)
    // const model = find(allModels, JSON.parse(value)) as Model
    const model = JSON.parse(value) as Model
    method(model)
  }, [])

  return (
    <SettingContainer theme={theme} style={containerStyle}>
      <SettingGroup theme={theme} style={groupStyle}>
        <SettingTitle style={{ marginBottom: 12 }}>
          <HStack alignItems="center" gap={10}>
            <MessageSquareMore size={18} color="var(--color-text)" />
            {t('settings.models.default_assistant_model')}
          </HStack>
        </SettingTitle>
        <HStack alignItems="center">
          <ModelSelector
            providers={providers}
            predicate={modelPredicate}
            value={defaultModelValue}
            defaultValue={defaultModelValue}
            apiModels={aiOnlyApiModels}
            autoFetch={false}
            loading={loading}
            onPopupScroll={handleScroll}
            style={{ width: compact ? '100%' : 360 }}
            size={compact ? 'large' : 'middle'}
            onChange={(value) => handleSetModel(value, setDefaultModel)}
            placeholder={t('settings.models.empty')}
          />
          {showSettingsButton && (
            <Button icon={<Settings2 size={16} />} style={{ marginLeft: 8 }} onClick={DefaultAssistantSettings.show} />
          )}
        </HStack>
        {showDescription && (
          <SettingDescription>{t('settings.models.default_assistant_model_description')}</SettingDescription>
        )}
      </SettingGroup>
      <SettingGroup theme={theme} style={groupStyle}>
        <SettingTitle style={{ marginBottom: 12 }}>
          <HStack alignItems="center" gap={10}>
            <Rocket size={18} color="var(--color-text)" />
            {t('settings.models.quick_model.label')}
            <InfoTooltip title={t('settings.models.quick_model.tooltip')} />
          </HStack>
        </SettingTitle>
        <HStack alignItems="center">
          <ModelSelector
            providers={providers}
            predicate={modelPredicate}
            value={defaultQuickModel}
            defaultValue={defaultQuickModel}
            style={{ width: compact ? '100%' : 360 }}
            size={compact ? 'large' : 'middle'}
            autoFetch={false}
            apiModels={aiOnlyApiModels}
            loading={loading}
            onPopupScroll={handleScroll}
            onChange={(value) => handleSetModel(value, setQuickModel)}
            placeholder={t('settings.models.empty')}
          />
          {showSettingsButton && (
            <Button icon={<Settings2 size={16} />} style={{ marginLeft: 8 }} onClick={TopicNamingModalPopup.show} />
          )}
        </HStack>
        {showDescription && <SettingDescription>{t('settings.models.quick_model.description')}</SettingDescription>}
      </SettingGroup>
      <SettingGroup theme={theme} style={groupStyle}>
        <SettingTitle style={{ marginBottom: 12 }}>
          <HStack alignItems="center" gap={10}>
            <Languages size={18} color="var(--color-text)" />
            {t('settings.models.translate_model')}
          </HStack>
        </SettingTitle>
        <HStack alignItems="center">
          <ModelSelector
            providers={providers}
            predicate={modelPredicate}
            value={defaultTranslateModel}
            defaultValue={defaultTranslateModel}
            apiModels={aiOnlyApiModels}
            autoFetch={false}
            loading={loading}
            onPopupScroll={handleScroll}
            style={{ width: compact ? '100%' : 360 }}
            size={compact ? 'large' : 'middle'}
            onChange={(value) => handleSetModel(value, setTranslateModel)}
            placeholder={t('settings.models.empty')}
          />
          {showSettingsButton && (
            <>
              <Button
                icon={<Settings2 size={16} />}
                style={{ marginLeft: 8 }}
                onClick={() => TranslateSettingsPopup.show()}
              />
              {translateModelPrompt !== TRANSLATE_PROMPT && (
                <Tooltip title={t('common.reset')}>
                  <Button icon={<RedoOutlined />} style={{ marginLeft: 8 }} onClick={onResetTranslatePrompt}></Button>
                </Tooltip>
              )}
            </>
          )}
        </HStack>
        {showDescription && <SettingDescription>{t('settings.models.translate_model_description')}</SettingDescription>}
      </SettingGroup>
    </SettingContainer>
  )
}

export default ModelSettings
