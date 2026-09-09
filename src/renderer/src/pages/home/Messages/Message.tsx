import { loggerService } from '@logger'
import HorizontalScrollContainer from '@renderer/components/HorizontalScrollContainer'
import Scrollbar from '@renderer/components/Scrollbar'
import { useMessageEditing } from '@renderer/context/MessageEditingContext'
import { useAssistant } from '@renderer/hooks/useAssistant'
import { useChatContext } from '@renderer/hooks/useChatContext'
import { useMessageOperations } from '@renderer/hooks/useMessageOperations'
import { useModel } from '@renderer/hooks/useModel'
import { useSettings } from '@renderer/hooks/useSettings'
import { useTimer } from '@renderer/hooks/useTimer'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import { getMessageModelId } from '@renderer/services/MessagesService'
import { getModelUniqId } from '@renderer/services/ModelService'
import { estimateMessageUsage } from '@renderer/services/TokenService'
import type { MultiModelMessageStyle } from '@renderer/store/settings'
import type { Assistant, Topic } from '@renderer/types'
import type { Message, MessageBlock } from '@renderer/types/newMessage'
import { cn } from '@renderer/utils'
import { scrollIntoView } from '@renderer/utils/dom'
import { isMessageProcessing } from '@renderer/utils/messageUtils/is'
import { Divider } from 'antd'
import type { Dispatch, FC, SetStateAction } from 'react'
import React, { memo, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { getRoundtableCardClassName } from '../../roundtable/roundtableView'
import MessageContent from './MessageContent'
import MessageEditor from './MessageEditor'
import MessageErrorBoundary from './MessageErrorBoundary'
import MessageHeader from './MessageHeader'
import MessageMenubar from './MessageMenubar'
import MessageOutline from './MessageOutline'

interface Props {
  message: Message
  topic: Topic
  assistant?: Assistant
  index?: number
  total?: number
  hideMenuBar?: boolean
  style?: React.CSSProperties
  isGrouped?: boolean
  isStreaming?: boolean
  onSetMessages?: Dispatch<SetStateAction<Message[]>>
  onUpdateUseful?: (msgId: string) => void
  isGroupContextMessage?: boolean
  isHorizontalMultiModelLayout?: boolean
  multiModelMessageStyle?: MultiModelMessageStyle
}

const logger = loggerService.withContext('MessageItem')

const WrapperContainer = ({
  isMultiSelectMode,
  children
}: {
  isMultiSelectMode: boolean
  children: React.ReactNode
}) => {
  return isMultiSelectMode ? <label style={{ cursor: 'pointer' }}>{children}</label> : children
}

const MessageItem: FC<Props> = ({
  message,
  topic,
  // assistant,
  index,
  hideMenuBar = false,
  isGrouped,
  onUpdateUseful,
  isGroupContextMessage,
  isHorizontalMultiModelLayout = false,
  multiModelMessageStyle = 'fold'
}) => {
  const { t } = useTranslation()
  const { assistant, setModel } = useAssistant(message.assistantId)
  const { isMultiSelectMode } = useChatContext(topic)
  const model = useModel(getMessageModelId(message), message.model?.provider) || message.model || assistant?.model
  const { messageFont, fontSize, /*messageStyle,*/ showMessageOutline } = useSettings()
  const { editMessageBlocks, resendUserMessageWithEdit, editMessage } = useMessageOperations(topic)
  const messageContainerRef = useRef<HTMLDivElement>(null)
  const { editingMessageId, startEditing, stopEditing } = useMessageEditing()
  const { setTimeoutTimer } = useTimer()
  const isEditing = editingMessageId === message.id

  // console.log('MessageItem------->message', message)
  // console.log('MessageItem------->model', model)

  useEffect(() => {
    if (isEditing && messageContainerRef.current) {
      scrollIntoView(messageContainerRef.current, {
        behavior: 'smooth',
        block: 'center',
        container: 'nearest'
      })
    }
  }, [isEditing])

  const handleEditSave = useCallback(
    async (blocks: MessageBlock[]) => {
      try {
        await editMessageBlocks(message.id, blocks)
        const usage = await estimateMessageUsage(message)
        void editMessage(message.id, { usage: usage })
        stopEditing()
      } catch (error) {
        logger.error('Failed to save message blocks:', error as Error)
      }
    },
    [message, editMessageBlocks, stopEditing, editMessage]
  )

  const handleEditResend = useCallback(
    async (blocks: MessageBlock[]) => {
      try {
        await resendUserMessageWithEdit(message, blocks, assistant)
        stopEditing()
      } catch (error) {
        logger.error('Failed to resend message:', error as Error)
      }
    },
    [message, resendUserMessageWithEdit, assistant, stopEditing]
  )

  const handleEditCancel = useCallback(() => {
    stopEditing()
  }, [stopEditing])

  const isLastMessage = index === 0 || !!isGrouped
  const isAssistantMessage = message.role === 'assistant'
  const isProcessing = isMessageProcessing(message)
  const showMenubar = !hideMenuBar && !isEditing && !isProcessing
  // const shouldReverseFooter = isLastMessage && (messageStyle === 'plain' || isAssistantMessage)

  const messageHighlightHandler = useCallback(
    (highlight: boolean = true) => {
      if (messageContainerRef.current) {
        scrollIntoView(messageContainerRef.current, { behavior: 'smooth', block: 'center', container: 'nearest' })
        if (highlight) {
          setTimeoutTimer(
            'messageHighlightHandler',
            () => {
              const classList = messageContainerRef.current?.classList
              classList?.add('animation-locate-highlight')

              const handleAnimationEnd = () => {
                classList?.remove('animation-locate-highlight')
                messageContainerRef.current?.removeEventListener('animationend', handleAnimationEnd)
              }

              messageContainerRef.current?.addEventListener('animationend', handleAnimationEnd)
            },
            500
          )
        }
      }
    },
    [setTimeoutTimer]
  )

  useEffect(() => {
    const unsubscribes = [EventEmitter.on(EVENT_NAMES.LOCATE_MESSAGE + ':' + message.id, messageHighlightHandler)]
    return () => unsubscribes.forEach((unsub) => unsub())
  }, [message.id, messageHighlightHandler])

  // Listen for external edit requests and activate editor for this message if it matches
  useEffect(() => {
    const handleEditRequest = (targetId: string) => {
      if (targetId === message.id) {
        startEditing(message.id)
      }
    }
    const unsubscribe = EventEmitter.on(EVENT_NAMES.EDIT_MESSAGE, handleEditRequest)
    return () => {
      unsubscribe()
    }
  }, [message.id, startEditing])

  if (message.type === 'clear') {
    return (
      <NewContextMessage
        isMultiSelectMode={isMultiSelectMode}
        className="clear-context-divider"
        onClick={() => {
          if (isMultiSelectMode) {
            return
          }
          void EventEmitter.emit(EVENT_NAMES.NEW_CONTEXT)
        }}>
        <Divider dashed style={{ padding: '0 20px' }} plain>
          {t('chat.message.new.context')}
        </Divider>
      </NewContextMessage>
    )
  }

  return (
    <WrapperContainer isMultiSelectMode={isMultiSelectMode}>
      <MessageContainer
        key={message.id}
        className={cn(
          'message',
          {
            'message-assistant': isAssistantMessage,
            'message-user': !isAssistantMessage
          },
          isAssistantMessage ? getRoundtableCardClassName(multiModelMessageStyle, isGrouped ? 2 : 1) : undefined
        )}
        ref={messageContainerRef}>
        {isEditing ? (
          <>
            <MessageHeader
              message={message}
              assistant={assistant}
              model={model}
              key={getModelUniqId(model)}
              topic={topic}
              isGroupContextMessage={isGroupContextMessage}
            />
            <MessageEditor
              message={message}
              topicId={topic.id}
              onSave={handleEditSave}
              onResend={handleEditResend}
              onCancel={handleEditCancel}
            />
          </>
        ) : (
          <MessageInfoWrapper className="message-info-wrapper">
            <MessageHeader
              message={message}
              assistant={assistant}
              model={model}
              key={getModelUniqId(model)}
              topic={topic}
              isGroupContextMessage={isGroupContextMessage}
              onSelectContext={isGrouped ? () => onUpdateUseful?.(message.id) : undefined}
            />
            <div className={cn('main', { 'is-grouped': isGrouped })}>
              {!isMultiSelectMode && message.role === 'assistant' && showMessageOutline && (
                <MessageOutline message={message} />
              )}
              {message.role === 'assistant' && message.model?.name && (
                <div className="model-name">{message.model?.name}</div>
              )}
              <MessageInnerWrapper className="message-inner-wrapper">
                <MessageContentContainer
                  className="message-content-container"
                  style={{
                    fontFamily: messageFont === 'serif' ? 'var(--font-family-serif)' : 'var(--font-family)',
                    fontSize,
                    overflowY: isHorizontalMultiModelLayout ? 'auto' : 'visible'
                  }}>
                  <MessageErrorBoundary>
                    <MessageContent message={message} />
                  </MessageErrorBoundary>
                </MessageContentContainer>
                {showMenubar && (
                  <MessageFooter className="MessageFooter">
                    <HorizontalScrollContainer
                      classNames={{
                        content: cn(
                          'flex-1 items-center justify-between',
                          /*shouldReverseFooter ? 'flex-row-reverse' : 'flex-row'*/
                          isAssistantMessage ? 'flex-row-reverse' : 'flex-row'
                        )
                      }}>
                      <MessageMenubar
                        message={message}
                        assistant={assistant}
                        model={model}
                        index={index}
                        topic={topic}
                        isLastMessage={isLastMessage}
                        isAssistantMessage={isAssistantMessage}
                        isGrouped={isGrouped}
                        messageContainerRef={messageContainerRef as React.RefObject<HTMLDivElement>}
                        setModel={setModel}
                        onUpdateUseful={onUpdateUseful}
                      />
                    </HorizontalScrollContainer>
                  </MessageFooter>
                )}
              </MessageInnerWrapper>
            </div>
          </MessageInfoWrapper>
        )}
      </MessageContainer>
    </WrapperContainer>
  )
}

const MessageContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  position: relative;
  transition: background-color 0.3s ease;
  transform: translateZ(0);
  will-change: transform;
  padding: 10px;
  border-radius: 10px;

  &.roundtable-response-card {
    overflow: hidden;
    padding: 0;
    border: 1px solid var(--color-border-soft);
    border-radius: 14px;
    background: var(--color-background);
    box-shadow:
      0 1px 2px var(--color-border-soft),
      0 8px 24px color-mix(in srgb, var(--color-text) 5%, transparent);
    transition: transform 0.2s ease;

    &::before {
      position: absolute;
      z-index: 1;
      top: 0;
      right: 0;
      left: 0;
      height: 3px;
      content: '';
      background: linear-gradient(90deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 35%, transparent));
    }

    &:hover {
      transform: translateY(-1px);
      box-shadow:
        0 2px 4px var(--color-border-soft),
        0 14px 32px color-mix(in srgb, var(--color-text) 8%, transparent);
    }

    .message-info-wrapper {
      height: 100%;
    }

    .message-header {
      top: 15px;
      left: 16px;
      right: 16px;
      z-index: 1;
      margin: 0;
    }

    .main {
      display: flex;
      flex-direction: column;
      height: 100%;
      margin-left: 0;
    }

    .model-name {
      display: flex;
      min-height: 58px;
      align-items: center;
      padding: 9px 44px 8px 60px;
      border-bottom: 1px solid var(--color-border-soft);
      background: linear-gradient(180deg, var(--color-background-soft), var(--color-background));
      font-size: 13px;
      font-weight: 650;
      line-height: 18px;
    }

    .message-inner-wrapper {
      display: flex;
      flex: 1;
      flex-direction: column;
      padding: 18px 18px 12px;
      border-radius: 0;
      background: transparent;
    }

    .MessageFooter {
      padding-top: 10px;
      border-top: 1px solid var(--color-border-soft);
    }
  }
  .menubar {
    opacity: 0;
    transition: opacity 0.2s ease;
    transform: translateZ(0);
    will-change: opacity;
    &.show {
      opacity: 1;
    }
  }
  &:hover {
    .menubar {
      opacity: 1;
    }
  }


  &.message-user{
    .message-info-wrapper{
      display: flex;
      justify-content: flex-end;
    }
    .message-header{
        right: 0;
    }
    .main{
      //border-radius: 8px 0 8px 8px;
      //width: fit-content;
      //min-width: 25%;
      //max-width: 100%;
      margin-right: 55px;
      //background-color: var(--color-list-item);
      display: flex;
      justify-content: flex-end;
    }
    .message-inner-wrapper{
      width: fit-content;
      min-width: 30%;
      max-width: 100%;
      background-color: var(--color-list-item);
      border-radius: 8px 0 8px 8px;
    }
  }
`

const MessageInfoWrapper = styled.div`
  width: 100%;
  position: relative;
  .main{
    //width: calc(100% - 100px);
    margin-left: 45px;
    //padding: 16px;
    //background-color: var(--color-gray-5);
    //border-radius: 0 8px 8px 8px;
    &:not(.is-grouped){
      width: calc(100% - 100px);
    }
  }
  .message-header{
    position: absolute;
    top: 0;
  }
  .model-name{
    font-weight: 600;
    padding-bottom: 6px;
  }
`

const MessageContentContainer = styled(Scrollbar)`
  max-width: 100%;
  //padding-left: 46px;
  margin-top: 0;
  overflow-y: auto;
  flex: 1;
`

const MessageFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  //margin-left: 45px;
  margin: 8px 0 -5px;
`

const NewContextMessage = styled.div<{ isMultiSelectMode: boolean }>`
  cursor: pointer;
  flex: 1;

  ${({ isMultiSelectMode }) => isMultiSelectMode && 'cursor: default;'}
`

const MessageInnerWrapper = styled.div`
  background-color: var(--color-gray-5);
  padding: 16px;
  border-radius: 0 8px 8px 8px;
`

export default memo(MessageItem)
