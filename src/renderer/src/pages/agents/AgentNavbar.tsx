import { Navbar, NavbarCenter, /*NavbarLeft,*/ NavbarRight } from '@renderer/components/app/Navbar'
import { HStack } from '@renderer/components/Layout'
import NavbarIcon from '@renderer/components/NavbarIcon'
import SearchPopup from '@renderer/components/Popups/SearchPopup'
// import { modelGenerating } from '@renderer/hooks/useRuntime'
// import { useSettings } from '@renderer/hooks/useSettings'
import { useShortcut } from '@renderer/hooks/useShortcuts'
// import { useShowAssistants, useShowTopics } from '@renderer/hooks/useStore'
// import { useAppDispatch } from '@renderer/store'
// import { setNarrowMode } from '@renderer/store/settings'
import { Tooltip } from 'antd'
import { t } from 'i18next'
// import { Menu, PanelLeftClose, PanelRightClose, Search } from 'lucide-react'
// import { AnimatePresence, motion } from 'motion/react'

// import UpdateAppButton from '../home/components/UpdateAppButton'
// import AgentSidePanelDrawer from './components/AgentSidePanelDrawer'

interface AgentNavbarProps {
  showSidebar: boolean
  toggleSidebar: () => void
}

const AgentNavbar = ({ showSidebar, toggleSidebar }: AgentNavbarProps) => {
  // const { showAssistants, toggleShowAssistants } = useShowAssistants()
  // const { showTopics, toggleShowTopics } = useShowTopics()
  // const { narrowMode, topicPosition } = useSettings()
  // const dispatch = useAppDispatch()

  useShortcut('search_message', () => {
    void SearchPopup.show()
  })

  /*const handleNarrowModeToggle = async () => {
    await modelGenerating()
    dispatch(setNarrowMode(!narrowMode))
  }*/

  return (
    <Navbar className="agent-navbar" style={{ position: 'relative' }}>
      {showSidebar && (
        <Tooltip title={t('navbar.hide_sidebar')} mouseEnterDelay={0.8}>
          <NavbarIcon
            onClick={toggleSidebar}
            style={{
              position: 'absolute',
              left: 'calc(var(--sidebar-width) + var(--assistants-width) - 18px)',
              zIndex: 1
            }}>
            <i className="iconfont icon-choutishouqi" style={{ fontSize: 18 }} />
          </NavbarIcon>
        </Tooltip>
      )}
      {/*<AnimatePresence initial={false}>
        {showAssistants && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>
            <NavbarLeft style={{ justifyContent: 'space-between', borderRight: 'none', padding: 0 }}>
              <Tooltip title={t('navbar.hide_sidebar')} mouseEnterDelay={0.8}>
                <NavbarIcon onClick={toggleShowAssistants}>
                  <PanelLeftClose size={18} />
                </NavbarIcon>
              </Tooltip>
            </NavbarLeft>
          </motion.div>
        )}
      </AnimatePresence>
      {!showAssistants && (
        <NavbarLeft
          style={{
            justifyContent: 'flex-start',
            borderRight: 'none',
            paddingLeft: 0,
            paddingRight: 0,
            minWidth: 'auto'
          }}>
          <Tooltip title={t('navbar.show_sidebar')} mouseEnterDelay={0.8} placement="right">
            <NavbarIcon onClick={() => toggleShowAssistants()}>
              <PanelRightClose size={18} />
            </NavbarIcon>
          </Tooltip>
          <NavbarIcon onClick={() => AgentSidePanelDrawer.show()} style={{ marginRight: 5 }}>
            <Menu size={18} />
          </NavbarIcon>
        </NavbarLeft>
      )}*/}
      <NavbarCenter>
        {t('agent.sidebar_title')}
        {!showSidebar && (
          <Tooltip title={t('navbar.show_sidebar')} mouseEnterDelay={0.8}>
            <NavbarIcon onClick={toggleSidebar} style={{ marginLeft: 6 }}>
              <i className="iconfont icon-choutizhankai" style={{ fontSize: 18 }} />
            </NavbarIcon>
          </Tooltip>
        )}
      </NavbarCenter>
      <NavbarRight
        style={{
          justifyContent: 'flex-end',
          flex: 'none',
          position: 'relative',
          paddingRight: '15px',
          minWidth: 'auto'
        }}
        className="agent-navbar-right">
        <HStack alignItems="center" gap={6}>
          {/*<UpdateAppButton />
          <Tooltip title={t('chat.assistant.search.placeholder')} mouseEnterDelay={0.8}>
            <NavbarIcon className="max-[1000px]:hidden" onClick={() => SearchPopup.show()}>
              <Search size={18} />
            </NavbarIcon>
          </Tooltip>
          <Tooltip title={t('navbar.expand')} mouseEnterDelay={0.8}>
            <NavbarIcon className="max-[1000px]:hidden" onClick={handleNarrowModeToggle}>
              <i className="iconfont icon-icon-adaptive-width"></i>
            </NavbarIcon>
          </Tooltip>
          {topicPosition === 'right' && !showTopics && (
            <Tooltip title={t('navbar.show_sidebar')} mouseEnterDelay={2}>
              <NavbarIcon onClick={toggleShowTopics}>
                <PanelLeftClose size={18} />
              </NavbarIcon>
            </Tooltip>
          )}
          {topicPosition === 'right' && showTopics && (
            <Tooltip title={t('navbar.hide_sidebar')} mouseEnterDelay={2}>
              <NavbarIcon onClick={toggleShowTopics}>
                <PanelRightClose size={18} />
              </NavbarIcon>
            </Tooltip>
          )}*/}
        </HStack>
      </NavbarRight>
    </Navbar>
  )
}

export default AgentNavbar
