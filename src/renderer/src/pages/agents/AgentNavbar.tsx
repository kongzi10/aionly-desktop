import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import NavbarIcon from '@renderer/components/NavbarIcon'
import { Tooltip } from 'antd'
import { t } from 'i18next'

interface AgentNavbarProps {
  showSidebar: boolean
  toggleSidebar: () => void
}

/**
 * 智能体页面顶部栏。
 * 与对话页一致：不显示页面标题，只保留侧栏开关（原实现用绝对定位 + 魔法数字贴到侧栏边缘，已改为常态排布）。
 */
const AgentNavbar = ({ showSidebar, toggleSidebar }: AgentNavbarProps) => {
  return (
    <Navbar className="agent-navbar">
      <NavbarCenter style={{ borderRight: 'none' }}>
        <Tooltip title={t(showSidebar ? 'navbar.hide_sidebar' : 'navbar.show_sidebar')} mouseEnterDelay={0.8}>
          <NavbarIcon onClick={toggleSidebar}>
            <i
              className={`iconfont ${showSidebar ? 'icon-choutishouqi' : 'icon-choutizhankai'}`}
              style={{ fontSize: 18 }}
            />
          </NavbarIcon>
        </Tooltip>
      </NavbarCenter>
    </Navbar>
  )
}

export default AgentNavbar
