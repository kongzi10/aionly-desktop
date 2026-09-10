import AiOnlyApiKeyListPopup from '@renderer//components/Popups/ApiKeyListPopup/aionly/popup'
// import { adaptProvider } from '@renderer/aiCore/provider/providerConfig'
import { addApikey, getApikeyList } from '@renderer/api/apikey'
import { queryIndexDetail } from '@renderer/api/balance'
import { getApikeyByUserId, getUserProfileApi } from '@renderer/api/login'
import OpenAIAlert from '@renderer/components/Alert/OpenAIAlert'
import { showErrorDetailPopup } from '@renderer/components/ErrorDetailModal'
import { LoadingIcon } from '@renderer/components/Icons'
import { HStack } from '@renderer/components/Layout'
import TokenPlanPopup from '@renderer/components/Popups/TokenPlan/TokenPlanPopup'
// import { ApiKeyListPopup } from '@renderer/components/Popups/ApiKeyListPopup'
import Selector from '@renderer/components/Selector'
// import { HelpTooltip } from '@renderer/components/TooltipIcons'
import { isRerankModel } from '@renderer/config/models'
import { PROVIDER_URLS } from '@renderer/config/providers'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useProvider /*useProviders, useAllProviders*/ } from '@renderer/hooks/useProvider'
import { useTimer } from '@renderer/hooks/useTimer'
import useUserTokenPlan from '@renderer/hooks/useUserTokenPlan'
import AnthropicSettings from '@renderer/pages/settings/ProviderSettings/AnthropicSettings'
import { ModelList } from '@renderer/pages/settings/ProviderSettings/ModelList'
import { checkApi } from '@renderer/services/ApiService'
import { loggerService } from '@renderer/services/LoggerService'
import { isProviderSupportAuth } from '@renderer/services/ProviderService'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { selectServiceInfo, selectUserInfo } from '@renderer/store/user'
import { updateWebSearchProvider } from '@renderer/store/websearch'
import type { SystemProviderId } from '@renderer/types'
import { isSystemProviderId, SystemProviderIds } from '@renderer/types'
import type { ApiKeyConnectivity } from '@renderer/types/healthCheck'
import { HealthStatus } from '@renderer/types/healthCheck'
import { /*formatApiHost,*/ formatApiKeys, getFancyProviderName, validateApiHost } from '@renderer/utils'
import { serializeHealthCheckError } from '@renderer/utils/error'
/*import {
  isAIGatewayProvider,
  isAnthropicProvider,
  isAzureOpenAIProvider,
  isGeminiProvider,
  isNewApiProvider,
  isOllamaProvider,
  isOpenAICompatibleProvider,
  isOpenAIProvider,
  isVertexProvider
} from '@renderer/utils/provider'*/
import { isAzureOpenAIProvider, isNewApiProvider, isVertexProvider } from '@renderer/utils/provider'
import { LOCAL_USER_SECRET_KEY } from '@shared/config/constant'
import { Button, Flex, Input, Select, Space, Tooltip, Typography } from 'antd'
import { debounce, isEmpty, throttle } from 'lodash'
import { Check, Settings2, TriangleAlert } from 'lucide-react'
import type { FC } from 'react'
import { useEffect } from 'react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

// import styled from 'styled-components'
import { SettingContainer, SettingHelpText, SettingHelpTextRow, SettingSubtitle } from '..'
import AwsBedrockSettings from './AwsBedrockSettings'
import CustomHeaderPopup from './CustomHeaderPopup'
import DMXAPISettings from './DMXAPISettings'
import GithubCopilotSettings from './GithubCopilotSettings'
import GPUStackSettings from './GPUStackSettings'
import LMStudioSettings from './LMStudioSettings'
import MarketOAuth from './MarketOAuth'
import MarketSettings from './MarketSettings'
import OVMSSettings from './OVMSSettings'
import ProviderOAuth from './ProviderOAuth'
import SelectProviderModelPopup from './SelectProviderModelPopup'
import VertexAISettings from './VertexAISettings'

const { Text } = Typography

const logger = loggerService.withContext('ProviderSetting')

interface Props {
  providerId: string
  /** Whether in onboarding mode for new users */
  isOnboarding?: boolean
}

const ANTHROPIC_COMPATIBLE_PROVIDER_IDS = [
  SystemProviderIds.deepseek,
  SystemProviderIds.moonshot,
  SystemProviderIds.zhipu,
  SystemProviderIds.dashscope,
  SystemProviderIds.modelscope,
  SystemProviderIds.aihubmix,
  SystemProviderIds.grok,
  SystemProviderIds.market,
  SystemProviderIds.longcat,
  SystemProviderIds.minimax,
  SystemProviderIds.silicon,
  SystemProviderIds.qiniu,
  SystemProviderIds.dmxapi,
  SystemProviderIds.mimo,
  SystemProviderIds.stepfun,
  SystemProviderIds.openrouter,
  SystemProviderIds.tokenflux,
  SystemProviderIds.ollama
] as const
type AnthropicCompatibleProviderId = (typeof ANTHROPIC_COMPATIBLE_PROVIDER_IDS)[number]

const ANTHROPIC_COMPATIBLE_PROVIDER_ID_SET = new Set<string>(ANTHROPIC_COMPATIBLE_PROVIDER_IDS)
const isAnthropicCompatibleProviderId = (id: string): id is AnthropicCompatibleProviderId => {
  return ANTHROPIC_COMPATIBLE_PROVIDER_ID_SET.has(id)
}

type HostField = 'apiHost' | 'anthropicApiHost'

const ProviderSetting: FC<Props> = ({ providerId, isOnboarding = false }) => {
  const { provider, updateProvider, models } = useProvider(providerId)
  // const allProviders = useAllProviders()
  // const { updateProviders } = useProviders()
  const [apiHost, setApiHost] = useState(provider.apiHost)
  const [anthropicApiHost, setAnthropicHost] = useState<string | undefined>(provider.anthropicApiHost)
  const [apiVersion, setApiVersion] = useState(provider.apiVersion)
  const [activeHostField, setActiveHostField] = useState<HostField>('apiHost')

  const { t, i18n } = useTranslation()
  const { theme } = useTheme()
  const { setTimeoutTimer } = useTimer()
  const dispatch = useAppDispatch()
  const serviceInfo = useAppSelector(selectServiceInfo)
  const userInfo: any = useAppSelector(selectUserInfo)
  const { getUserEnabledPlan, clearUserEnabledPlan } = useUserTokenPlan(userInfo?.userId)

  // console.log('getUserEnabledPlan', getUserEnabledPlan())

  /**
   * TODO： 当前用户启用的tokenPlan套餐数据--用来判断是否已失效
   * 需要一个接口获取当前用户启用的tokenPlan套餐数据（根据planId）
   * **/
  const [userSelectedTokenPlan, setUserSelectedTokenPlan] = useState<any>(getUserEnabledPlan())

  // console.log('userSelectedTokenPlan', userSelectedTokenPlan)

  const isAzureOpenAI = isAzureOpenAIProvider(provider)
  const isDmxapi = provider.id === 'dmxapi'
  const isMarket = provider.id === 'market'
  const isChineseUser = i18n.language.startsWith('zh')
  const noAPIInputProviders = ['aws-bedrock'] as const satisfies SystemProviderId[]
  const hideApiInput = noAPIInputProviders.some((id) => id === provider.id)
  const noAPIKeyInputProviders = ['copilot', 'vertexai'] as const satisfies SystemProviderId[]
  const hideApiKeyInput = noAPIKeyInputProviders.some((id) => id === provider.id)

  const providerConfig = PROVIDER_URLS[provider.id]
  /*const officialWebsite = providerConfig?.websites?.official
  const apiKeyWebsite = providerConfig?.websites?.apiKey*/
  const configuredApiHost = providerConfig?.api?.url

  const fancyProviderName = getFancyProviderName(provider)

  /** TODO: 是否启用了tokenPlan，后台管理配置 */
  const tokenPlanEnabled = useMemo(() => {
    return serviceInfo?.planStatus == 1
  }, [serviceInfo?.planStatus])

  /** 是否有用户token计划数据(由用户开启) */
  const [hasUserTokenPlanData, setHasUserTokenPlanData] = useState<any>(!!getUserEnabledPlan())

  const [localApiKey, setLocalApiKey] = useState(provider.apiKey)
  const [apiKeyConnectivity, setApiKeyConnectivity] = useState<ApiKeyConnectivity>({
    status: HealthStatus.NOT_CHECKED,
    checking: false
  })

  const [localApiKeyLoading, setLocalApiKeyLoading] = useState(false)
  const apiKeyPageQueryParams = useRef({
    pageNum: 1,
    pageSize: 10,
    total: 10,
    appname: '',
    keyType: ''
  })

  const apikeyForm = useRef({
    id: '',
    keyType: '标准模式',
    appname: '系统自动生成名称',
    apikey: '',
    remark: '',
    createTime: '',
    description: '',
    modelId: '',
    componentIds: [],
    knowledgeFlag: 1,
    knowledgeId: '',
    knowledgeReturn: 10,
    milvusType: '',
    promptVal: ''
  })

  const getApiKeyPageList = useCallback(async () => {
    const { rows, total } = await getApikeyList(apiKeyPageQueryParams.current)
    apiKeyPageQueryParams.current.total = total
    return rows
  }, [])

  useEffect(() => {
    getApiKeyPageList().then()
    if (!hasUserTokenPlanData) {
      initUserApi().then()
    }
  }, [getApiKeyPageList, hasUserTokenPlanData])

  // 查询用户tokenPlan明细接口
  const getUserTokenPlanDetail = useCallback(async () => {
    const res = await queryIndexDetail({
      id: getUserEnabledPlan()?.id
    })
    setUserSelectedTokenPlan(res.data)
  }, [getUserEnabledPlan])

  // 查询用户tokenPlan明细---显示是否过期
  useEffect(() => {
    if (hasUserTokenPlanData) {
      getUserTokenPlanDetail().then()
      if (userSelectedTokenPlan) {
        // console.log('userSelectedTokenPlan', userSelectedTokenPlan)
        const apiKey = userSelectedTokenPlan.apikey
        setLocalApiKey(apiKey)
        updateProvider({ apiKey })
      }
    } else {
      setUserSelectedTokenPlan(null)
    }
  }, [hasUserTokenPlanData])

  // TODO 生成密钥
  const handleGetApiKey = async () => {
    setLocalApiKeyLoading(true)
    try {
      await addApikey(apikeyForm.current)
      await getApiKeyPageList()
    } catch (e: any) {
      logger.error(e)
    } finally {
      setLocalApiKeyLoading(false)
    }
  }

  // 初始化查询用户密钥
  const initUserApi = async () => {
    const user_res: any = await getUserProfileApi()
    const user = user_res.data?.user
    const res = await getApikeyByUserId({ userId: user?.userId || '' })
    const secretKey = res.msg
    localStorage.setItem(LOCAL_USER_SECRET_KEY, secretKey)
    setLocalApiKey(secretKey)
    updateProvider({ apiKey: secretKey })
  }

  const updateWebSearchProviderKey = useCallback(
    ({ apiKey }: { apiKey: string }) => {
      provider.id === 'zhipu' && dispatch(updateWebSearchProvider({ id: 'zhipu', apiKey: apiKey.split(',')[0] }))
    },
    [dispatch, provider.id]
  )

  // Store callbacks in ref to avoid recreating debounce function when dependencies change
  const callbacks = { updateProvider, updateWebSearchProviderKey, isOnboarding, providerEnabled: provider.enabled }
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  const debouncedUpdateApiKey = useMemo(
    () =>
      debounce((value: string) => {
        const { updateProvider, updateWebSearchProviderKey, isOnboarding, providerEnabled } = callbacksRef.current
        const formattedKey = formatApiKeys(value)
        updateProvider({ apiKey: formattedKey })
        updateWebSearchProviderKey({ apiKey: formattedKey })
        // Auto-enable provider when apiKey is updated in onboarding mode
        if (isOnboarding && formattedKey && !providerEnabled) {
          updateProvider({ enabled: true })
        }
      }, 150),
    []
  )

  // Track whether update comes from external source to avoid loops
  const isExternalUpdateRef = useRef(false)

  // Sync provider.apiKey to localApiKey and reset connectivity status
  useEffect(() => {
    // Cancel any pending debounce calls to prevent old values from overwriting new ones
    debouncedUpdateApiKey.cancel()
    isExternalUpdateRef.current = true
    setLocalApiKey(provider.apiKey)
    setApiKeyConnectivity({ status: HealthStatus.NOT_CHECKED })
  }, [provider.apiKey, debouncedUpdateApiKey])

  // Sync localApiKey to provider.apiKey (debounced)
  // Only trigger on user input, not on external updates
  useEffect(() => {
    if (isExternalUpdateRef.current) {
      isExternalUpdateRef.current = false
      return
    }
    if (localApiKey !== provider.apiKey) {
      debouncedUpdateApiKey(localApiKey)
    }
  }, [localApiKey, provider.apiKey, debouncedUpdateApiKey])

  // Flush pending updates on unmount to prevent data loss
  useEffect(() => {
    return () => {
      debouncedUpdateApiKey.flush()
    }
  }, [debouncedUpdateApiKey])

  const isApiKeyConnectable = useMemo(() => {
    return apiKeyConnectivity.status === 'success'
  }, [apiKeyConnectivity])

  /*const moveProviderToTop = useCallback(
    (providerId: string) => {
      const reorderedProviders = [...allProviders]
      const index = reorderedProviders.findIndex((p) => p.id === providerId)

      if (index !== -1) {
        const updatedProvider = { ...reorderedProviders[index], enabled: true }
        reorderedProviders.splice(index, 1)
        reorderedProviders.unshift(updatedProvider)
        updateProviders(reorderedProviders)
      }
    },
    [allProviders, updateProviders]
  )*/

  const onUpdateApiHost = () => {
    if (!validateApiHost(apiHost)) {
      setApiHost(provider.apiHost)
      window.toast.error(t('settings.provider.api_host_no_valid'))
      return
    }
    if (isVertexProvider(provider) || apiHost.trim()) {
      // For new-api provider, keep apiHost and anthropicApiHost in sync
      if (isNewApiProvider(provider)) {
        updateProvider({ apiHost, anthropicApiHost: apiHost })
        setAnthropicHost(apiHost)
      } else {
        updateProvider({ apiHost })
      }
    } else {
      setApiHost(provider.apiHost)
    }
  }

  const onUpdateAnthropicHost = () => {
    const trimmedHost = anthropicApiHost?.trim()

    if (trimmedHost) {
      updateProvider({ anthropicApiHost: trimmedHost })
      setAnthropicHost(trimmedHost)
    } else {
      updateProvider({ anthropicApiHost: undefined })
      setAnthropicHost(undefined)
    }
  }
  const onUpdateApiVersion = () => updateProvider({ apiVersion })

  const openApiKeyList = async () => {
    if (localApiKey !== provider.apiKey) {
      // console.log('localApiKey !== provider.apiKey', localApiKey, provider.apiKey)
      updateProvider({ apiKey: formatApiKeys(localApiKey) })
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    await AiOnlyApiKeyListPopup.show()

    /*await ApiKeyListPopup.show({
      providerId: provider.id,
      title: `${fancyProviderName} ${t('settings.provider.api.key.list.title')}`,
      providerType: 'llm'
    })*/
  }

  const onCheckApi = async () => {
    const formattedLocalKey = formatApiKeys(localApiKey)

    // 如果存在多个密钥，直接打开管理窗口
    if (formattedLocalKey.includes(',')) {
      await openApiKeyList()
      return
    }

    const modelsToCheck = models.filter((model) => !isRerankModel(model))

    if (isEmpty(modelsToCheck)) {
      window.toast.error({
        timeout: 5000,
        title: t('settings.provider.no_models_for_check')
      })
      return
    }

    const model = await SelectProviderModelPopup.show({ provider })

    if (!model) {
      window.toast.error(i18n.t('message.error.enter.model'))
      return
    }

    try {
      setApiKeyConnectivity((prev) => ({ ...prev, checking: true, status: HealthStatus.NOT_CHECKED }))
      await checkApi({ ...provider, apiHost, apiKey: formattedLocalKey }, model)

      window.toast.success({
        timeout: 2000,
        title: i18n.t('message.api.connection.success')
      })

      setApiKeyConnectivity((prev) => ({ ...prev, status: HealthStatus.SUCCESS }))

      // Auto-enable provider when API check succeeds in onboarding mode
      if (isOnboarding && !provider.enabled) {
        updateProvider({ enabled: true })
      }

      setTimeoutTimer(
        'onCheckApi',
        () => {
          setApiKeyConnectivity((prev) => ({ ...prev, status: HealthStatus.NOT_CHECKED }))
        },
        3000
      )
    } catch (error: unknown) {
      window.toast.error({
        timeout: 8000,
        title: i18n.t('message.api.connection.failed')
      })

      const serializedError = serializeHealthCheckError(error)

      setApiKeyConnectivity((prev) => ({ ...prev, status: HealthStatus.FAILED, error: serializedError }))
    } finally {
      setApiKeyConnectivity((prev) => ({ ...prev, checking: false }))
    }
  }

  // 重置API Host
  const onReset = useCallback(() => {
    setApiHost(configuredApiHost)
    updateProvider({ apiHost: configuredApiHost, anthropicApiHost: configuredApiHost })
  }, [configuredApiHost, updateProvider])

  const isApiHostResettable = useMemo(() => {
    return !isEmpty(configuredApiHost) && apiHost !== configuredApiHost
  }, [configuredApiHost, apiHost])

  /*const hostPreview = () => {
    const formattedApiHost = adaptProvider({ provider: { ...provider, apiHost } }).apiHost

    if (isOllamaProvider(provider)) {
      return formattedApiHost + '/chat'
    }

    if (isOpenAICompatibleProvider(provider)) {
      return formattedApiHost + '/chat/completions'
    }

    if (isAzureOpenAIProvider(provider)) {
      const apiVersion = provider.apiVersion || ''
      const path = !['preview', 'v1'].includes(apiVersion)
        ? `/v1/chat/completions?apiVersion=v1`
        : `/v1/responses?apiVersion=v1`
      return formattedApiHost + path
    }

    if (isAnthropicProvider(provider)) {
      return formattedApiHost + '/messages'
    }

    if (isGeminiProvider(provider)) {
      return formattedApiHost + '/models'
    }
    if (isOpenAIProvider(provider)) {
      return formattedApiHost + '/responses'
    }
    if (isVertexProvider(provider)) {
      return formattedApiHost + '/publishers/google'
    }
    if (isAIGatewayProvider(provider)) {
      return formattedApiHost + '/language-model'
    }
    return formattedApiHost
  }*/

  // API key 连通性检查状态指示器，目前仅在失败时显示
  const renderStatusIndicator = () => {
    if (apiKeyConnectivity.checking || apiKeyConnectivity.status !== HealthStatus.FAILED) {
      return null
    }

    return (
      <>
        <Tooltip title={apiKeyConnectivity.error?.message || t('settings.models.check.failed')}>
          <TriangleAlert
            size={16}
            color="var(--color-status-warning)"
            style={{ cursor: 'pointer' }}
            onClick={() => showErrorDetailPopup({ error: apiKeyConnectivity.error })}
          />
        </Tooltip>
      </>
    )
  }

  useEffect(() => {
    if (provider.id === 'copilot') {
      return
    }
    setApiHost(provider.apiHost)
  }, [provider.apiHost, provider.id])

  useEffect(() => {
    setAnthropicHost(provider.anthropicApiHost)
  }, [provider.anthropicApiHost])

  const canConfigureAnthropicHost = useMemo(() => {
    if (isMarket) {
      return false
    }
    if (isNewApiProvider(provider)) {
      return true
    }
    return (
      provider.type !== 'anthropic' && isSystemProviderId(provider.id) && isAnthropicCompatibleProviderId(provider.id)
    )
  }, [isMarket, provider])

  /*  const anthropicHostPreview = useMemo(() => {
    const rawHost = anthropicApiHost ?? provider.anthropicApiHost
    // AI SDK uses the baseURL with /v1, then appends /messages
    const normalizedHost = formatApiHost(rawHost)

    return `${normalizedHost}/messages`
  }, [anthropicApiHost, provider.anthropicApiHost])*/

  const hostSelectorOptions = useMemo(() => {
    const options: { value: HostField; label: string }[] = [
      { value: 'apiHost', label: t('settings.provider.api_host') }
    ]

    if (canConfigureAnthropicHost) {
      options.push({ value: 'anthropicApiHost', label: t('settings.provider.anthropic_api_host') })
    }

    return options
  }, [canConfigureAnthropicHost, t])

  useEffect(() => {
    if (!canConfigureAnthropicHost && activeHostField === 'anthropicApiHost') {
      setActiveHostField('apiHost')
    }
  }, [canConfigureAnthropicHost, activeHostField])

  const hostSelectorTooltip =
    activeHostField === 'anthropicApiHost'
      ? t('settings.provider.anthropic_api_host_tooltip')
      : t('settings.provider.api_host_tooltip')

  const isAnthropicOAuth = () => provider.id === 'anthropic' && provider.authType === 'oauth'

  // 保存 ModelList 的分页状态
  const paginationStateRef = useRef<{
    fetchNextPage: () => void
    loading: boolean
    hasMore: boolean
  } | null>(null)

  // 接收 ModelList 的分页状态
  const handlePaginationStateChange = useCallback(
    (state: { fetchNextPage: () => void; loading: boolean; hasMore: boolean }) => {
      paginationStateRef.current = state
    },
    []
  )

  // 监听滚动事件，滚动到底部时触发分页加载
  const handleScrollInner = useCallback(
    (scrollTop: number, scrollHeight: number, clientHeight: number) => {
      // 如果启用了 tokenPlan，不执行滚动加载
      if (hasUserTokenPlanData) {
        return
      }

      const distanceFromBottom = scrollHeight - scrollTop - clientHeight

      // 距离底部小于 50px 时触发加载
      if (distanceFromBottom < 50) {
        const state = paginationStateRef.current
        if (state && state.hasMore && !state.loading) {
          state.fetchNextPage()
        }
      }
    },
    [hasUserTokenPlanData]
  )

  const handleScrollInnerThrottled = useMemo(() => throttle(handleScrollInner, 200), [handleScrollInner])

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget
      if (!target) return

      const { scrollTop, scrollHeight, clientHeight } = target
      handleScrollInnerThrottled(scrollTop, scrollHeight, clientHeight)
    },
    [handleScrollInnerThrottled]
  )

  // 组件卸载时清理节流函数
  useEffect(() => {
    return () => {
      handleScrollInnerThrottled.cancel()
    }
  }, [handleScrollInnerThrottled])

  // 停用 TokenPlan：清空启用套餐缓存并回退到用户基础 apiKey（与登录流程 saveUserInfo 的逻辑保持一致）
  const disableTokenPlan = () => {
    clearUserEnabledPlan()
    const userSecretKey = localStorage.getItem(LOCAL_USER_SECRET_KEY) ?? ''
    setLocalApiKey(userSecretKey)
    setActiveHostField('apiHost')
    setApiHost(provider.apiHost)
    setUserSelectedTokenPlan(null)
    setHasUserTokenPlanData(false)
    updateProvider({
      apiKey: formatApiKeys(userSecretKey),
      apiHost: provider.apiHost
    })
  }

  /** 停用 TokenPlan 并切换回 API 密钥模式 */
  const handleUseApiKey = async () => {
    const confirmed = await window.modal.confirm({
      title: t('settings.provider.api_key.use_api_key_confirm_title'),
      content: t('settings.provider.api_key.use_api_key_confirm_content'),
      centered: true
    })
    if (!confirmed) return
    disableTokenPlan()
  }

  /** 打开 TokenPlanModal */
  const handleOpenTokenPlanModal = async () => {
    const res = await TokenPlanPopup.show()
    if (res) {
      setHasUserTokenPlanData(res.enabled)
      if (res.enabled) {
        setLocalApiKey(res.apikey)
        // 重新获取最新的 tokenPlan 详细数据
        // await getUserTokenPlanDetail()
        if (activeHostField === 'apiHost' && canConfigureAnthropicHost) {
          updateProvider({
            apiKey: formatApiKeys(res.apikey)
          })
        }
        if (activeHostField === 'anthropicApiHost' && canConfigureAnthropicHost) {
          updateProvider({
            apiKey: formatApiKeys(res.apikey)
          })
        }
      } else {
        disableTokenPlan()
      }
    }
  }

  return (
    <SettingContainer theme={theme} style={{ background: 'var(--color-background)' }} onScroll={handleScroll}>
      {/*<SettingTitle>
        <Flex align="center" gap={8}>
          <ProviderName>{fancyProviderName}</ProviderName>
          {officialWebsite && (
            <Link target="_blank" href={providerConfig.websites.official} style={{ display: 'flex' }}>
              <Button type="text" size="small" icon={<SquareArrowOutUpRight size={14} />} />
            </Link>
          )}
          {(!isSystemProvider(provider) || isSupportAnthropicPromptCacheProvider(provider)) && (
            <Tooltip title={t('settings.provider.api.options.label')}>
              <Button
                type="text"
                icon={<Bolt size={14} />}
                size="small"
                onClick={() => ApiOptionsSettingsPopup.show({ providerId: provider.id })}
              />
            </Tooltip>
          )}
        </Flex>
        <Switch
          value={provider.enabled}
          key={provider.id}
          onChange={(enabled) => {
            updateProvider({ apiHost, enabled })
            if (enabled) {
              moveProviderToTop(provider.id)
            }
          }}
        />
      </SettingTitle>*/}
      {/*<Divider style={{ width: '100%', margin: '10px 0' }} />*/}
      {isProviderSupportAuth(provider) && (
        <ProviderOAuth providerId={provider.id} fancyProviderName={fancyProviderName} />
      )}
      {isMarket && <MarketOAuth providerId={provider.id} />}
      {provider.id === 'openai' && <OpenAIAlert />}
      {provider.id === 'ovms' && <OVMSSettings />}
      {isDmxapi && <DMXAPISettings providerId={provider.id} />}
      {provider.id === 'anthropic' && (
        <>
          <SettingSubtitle style={{ marginTop: 5 }}>{t('settings.provider.anthropic.auth_method')}</SettingSubtitle>
          <Select
            style={{ width: '40%', marginTop: 5, marginBottom: 10 }}
            value={provider.authType || 'apiKey'}
            onChange={(value) => updateProvider({ authType: value })}
            options={[
              { value: 'apiKey', label: t('settings.provider.anthropic.apikey') },
              { value: 'oauth', label: t('settings.provider.anthropic.oauth') }
            ]}
          />
          {provider.authType === 'oauth' && <AnthropicSettings />}
        </>
      )}

      {!hideApiInput && !isAnthropicOAuth() && (
        <>
          {!hideApiKeyInput && (
            <>
              <SettingSubtitle
                style={{
                  marginTop: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                <div className="inner">
                  <span className="title">{t('settings.provider.api_key.label')}</span>
                  {userSelectedTokenPlan && userSelectedTokenPlan.status == 2 && (
                    <span className="plan-status-tag enabled">
                      {t('settings.provider.api_key.token_plan.title')}
                      {t('settings.provider.api_key.token_plan.status.enabled')}
                    </span>
                  )}
                  {userSelectedTokenPlan && userSelectedTokenPlan.status != 2 && (
                    <span className="plan-status-tag disabled">
                      {t('settings.provider.api_key.token_plan.title')}
                      {t('settings.provider.api_key.token_plan.status.disabled')}
                    </span>
                  )}
                </div>

                {/*{provider.id !== 'copilot' && (
                  <Tooltip title={t('settings.provider.api.key.list.open')} mouseEnterDelay={0.5}>
                    <Button type="text" onClick={openApiKeyList} icon={<Settings2 size={16} />} />
                  </Tooltip>
                )}*/}

                {provider.id !== 'copilot' && (
                  <Flex gap={10}>
                    {tokenPlanEnabled && (
                      <Button
                        type="primary"
                        ghost={true}
                        onClick={handleOpenTokenPlanModal}
                        style={{ padding: '3px 12px', height: 'auto', fontSize: 12 }}>
                        {t('settings.provider.api_key.token_plan.title')}
                      </Button>
                    )}
                    {!hasUserTokenPlanData && (
                      <Button
                        type="primary"
                        onClick={openApiKeyList}
                        style={{ padding: '3px 12px', height: 'auto', fontSize: 12 }}>
                        {t('settings.provider.api.key.list.title')}
                      </Button>
                    )}
                    {hasUserTokenPlanData && (
                      <Button
                        type="primary"
                        onClick={handleUseApiKey}
                        style={{ padding: '3px 12px', height: 'auto', fontSize: 12 }}>
                        {t('settings.provider.api_key.use_api_key')}
                      </Button>
                    )}
                  </Flex>
                )}
              </SettingSubtitle>
              <Space.Compact style={{ width: '100%', marginTop: 5 }}>
                <Input.Password
                  value={localApiKey}
                  placeholder={t('settings.provider.api_key.label')}
                  onChange={(e) => setLocalApiKey(e.target.value)}
                  spellCheck={false}
                  autoFocus={provider.enabled && provider.apiKey === '' && !isProviderSupportAuth(provider)}
                  disabled={provider.id === 'copilot'}
                  suffix={renderStatusIndicator()}
                />
                <Button
                  type={isApiKeyConnectable ? 'primary' : 'default'}
                  ghost={isApiKeyConnectable}
                  onClick={onCheckApi}
                  disabled={!apiHost || apiKeyConnectivity.checking}>
                  {apiKeyConnectivity.checking ? (
                    <LoadingIcon />
                  ) : apiKeyConnectivity.status === 'success' ? (
                    <Check size={16} className="lucide-custom" />
                  ) : (
                    t('settings.provider.check')
                  )}
                </Button>
              </Space.Compact>
              <SettingHelpTextRow style={{ justifyContent: 'space-between' }}>
                <HStack>
                  {/*{apiKeyWebsite && !isDmxapi && (
                    <SettingHelpLink target="_blank" href={apiKeyWebsite}>
                      {t('settings.provider.get_api_key')}
                    </SettingHelpLink>
                  )}*/}

                  {!localApiKey && (
                    <>
                      <Button
                        style={{ fontSize: 12, padding: 0 }}
                        type="link"
                        size="small"
                        loading={localApiKeyLoading}
                        onClick={handleGetApiKey}>
                        {t('settings.provider.get_api_key')}
                      </Button>
                      <Text type="warning" style={{ fontSize: 12, padding: 0 }}>
                        （{t('settings.provider.api_key.max_tip')}）
                      </Text>
                    </>
                  )}
                </HStack>
                {/*<SettingHelpText>{t('settings.provider.api_key.tip')}</SettingHelpText>*/}
              </SettingHelpTextRow>
            </>
          )}
          {!isDmxapi && (
            <>
              <SettingSubtitle style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="flex items-center gap-1">
                  <Tooltip title={hostSelectorTooltip} mouseEnterDelay={0.3}>
                    <div>
                      <Selector
                        size={14}
                        value={activeHostField}
                        onChange={(value) => setActiveHostField(value)}
                        options={hostSelectorOptions}
                        style={{ paddingLeft: 1, fontWeight: 'bold' }}
                        placement="bottomLeft"
                      />
                    </div>
                  </Tooltip>
                  {/*<HelpTooltip title={t('settings.provider.api.url.tip')}></HelpTooltip>*/}
                  <Tooltip title={t('settings.provider.api.url.tip')} mouseEnterDelay={0.3}>
                    <i className="iconfont icon-icon" style={{ fontSize: 12, cursor: 'pointer' }}></i>
                  </Tooltip>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Button
                    type="text"
                    onClick={() => CustomHeaderPopup.show({ provider })}
                    icon={<Settings2 size={16} />}
                  />
                </div>
              </SettingSubtitle>
              {activeHostField === 'apiHost' && (
                <>
                  {isMarket && isChineseUser ? (
                    <MarketSettings providerId={provider.id} apiHost={apiHost} setApiHost={setApiHost} />
                  ) : (
                    <Space.Compact style={{ width: '100%', marginTop: 5 }}>
                      <Input
                        value={apiHost}
                        placeholder={t('settings.provider.api_host')}
                        onChange={(e) => {
                          // Normalize Unicode dash variants to standard ASCII hyphen to prevent Punycode encoding
                          const normalized = e.target.value.replace(/[‐‑‒–—―−﹘﹣－]/g, '-')
                          setApiHost(normalized)
                        }}
                        onBlur={onUpdateApiHost}
                      />
                      {isApiHostResettable && (
                        <Button danger onClick={onReset}>
                          {t('settings.provider.api.url.reset')}
                        </Button>
                      )}
                    </Space.Compact>
                  )}
                  {isVertexProvider(provider) && (
                    <SettingHelpTextRow>
                      <SettingHelpText>{t('settings.provider.vertex_ai.api_host_help')}</SettingHelpText>
                    </SettingHelpTextRow>
                  )}
                  {/*<SettingHelpTextRow style={{ justifyContent: 'space-between' }}>
                    <SettingHelpText
                      style={{
                        marginLeft: 6,
                        marginRight: '1em',
                        whiteSpace: 'break-spaces',
                        wordBreak: 'break-all'
                      }}>
                      {t('settings.provider.api_host_preview', { url: hostPreview() })}
                    </SettingHelpText>
                  </SettingHelpTextRow>*/}
                </>
              )}

              {activeHostField === 'anthropicApiHost' && canConfigureAnthropicHost && (
                <>
                  <Space.Compact style={{ width: '100%', marginTop: 5 }}>
                    <Input
                      value={anthropicApiHost ?? ''}
                      placeholder={t('settings.provider.anthropic_api_host')}
                      onChange={(e) => setAnthropicHost(e.target.value)}
                      onBlur={onUpdateAnthropicHost}
                    />
                    {/* TODO: Add a reset button here. */}
                  </Space.Compact>
                  {/*<SettingHelpTextRow style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                    <SettingHelpText style={{ marginLeft: 6, whiteSpace: 'break-spaces', wordBreak: 'break-all' }}>
                      {t('settings.provider.anthropic_api_host_preview', {
                        url: anthropicHostPreview || '—'
                      })}
                    </SettingHelpText>
                  </SettingHelpTextRow>*/}
                </>
              )}
            </>
          )}
        </>
      )}
      {isAzureOpenAI && (
        <>
          <SettingSubtitle>{t('settings.provider.api_version')}</SettingSubtitle>
          <Space.Compact style={{ width: '100%', marginTop: 5 }}>
            <Input
              value={apiVersion}
              placeholder="2024-xx-xx-preview"
              onChange={(e) => setApiVersion(e.target.value)}
              onBlur={onUpdateApiVersion}
            />
          </Space.Compact>
          <SettingHelpTextRow style={{ justifyContent: 'space-between' }}>
            <SettingHelpText style={{ minWidth: 'fit-content' }}>
              {t('settings.provider.azure.apiversion.tip')}
            </SettingHelpText>
          </SettingHelpTextRow>
        </>
      )}
      {provider.id === 'lmstudio' && <LMStudioSettings />}
      {provider.id === 'gpustack' && <GPUStackSettings />}
      {provider.id === 'copilot' && <GithubCopilotSettings providerId={provider.id} />}
      {provider.id === 'aws-bedrock' && <AwsBedrockSettings />}
      {provider.id === 'vertexai' && <VertexAISettings />}
      <ModelList
        providerId={provider.id}
        hasUserTokenPlanData={hasUserTokenPlanData}
        userSelectedTokenPlan={userSelectedTokenPlan}
        onPaginationStateChange={handlePaginationStateChange}
      />
    </SettingContainer>
  )
}

/*const ProviderName = styled.span`
  font-size: 14px;
  font-weight: 500;
  margin-right: -2px;
`*/

export default ProviderSetting
