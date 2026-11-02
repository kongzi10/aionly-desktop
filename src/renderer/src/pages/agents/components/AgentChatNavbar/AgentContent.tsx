import NavbarIcon from '@renderer/components/NavbarIcon'
import { useNavbarPosition } from '@renderer/hooks/useSettings'
import { useShowAssistants } from '@renderer/hooks/useStore'
import { Menu, PanelLeftClose, PanelRightClose } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import AgentSidePanelDrawer from '../AgentSidePanelDrawer'
import Tools from './Tools'

/**
 * 输入框上方顶栏的内容。
 * 模型选择、智能体按钮、设置、外部编辑器入口都已搬进输入框（布局与对话页一致），
 * 这里只保留顶部导航模式下才需要的侧栏开关，左侧导航模式返回 null。
 */
const AgentContent = () => {
  const { t } = useTranslation()
  const { showAssistants, toggleShowAssistants } = useShowAssistants()
  const { isTopNavbar } = useNavbarPosition()

  if (!isTopNavbar) {
    return null
  }

  return (
    <div className="flex w-full items-center justify-between pr-2">
      <div className="flex min-w-0 shrink items-center">
        {showAssistants ? (
          <NavbarIcon onClick={toggleShowAssistants} aria-label={t('navbar.hide_sidebar')}>
            <PanelLeftClose size={18} />
          </NavbarIcon>
        ) : (
          <NavbarIcon onClick={() => toggleShowAssistants()} style={{ marginRight: 8 }}>
            <PanelRightClose size={18} />
          </NavbarIcon>
        )}
        <AnimatePresence initial={false}>
          {!showAssistants && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}>
              <NavbarIcon onClick={() => AgentSidePanelDrawer.show()} style={{ marginRight: 5 }}>
                <Menu size={18} />
              </NavbarIcon>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Tools />
    </div>
  )
}

export default AgentContent
