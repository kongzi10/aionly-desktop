import ModelAvatar from '@renderer/components/Avatar/ModelAvatar'
import HorizontalScrollContainer from '@renderer/components/HorizontalScrollContainer'
import RoundtableRoleSwitcher from '@renderer/pages/roundtable/RoundtableRoleSwitcher'
import { getModelUniqId } from '@renderer/services/ModelService'
import type { Model } from '@renderer/types'
import { Tooltip } from 'antd'
import { ChevronDown, X } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const MentionModelsInput: FC<{
  selectedModels: Model[]
  onRemoveModel: (model: Model) => void
  getRoleName?: (model: Model) => string | undefined
  /** 群聊：成员 chip 可点击弹出角色面板，随时切换该成员绑定的角色 */
  roleSwitchable?: boolean
}> = ({ selectedModels, onRemoveModel, getRoleName, roleSwitchable = false }) => {
  const { t } = useTranslation()
  // 角色绑定暂存于模块级 pending（非响应式），切换后需主动触发重渲染以刷新 chip 角色名
  const [roleVersion, setRoleVersion] = useState(0)
  const handleRoleChanged = useCallback(() => setRoleVersion((version) => version + 1), [])

  return (
    <Container data-mentioned-models>
      <HorizontalScrollContainer dependencies={[selectedModels, roleVersion]} gap="6px">
        {selectedModels.map((model) => {
          const roleName = getRoleName?.(model)
          // 群聊 chip 始终展示当前角色：未绑定时展示「默认角色」占位，与弹窗成员行口径一致
          const shownRoleName = roleSwitchable ? (roleName ?? t('roundtable.role.default')) : roleName
          const baseTitle = shownRoleName
            ? `${model.name} · ${shownRoleName}`
            : model.group
              ? `${model.name} · ${model.group}`
              : model.name
          const nameNode = (
            <Tooltip
              title={roleSwitchable ? `${baseTitle}（${t('roundtable.role.select')}）` : baseTitle}
              mouseEnterDelay={0.4}>
              <ModelName>
                {model.name}
                {shownRoleName && <RoleName $bound={!!roleName}> · {shownRoleName}</RoleName>}
              </ModelName>
            </Tooltip>
          )
          return (
            <ModelChip key={getModelUniqId(model)}>
              {roleSwitchable ? (
                <RoundtableRoleSwitcher model={model} onChanged={handleRoleChanged}>
                  <ChipTrigger type="button">
                    <ModelAvatar model={model} size={16} />
                    {nameNode}
                    <ChevronDown size={12} className="arrow" />
                  </ChipTrigger>
                </RoundtableRoleSwitcher>
              ) : (
                <>
                  <ModelAvatar model={model} size={16} />
                  {nameNode}
                </>
              )}
              <RemoveButton
                type="button"
                aria-label={`${t('common.delete')} ${model.name}`}
                onClick={() => onRemoveModel(model)}>
                <X size={12} strokeWidth={1.8} />
              </RemoveButton>
            </ModelChip>
          )
        })}
      </HorizontalScrollContainer>
    </Container>
  )
}

const Container = styled.div`
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 0 48px 6px 15px;
`

const ModelChip = styled.div`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  height: 28px;
  max-width: 210px;
  padding: 0 5px 0 6px;
  border: 1px solid rgb(90 143 215 / 22%);
  border-radius: 9px;
  background: rgb(94 154 232 / 9%);
  color: var(--color-text);
`

/** 角色切换触发区：覆盖 chip 内头像 + 名称，点击弹出角色面板 */
const ChipTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  padding: 3px 4px;
  margin: -3px -4px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    background: rgb(94 154 232 / 16%);
  }

  .arrow {
    flex: 0 0 auto;
    color: var(--color-text-3);
    transition: color 0.15s;
  }

  &:hover .arrow {
    color: var(--color-primary);
  }
`

const ModelName = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 1;
`

const RoleName = styled.span<{ $bound?: boolean }>`
  color: ${(props) => (props.$bound ? 'var(--color-primary)' : 'var(--color-text-3)')};
  font-weight: ${(props) => (props.$bound ? 600 : 400)};
`

const RemoveButton = styled.button`
  display: inline-flex;
  flex: 0 0 18px;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--color-text-3);
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: rgb(94 154 232 / 18%);
    color: var(--color-text);
  }
`

export default MentionModelsInput
