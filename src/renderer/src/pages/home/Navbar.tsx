import { Navbar, NavbarCenter, NavbarRight } from '@renderer/components/app/Navbar'
// import { HStack } from '@renderer/components/Layout'
import SearchPopup from '@renderer/components/Popups/SearchPopup'
// import { modelGenerating } from '@renderer/hooks/useRuntime'
// import { useSettings } from '@renderer/hooks/useSettings'
import { useShortcut } from '@renderer/hooks/useShortcuts'
import { useShowAssistants /*useShowTopics*/ } from '@renderer/hooks/useStore'
// import { useAppDispatch } from '@renderer/store'
// import { setNarrowMode } from '@renderer/store/settings'
import type { Assistant, Topic } from '@renderer/types'
import { Tooltip } from 'antd'
import { t } from 'i18next'
import type { FC } from 'react'

// import styled from 'styled-components'
import NavbarIcon from '../../components/NavbarIcon'
import UpdateAppButton from './components/UpdateAppButton'

interface Props {
  activeAssistant: Assistant
  activeTopic: Topic
  setActiveTopic: (topic: Topic) => void
  setActiveAssistant: (assistant: Assistant) => void
  position: 'left' | 'right'
  titleKey?: string
  showTitle?: boolean
  showAssistantToggle?: boolean
}

const HeaderNavbar: FC<Props> = ({ titleKey = 'assistants.title', showTitle = true, showAssistantToggle = true }) => {
  const { showAssistants, toggleShowAssistants } = useShowAssistants()
  // const { topicPosition, narrowMode } = useSettings()
  // const { showTopics, toggleShowTopics } = useShowTopics()
  // const dispatch = useAppDispatch()

  useShortcut('search_message', () => {
    void SearchPopup.show()
  })

  /*const handleNarrowModeToggle = async () => {
    await modelGenerating()
    dispatch(setNarrowMode(!narrowMode))
  }*/

  return (
    <Navbar className="home-navbar">
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
      </AnimatePresence>*/}
      <NavbarCenter>
        {showAssistantToggle && (
          <Tooltip title={t(showAssistants ? 'navbar.hide_sidebar' : 'navbar.show_sidebar')} mouseEnterDelay={0.8}>
            <NavbarIcon onClick={toggleShowAssistants} style={{ marginRight: showTitle ? 8 : 0 }}>
              <i
                className={`iconfont ${showAssistants ? 'icon-choutishouqi' : 'icon-choutizhankai'}`}
                style={{ fontSize: 18 }}
              />
            </NavbarIcon>
          </Tooltip>
        )}
        {showTitle && t(titleKey)}
      </NavbarCenter>
      <NavbarRight
        style={{
          justifyContent: 'flex-end',
          flex: 1,
          position: 'relative',
          paddingRight: '15px'
        }}
        className="home-navbar-right">
        <UpdateAppButton />
        {/*<HStack alignItems="center" gap={6}>
          <UpdateAppButton />
          <Tooltip title={t('chat.assistant.search.placeholder')} mouseEnterDelay={0.8}>
            <NarrowIcon onClick={() => SearchPopup.show()}>
              <Search size={18} />
            </NarrowIcon>
          </Tooltip>
          <Tooltip title={t('navbar.expand')} mouseEnterDelay={0.8}>
            <NarrowIcon onClick={handleNarrowModeToggle}>
              <i className="iconfont icon-icon-adaptive-width"></i>
            </NarrowIcon>
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
          )}
        </HStack>*/}
      </NavbarRight>
    </Navbar>
  )
}

/*const NarrowIcon = styled(NavbarIcon)`
  @media (max-width: 1000px) {
    display: none;
  }
`*/

export default HeaderNavbar
