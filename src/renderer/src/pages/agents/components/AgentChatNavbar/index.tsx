import { NavbarHeader } from '@renderer/components/app/Navbar'
import { cn } from '@renderer/utils'

import AgentContent from './AgentContent'

interface Props {
  className?: string
}

/**
 * 输入框上方的顶栏。
 * 仅在顶部导航模式下渲染：左侧导航模式的所有控件都已收进输入框，
 * 保留这条空带只会白白占掉 navbar 高度。
 */
const AgentChatNavbar = ({ className }: Props) => {
  return (
    <NavbarHeader className={cn('agent-navbar h-(--navbar-height)', className)}>
      <div className="flex h-full min-w-0 flex-1 shrink items-center overflow-auto">
        <AgentContent />
      </div>
    </NavbarHeader>
  )
}

export default AgentChatNavbar
