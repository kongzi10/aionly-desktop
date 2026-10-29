import AddButton from '@renderer/components/AddButton'
import AssistantAvatar from '@renderer/components/Avatar/AssistantAvatar'
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
import { Button, Popover } from 'antd'
import { ChevronDown, Plus, Search, X } from 'lucide-react'
import type { FC } from 'react'
import React from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
// import { useNavigate } from 'react-router-dom'
import styled, { css } from 'styled-components'

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
  const [rolePickerOpen, setRolePickerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  /*const borderStyle = '0.5px solid var(--color-border)'
  const border =
    position === 'left'
      ? { borderRight: isLeftNavbar ? borderStyle : 'none' }
      : { borderLeft: isLeftNavbar ? borderStyle : 'none', borderTopLeftRadius: 0 }*/

  if (position === 'left' && topicPosition === 'left') {
    _tab = tab
  }

  const showTab = position === 'left' && topicPosition === 'left'
  const mergePanels = position === 'left'

  const onCreateAssistant = async () => {
    if (mergePanels) setRolePickerOpen(false)
    const assistant = await AddAssistantPopup.show(workspace)
    if (assistant) {
      setActiveAssistant(assistant)
    }
  }

  const onCreateDefaultAssistant = () => {
    if (mergePanels) setRolePickerOpen(false)
    const id = uuid()
    const assistant = { ...defaultAssistant, id, workspace, topics: [getDefaultTopic(id)] }
    addAssistant(assistant)
    setActiveAssistant(assistant)
  }

  // TODO: 跳转角色管理
  const handleToRole = () => {
    setRolePickerOpen(false)
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
        if (mergePanels) setRolePickerOpen(true)
        else if (showTab) setTab('assistants')
      }),
      EventEmitter.on(EVENT_NAMES.SHOW_TOPIC_SIDEBAR, (): any => {
        if (mergePanels) setRolePickerOpen(false)
        else if (showTab) setTab('topic')
      }),
      EventEmitter.on(EVENT_NAMES.SWITCH_TOPIC_SIDEBAR, () => {
        if (mergePanels) setRolePickerOpen(false)
        else if (showTab) setTab('topic')
        if (position === 'left' && topicPosition === 'right') {
          toggleShowTopics()
        }
      })
    ]
    return () => unsubscribes.forEach((unsub) => unsub())
  }, [mergePanels, position, showTab, toggleShowTopics, topicPosition])

  useEffect(() => {
    if (position === 'right' && topicPosition === 'right' && tab === 'assistants') {
      setTab('topic')
    }
    if (position === 'left' && topicPosition === 'right' && tab === 'topic') {
      setTab('assistants')
    }
  }, [position, tab, topicPosition, forceToSeeAllTab])

  const roleLibraryButton = (
    <PlainButton
      theme={theme}
      type="primary"
      block={true}
      icon={<i className="iconfont icon-jiaoseguanli"></i>}
      onClick={handleToRole}>
      {t('assistants.presets.title')}
    </PlainButton>
  )
  const newTopicButton = (
    <AddButton data-tour="new-topic" onClick={() => EventEmitter.emit(EVENT_NAMES.ADD_NEW_TOPIC)}>
      {t('chat.add.topic.title')}
    </AddButton>
  )

  return (
    <Container
      $merged={mergePanels}
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

      {mergePanels && (
        <RolePicker className="role-picker">
          <Popover
            open={rolePickerOpen}
            onOpenChange={setRolePickerOpen}
            trigger="click"
            placement="bottomLeft"
            arrow={false}
            content={
              <RolePopover>
                <div className="role-menu-title">{t('assistants.abbr')}</div>
                <div className="role-list">
                  <Assistants
                    workspace={workspace}
                    activeAssistant={activeAssistant}
                    setActiveAssistant={(assistant) => {
                      setActiveAssistant(assistant)
                      setRolePickerOpen(false)
                    }}
                    onCreateAssistant={onCreateAssistant}
                    onCreateDefaultAssistant={onCreateDefaultAssistant}
                  />
                </div>
                <div className="role-actions">
                  <button type="button" onClick={onCreateAssistant}>
                    {t('chat.add.assistant.title')}
                  </button>
                  <button type="button" onClick={handleToRole}>
                    {t('assistants.presets.title')}
                  </button>
                </div>
              </RolePopover>
            }>
            <button className="role-selector" type="button" data-tour="add-assistant" aria-expanded={rolePickerOpen}>
              <AssistantAvatar assistant={activeAssistant} size={26} />
              <span className="role-name">{activeAssistant.name}</span>
              <ChevronDown size={16} />
            </button>
          </Popover>
        </RolePicker>
      )}

      {mergePanels && (
        <SidebarActions>
          <button
            className="new-topic"
            type="button"
            data-tour="new-topic"
            onClick={() => EventEmitter.emit(EVENT_NAMES.ADD_NEW_TOPIC)}>
            <Plus size={16} />
            <span>{t('chat.add.topic.title')}</span>
          </button>
          <button
            className="search-toggle"
            type="button"
            aria-label={t('chat.topics.search.title')}
            aria-expanded={searchOpen}
            onClick={() => {
              setSearchOpen((open) => !open)
              setSearchQuery('')
            }}>
            <Search size={17} />
          </button>
        </SidebarActions>
      )}

      {mergePanels && searchOpen && (
        <SidebarSearch>
          <Search size={15} />
          <input
            autoFocus
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setSearchOpen(false)
                setSearchQuery('')
              }
            }}
            placeholder={t('chat.topics.search.placeholder')}
            aria-label={t('chat.topics.search.title')}
          />
          {searchQuery && (
            <button type="button" aria-label={t('common.clear')} onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </SidebarSearch>
      )}

      {!mergePanels && (
        <PanelItem className="assistants" theme={theme}>
          <div className="header">
            <span className="title">{t('assistants.abbr')}</span>
            {!mergePanels && <AssistantAddButton onCreateAssistant={onCreateAssistant} />}
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
          {!mergePanels && <div className="footer">{roleLibraryButton}</div>}
        </PanelItem>
      )}

      <PanelItem className="topics" theme={theme}>
        <div className="header">
          <span className="title">{t('chat.topics.title')}</span>
          {!mergePanels && newTopicButton}
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
            compact={mergePanels}
            searchQuery={searchQuery}
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

const Container = styled.div<{ $merged: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ $merged }) => ($merged ? '0' : '10px')};
  width: var(--assistants-width);
  transition: width 0.3s;
  height: calc(100vh - var(--navbar-height) - 10px);
  position: relative;
  border-radius: var(--base-border-radius);

  ${({ $merged }) =>
    $merged &&
    css`
      background: transparent;
      border: 0;
      border-radius: 0;

      > .role-picker {
        border-bottom: 0;
        padding-bottom: 2px;
      }

      > .topics {
        display: flex;
        flex-direction: column;
        border: 0;
        border-radius: 0;
      }

      > .topics {
        height: auto;
        flex: 1;
        min-height: 0;
      }

      > .topics .content {
        flex: 1;
        min-height: 0;
        height: auto;
      }

      > .topics .header {
        padding: 7px 14px 4px;
        border-bottom: 0;
      }

      > .topics .header .title {
        color: var(--color-text-3);
        font-size: 12px;
        font-weight: 500;

        &::before {
          display: none;
        }
      }

      body.light :is(#home-page, #roundtable-page) & {
        background: rgb(248 251 255 / 78%);
        border: 0;
        border-radius: 0;
        box-shadow: none;

        > .topics {
          background: transparent;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          backdrop-filter: none;
        }

      }
    `}

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

const RolePicker = styled.div`
  flex-shrink: 0;
  padding: 8px 10px;
  border-bottom: 1px solid var(--color-border);

  .role-selector {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    height: 46px;
    padding: 0 8px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    text-align: left;

    .role-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
      font-weight: 600;
    }

    &:hover {
      background: var(--color-background-soft);
    }

    &:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    &[aria-expanded='true'] > svg:last-child {
      transform: rotate(180deg);
    }
  }

  body.light :is(#home-page, #roundtable-page) & {
    border-bottom-color: rgb(132 172 226 / 15%);

    .role-selector:hover,
    .role-selector[aria-expanded='true'] {
      background: rgb(229 239 255 / 75%);
    }
  }

`

const SidebarActions = styled.div.attrs({ className: 'new-chat-actions' })`
  display: flex;
  gap: 4px;
  padding: 2px 10px 5px;

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 34px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--color-text-1);
    cursor: pointer;

    &:hover {
      background: var(--color-background-soft);
    }

    &:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: -2px;
    }
  }

  .new-topic {
    flex: 1;
    justify-content: flex-start;
    gap: 9px;
    padding: 0 10px;
    font-size: 13px;
    font-weight: 500;
  }

  .search-toggle {
    width: 34px;
    flex-shrink: 0;
    color: var(--color-text-2);
  }
`

const SidebarSearch = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  margin: 2px 10px 7px;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
  color: var(--color-text-3);

  &:focus-within {
    border-color: var(--color-primary);
  }

  input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--color-text-1);
    font-size: 12px;
  }

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-text-3);
    cursor: pointer;
  }
`

const RolePopover = styled.div`
  width: 218px;

  .role-menu-title {
    padding: 0 10px 8px;
    color: var(--color-text-secondary);
    font-size: 12px;
  }

  .role-list {
    max-height: 250px;
    overflow-y: auto;
  }

  .role-actions {
    display: flex;
    justify-content: space-between;
    gap: 4px;
    padding: 8px 4px 0;
    border-top: 1px solid var(--color-border);

    button {
      border: 0;
      border-radius: 6px;
      padding: 5px 8px;
      background: transparent;
      color: var(--color-primary);
      cursor: pointer;
      font-size: 12px;

      &:hover {
        background: var(--color-primary-plain);
      }
    }
  }
`

const PanelItem = styled.div<{ theme: string }>`
  height: 50%;
  background-color: var(--color-background);
  border-radius: var(--base-border-radius);
  overflow: hidden;

  body.light :is(#home-page, #roundtable-page) & {
    background: rgb(248 251 255 / 78%);
    border: 1px solid rgb(255 255 255 / 70%);
    border-radius: 12px;
    backdrop-filter: blur(18px);
    box-shadow: 0 8px 24px rgb(77 122 190 / 7%);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    border-bottom: 1px solid ${({ theme }) => (theme === 'dark' ? 'var(--color-black-mute)' : 'var(--color-gray-4)')};

    body.light :is(#home-page, #roundtable-page) & {
      border-bottom-color: rgb(132 172 226 / 15%);
    }

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
