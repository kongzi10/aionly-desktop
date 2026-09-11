// import { PlusOutlined } from '@ant-design/icons'
import { WarningFilled } from '@ant-design/icons'
import { loggerService } from '@logger'
import { AiProvider } from '@renderer/aiCore'
// import IcImageUp from '@renderer/assets/images/paintings/ic_ImageUp.svg'
import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import ModelAvatar from '@renderer/components/Avatar/ModelAvatar'
// import Scrollbar from '@renderer/components/Scrollbar'
import TranslateButton from '@renderer/components/TranslateButton'
// import { isMac } from '@renderer/config/constant'
import { LanguagesEnum } from '@renderer/config/translate'
// import { useTheme } from '@renderer/context/ThemeProvider'
import { useAiOnlyModels } from '@renderer/hooks/useAiOnlyModels'
import { usePaintings } from '@renderer/hooks/usePaintings'
import { ModelAttribute, useAllProviders, useProvider } from '@renderer/hooks/useProvider'
import { useRuntime } from '@renderer/hooks/useRuntime'
import { useSettings } from '@renderer/hooks/useSettings'
import useUserTokenPlan from '@renderer/hooks/useUserTokenPlan'
import {
  getPaintingsBackgroundOptionsLabel,
  getPaintingsImageSizeOptionsLabel,
  getPaintingsModerationOptionsLabel,
  getPaintingsQualityOptionsLabel
} from '@renderer/i18n/label'
import PaintingsList from '@renderer/pages/paintings/components/PaintingsList'
import {
  DEFAULT_PAINTING,
  formatSizeForModel,
  MODELS,
  SUPPORTED_MODELS
} from '@renderer/pages/paintings/config/NewApiConfig'
import AiOnlyAddModelPopup from '@renderer/pages/settings/ProviderSettings/AiOnlyModel/add/AddModelPopup'
import FileManager from '@renderer/services/FileManager'
import { translateText } from '@renderer/services/TranslateService'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setGenerating } from '@renderer/store/runtime'
import { selectUserInfo } from '@renderer/store/user'
import type { FileMetadata, PaintingAction, PaintingsState } from '@renderer/types'
import { convertToBase64, getErrorMessage, uuid } from '@renderer/utils'
import { isNewApiProvider } from '@renderer/utils/provider'
import { LOCAL_USER_SECRET_KEY } from '@shared/config/constant'
import type { RadioChangeEvent } from 'antd'
import { Button, Empty, Flex, InputNumber, Radio, Select, Spin, Tooltip, Upload } from 'antd'
import TextArea from 'antd/es/input/TextArea'
import type { RcFile } from 'antd/es/upload'
import type { UploadFile } from 'antd/es/upload/interface'
import { Paperclip } from 'lucide-react'
import type { FC } from 'react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import styled from 'styled-components'

import SendMessageButton from '../home/Inputbar/SendMessageButton'
// import { SettingTitle } from '../settings'
import Artboard from './components/Artboard'
import FilesCard from './components/FilesCard'
import { checkProviderEnabled, findPaintingByFiles } from './utils'

const logger = loggerService.withContext('NewApiPage')

const NewApiPage: FC<{ Options: string[] }> = ({ Options: _Options }) => {
  const [mode, setMode] = useState<keyof PaintingsState>('openai_image_generate')
  const { addPainting, removePainting, updatePainting, openai_image_generate, openai_image_edit } = usePaintings()

  const newApiPaintings = useMemo(() => {
    return {
      openai_image_generate,
      openai_image_edit
    }
  }, [openai_image_generate, openai_image_edit])

  // moved below after newApiProvider is defined
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [spaceClickCount, setSpaceClickCount] = useState(0)
  const [isTranslating, setIsTranslating] = useState(false)
  const [editImageFiles, setEditImageFiles] = useState<File[]>([])

  const { t } = useTranslation()
  // const { theme } = useTheme()
  const providers = useAllProviders()
  const location = useLocation()
  // const routeName = location.pathname.split('/').pop() || 'new-api'
  const routeName = location.pathname.split('/').pop() || 'aionly'
  // const newApiProviders = providers.filter((p) => isNewApiProvider(p))
  const newApiProviders = providers.filter((p) => isNewApiProvider(p) && p.id === 'aionly')
  const { provider } = useProvider('aionly')

  const dispatch = useAppDispatch()
  const { generating } = useRuntime()
  // const navigate = useNavigate()
  const { autoTranslateWithSpace } = useSettings()
  const spaceClickTimer = useRef<NodeJS.Timeout>(null)
  const newApiProvider = newApiProviders.find((p) => p.id === routeName) || newApiProviders[0]

  // ---------------- User Info and Token Plan ----------------
  const userInfo: any = useAppSelector(selectUserInfo)
  const { getUserEnabledPlan } = useUserTokenPlan(userInfo?.userId)
  const userTokenPlan: any = getUserEnabledPlan()

  const filteredPaintings = useMemo(
    () => (newApiPaintings[mode] || []).filter((p) => p.providerId === newApiProvider.id),
    [newApiPaintings, mode, newApiProvider.id]
  )
  const [painting, setPainting] = useState<PaintingAction>({ ...DEFAULT_PAINTING, providerId: newApiProvider.id })

  const modeOptions = [
    { label: t('paintings.mode.generate'), value: 'openai_image_generate' },
    { label: t('paintings.mode.edit'), value: 'openai_image_edit' }
  ]

  const textareaRef = useRef<any>(null)

  // 获取编辑模式的图片文件
  const editImages = editImageFiles

  useEffect(() => {
    if (mode !== 'openai_image_edit') {
      return
    }

    let isActive = true

    const syncEditImages = async () => {
      if (painting.files.length === 0) {
        setEditImageFiles([])
        return
      }

      try {
        const files = await Promise.all(
          painting.files.map(async (file, index) => {
            const { data, mime } = await window.api.file.binaryImage(file.id + file.ext)
            const fileName = file.name || `image_${index + 1}${file.ext}`

            return new File([data], fileName, {
              type: mime,
              lastModified: new Date(file.created_at).getTime()
            })
          })
        )

        if (isActive) {
          setEditImageFiles(files)
        }
      } catch (error) {
        logger.error('Failed to sync edit images from selected painting:', error as Error)

        if (isActive) {
          setEditImageFiles([])
        }
      }
    }

    void syncEditImages()

    return () => {
      isActive = false
    }
  }, [mode, painting.files])

  const updatePaintingState = useCallback(
    (updates: Partial<PaintingAction>) => {
      const updatedPainting = { ...painting, providerId: newApiProvider.id, ...updates }
      setPainting(updatedPainting)
      updatePainting(mode, updatedPainting)
    },
    [painting, newApiProvider.id, mode, updatePainting]
  )

  // ---------------- Model Related Configurations ----------------
  // const modelOptions = MODELS.map((m) => ({ label: m.name, value: m.name }))

  /** 从接口查询图片模型 **/
  const { loading, getFilteredModels, handleScroll, fetchModels } = useAiOnlyModels({
    type: '3',
    modelAttribute: ModelAttribute.ImageModel,
    pageSize: 10,
    autoFetch: true
  })

  const modelOptions = useMemo(() => {
    const customModels = getFilteredModels().map((m) => ({
      label: m.modelName,
      value: m.model,
      custom: !SUPPORTED_MODELS.includes(m.model),
      group: m.serviceName,
      modelFileUrl: m.modelFileUrl
    }))

    // 去重：同一 (id, serviceName) 只保留第一条
    const seen = new Set<string>()
    const filterModels = customModels.filter((m: any) => {
      const k = m.value
      return seen.has(k) ? false : (seen.add(k), true)
    })

    return [...filterModels]
  }, [getFilteredModels])

  const disabled = useMemo(() => {
    return modelOptions.length === 0
  }, [modelOptions])

  /*const modelOptions = useMemo(() => {
    const customModels = newApiProvider.models
      .filter((m) => m.endpoint_type && m.endpoint_type === 'image-generation')
      .map((m) => ({
        label: m.name,
        value: m.id,
        custom: !SUPPORTED_MODELS.includes(m.id),
        group: m.group
      }))
    return [...customModels]
  }, [newApiProvider.models])*/

  // 根据 group 将模型进行分组，便于在下拉列表中分组渲染
  const groupedModelOptions = useMemo(() => {
    return modelOptions.reduce<Record<string, typeof modelOptions>>((acc, option) => {
      const groupName = option.group
      if (!acc[groupName]) {
        acc[groupName] = []
      }
      acc[groupName].push(option)
      return acc
    }, {})
  }, [modelOptions])

  const getNewPainting = useCallback(() => {
    return {
      ...DEFAULT_PAINTING,
      model: painting.model || modelOptions[0]?.value || '',
      id: uuid(),
      providerId: newApiProvider.id
    }
  }, [modelOptions, painting.model, newApiProvider.id])

  const selectedModelConfig = useMemo(
    () => MODELS.find((m) => m.name === painting.model) || MODELS[0],
    [painting.model]
  )

  const handleModelChange = (value: string) => {
    const modelConfig = MODELS.find((m) => m.name === value)
    const updates: Partial<PaintingAction> = { model: value }

    // 设置默认值
    if (modelConfig?.imageSizes?.length) {
      updates.size = modelConfig.imageSizes[0].value
    }
    if (modelConfig?.quality?.length) {
      updates.quality = modelConfig.quality[0].value
    }
    if (modelConfig?.moderation?.length) {
      updates.moderation = modelConfig.moderation[0].value
    }
    updates.n = 1
    updatePaintingState(updates)
  }

  const handleSizeChange = (value: string) => {
    updatePaintingState({ size: value })
  }

  const handleQualityChange = (value: string) => {
    updatePaintingState({ quality: value })
  }

  const handleModerationChange = (value: string) => {
    updatePaintingState({ moderation: value })
  }

  const handleNChange = (value: number | string | null) => {
    if (value !== null && value !== undefined && value !== '') {
      updatePaintingState({ n: Number(value) })
    }
  }

  const handleError = (error: unknown) => {
    if (error instanceof Error && error.name !== 'AbortError') {
      window.modal.error({
        content: getErrorMessage(error),
        centered: true
      })
    }
  }

  const downloadImages = async (urls: string[]) => {
    const downloadedFiles = await Promise.all(
      urls.map(async (url) => {
        try {
          if (!url?.trim()) {
            logger.error('图像URL为空')
            window.toast.warning(t('message.empty_url'))
            return null
          }
          return await window.api.file.download(url)
        } catch (error) {
          logger.error('下载图像失败:', error as Error)
          if (
            error instanceof Error &&
            (error.message.includes('Failed to parse URL') || error.message.includes('Invalid URL'))
          ) {
            window.toast.warning(t('message.empty_url'))
          }
          return null
        }
      })
    )

    return downloadedFiles.filter((file): file is FileMetadata => file !== null)
  }

  const getFileBase64 = async (file: any) => {
    return await convertToBase64(file)
  }

  const onGenerate = async () => {
    // Token Plan 模式下不支持绘画，提示用户切换回 API 密钥模式
    if (userTokenPlan) {
      window.modal.warning({
        content: t('paintings.token_plan_mode'),
        centered: true
      })
      return
    }

    await checkProviderEnabled(newApiProvider, t)

    if (painting.files.length > 0) {
      const confirmed = await window.modal.confirm({
        content: t('paintings.regenerate.confirm'),
        centered: true
      })

      if (!confirmed) return
      await FileManager.deleteFiles(painting.files)
    }

    const prompt = textareaRef.current?.resizableTextArea?.textArea?.value || ''
    updatePaintingState({ prompt })

    const AI = new AiProvider(newApiProvider)

    if (!AI.getApiKey()) {
      window.modal.error({
        content: t('error.no_api_key'),
        centered: true
      })
      return
    }

    if (!painting.model || !painting.prompt) {
      return
    }

    const controller = new AbortController()
    setAbortController(controller)
    setIsLoading(true)
    dispatch(setGenerating(true))

    let body: string | FormData = ''
    // 针对tokenPlan兼容一下
    const apikey = !userTokenPlan ? AI.getApiKey() : localStorage.getItem(LOCAL_USER_SECRET_KEY) || AI.getApiKey()
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apikey}`
    }
    // NOTE: AiOnly当下 newapi只接受v1/images/xxx的请求
    // TODO: support gemini https://www.newapi.ai/zh/docs/api/ai-model/images/gemini/geminirelayv1beta-383837589
    let url = newApiProvider.apiHost.replace(/\/v1$/, '') + `/v1/images/generations`
    let editUrl = newApiProvider.apiHost.replace(/\/v1$/, '') + `/v1/images/edits`
    if (newApiProvider.id === 'aionly') {
      // url = newApiProvider.apiHost.replace(/\/v1$/, '') + `/openai/v1/images/generations`
      // editUrl = newApiProvider.apiHost.replace(/\/v1$/, '') + `/openai/v1/images/edits`

      // 新的兼容接口
      url = newApiProvider.apiHost.replace(/\/v1$/, '') + `/openai/v1/images/generations`
      editUrl = newApiProvider.apiHost.replace(/\/v1$/, '') + `/v1/images/generations`
    }

    try {
      if (mode === 'openai_image_generate') {
        const requestData = {
          prompt,
          model: painting.model,
          size: formatSizeForModel(painting.model, painting.size),
          background: painting.background === 'auto' ? undefined : painting.background,
          n: painting.n,
          quality: painting.quality === 'auto' ? undefined : painting.quality,
          moderation: painting.moderation === 'auto' ? undefined : painting.moderation
        }

        body = JSON.stringify(requestData)
        headers['Content-Type'] = 'application/json'
      } else if (mode === 'openai_image_edit') {
        // -------- Edit Mode --------
        if (editImages.length === 0) {
          window.toast.warning(t('paintings.image_file_required'))
          return
        }

        /*const formData = new FormData()
        formData.append('prompt', prompt)
        formData.append('model', painting.model)
        if (painting.background && painting.background !== 'auto') {
          formData.append('background', painting.background)
        }

        if (painting.size && painting.size !== 'auto') {
          formData.append('size', painting.size)
        }

        if (painting.quality && painting.quality !== 'auto') {
          formData.append('quality', painting.quality)
        }

        if (painting.moderation && painting.moderation !== 'auto') {
          formData.append('moderation', painting.moderation)
        }

        // append images
        editImages.forEach((file) => {
          formData.append('image[]', file)
        })

        // TODO: mask support later

        body = formData*/

        // For edit mode we do not set content-type; browser will set multipart boundary

        // TODO: 启用新接口：v1/images/generations---Openai image
        const editImageParams = {
          model: painting.model,
          input: {
            prompt,
            images: await Promise.all(editImages.map((file) => getFileBase64(file)))
          },
          parameters: {
            size: formatSizeForModel(painting.model, painting.size), // size 格式因模型而异：百炼系 width*height，其余 widthxheight
            quality: painting.quality || 'auto',
            moderation: painting.moderation || 'auto'
          }
        }

        body = JSON.stringify(editImageParams)
        headers['Content-Type'] = 'application/json'
      }

      const requestUrl = mode === 'openai_image_edit' ? editUrl : url
      const response = await fetch(requestUrl, { method: 'POST', headers, body })

      if (!response.ok) {
        const errorData = await response.json()
        // console.log('errorData:', errorData)
        throw new Error(errorData.error?.message || errorData?.msg || t('paintings.generate_failed'))
      }

      const res = await response.json()
      // console.log('res:', res)
      /*if (res.code != 200) {
        throw new Error(res.message || res.msg || t('paintings.generate_failed'))
      }*/
      const urls = res?.data?.filter((item) => item.url).map((item) => item.url)
      const base64s = res?.data
        ?.filter((item) => item.b64_json || item.base64)
        .map((item) => item.b64_json || item.base64)

      if (urls?.length > 0) {
        const validFiles = await downloadImages(urls)
        await FileManager.addFiles(validFiles)
        updatePaintingState({ files: validFiles, urls })
      }

      if (base64s?.length > 0) {
        const validFiles = await Promise.all(
          base64s.map(async (base64) => {
            return await window.api.file.saveBase64Image(base64)
          })
        )
        await FileManager.addFiles(validFiles)
        updatePaintingState({ files: validFiles, urls: [] })
      }
    } catch (error: unknown) {
      handleError(error)
    } finally {
      setIsLoading(false)
      dispatch(setGenerating(false))
      setAbortController(null)
    }
  }

  const handleRetry = async (painting: PaintingAction) => {
    setIsLoading(true)
    try {
      const validFiles = await downloadImages(painting.urls)
      await FileManager.addFiles(validFiles)
      updatePaintingState({ files: validFiles, urls: painting.urls })
    } catch (error) {
      handleError(error)
    } finally {
      setIsLoading(false)
    }
  }

  const onCancel = () => {
    abortController?.abort()
  }

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % painting.files.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + painting.files.length) % painting.files.length)
  }

  const handleAddPainting = () => {
    const newPainting = addPainting(mode, getNewPainting())
    updatePainting(mode, newPainting)
    setPainting(newPainting)
    return newPainting
  }

  const onDeletePainting = (paintingToDelete: PaintingAction) => {
    if (paintingToDelete.id === painting.id) {
      const currentIndex = filteredPaintings.findIndex((p) => p.id === paintingToDelete.id)

      if (currentIndex > 0) {
        setPainting(filteredPaintings[currentIndex - 1])
      } else if (filteredPaintings.length > 1) {
        setPainting(filteredPaintings[1])
      }
    }

    void removePainting(mode, paintingToDelete)
  }

  const translate = async () => {
    if (isTranslating) {
      return
    }

    if (!painting.prompt) {
      return
    }

    try {
      setIsTranslating(true)
      const translatedText = await translateText(painting.prompt, LanguagesEnum.enUS)
      updatePaintingState({ prompt: translatedText })
    } catch (error) {
      logger.error('Translation failed:', error as Error)
    } finally {
      setIsTranslating(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (autoTranslateWithSpace && event.key === ' ') {
      setSpaceClickCount((prev) => prev + 1)

      if (spaceClickTimer.current) {
        clearTimeout(spaceClickTimer.current)
      }

      spaceClickTimer.current = setTimeout(() => {
        setSpaceClickCount(0)
      }, 200)

      if (spaceClickCount === 2) {
        setSpaceClickCount(0)
        setIsTranslating(true)
        void translate()
      }
    }
  }

  /*const handleProviderChange = (providerId: string) => {
    const routeName = location.pathname.split('/').pop()
    if (providerId !== routeName) {
      navigate('../' + providerId, { replace: true })
    }
  }*/

  // 处理模式切换
  const handleModeChange = (e: RadioChangeEvent) => {
    const value = e.target.value
    const nextMode = value as keyof PaintingsState

    setMode(nextMode)

    if (nextMode === 'openai_image_edit' && mode === 'openai_image_generate' && painting.files.length > 0) {
      const existingEditPainting = findPaintingByFiles(
        newApiPaintings.openai_image_edit || [],
        newApiProvider.id,
        painting.files
      )

      if (existingEditPainting) {
        setPainting(existingEditPainting)
        return
      }

      const seededPainting = {
        ...painting,
        id: uuid(),
        providerId: newApiProvider.id
      }

      addPainting(nextMode, seededPainting)
      setPainting(seededPainting)
      return
    }

    const list = (newApiPaintings[nextMode] || []).filter((p) => p.providerId === newApiProvider.id)
    setPainting(list[0] || { ...DEFAULT_PAINTING, providerId: newApiProvider.id })
  }

  // 渲染配置项的函数
  const onSelectPainting = (newPainting: PaintingAction) => {
    if (generating) return
    setPainting(newPainting)
    setCurrentImageIndex(0)
  }

  const handleImageUpload = (file: File) => {
    setEditImageFiles((prev) => [...prev, file])
    return false // 阻止默认上传行为
  }

  // 当 modelOptions 为空时，引导用户跳转到 Provider 设置页面，新增 image-generation 端点模型
  /* const handleShowAddModelPopup = () => {
    navigate(`/settings/provider?id=${newApiProvider.id}`)
  }*/

  // 开通模型
  const handleOpenModel = async () => {
    const result = await AiOnlyAddModelPopup.show({ provider, modelType: 'image_generation' })
    if (result.success) {
      await fetchModels(1)
    }
  }

  useEffect(() => {
    if (filteredPaintings.length === 0) {
      const newPainting = getNewPainting()
      addPainting(mode, newPainting)
      setPainting(newPainting)
    } else {
      // 如果当前 painting 存在于 filteredPaintings 中，则优先显示当前 painting
      const found = filteredPaintings.find((p) => p.id === painting.id)
      if (found) {
        setPainting(found)
      } else {
        setPainting(filteredPaintings[0])
      }
    }
  }, [filteredPaintings, mode, addPainting, getNewPainting, painting.id])

  useEffect(() => {
    const timer = spaceClickTimer.current
    return () => {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [])

  // if painting.model is not set, set it to the first model in modelOptions
  useEffect(() => {
    if (!painting.model && modelOptions.length > 0) {
      updatePaintingState({ model: modelOptions[0].value })
    }
  }, [modelOptions, painting.model, updatePaintingState])

  // 上传图片文件列表数据
  const uploadImageFileList = useMemo(() => {
    return editImageFiles.map((file, idx): UploadFile<any> => {
      const rcFile: RcFile = {
        ...file,
        uid: String(idx),
        lastModifiedDate: file.lastModified ? new Date(file.lastModified) : new Date()
      }
      return {
        uid: rcFile.uid,
        name: rcFile.name || `image_${idx + 1}.png`,
        status: 'done',
        url: URL.createObjectURL(file),
        originFileObj: rcFile,
        lastModifiedDate: rcFile.lastModifiedDate
      }
    })
  }, [editImageFiles])

  // 删除图片文件列表数据
  const handleFileRemove = (file: any) => {
    setEditImageFiles((prev) =>
      prev.filter((f) => {
        const idx = prev.indexOf(f)
        return String(idx) !== file.uid
      })
    )
    return true
  }

  return (
    <Container className="page-container">
      <Navbar>
        <NavbarCenter style={{ borderRight: 'none' }}>{t('paintings.title')}</NavbarCenter>
        {/*{isMac && (
          <NavbarRight style={{ justifyContent: 'flex-end' }}>
            <Button size="small" className="nodrag" icon={<PlusOutlined />} onClick={handleAddPainting}>
              {t('paintings.button.new.image')}
            </Button>
          </NavbarRight>
        )}*/}
      </Navbar>
      <ContentContainer id="content-container">
        {/*<LeftContainer>
          <ProviderTitleContainer>
            <SettingTitle style={{ marginBottom: 5 }}>{t('common.provider')}</SettingTitle>
            <SettingHelpLink
              target="_blank"
              href={PROVIDER_URLS[newApiProvider.id]?.websites?.docs || 'https://docs.newapi.pro/'}>
              {t('paintings.learn_more')}
              <ProviderLogo
                shape="square"
                src={getProviderLogo(newApiProvider.id)}
                size={16}
                style={{ marginLeft: 5 }}
              />
            </SettingHelpLink>
          </ProviderTitleContainer>

           <ProviderSelect provider={newApiProvider} options={Options} onChange={handleProviderChange} />
        </LeftContainer>*/}

        <div className="left" style={{ width: 'calc(100% - 100px)' }}>
          <div className="top-bar">
            {/* 添加功能切换分段控制器 */}
            <ModeSegmentedContainer>
              {/*<Segmented shape="round" value={mode} onChange={handleModeChange} options={modeOptions} />*/}
              <div className="inner">
                <Radio.Group
                  block
                  value={mode}
                  options={modeOptions}
                  optionType="button"
                  buttonStyle="solid"
                  onChange={handleModeChange}
                />
              </div>
            </ModeSegmentedContainer>
          </div>
          <MainContainer>
            {modelOptions.length > 0 && (
              <Artboard
                painting={painting}
                isLoading={isLoading}
                currentImageIndex={currentImageIndex}
                onPrevImage={prevImage}
                onNextImage={nextImage}
                onCancel={onCancel}
                retry={handleRetry}
              />
            )}

            {modelOptions.length === 0 && (
              <div className="empty-wrapper">
                {/* 当没有可用的 Image Generation 模型时，提示用户先去新增 */}
                {/*<Empty
                  style={{ marginTop: 24 }}
                  description={t('paintings.no_image_generation_model', {
                    endpoint_type: t('endpoint_type.image-generation')
                  })}>
                  <Button type="primary" onClick={handleShowAddModelPopup}>
                    {t('paintings.go_to_settings')}
                  </Button>
                </Empty>*/}
                {loading && <Spin spinning={true} />}
                {!loading && (
                  <Empty style={{ marginTop: 24 }} image={Empty.PRESENTED_IMAGE_SIMPLE}>
                    <TipText className="tips">
                      <WarningFilled />
                      {t('chat.topics.no_model')}
                    </TipText>
                    <Button type="primary" onClick={handleOpenModel}>
                      {t('chat.topics.open_model_text')}
                    </Button>
                  </Empty>
                )}
              </div>
            )}

            <div className="option-set-wrapper">
              {modelOptions.length > 0 && (
                <>
                  {/* Background */}
                  {mode === 'openai_image_edit' &&
                    selectedModelConfig?.background &&
                    selectedModelConfig.background.length > 0 && (
                      <>
                        {/*<SettingTitle>{t('paintings.background')}</SettingTitle>*/}
                        <Select
                          disabled={disabled}
                          size="small"
                          prefix={`${t('paintings.background')}:`}
                          value={painting.background}
                          onChange={(value) => updatePaintingState({ background: value })}
                          style={{ width: '120px', marginBottom: 0 }}>
                          {selectedModelConfig.background.map((b) => (
                            <Select.Option value={b.value} key={b.value}>
                              {getPaintingsBackgroundOptionsLabel(b.value) ?? b.value}
                            </Select.Option>
                          ))}
                        </Select>
                      </>
                    )}
                </>
              )}

              {/* Image Size */}
              {selectedModelConfig?.imageSizes && selectedModelConfig.imageSizes.length > 0 && (
                <>
                  {/*<SettingTitle>{t('paintings.image.size')}</SettingTitle>*/}
                  <Select
                    disabled={disabled}
                    size="small"
                    prefix={`${t('paintings.image.size')}:`}
                    value={painting.size}
                    onChange={handleSizeChange}
                    style={{ width: '150px', flexShrink: 0, marginBottom: 0 }}>
                    {selectedModelConfig.imageSizes.map((s) => (
                      <Select.Option value={s.value} key={s.value}>
                        {getPaintingsImageSizeOptionsLabel(s.value) ?? s.value}
                      </Select.Option>
                    ))}
                  </Select>
                </>
              )}

              {/* Quality */}
              {selectedModelConfig?.quality && selectedModelConfig.quality.length > 0 && (
                <>
                  {/*<SettingTitle>{t('paintings.quality')}</SettingTitle>*/}
                  <Select
                    disabled={disabled}
                    size="small"
                    prefix={`${t('paintings.quality')}:`}
                    value={painting.quality}
                    onChange={handleQualityChange}
                    style={{ width: '120px', marginBottom: 0 }}>
                    {selectedModelConfig.quality.map((q) => (
                      <Select.Option value={q.value} key={q.value}>
                        {getPaintingsQualityOptionsLabel(q.value) ?? q.value}
                      </Select.Option>
                    ))}
                  </Select>
                </>
              )}

              {/* Moderation */}
              {mode !== 'openai_image_edit' &&
                selectedModelConfig?.moderation &&
                selectedModelConfig.moderation.length > 0 && (
                  <>
                    {/*<SettingTitle>{t('paintings.moderation')}</SettingTitle>*/}
                    <Select
                      disabled={disabled}
                      size="small"
                      prefix={`${t('paintings.moderation')}:`}
                      value={painting.moderation}
                      onChange={handleModerationChange}
                      style={{ width: '120px', marginBottom: 0 }}>
                      {selectedModelConfig.moderation.map((m) => (
                        <Select.Option value={m.value} key={m.value}>
                          {getPaintingsModerationOptionsLabel(m.value) ?? m.value}
                        </Select.Option>
                      ))}
                    </Select>
                  </>
                )}

              {/* Number of Images (n) */}
              {selectedModelConfig?.max_images && (
                <>
                  {/*<SettingTitle>{t('paintings.number_images')}</SettingTitle>*/}
                  <InputNumber
                    disabled={disabled}
                    size="small"
                    prefix={`${t('paintings.number_images')}:`}
                    min={1}
                    max={selectedModelConfig.max_images}
                    value={painting.n || 1}
                    onChange={handleNChange}
                    style={{ width: '150px', marginBottom: 0 }}
                  />
                </>
              )}
            </div>
            <InputContainer>
              {mode === 'openai_image_edit' && uploadImageFileList.length > 0 && (
                <FilesCard files={uploadImageFileList} handleRemoveFile={handleFileRemove} />
              )}
              <Textarea
                ref={textareaRef}
                variant="borderless"
                disabled={isLoading || disabled}
                value={painting.prompt}
                spellCheck={false}
                onChange={(e) => updatePaintingState({ prompt: e.target.value })}
                placeholder={
                  isTranslating
                    ? t('paintings.translating')
                    : painting.model?.startsWith('imagen-')
                      ? t('paintings.prompt_placeholder_en')
                      : t('paintings.prompt_placeholder_edit')
                }
                onKeyDown={handleKeyDown}
              />
              <Toolbar>
                <ToolLeftMenu>
                  {/* Model Selector */}
                  {modelOptions && modelOptions.length > 0 && (
                    <Select
                      disabled={disabled}
                      value={painting.model}
                      onChange={handleModelChange}
                      style={{ minWidth: '200px', marginBottom: 0 }}
                      virtual={true}
                      onPopupScroll={handleScroll}
                      popupRender={(menu) => <Spin spinning={loading}>{menu}</Spin>}>
                      {Object.entries(groupedModelOptions).map(([groupName, options]) => (
                        <Select.OptGroup label={groupName} key={groupName}>
                          {options.map((m) => (
                            <Select.Option value={m.value} key={m.value}>
                              <Flex align="center" gap={5}>
                                <ModelAvatar model={m} size={18} />
                                <span className="text-overflow" title={m.label}>
                                  {m.label}
                                </span>
                              </Flex>
                            </Select.Option>
                          ))}
                        </Select.OptGroup>
                      ))}
                    </Select>
                  )}
                </ToolLeftMenu>
                <ToolbarMenu>
                  {mode === 'openai_image_edit' && (
                    <Tooltip title={t('richEditor.imageUploader.uploadFile')}>
                      <ImageUploadButton
                        disabled={disabled}
                        accept="image/png, image/jpeg, image/gif"
                        maxCount={16}
                        showUploadList={false}
                        listType="picture"
                        beforeUpload={handleImageUpload}
                        fileList={uploadImageFileList}
                        onRemove={handleFileRemove}>
                        <ImagePlaceholder>
                          {/*<ImageSizeImage src={IcImageUp} theme={theme} />*/}
                          <Paperclip
                            size={18}
                            style={{
                              opacity: disabled ? 0.5 : 1,
                              pointerEvents: disabled ? 'none' : 'auto',
                              cursor: disabled ? 'not-allowed' : 'pointer'
                            }}
                          />
                        </ImagePlaceholder>
                      </ImageUploadButton>
                    </Tooltip>
                  )}
                  <TranslateButton
                    text={textareaRef.current?.resizableTextArea?.textArea?.value}
                    onTranslated={(translatedText) => updatePaintingState({ prompt: translatedText })}
                    disabled={isLoading || isTranslating || disabled}
                    isLoading={isTranslating}
                    style={{ marginRight: 6, borderRadius: '50%' }}
                  />
                  <SendMessageButton sendMessage={onGenerate} disabled={isLoading || disabled} />
                </ToolbarMenu>
              </Toolbar>
            </InputContainer>
          </MainContainer>
        </div>
        <PaintingsList
          namespace={mode}
          paintings={filteredPaintings}
          selectedPainting={painting}
          onSelectPainting={onSelectPainting}
          onDeletePainting={onDeletePainting}
          onNewPainting={handleAddPainting}
        />
      </ContentContainer>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  .text-overflow{
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .top-bar{
    border-radius: var(--base-border-radius) var(--base-border-radius) 0 0;
    background-color: var(--color-background);
  }
`

const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  height: 100%;
  background-color: var(--color-background);
  overflow: hidden;
  border-radius: var(--base-border-radius) !important;
  position: relative;

  .option-set-wrapper{
    padding: 0 20px 5px;
    display: flex;
    gap: 10px;
  }

  .empty-wrapper{
    height: calc(100vh - 220px);
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
`

/*const LeftContainer = styled(Scrollbar)`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  padding: 20px;
  background-color: var(--color-background);
  max-width: var(--assistants-width);
  border-right: 0.5px solid var(--color-border);
`*/

const MainContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: calc(100% - 70px);
  background-color: var(--color-background);
`

const InputContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 95px;
  max-height: 320px;
  position: relative;
  border: 1px solid var(--color-border-soft);
  transition: all 0.3s ease;
  margin: 0 20px 15px 20px;
  border-radius: 10px;
`

const Textarea = styled(TextArea)`
  padding: 5px 10px 10px;
  border-radius: 0;
  display: flex;
  flex: 1;
  resize: none !important;
  overflow: auto;
  width: auto;
`

const Toolbar = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 0 8px 0;
  height: 40px;
`

const ToolLeftMenu = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
`

const ToolbarMenu = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
`

/*const _ProviderLogo = styled(Avatar)`
  border: 0.5px solid var(--color-border);
`*/

const ModeSegmentedContainer = styled.div`
  padding: 16px;
  .inner{
    width: 256px;
  }
`

/*const _ProviderTitleContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
`*/

const ImageUploadButton = styled(Upload)`
  line-height: 1;
  & .ant-upload.ant-upload-select {
   /* width: 60px;
    height: 60px;
    border: 1px dashed var(--color-border);*/
  }
`

const ImagePlaceholder = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  height: 100%;
  cursor: pointer;
  gap: 8px;
`

/*const ImageSizeImage = styled.img<{ theme: string }>`
  filter: ${({ theme }) => (theme === 'dark' ? 'invert(100%)' : 'none')};
  width: 20px;
  height: 20px;
`*/

const TipText = styled.div`
  color: var(--color-red-600);
  font-size: 14px;
  margin-bottom: 10px;
`

export default NewApiPage
