import { WarningFilled } from '@ant-design/icons'
import { loggerService } from '@logger'
import { getAnthropicReasoningParams } from '@renderer/aiCore/utils/reasoning'
import type { QuickPanelTriggerInfo } from '@renderer/components/QuickPanel'
import { QuickPanelReservedSymbol, useQuickPanel } from '@renderer/components/QuickPanel'
import { isGenerateImageModel, isVisionModel } from '@renderer/config/models'
import { useAgent } from '@renderer/hooks/agents/useAgent'
import { useSession } from '@renderer/hooks/agents/useSession'
import { useUpdateAgent } from '@renderer/hooks/agents/useUpdateAgent'
import { useUpdateSession } from '@renderer/hooks/agents/useUpdateSession'
import { transformToModel, useFetchAndSetupModels } from '@renderer/hooks/useAiOnlyModels'
import { useInputText } from '@renderer/hooks/useInputText'
import { selectNewTopicLoading } from '@renderer/hooks/useMessageOperations'
// import { getModel } from '@renderer/hooks/useModel'
import { useProvider } from '@renderer/hooks/useProvider'
import { useSettings } from '@renderer/hooks/useSettings'
import { useTextareaResize } from '@renderer/hooks/useTextareaResize'
import { useTimer } from '@renderer/hooks/useTimer'
import { InputbarCore } from '@renderer/pages/home/Inputbar/components/InputbarCore'
import {
  InputbarToolsProvider,
  useInputbarToolsDispatch,
  useInputbarToolsInternalDispatch,
  useInputbarToolsState
} from '@renderer/pages/home/Inputbar/context/InputbarToolsProvider'
import InputbarTools from '@renderer/pages/home/Inputbar/InputbarTools'
import { getInputbarConfig } from '@renderer/pages/home/Inputbar/registry'
import type { ToolContext } from '@renderer/pages/home/Inputbar/types'
import { TopicType } from '@renderer/pages/home/Inputbar/types'
import { isSoulModeEnabled } from '@renderer/pages/settings/AgentSettings/shared'
import AiOnlyAddModelPopup from '@renderer/pages/settings/ProviderSettings/AiOnlyModel/add/AddModelPopup'
import { CacheService } from '@renderer/services/CacheService'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import { pauseTrace } from '@renderer/services/SpanManagerService'
import { estimateUserPromptUsage } from '@renderer/services/TokenService'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { newMessagesActions, selectMessagesForTopic } from '@renderer/store/newMessage'
import { sendMessage as dispatchSendMessage } from '@renderer/store/thunk/messageThunk'
import { selectAiOnlyModels } from '@renderer/store/user'
import type { ApiModel, Assistant, Message, ThinkingOption } from '@renderer/types'
import type { AgentSessionEntity, FileMetadata } from '@renderer/types'
import type { MessageBlock } from '@renderer/types/newMessage'
import { MessageBlockStatus } from '@renderer/types/newMessage'
import { abortCompletion } from '@renderer/utils/abortController'
import { buildAgentSessionTopicId } from '@renderer/utils/agentSession'
import { getCachedAiOnlyModel } from '@renderer/utils/aionly-model-cache'
import { getSendMessageShortcutLabel } from '@renderer/utils/input'
import { createMainTextBlock, createMessage } from '@renderer/utils/messageUtils/create'
import { documentExts, imageExts, textExts } from '@shared/config/constant'
import { Button } from 'antd'
import type { FC } from 'react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import styled from 'styled-components'
import { v4 as uuid } from 'uuid'

import AgentModelSelectButton from './AgentModelSelectButton'
import AgentNameButton from './AgentNameButton'
import AgentSettingsButton from './AgentSettingsButton'
import OpenExternalAppButton from './OpenExternalAppButton'

const logger = loggerService.withContext('AgentSessionInputbar')

const DRAFT_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

const getAgentDraftCacheKey = (agentId: string) => `agent-session-draft-${agentId}`

type Props = {
  agentId: string
  sessionId: string
}

const AgentSessionInputbar = ({ agentId, sessionId }: Props) => {
  const { session } = useSession(agentId, sessionId)
  // FIXME: 不应该使用ref将action传到context提供给tool，权宜之计
  const actionsRef = useRef({
    resizeTextArea: () => {},
    // oxlint-disable-next-line no-unused-vars
    onTextChange: (_updater: React.SetStateAction<string> | ((prev: string) => string)) => {},
    toggleExpanded: () => {}
  })

  // Create assistant stub with session data
  const assistantStub = useMemo<Assistant | null>(() => {
    // console.log('<============session=======>', session)
    if (!session) return null

    // Extract model info
    // const [providerId, actualModelId] = session.model?.split(':') ?? [undefined, undefined]
    // const actualModel = actualModelId ? getModel(actualModelId, providerId) : undefined

    const actualModelId = session.model

    // TODO: 临时处理，从本地缓存拿用户选过的模型，从里面去找对应的模型
    const cacheModel = actualModelId ? getCachedAiOnlyModel(actualModelId) : undefined
    const actualModel = cacheModel ? transformToModel(cacheModel) : undefined

    // console.log('<============actualModel=======>', actualModel)

    return {
      id: session.agent_id ?? agentId,
      name: session.name ?? 'Agent Session',
      prompt: session.instructions ?? '',
      topics: [],
      type: 'agent-session',
      model: actualModel,
      defaultModel: actualModel,
      tags: [],
      enableWebSearch: false
    } satisfies Assistant
  }, [session, agentId])

  // Prepare session data for tools
  const sessionData = useMemo(() => {
    if (!session) return undefined
    return {
      agentId,
      sessionId,
      slashCommands: session.slash_commands,
      tools: session.tools,
      accessiblePaths: session.accessible_paths ?? []
    }
  }, [session, agentId, sessionId])

  const initialState = useMemo(
    () => ({
      mentionedModels: [],
      selectedKnowledgeBases: [],
      files: [] as FileMetadata[],
      isExpanded: false
    }),
    []
  )

  // console.log('<============assistantStub=======>', assistantStub)

  if (!assistantStub) {
    return null // Wait for session to load
  }

  return (
    <InputbarToolsProvider
      initialState={initialState}
      actions={{
        resizeTextArea: () => actionsRef.current.resizeTextArea(),
        onTextChange: (updater) => actionsRef.current.onTextChange(updater),
        // Agent Session specific actions
        addNewTopic: () => {},
        clearTopic: () => {},
        onNewContext: () => {},
        toggleExpanded: () => actionsRef.current.toggleExpanded()
      }}>
      <AgentSessionInputbarInner
        assistant={assistantStub}
        agentId={agentId}
        sessionId={sessionId}
        session={session}
        sessionData={sessionData}
        actionsRef={actionsRef}
      />
    </InputbarToolsProvider>
  )
}

interface InnerProps {
  assistant: Assistant
  agentId: string
  sessionId: string
  session?: AgentSessionEntity
  sessionData?: ToolContext['session']
  actionsRef: React.MutableRefObject<{
    resizeTextArea: () => void
    onTextChange: (updater: React.SetStateAction<string> | ((prev: string) => string)) => void
    toggleExpanded: (nextState?: boolean) => void
  }>
}

const AgentSessionInputbarInner: FC<InnerProps> = ({
  assistant,
  agentId,
  sessionId,
  session,
  sessionData,
  actionsRef
}) => {
  const { agent: agentBase } = useAgent(agentId)
  const { updateAgent } = useUpdateAgent()
  const { updateModel: updateSessionModel } = useUpdateSession(agentId)
  const { provider } = useProvider('aionly')
  const aiOnlyModels = useSelector(selectAiOnlyModels)
  const setupModels = useFetchAndSetupModels()
  const scope = TopicType.Session
  const config = getInputbarConfig(scope)

  // 没有可用模型时，右下角显示“去开通”；否则显示与对话页同款的模型选择按钮
  const noModels = useMemo(() => !!aiOnlyModels && aiOnlyModels.length === 0, [aiOnlyModels])

  const handleUpdateModel = useCallback(
    async (model: ApiModel) => {
      if (!agentBase || !session) return

      const updatedAgent = await updateAgent({ id: agentBase.id, model: model.id }, { showSuccessToast: false })
      if (!updatedAgent) return

      await updateSessionModel(session.id, model.id, { showSuccessToast: false })
    },
    [agentBase, session, updateAgent, updateSessionModel]
  )

  const handleOpenModel = useCallback(async () => {
    const result = await AiOnlyAddModelPopup.show({ provider })
    if (result.success) {
      await setupModels(10)
    }
  }, [provider, setupModels])

  // console.log('<============assistant=======>', assistant)

  // Use shared hooks for text and textarea management with draft persistence
  const draftCacheKey = getAgentDraftCacheKey(agentId)
  const {
    text,
    setText,
    isEmpty: inputEmpty
  } = useInputText({
    initialValue: CacheService.get<string>(draftCacheKey) ?? '',
    onChange: (value) => CacheService.set(draftCacheKey, value, DRAFT_CACHE_TTL)
  })
  const {
    textareaRef,
    resize: resizeTextArea,
    focus: focusTextarea,
    setExpanded,
    isExpanded: textareaIsExpanded,
    customHeight,
    setCustomHeight
  } = useTextareaResize({ maxHeight: 500, minHeight: 30 })
  const { sendMessageShortcut, apiServer } = useSettings()

  const { t } = useTranslation()
  const quickPanel = useQuickPanel()

  const [reasoningEffort, setReasoningEffort] = useState<ThinkingOption>('default')

  const { files } = useInputbarToolsState()
  const { toolsRegistry, setIsExpanded, setFiles } = useInputbarToolsDispatch()
  const { setCouldAddImageFile } = useInputbarToolsInternalDispatch()

  const { setTimeoutTimer } = useTimer()
  const dispatch = useAppDispatch()
  const sessionTopicId = buildAgentSessionTopicId(sessionId)
  const topicMessages = useAppSelector((state) => selectMessagesForTopic(state, sessionTopicId))
  const loading = useAppSelector((state) => selectNewTopicLoading(state, sessionTopicId))

  // Calculate vision and image generation support
  const isVisionAssistant = useMemo(() => (assistant.model ? isVisionModel(assistant.model) : false), [assistant.model])
  const isGenerateImageAssistant = useMemo(
    () => (assistant.model ? isGenerateImageModel(assistant.model) : false),
    [assistant.model]
  )

  // Agent sessions don't support model mentions yet, so we only check the assistant's model
  const canAddImageFile = useMemo(() => {
    return isVisionAssistant || isGenerateImageAssistant
  }, [isVisionAssistant, isGenerateImageAssistant])

  const canAddTextFile = useMemo(() => {
    return isVisionAssistant || (!isVisionAssistant && !isGenerateImageAssistant)
  }, [isVisionAssistant, isGenerateImageAssistant])

  // Update the couldAddImageFile state when the model changes
  useEffect(() => {
    setCouldAddImageFile(canAddImageFile)
  }, [canAddImageFile, setCouldAddImageFile])

  const syncExpandedState = useCallback(
    (expanded: boolean) => {
      setExpanded(expanded)
      setIsExpanded(expanded)
    },
    [setExpanded, setIsExpanded]
  )
  const handleToggleExpanded = useCallback(
    (nextState?: boolean) => {
      const target = typeof nextState === 'boolean' ? nextState : !textareaIsExpanded
      syncExpandedState(target)
      focusTextarea()
    },
    [focusTextarea, syncExpandedState, textareaIsExpanded]
  )

  // Update actionsRef for InputbarTools
  useEffect(() => {
    actionsRef.current = {
      resizeTextArea,
      onTextChange: setText,
      toggleExpanded: handleToggleExpanded
    }
  }, [resizeTextArea, setText, actionsRef, handleToggleExpanded])

  const rootTriggerHandlerRef = useRef<((payload?: unknown) => void) | undefined>(undefined)

  // Update handler logic when dependencies change
  // For Agent Session, we directly trigger SlashCommands panel instead of Root menu
  useEffect(() => {
    rootTriggerHandlerRef.current = (payload) => {
      const slashCommands = sessionData?.slashCommands || []
      const triggerInfo = (payload ?? {}) as QuickPanelTriggerInfo

      if (slashCommands.length === 0) {
        quickPanel.open({
          title: t('chat.input.slash_commands.title'),
          symbol: QuickPanelReservedSymbol.SlashCommands,
          triggerInfo,
          list: [
            {
              label: t('chat.input.slash_commands.empty', 'No slash commands available'),
              description: '',
              icon: null,
              disabled: true,
              action: () => {}
            }
          ]
        })
        return
      }

      quickPanel.open({
        title: t('chat.input.slash_commands.title'),
        symbol: QuickPanelReservedSymbol.SlashCommands,
        triggerInfo,
        list: slashCommands.map((cmd) => ({
          label: cmd.command,
          description: cmd.description || '',
          icon: null,
          filterText: `${cmd.command} ${cmd.description || ''}`,
          action: () => {
            // Insert command into textarea
            setText((prev: string) => {
              const textArea = document.querySelector('.inputbar textarea') as HTMLTextAreaElement | null
              if (!textArea) {
                return prev + ' ' + cmd.command
              }

              const cursorPosition = textArea.selectionStart || 0
              const textBeforeCursor = prev.slice(0, cursorPosition)
              const lastSlashIndex = textBeforeCursor.lastIndexOf('/')

              if (lastSlashIndex !== -1 && cursorPosition > lastSlashIndex) {
                // Replace from '/' to cursor with command
                const newText = prev.slice(0, lastSlashIndex) + cmd.command + ' ' + prev.slice(cursorPosition)
                const newCursorPos = lastSlashIndex + cmd.command.length + 1

                setTimeout(() => {
                  if (textArea) {
                    textArea.focus()
                    textArea.setSelectionRange(newCursorPos, newCursorPos)
                  }
                }, 0)

                return newText
              }

              // No '/' found, just insert at cursor
              const newText = prev.slice(0, cursorPosition) + cmd.command + ' ' + prev.slice(cursorPosition)
              const newCursorPos = cursorPosition + cmd.command.length + 1

              setTimeout(() => {
                if (textArea) {
                  textArea.focus()
                  textArea.setSelectionRange(newCursorPos, newCursorPos)
                }
              }, 0)

              return newText
            })
          }
        }))
      })
    }
  }, [sessionData, quickPanel, t, setText])

  // Register the trigger handler (only once)
  useEffect(() => {
    if (!config.enableQuickPanel) {
      return
    }

    const disposeRootTrigger = toolsRegistry.registerTrigger(
      'agent-session-root',
      QuickPanelReservedSymbol.Root,
      (payload) => rootTriggerHandlerRef.current?.(payload)
    )

    return () => {
      disposeRootTrigger()
    }
  }, [config.enableQuickPanel, toolsRegistry])

  const sendDisabled = (inputEmpty && files.length === 0) || !apiServer.enabled

  const streamingAskIds = useMemo(() => {
    if (!topicMessages) {
      return []
    }

    const askIdSet = new Set<string>()
    for (const message of topicMessages) {
      if (!message) continue
      if (message.status === 'processing' || message.status === 'pending') {
        if (message.askId) {
          askIdSet.add(message.askId)
        } else if (message.id) {
          askIdSet.add(message.id)
        }
      }
    }

    return Array.from(askIdSet)
  }, [topicMessages])

  const canAbort = loading && streamingAskIds.length > 0

  const abortAgentSession = useCallback(async () => {
    if (!streamingAskIds.length) {
      logger.debug('No active agent session streams to abort', { sessionTopicId })
      return
    }

    logger.info('Aborting agent session message generation', {
      sessionTopicId,
      askIds: streamingAskIds
    })

    for (const askId of streamingAskIds) {
      abortCompletion(askId)
    }

    void pauseTrace(sessionTopicId)
    dispatch(newMessagesActions.setTopicLoading({ topicId: sessionTopicId, loading: false }))
  }, [dispatch, sessionTopicId, streamingAskIds])

  const sendMessage = useCallback(async () => {
    if (sendDisabled) {
      return
    }

    logger.info('Starting to send message')

    try {
      const userMessageId = uuid()

      // For agent sessions, append file paths to the text content instead of uploading files
      let messageText = text
      if (files.length > 0) {
        const filePaths = files.map((file) => file.path).join('\n')
        messageText = text ? `${text}\n\nAttached files:\n${filePaths}` : `Attached files:\n${filePaths}`
      }

      const mainBlock = createMainTextBlock(userMessageId, messageText, {
        status: MessageBlockStatus.SUCCESS
      })
      const userMessageBlocks: MessageBlock[] = [mainBlock]

      // Calculate token usage for the user message
      const usage = await estimateUserPromptUsage({ content: text })

      // console.log('createMessage----assistant', assistant)

      const userMessage: Message = createMessage('user', sessionTopicId, agentId, {
        id: userMessageId,
        blocks: userMessageBlocks.map((block) => block?.id),
        model: assistant.model,
        modelId: assistant.model?.id,
        usage
      })

      const thinkingParams = assistant.model
        ? getAnthropicReasoningParams(
            { ...assistant, settings: { ...assistant.settings, reasoning_effort: reasoningEffort } },
            assistant.model
          )
        : {}

      void dispatch(
        dispatchSendMessage(userMessage, userMessageBlocks, assistant, sessionTopicId, {
          agentId,
          sessionId,
          ...thinkingParams
        })
      )

      // Emit event to trigger scroll to bottom in AgentSessionMessages
      void EventEmitter.emit(EVENT_NAMES.SEND_MESSAGE, { topicId: sessionTopicId })

      // Clear text and files after successful send (draft is cleared automatically via onChange)
      setText('')
      setFiles([])
      setTimeoutTimer('agentSession_sendMessage', () => setText(''), 500)
      // Restore focus to textarea after sending to maintain IME state (fcitx5 issue)
      focusTextarea()
    } catch (error) {
      logger.warn('Failed to send message:', error as Error)
    }
  }, [
    sendDisabled,
    agentId,
    dispatch,
    assistant,
    sessionId,
    sessionTopicId,
    setText,
    setFiles,
    setTimeoutTimer,
    text,
    files,
    focusTextarea,
    reasoningEffort
  ])

  useEffect(() => {
    if (!document.querySelector('.topview-fullscreen-container')) {
      focusTextarea()
    }
  }, [focusTextarea])

  const supportedExts = useMemo(() => {
    if (canAddImageFile && canAddTextFile) {
      return [...imageExts, ...documentExts, ...textExts]
    }

    if (canAddImageFile) {
      return [...imageExts]
    }

    if (canAddTextFile) {
      return [...documentExts, ...textExts]
    }

    return []
  }, [canAddImageFile, canAddTextFile])

  const toolsSession = useMemo(() => {
    if (!sessionData) return undefined
    return { ...sessionData, reasoningEffort, onReasoningEffortChange: setReasoningEffort }
  }, [sessionData, reasoningEffort])

  const workdir = session?.accessible_paths?.[0]

  // 底栏左侧：工具按钮 → 智能体按钮 → 选择外部编辑器（均与工具按钮同一行）
  const leftToolbar = useMemo(
    () => (
      <ToolbarGroup>
        {config.showTools && (
          <InputbarTools scope={scope} assistant={assistant} model={assistant.model!} session={toolsSession} />
        )}
        {agentBase && <AgentNameButton agent={agentBase} />}
        {workdir && <OpenExternalAppButton workdir={workdir} variant="compact" />}
      </ToolbarGroup>
    ),
    [config.showTools, scope, assistant, toolsSession, agentBase, workdir]
  )

  // 底栏右侧：模型选择（与对话页同款样式），无模型时退化为“去开通”
  const rightToolbar = useMemo(() => {
    if (noModels) {
      return (
        <NoModelHint>
          <WarningFilled />
          <span>{t('chat.topics.no_model')}</span>
          <Button type="primary" size="small" onClick={() => void handleOpenModel()}>
            {t('chat.topics.open_model_text')}
          </Button>
        </NoModelHint>
      )
    }

    if (!session) {
      return null
    }

    return <AgentModelSelectButton agentBase={session} onSelect={handleUpdateModel} />
  }, [noModels, session, t, handleOpenModel, handleUpdateModel])
  const placeholderText = useMemo(() => {
    if (isSoulModeEnabled(agentBase?.configuration)) {
      return t('agent.input.soul_placeholder')
    }
    return t('agent.input.placeholder', {
      key: getSendMessageShortcutLabel(sendMessageShortcut)
    })
  }, [agentBase?.configuration, sendMessageShortcut, t])

  return (
    <InputbarCore
      scope={TopicType.Session}
      text={text}
      onTextChange={setText}
      textareaRef={textareaRef}
      height={customHeight}
      onHeightChange={setCustomHeight}
      resizeTextArea={resizeTextArea}
      focusTextarea={focusTextarea}
      placeholder={placeholderText}
      supportedExts={supportedExts}
      onPause={abortAgentSession}
      isLoading={canAbort}
      handleSendMessage={sendMessage}
      leftToolbar={leftToolbar}
      rightToolbar={rightToolbar}
      topRightContent={<AgentSettingsButton compact />}
      forceEnableQuickPanelTriggers
    />
  )
}

const ToolbarGroup = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  min-width: 0;
`

const NoModelHint = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-red-600);
  font-size: 12px;
  white-space: nowrap;
`

export default AgentSessionInputbar
