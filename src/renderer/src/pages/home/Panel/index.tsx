import AddButton from '@renderer/components/AddButton'
import AddAssistantPopup from '@renderer/components/Popups/AddAssistantPopup'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useAssistants, useDefaultAssistant } from '@renderer/hooks/useAssistant'
import { /*useNavbarPosition,*/ useSettings } from '@renderer/hooks/useSettings'
import { useShowTopics } from '@renderer/hooks/useStore'
import AssistantPresetsPage from '@renderer/pages/store/assistants/presets/AssistantPresetsPage'
import { getDefaultTopic } from '@renderer/services/AssistantService'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import type { Assistant, AssistantWorkspace, Topic } from '@renderer/types'
import type { Tab } from '@renderer/types/chat'
import { classNames, uuid } from '@renderer/utils'
import { Button } from 'antd'
import type { FC } from 'react'
import React from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
// import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import Assistants from '../Tabs/AssistantsTab'
import AssistantAddButton from '../Tabs/components/AssistantAddButton'
import Topics from '../Tabs/TopicsTab'

interface Props {
  activeAssistant: Assistant
  activeTopic: Topic
  setActiveAssistant: (assistant: Assistant) => void
  setActiveTopic: (topic: Topic) => void
  position: 'left' | 'right'
  forceToSeeAllTab?: boolean
  style?: React.CSSProperties
  workspace?: AssistantWorkspace
}

let _tab: Tab | null = null

const HomePanel: FC<Props> = ({
  activeAssistant,
  activeTopic,
  setActiveAssistant,
  setActiveTopic,
  position,
  forceToSeeAllTab,
  style,
  workspace = 'chat'
}) => {
  const { addAssistant } = useAssistants()
  const { topicPosition } = useSettings()
  const { defaultAssistant } = useDefaultAssistant()
  const { toggleShowTopics } = useShowTopics()
  // const { isLeftNavbar } = useNavbarPosition()
  // const navigate = useNavigate()
  const { t } = useTranslation()

  const { theme } = useTheme()

  const [tab, setTab] = useState<Tab>(position === 'left' ? _tab || 'assistants' : 'topic')
  /*const borderStyle = '0.5px solid var(--color-border)'
  const border =
    position === 'left'
      ? { borderRight: isLeftNavbar ? borderStyle : 'none' }
      : { borderLeft: isLeftNavbar ? borderStyle : 'none', borderTopLeftRadius: 0 }*/

  if (position === 'left' && topicPosition === 'left') {
    _tab = tab
  }

  const showTab = position === 'left' && topicPosition === 'left'

  const onCreateAssistant = async () => {
    const assistant = await AddAssistantPopup.show(workspace)
    if (assistant) {
      setActiveAssistant(assistant)
    }
  }

  const onCreateDefaultAssistant = () => {
    const id = uuid()
    const assistant = { ...defaultAssistant, id, workspace, topics: [getDefaultTopic(id)] }
    addAssistant(assistant)
    setActiveAssistant(assistant)
  }

  // TODO: 跳转角色管理
  const handleToRole = () => {
    // navigate('/store')
    window.modal.info({
      title: t('assistants.presets.title'),
      okText: null,
      cancelText: null,
      footer: null,
      maskClosable: true,
      closable: true,
      icon: null,
      width: '80%',
      style: {
        top: 20
      },
      zIndex: 888,
      bodyStyle: {
        padding: 0
        // height: 'calc(100vh - 100px)',
        // overflowY: 'auto'
      },
      content: <AssistantPresetsPage showNavbar={false} workspace={workspace} />
    })
  }

  useEffect(() => {
    const unsubscribes = [
      EventEmitter.on(EVENT_NAMES.SHOW_ASSISTANTS, (): any => {
        showTab && setTab('assistants')
      }),
      EventEmitter.on(EVENT_NAMES.SHOW_TOPIC_SIDEBAR, (): any => {
        showTab && setTab('topic')
      }),
      EventEmitter.on(EVENT_NAMES.SWITCH_TOPIC_SIDEBAR, () => {
        showTab && setTab('topic')
        if (position === 'left' && topicPosition === 'right') {
          toggleShowTopics()
        }
      })
    ]
    return () => unsubscribes.forEach((unsub) => unsub())
  }, [position, setTab, showTab, tab, toggleShowTopics, topicPosition])

  useEffect(() => {
    if (position === 'right' && topicPosition === 'right' && tab === 'assistants') {
      setTab('topic')
    }
    if (position === 'left' && topicPosition === 'right' && tab === 'topic') {
      setTab('assistants')
    }
  }, [position, tab, topicPosition, forceToSeeAllTab])

  return (
    <Container
      style={{ /*...border,*/ ...style }}
      className={classNames('home-tabs', { right: position === 'right' && topicPosition === 'right' })}>
      {/*{position === 'left' && topicPosition === 'left' && (
        <CustomTabs>
          <TabItem active={tab === 'assistants'} onClick={() => setTab('assistants')}>
            {t('assistants.abbr')}
          </TabItem>
          <TabItem active={tab === 'topic'} onClick={() => setTab('topic')}>
            {t('common.topics')}
          </TabItem>
        </CustomTabs>
      )}*/}

      <PanelItem className="assistants" theme={theme}>
        <div className="header">
          <span className="title">{t('assistants.abbr')}</span>
          <AssistantAddButton onCreateAssistant={onCreateAssistant} />
        </div>
        <div className="content">
          <Assistants
            workspace={workspace}
            activeAssistant={activeAssistant}
            setActiveAssistant={setActiveAssistant}
            onCreateAssistant={onCreateAssistant}
            onCreateDefaultAssistant={onCreateDefaultAssistant}
          />
        </div>
        <div className="footer">
          <PlainButton
            theme={theme}
            type="primary"
            block={true}
            icon={<i className="iconfont icon-jiaoseguanli"></i>}
            onClick={handleToRole}>
            {t('assistants.presets.title')}
          </PlainButton>
        </div>
      </PanelItem>

      <PanelItem className="topics" theme={theme}>
        <div className="header">
          <span className="title">{t('chat.topics.title')}</span>
          <AddButton onClick={() => EventEmitter.emit(EVENT_NAMES.ADD_NEW_TOPIC)}>
            {t('chat.add.topic.title')}
          </AddButton>
          {/*<Tooltip title={t('chat.topics.manage.title')} mouseEnterDelay={0.5}>
            <HeaderIconButton
              onClick={isManageMode ? exitManageMode : enterManageMode}
              className={isManageMode ? 'active' : ''}>
              <ListChecks size={14} />
            </HeaderIconButton>
          </Tooltip>*/}
        </div>
        <div className="content">
          <Topics
            assistant={activeAssistant}
            activeTopic={activeTopic}
            setActiveTopic={setActiveTopic}
            position={position}
          />
        </div>
      </PanelItem>

      {/*<TabContent className="home-tabs-content">
        {tab === 'assistants' && (
          <Assistants
            activeAssistant={activeAssistant}
            setActiveAssistant={setActiveAssistant}
            onCreateAssistant={onCreateAssistant}
            onCreateDefaultAssistant={onCreateDefaultAssistant}
          />
        )}
        {tab === 'topic' && (
          <Topics
            assistant={activeAssistant}
            activeTopic={activeTopic}
            setActiveTopic={setActiveTopic}
            position={position}
          />
        )}
      </TabContent>*/}
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: var(--assistants-width);
  transition: width 0.3s;
  height: calc(100vh - var(--navbar-height) - 10px);
  position: relative;
  border-radius: var(--base-border-radius);

  &.right {
    height: calc(100vh - var(--navbar-height));
  }

  /*[navbar-position='left'] & {
    background-color: var(--color-background);
  }*/
  [navbar-position='top'] & {
    height: calc(100vh - var(--navbar-height));
  }
  overflow: hidden;
  .collapsed {
    width: 0;
    border-left: none;
  }
`

const PanelItem = styled.div<{ theme: string }>`
  height: 50%;
  background-color: var(--color-background);
  border-radius: var(--base-border-radius);
  overflow: hidden;
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    border-bottom: 1px solid ${({ theme }) => (theme === 'dark' ? 'var(--color-black-mute)' : 'var(--color-gray-4)')};

    .title{
      display: inline-block;
      width: fit-content;
      flex-shrink: 0;
      font-family: Source Han Sans CN;
      font-size: 14px;
      font-weight: 500;

      &::before{
        content: "";
        display: inline-block;
        width: 2px;
        height: 12px;
        margin-right: 5px;
        background-color: var(--color-primary);
        border-radius: 1px;
        vertical-align: middle;
      }
    }
  }

  &.assistants .content{
    height: calc(100% - 100px);
  }

  .content{
    height: calc(100% - 40px);
    overflow-y: auto;
  }

  .footer{
    padding: 10px;
  }
`

const PlainButton = styled(Button)<{ theme: string }>`
  background-color: ${({ theme }) => (theme === 'dark' ? 'var(--color-black-mute)' : 'var(--color-primary-plain)')};
  color: var(--color-primary);
  font-size: 12px;
`

/*const TabContent = styled.div`
  display: flex;
  transition: width 0.3s;
  flex: 1;
  flex-direction: column;
  overflow-y: hidden;
  overflow-x: hidden;
`

const CustomTabs = styled.div`
  display: flex;
  margin: 0 12px;
  padding: 6px 0;
  border-bottom: 1px solid var(--color-border);
  background: transparent;
  -webkit-app-region: no-drag;
  [navbar-position='top'] & {
    padding-top: 2px;
  }
`

const TabItem = styled.button<{ active: boolean }>`
  flex: 1;
  height: 30px;
  border: none;
  background: transparent;
  color: ${(props) => (props.active ? 'var(--color-text)' : 'var(--color-text-secondary)')};
  font-size: 13px;
  font-weight: ${(props) => (props.active ? '600' : '400')};
  cursor: pointer;
  border-radius: 8px;
  margin: 0 2px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: var(--color-text);
  }

  &:active {
    transform: scale(0.98);
  }

  &::after {
    content: '';
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
    width: ${(props) => (props.active ? '30px' : '0')};
    height: 3px;
    background: var(--color-primary);
    border-radius: 1px;
    transition: all 0.2s ease;
  }

  &:hover::after {
    width: ${(props) => (props.active ? '30px' : '16px')};
    background: ${(props) => (props.active ? 'var(--color-primary)' : 'var(--color-primary-soft)')};
  }
`*/

export default HomePanel
