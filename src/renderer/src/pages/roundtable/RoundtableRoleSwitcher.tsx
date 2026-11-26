import { RolePanel } from '@renderer/components/Popups/SelectModelPopup/roundtable-model-popup'
import { useAppSelector } from '@renderer/store'
import type { Model } from '@renderer/types'
import { Popover } from 'antd'
import type { FC, PropsWithChildren } from 'react'
import { useCallback, useState } from 'react'

import { findPendingRoundtableMention, updatePendingRoundtableMentionRole } from './roundtableMentions'
import { selectRoundtableRoleAssistants } from './roundtableRole'
import { useRoundtableRoleActions } from './useRoundtableRoleActions'

/**
 * 群聊成员角色切换器：点击触发区弹出角色面板（与成员选择弹窗同一 RolePanel），
 * 选中后立即写入 pending 暂存（发送链路按 pending 拼 message.mentions），
 * 并通过 onChanged 通知父级刷新 chip 上的角色名展示。
 */
const RoundtableRoleSwitcher: FC<PropsWithChildren<{ model: Model; onChanged?: () => void }>> = ({
  model,
  onChanged,
  children
}) => {
  const [open, setOpen] = useState(false)
  const roleAssistants = useAppSelector(selectRoundtableRoleAssistants)
  const { createRole, openRoleLibrary } = useRoundtableRoleActions()

  const selectedId = findPendingRoundtableMention(model)?.assistantId

  const handleSelect = useCallback(
    (assistantId: string | undefined) => {
      updatePendingRoundtableMentionRole(model, assistantId)
      setOpen(false)
      onChanged?.()
    },
    [model, onChanged]
  )

  const handleAddRole = useCallback(() => {
    setOpen(false)
    createRole(handleSelect)
  }, [createRole, handleSelect])

  const handleOpenLibrary = useCallback(() => {
    setOpen(false)
    openRoleLibrary()
  }, [openRoleLibrary])

  return (
    <Popover
      trigger="click"
      placement="topLeft"
      open={open}
      onOpenChange={setOpen}
      content={
        <RolePanel
          key={open ? 'open' : 'closed'}
          roles={roleAssistants}
          selectedId={selectedId}
          onSelect={handleSelect}
          onAddRole={handleAddRole}
          onOpenLibrary={handleOpenLibrary}
        />
      }>
      {children}
    </Popover>
  )
}

export default RoundtableRoleSwitcher
