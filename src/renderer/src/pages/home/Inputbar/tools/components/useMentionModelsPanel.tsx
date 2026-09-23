import { SelectMultiModelsPopup } from '@renderer/components/Popups/SelectModelPopup'
import { QuickPanelReservedSymbol } from '@renderer/components/QuickPanel'
import { isVisionModel } from '@renderer/config/models'
import { transformToModel } from '@renderer/hooks/useAiOnlyModels'
import type { ToolQuickPanelApi } from '@renderer/pages/home/Inputbar/types'
import type { Model } from '@renderer/types'
import { AtSign } from 'lucide-react'
import React, { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export type MentionTriggerInfo = { type: 'input' | 'button'; position?: number; originalText?: string }

interface Params {
  /** 仅 manager 角色需要，用于注册 QuickPanel 根菜单和 @ 触发器 */
  quickPanel?: ToolQuickPanelApi
  mentionedModels: Model[]
  setMentionedModels: React.Dispatch<React.SetStateAction<Model[]>>
  couldMentionNotVisionModel: boolean
  setText: React.Dispatch<React.SetStateAction<string>>
  /** 数量上限提示文案使用的场景：圆桌对话 / 对话中的多模型（多智能体回复） */
  mode?: 'chat' | 'roundtable'
}

/**
 * 多模型（多智能体回复）的模型选择逻辑：
 * 统一通过 SelectMultiModelsPopup 弹窗选择（搜索 + 按供应商分组），
 * 支持 @ 按钮、@ 输入触发和 QuickPanel 根菜单三个入口。
 */
export const useMentionModelsPanel = (params: Params, role: 'button' | 'manager' = 'button') => {
  const { quickPanel, mentionedModels, setMentionedModels, couldMentionNotVisionModel, setText, mode = 'chat' } = params
  const { t } = useTranslation()
  const { registerRootMenu, registerTrigger } = quickPanel ?? {}

  const removeAtSymbolAndText = useCallback((currentText: string, caretPosition: number, fallbackPosition?: number) => {
    const safeCaret = Math.max(0, Math.min(caretPosition ?? 0, currentText.length))

    const fromIndex = Math.max(0, safeCaret - 1)
    const start = currentText.lastIndexOf('@', fromIndex)
    if (start === -1) {
      if (typeof fallbackPosition === 'number' && currentText[fallbackPosition] === '@') {
        let endPos = fallbackPosition + 1
        while (endPos < currentText.length && !/\s/.test(currentText[endPos])) {
          endPos++
        }
        return currentText.slice(0, fallbackPosition) + currentText.slice(endPos)
      }
      return currentText
    }

    let endPos = start + 1
    while (endPos < currentText.length && !/\s/.test(currentText[endPos])) {
      endPos++
    }
    return currentText.slice(0, start) + currentText.slice(endPos)
  }, [])

  // 带图片时仅允许选择视觉模型，与多模型回复的过滤规则保持一致
  const modelFilter = useCallback(
    (m: any) => couldMentionNotVisionModel || isVisionModel(transformToModel(m)),
    [couldMentionNotVisionModel]
  )

  const openModelPopup = useCallback(
    (triggerInfo?: MentionTriggerInfo) => {
      // 输入触发：先移除输入框中的 @ 及其后的搜索段，避免弹窗关闭后残留触发符
      if (triggerInfo?.type === 'input' && triggerInfo.position !== undefined) {
        setText((currentText) => {
          const textArea = document.querySelector('.inputbar textarea') as HTMLTextAreaElement | null
          const caret = textArea ? (textArea.selectionStart ?? currentText.length) : currentText.length
          return removeAtSymbolAndText(currentText, caret, triggerInfo.position)
        })
      }

      void SelectMultiModelsPopup.show({
        selectedModels: mentionedModels,
        modelFilter,
        mode
      }).then((models) => {
        if (models) {
          setMentionedModels(models)
        }
      })
    },
    [mentionedModels, mode, modelFilter, removeAtSymbolAndText, setMentionedModels, setText]
  )

  const handleOpenModelPopup = useCallback(() => {
    openModelPopup({ type: 'button' })
  }, [openModelPopup])

  useEffect(() => {
    if (role !== 'manager' || !registerRootMenu || !registerTrigger) return

    const disposeRootMenu = registerRootMenu([
      {
        label: t('assistants.presets.edit.model.select.title'),
        description: '',
        icon: <AtSign />,
        isMenu: true,
        action: () => openModelPopup({ type: 'button' })
      }
    ])

    const disposeTrigger = registerTrigger(QuickPanelReservedSymbol.MentionModels, (payload) => {
      const trigger = (payload || {}) as MentionTriggerInfo
      openModelPopup(trigger)
    })

    return () => {
      disposeRootMenu()
      disposeTrigger()
    }
  }, [openModelPopup, registerRootMenu, registerTrigger, role, t])

  return {
    handleOpenModelPopup,
    openModelPopup
  }
}
