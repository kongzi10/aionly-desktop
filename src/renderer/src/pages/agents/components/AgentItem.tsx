import { DeleteIcon, EditIcon } from '@renderer/components/Icons'
import MarqueeText from '@renderer/components/MarqueeText'
import { useSettings } from '@renderer/hooks/useSettings'
import AgentSettingsPopup from '@renderer/pages/settings/AgentSettings/AgentSettingsPopup'
import { AgentLabel } from '@renderer/pages/settings/AgentSettings/shared'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import type { AgentEntity } from '@renderer/types'
import { cn } from '@renderer/utils'
import type { MenuProps } from 'antd'
import { Dropdown } from 'antd'
import { MoreVertical } from 'lucide-react'
import type { PropsWithChildren } from 'react'
import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface AgentItemProps {
  agent: AgentEntity
  isActive: boolean
  onDelete: (agent: AgentEntity) => void
  onPress: () => void
}

const AgentItem = ({ agent, isActive, onDelete, onPress }: AgentItemProps) => {
  const { t } = useTranslation()
  const { clickAssistantToShowTopic, topicPosition, assistantIconType } = useSettings()
  const [isHovered, setIsHovered] = useState(false)

  const handlePress = useCallback(() => {
    // Show session sidebar if setting is enabled (reusing the assistant setting for consistency)
    if (clickAssistantToShowTopic) {
      if (topicPosition === 'left') {
        void EventEmitter.emit(EVENT_NAMES.SWITCH_TOPIC_SIDEBAR)
      }
    }
    onPress()
  }, [clickAssistantToShowTopic, topicPosition, onPress])

  const handleMenuButtonClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  const menuItems: MenuProps['items'] = useMemo(
    () => [
      {
        label: t('common.edit'),
        key: 'edit',
        icon: <EditIcon size={14} />,
        onClick: () => AgentSettingsPopup.show({ agentId: agent.id })
      },
      {
        label: t('common.delete'),
        key: 'delete',
        icon: <DeleteIcon size={14} className="lucide-custom" />,
        danger: true,
        onClick: () => {
          window.modal.confirm({
            title: t('agent.delete.title'),
            content: t('agent.delete.content'),
            centered: true,
            okButtonProps: { danger: true },
            onOk: () => onDelete(agent)
          })
        }
      }
    ],
    [t, agent, onDelete]
  )

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={['contextMenu']}
      popupRender={(menu) => <div onPointerDown={(e) => e.stopPropagation()}>{menu}</div>}>
      <Container
        onClick={handlePress}
        isActive={isActive}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}>
        <NameRow title={agent.name ?? agent.id}>
          <MarqueeText className="flex min-w-0 flex-1">
            <AgentLabel agent={agent} hideIcon={assistantIconType === 'none'} />
          </MarqueeText>
          {(isActive || isHovered) && (
            <Dropdown
              menu={{ items: menuItems }}
              trigger={['click']}
              popupRender={(menu) => <div onPointerDown={(e) => e.stopPropagation()}>{menu}</div>}>
              <MenuTrigger
                onClick={handleMenuButtonClick}
                aria-label={t('common.edit')}
                className={isActive ? 'text-(--color-primary)' : 'text-(--color-text-secondary)'}>
                <MoreVertical size={14} />
              </MenuTrigger>
            </Dropdown>
          )}
        </NameRow>
      </Container>
    </Dropdown>
  )
}

const Container = ({
  children,
  isActive,
  className,
  ...props
}: PropsWithChildren<{ isActive?: boolean } & React.HTMLAttributes<HTMLDivElement>>) => (
  <div
    {...props}
    className={cn(
      'relative flex h-8.5 w-full cursor-pointer flex-row justify-between rounded-(--base-border-radius) border-[0.5px] border-transparent px-2',
      !isActive && 'hover:bg-(--color-list-item-hover)',
      isActive && 'bg-(--color-list-item) shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]',
      className
    )}>
    {children}
  </div>
)

const NameRow = ({ children, className, ...props }: PropsWithChildren<{} & React.HTMLAttributes<HTMLDivElement>>) => (
  <div
    {...props}
    className={cn('flex min-w-0 flex-1 flex-row items-center gap-2 text-(--color-text) text-[13px]', className)}>
    {children}
  </div>
)

const MenuTrigger = ({
  children,
  className,
  ...props
}: PropsWithChildren<{} & React.HTMLAttributes<HTMLDivElement>>) => (
  <div
    {...props}
    className={cn('flex h-5.5 min-h-5.5 min-w-5.5 shrink-0 items-center justify-center px-1.25', className)}>
    {children}
  </div>
)

export default memo(AgentItem)
