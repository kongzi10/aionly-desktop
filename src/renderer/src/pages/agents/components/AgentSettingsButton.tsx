import NavbarIcon from '@renderer/components/NavbarIcon'
import { useNavbarPosition } from '@renderer/hooks/useSettings'
import AgentSettingsTab from '@renderer/pages/agents/AgentSettingsTab'
import { Drawer, Tooltip } from 'antd'
import { t } from 'i18next'
import { Settings2 } from 'lucide-react'
import { useState } from 'react'

interface Props {
  /** 输入框右上角的悬浮位置需要更小一档的图标键 */
  compact?: boolean
}

/**
 * 智能体设置入口。
 * 由顶栏搬迁到输入框右上角（与对话页 SettingsButton 的位置一致），抽屉内容不变。
 */
const AgentSettingsButton = ({ compact = false }: Props) => {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { isTopNavbar } = useNavbarPosition()

  return (
    <>
      <Tooltip title={t('settings.title')} mouseEnterDelay={0.8}>
        <NavbarIcon onClick={() => setSettingsOpen(true)} style={compact ? { width: 26, height: 26 } : undefined}>
          <Settings2 size={compact ? 16 : 18} />
        </NavbarIcon>
      </Tooltip>
      <Drawer
        placement="right"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        width="var(--assistants-width)"
        closable={false}
        styles={{
          body: { padding: 0, paddingTop: isTopNavbar ? 0 : 'var(--navbar-height)' }
        }}>
        <AgentSettingsTab />
      </Drawer>
    </>
  )
}

export default AgentSettingsButton
