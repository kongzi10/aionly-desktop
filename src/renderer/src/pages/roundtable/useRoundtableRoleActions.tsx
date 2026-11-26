import AddAssistantPopup from '@renderer/components/Popups/AddAssistantPopup'
import AssistantPresetsPage from '@renderer/pages/store/assistants/presets/AssistantPresetsPage'
import store from '@renderer/store'
import { addAssistant, updateAssistant } from '@renderer/store/assistants'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * 群聊角色管理共享动作：新建角色（含 store 自愈校验）与角色库模态。
 * 成员选择弹窗（SelectRoundtableModelsPopup）与输入栏成员 chip 的角色切换器复用，
 * 保证两个入口的创建/管理行为一致。
 */
export const useRoundtableRoleActions = () => {
  const { t } = useTranslation()

  /** 打开角色库（与首页面板一致：内嵌 AssistantPresetsPage 的模态） */
  const openRoleLibrary = useCallback(() => {
    window.modal.info({
      title: t('assistants.presets.title'),
      okText: null,
      cancelText: null,
      footer: null,
      maskClosable: true,
      closable: true,
      icon: null,
      className: 'assistant-presets-modal',
      width: '80%',
      centered: true,
      // 需高于成员选择弹窗（antd Modal 默认 1000）及其遮罩，否则角色库被压在下面无法交互
      zIndex: 1200,
      styles: {
        content: {
          height: '86vh',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column'
        },
        header: {
          flexShrink: 0
        },
        body: {
          padding: 0,
          flex: 1,
          minHeight: 0,
          overflow: 'hidden'
        }
      },
      content: <AssistantPresetsPage showNavbar={false} workspace="roundtable" embedded />
    })
  }, [t])

  /** 新建角色（workspace='roundtable'），创建成功后通过 onBind 回传新角色 id 由调用方完成绑定 */
  const createRole = useCallback((onBind: (assistantId: string) => void) => {
    void AddAssistantPopup.show('roundtable').then((assistant) => {
      if (!assistant) return
      // 自愈校验：创建链路虽传入 workspace='roundtable'，但跨窗口同步（StoreSyncService 'assistants/'）
      // 等竞态可能覆盖/丢失新角色，导致「添加成功但角色列表没有」。此处按 store 实况修复：
      // 缺失则补 addAssistant，workspace 不符则 updateAssistant 归位到 roundtable。
      const exists = store.getState().assistants.assistants.find((item) => item.id === assistant.id)
      if (!exists) {
        store.dispatch(addAssistant({ ...assistant, workspace: 'roundtable' }))
      } else if (exists.workspace !== 'roundtable') {
        store.dispatch(updateAssistant({ id: assistant.id, workspace: 'roundtable' }))
      }
      onBind(assistant.id)
    })
  }, [])

  return { createRole, openRoleLibrary }
}
