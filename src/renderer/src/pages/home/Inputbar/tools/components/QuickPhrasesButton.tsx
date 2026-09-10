import { ActionIconButton } from '@renderer/components/Buttons'
import {
  type QuickPanelListItem,
  type QuickPanelOpenOptions,
  QuickPanelReservedSymbol,
  type QuickPanelTriggerInfo
} from '@renderer/components/QuickPanel'
import { useQuickPanel } from '@renderer/components/QuickPanel'
import { useAssistant } from '@renderer/hooks/useAssistant'
import { useTimer } from '@renderer/hooks/useTimer'
import type { ToolQuickPanelApi } from '@renderer/pages/home/Inputbar/types'
import QuickPhraseService from '@renderer/services/QuickPhraseService'
import type { QuickPhrase } from '@renderer/types'
import { Form, Input, Modal, Radio, Tooltip } from 'antd'
import { BotMessageSquare, Plus, Zap } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  quickPanel: ToolQuickPanelApi
  setInputValue: React.Dispatch<React.SetStateAction<string>>
  resizeTextArea: () => void
  assistantId: string
}

const QuickPhrasesButton = ({ quickPanel, setInputValue, resizeTextArea, assistantId }: Props) => {
  const [quickPhrasesList, setQuickPhrasesList] = useState<QuickPhrase[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [location, setLocation] = useState<'global' | 'assistant'>('global')
  const [form] = Form.useForm<{ title: string; content: string }>()
  const { t } = useTranslation()
  const quickPanelHook = useQuickPanel()
  const { assistant, updateAssistant } = useAssistant(assistantId)
  const { setTimeoutTimer } = useTimer()
  const triggerInfoRef = useRef<
    (QuickPanelTriggerInfo & { symbol?: QuickPanelReservedSymbol; searchText?: string }) | undefined
  >(undefined)

  const loadQuickListPhrases = useCallback(
    async (regularPhrases: QuickPhrase[] = []) => {
      const phrases = await QuickPhraseService.getAll()
      if (regularPhrases.length) {
        setQuickPhrasesList([...regularPhrases, ...phrases])
        return
      }
      const assistantPrompts = assistant.regularPhrases || []
      setQuickPhrasesList([...assistantPrompts, ...phrases])
    },
    [assistant.regularPhrases]
  )

  useEffect(() => {
    void loadQuickListPhrases()
  }, [loadQuickListPhrases])

  const handlePhraseSelect = useCallback(
    (phrase: QuickPhrase) => {
      setTimeoutTimer(
        'handlePhraseSelect_1',
        () => {
          setInputValue((prev) => {
            const triggerInfo = triggerInfoRef.current
            const textArea = document.querySelector('.inputbar textarea') as HTMLTextAreaElement | null

            const focusAndSelect = (start: number) => {
              setTimeoutTimer(
                'handlePhraseSelect_2',
                () => {
                  if (textArea) {
                    textArea.focus()
                    textArea.setSelectionRange(start, start + phrase.content.length)
                  }
                  resizeTextArea()
                },
                10
              )
            }

            if (triggerInfo?.type === 'input' && triggerInfo.position !== undefined) {
              const symbol = triggerInfo.symbol ?? QuickPanelReservedSymbol.Root
              const searchText = triggerInfo.searchText ?? ''
              const startIndex = triggerInfo.position

              let endIndex = startIndex + 1
              if (searchText) {
                const expected = symbol + searchText
                const actual = prev.slice(startIndex, startIndex + expected.length)
                if (actual === expected) {
                  endIndex = startIndex + expected.length
                } else {
                  while (endIndex < prev.length && !/\s/.test(prev[endIndex])) {
                    endIndex++
                  }
                }
              } else {
                while (endIndex < prev.length && !/\s/.test(prev[endIndex])) {
                  endIndex++
                }
              }

              const newText = prev.slice(0, startIndex) + phrase.content + prev.slice(endIndex)
              triggerInfoRef.current = undefined
              focusAndSelect(startIndex)
              return newText
            }

            if (!textArea) {
              triggerInfoRef.current = undefined
              return prev + phrase.content
            }

            const cursorPosition = textArea.selectionStart ?? prev.length
            const newText = prev.slice(0, cursorPosition) + phrase.content + prev.slice(cursorPosition)
            triggerInfoRef.current = undefined
            focusAndSelect(cursorPosition)
            return newText
          })
        },
        10
      )
    },
    [setTimeoutTimer, setInputValue, resizeTextArea]
  )

  const handleModalCancel = () => {
    setIsModalOpen(false)
    setLocation('global')
    form.resetFields()
  }

  const handleModalOk = async (values: { title: string; content: string }) => {
    if (location === 'assistant') {
      // 添加到助手的 regularPhrases
      const updatedPrompts = [
        ...(assistant.regularPhrases || []),
        {
          id: crypto.randomUUID(),
          title: values.title,
          content: values.content,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ]
      updateAssistant({ ...assistant, regularPhrases: updatedPrompts })
      await loadQuickListPhrases(updatedPrompts)
    } else {
      // 添加到全局 Quick Phrases
      await QuickPhraseService.add(values)
      await loadQuickListPhrases()
    }
    handleModalCancel()
  }

  const phraseItems = useMemo(() => {
    const newList: QuickPanelListItem[] = quickPhrasesList.map((phrase, index) => ({
      label: phrase.title,
      description: phrase.content,
      icon: index < (assistant.regularPhrases?.length || 0) ? <BotMessageSquare /> : <Zap />,
      action: () => handlePhraseSelect(phrase)
    }))

    newList.push({
      label: t('settings.quickPhrase.add') + '...',
      icon: <Plus />,
      action: () => setIsModalOpen(true)
    })
    return newList
  }, [quickPhrasesList, t, handlePhraseSelect, assistant])

  const quickPanelOpenOptions = useMemo<QuickPanelOpenOptions>(
    () => ({
      title: t('settings.quickPhrase.title'),
      list: phraseItems,
      symbol: QuickPanelReservedSymbol.QuickPhrases
    }),
    [phraseItems, t]
  )

  type QuickPhraseTrigger =
    | (QuickPanelTriggerInfo & { symbol?: QuickPanelReservedSymbol; searchText?: string })
    | undefined

  const openQuickPanel = useCallback(
    (triggerInfo?: QuickPhraseTrigger) => {
      triggerInfoRef.current = triggerInfo
      quickPanelHook.open({
        ...quickPanelOpenOptions,
        triggerInfo:
          triggerInfo && triggerInfo.type === 'input'
            ? {
                type: triggerInfo.type,
                position: triggerInfo.position,
                originalText: triggerInfo.originalText
              }
            : triggerInfo,
        onClose: () => {
          triggerInfoRef.current = undefined
        }
      })
    },
    [quickPanelHook, quickPanelOpenOptions]
  )

  const handleOpenQuickPanel = useCallback(() => {
    if (quickPanelHook.isVisible && quickPanelHook.symbol === QuickPanelReservedSymbol.QuickPhrases) {
      quickPanelHook.close()
    } else {
      openQuickPanel()
    }
  }, [openQuickPanel, quickPanelHook])

  useEffect(() => {
    const disposeRootMenu = quickPanel.registerRootMenu([
      {
        label: t('settings.quickPhrase.title'),
        description: '',
        icon: <Zap />,
        isMenu: true,
        action: ({ context, searchText }) => {
          const rootTrigger =
            context.triggerInfo && context.triggerInfo.type === 'input'
              ? {
                  ...context.triggerInfo,
                  symbol: QuickPanelReservedSymbol.Root,
                  searchText: searchText ?? ''
                }
              : undefined

          context.close('select')
          setTimeout(() => {
            openQuickPanel(rootTrigger)
          }, 0)
        }
      }
    ])

    const disposeTrigger = quickPanel.registerTrigger(QuickPanelReservedSymbol.QuickPhrases, (payload) => {
      const trigger = (payload || undefined) as QuickPhraseTrigger
      openQuickPanel(trigger)
    })

    return () => {
      disposeRootMenu()
      disposeTrigger()
    }
  }, [openQuickPanel, quickPanel, t])

  return (
    <>
      <Tooltip placement="top" title={t('settings.quickPhrase.title')} mouseLeaveDelay={0} arrow>
        <ActionIconButton onClick={handleOpenQuickPanel} aria-label={t('settings.quickPhrase.title')}>
          {/*<Zap size={18} />*/}
          <i className="iconfont icon-kuaijieduanyu" style={{ fontSize: '18px' }}></i>
        </ActionIconButton>
      </Tooltip>

      <Modal
        title={t('settings.quickPhrase.add')}
        open={isModalOpen}
        onOk={() => form.submit()}
        maskClosable={false}
        onCancel={handleModalCancel}
        width={520}
        transitionName="animation-move-down"
        centered>
        <Form
          form={form}
          layout="vertical"
          requiredMark
          colon={false}
          validateTrigger={['onChange']}
          style={{ marginBottom: 16 }}
          onFinish={handleModalOk}>
          <Form.Item
            name="title"
            label={t('settings.quickPhrase.titleLabel')}
            rules={[{ required: true, message: t('settings.quickPhrase.titleRequired') }]}>
            <Input placeholder={t('settings.quickPhrase.titlePlaceholder')} spellCheck={false} allowClear />
          </Form.Item>
          <Form.Item
            name="content"
            label={t('settings.quickPhrase.contentLabel')}
            rules={[{ required: true, message: t('settings.quickPhrase.contentRequired') }]}>
            <Input.TextArea
              placeholder={t('settings.quickPhrase.contentPlaceholder')}
              spellCheck={false}
              autoSize={{ minRows: 6, maxRows: 10 }}
            />
          </Form.Item>
        </Form>
        <div>
          <Label>{t('settings.quickPhrase.locationLabel', '添加位置')}</Label>
          <Radio.Group value={location} onChange={(e) => setLocation(e.target.value)}>
            <Radio value="global">
              <Zap size={20} style={{ paddingRight: '4px', verticalAlign: 'middle', paddingBottom: '3px' }} />
              {t('settings.quickPhrase.global', '全局快速短语')}
            </Radio>
            <Radio value="assistant">
              <BotMessageSquare
                size={20}
                style={{ paddingRight: '4px', verticalAlign: 'middle', paddingBottom: '3px' }}
              />
              {t('settings.quickPhrase.assistant', '助手提示词')}
            </Radio>
          </Radio.Group>
        </div>
      </Modal>
    </>
  )
}

const Label = styled.div`
  font-size: 14px;
  color: var(--color-text);
  margin-bottom: 8px;
`

export default memo(QuickPhrasesButton)
