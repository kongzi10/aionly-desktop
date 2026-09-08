import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
// import { HStack } from '@renderer/components/Layout'
// import ListItem from '@renderer/components/ListItem'
import Scrollbar from '@renderer/components/Scrollbar'
// import CustomTag from '@renderer/components/Tags/CustomTag'
import { useAssistantPresets } from '@renderer/hooks/useAssistantPresets'
// import { useNavbarPosition } from '@renderer/hooks/useSettings'
import { createAssistantFromAgent } from '@renderer/services/AssistantService'
import type { AssistantPreset, AssistantWorkspace } from '@renderer/types'
import { uuid } from '@renderer/utils'
import { cn } from '@renderer/utils/style'
import { Button, Divider, Empty, Flex, Input } from 'antd'
import { omit } from 'lodash'
import { ChevronDown, ChevronUp, FolderInput, Plus, Search, UserCog } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import styled from 'styled-components'

import { groupByCategories, useSystemAssistantPresets } from '.'
import { groupTranslations } from './assistantPresetGroupTranslations'
import AddAssistantPresetPopup from './components/AddAssistantPresetPopup'
import AssistantPresetCard from './components/AssistantPresetCard'
// import { AssistantPresetGroupIcon } from './components/AssistantPresetGroupIcon'
import ImportAssistantPresetPopup from './components/ImportAssistantPresetPopup'
import ManageAssistantPresetsPopup from './components/ManageAssistantPresetsPopup'

interface Props {
  showNavbar?: boolean
  workspace?: AssistantWorkspace
}

const AssistantPresetsPage: FC<Props> = ({ showNavbar = true, workspace = 'chat' }) => {
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  // const [activeGroup, setActiveGroup] = useState('我的') // 原逻辑：默认选中「我的」
  const [activeGroup, setActiveGroup] = useState('') // 新逻辑：默认展示全部
  const [agentGroups, setAgentGroups] = useState<Record<string, AssistantPreset[]>>({})
  const [_isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(true)
  const systemPresets = useSystemAssistantPresets()
  const { presets: userPresets } = useAssistantPresets()
  // const { isTopNavbar } = useNavbarPosition()

  useEffect(() => {
    const systemAgentsGroupList = groupByCategories(systemPresets)
    const agentsGroupList = {
      我的: userPresets,
      精选: [],
      ...systemAgentsGroupList
    } as Record<string, AssistantPreset[]>
    setAgentGroups(agentsGroupList)
  }, [systemPresets, userPresets])

  const filteredPresets = useMemo(() => {
    // 原逻辑（已保留）：
    // 搜索框为空直接返回「我的」分组下的 agent
    // if (!search.trim()) {
    //   return agentGroups[activeGroup] || []
    // }
    // const uniquePresets = new Map<string, AssistantPreset>()
    // Object.entries(agentGroups).forEach(([, agents]) => {
    //   agents.forEach((agent) => {
    //     if (
    //       agent.name.toLowerCase().includes(search.toLowerCase()) ||
    //       agent.description?.toLowerCase().includes(search.toLowerCase())
    //     ) {
    //       uniquePresets.set(agent.id, agent)
    //     }
    //   })
    // })
    // return Array.from(uniquePresets.values())

    // 新逻辑：默认展示全部，支持分组筛选
    const allPresets = new Map<string, AssistantPreset>()
    Object.entries(agentGroups).forEach(([, agents]) => {
      agents.forEach((agent) => allPresets.set(agent.id, agent))
    })

    // activeGroup 为空时展示全部，否则展示对应分组
    const pool = activeGroup ? agentGroups[activeGroup] || [] : Array.from(allPresets.values())

    // 搜索过滤
    if (!search.trim()) {
      return pool
    }

    return pool.filter(
      (agent) =>
        agent.name.toLowerCase().includes(search.toLowerCase()) ||
        agent.description?.toLowerCase().includes(search.toLowerCase())
    )
  }, [agentGroups, activeGroup, search])

  const { t, i18n } = useTranslation()

  const onAddPresetConfirm = useCallback(
    (preset: AssistantPreset) => {
      window.modal.confirm({
        title: preset.name,
        content: (
          <Flex gap={16} vertical style={{ width: 'calc(100% + 12px)' }}>
            {preset.description && <AgentDescription>{preset.description}</AgentDescription>}

            {preset.prompt && (
              <AgentPrompt className="markdown">
                <ReactMarkdown>{preset.prompt}</ReactMarkdown>
              </AgentPrompt>
            )}
          </Flex>
        ),
        width: 600,
        icon: null,
        closable: true,
        maskClosable: true,
        centered: true,
        okButtonProps: { type: 'primary' },
        okText: t('assistants.presets.add.button'),
        onOk: () => createAssistantFromAgent(preset, workspace)
      })
    },
    [t, workspace]
  )

  const getPresetFromSystemPreset = useCallback((preset: (typeof systemPresets)[number]) => {
    return {
      ...omit(preset, 'group'),
      name: preset.name,
      id: uuid(),
      topics: [],
      type: 'agent'
    }
  }, [])

  const getLocalizedGroupName = useCallback(
    (group: string) => {
      const currentLang = i18n.language
      return groupTranslations[group]?.[currentLang] || group
    },
    [i18n.language]
  )

  const agentGroupOptions = useMemo(() => {
    // 原逻辑：只显示分组
    // return Object.keys(agentGroups).map((group) => ({
    //   label: getLocalizedGroupName(group),
    //   value: group
    // }))

    // 新逻辑：添加"全部"选项
    const options = [{ label: t('models.all'), value: '' }]
    Object.keys(agentGroups).forEach((group) => {
      options.push({
        label: getLocalizedGroupName(group),
        value: group
      })
    })
    return options
  }, [agentGroups, getLocalizedGroupName, t])

  const handleSearch = () => {
    if (searchInput.trim() === '') {
      setSearch('')
      // setActiveGroup('我的') // 原逻辑：恢复到「我的」分组
      setActiveGroup('') // 新逻辑：恢复到全部
    } else {
      setActiveGroup('')
      setSearch(searchInput)
    }
  }

  const handleSearchClear = () => {
    setSearch('')
    setSearchInput('')
    // setActiveGroup('我的') // 原逻辑：恢复到「我的」分组
    setActiveGroup('') // 新逻辑：恢复到全部
    setIsSearchExpanded(false)
  }

  /*  const handleSearchIconClick = () => {
    if (!isSearchExpanded) {
      setIsSearchExpanded(true)
    } else {
      handleSearch()
    }
  }*/

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchInput(value)
    // 如果输入内容为空，折叠搜索框
    if (value.trim() === '') {
      setIsSearchExpanded(false)
      setSearch('')
      // setActiveGroup('我的') // 原逻辑：恢复到「我的」分组
      setActiveGroup('') // 新逻辑：恢复到全部
    }
  }

  const handleSearchInputBlur = () => {
    // 如果输入内容为空，失焦时折叠搜索框
    if (searchInput.trim() === '') {
      setIsSearchExpanded(false)
    }
  }

  const handleGroupClick = (group: string) => () => {
    setSearch('')
    setSearchInput('')
    setActiveGroup(group)
  }

  const handleAddAgent = () => {
    void AddAssistantPresetPopup.show().then(() => {
      handleSearchClear()
    })
  }

  const handleImportAgent = async () => {
    try {
      await ImportAssistantPresetPopup.show()
    } catch (error) {
      window.toast.error(error instanceof Error ? error.message : t('message.agents.import.error'))
    }
  }

  const handleManageAgents = () => {
    ManageAssistantPresetsPopup.show()
  }

  const toggleCategoryExpand = () => {
    setIsCategoryExpanded(!isCategoryExpanded)
  }

  return (
    <Container className="page-container">
      {showNavbar && (
        <Navbar>
          <NavbarCenter style={{ borderRight: 'none', justifyContent: 'space-between' }}>
            {t('assistants.presets.title')}
            {/* <Input
            placeholder={t('common.search')}
            className="nodrag"
            style={{ width: '30%', height: 28, borderRadius: 15, paddingLeft: 12 }}
            size="small"
            variant="filled"
            allowClear
            onClear={handleSearchClear}
            suffix={<Search size={14} color="var(--color-icon)" onClick={handleSearch} />}
            value={searchInput}
            maxLength={50}
            onChange={handleSearchInputChange}
            onPressEnter={handleSearch}
            onBlur={handleSearchInputBlur}
          />*/}
            <div style={{ width: 80 }} />
          </NavbarCenter>
        </Navbar>
      )}

      <Main id="content-container">
        {/*<AgentsGroupList>
          {Object.entries(agentGroups).map(([group]) => (
            <ListItem
              active={activeGroup === group && !search.trim()}
              key={group}
              title={
                <Flex gap={16} align="center" justify="space-between">
                  <Flex gap={10} align="center">
                    <AssistantPresetGroupIcon groupName={group} />
                    {getLocalizedGroupName(group)}
                  </Flex>
                  {
                    <HStack alignItems="center" justifyContent="center" style={{ minWidth: 40 }}>
                      <CustomTag color="#A0A0A0" size={8}>
                        {agentGroups[group].length}
                      </CustomTag>
                    </HStack>
                  }
                </Flex>
              }
              style={{ margin: '0 8px', paddingLeft: 16, paddingRight: 16 }}
              onClick={handleGroupClick(group)}></ListItem>
          ))}
        </AgentsGroupList>*/}

        <AgentCategoryWrap className={cn({ collapsed: !isCategoryExpanded })}>
          <div className="category-list">
            {agentGroupOptions.map((category) => (
              <div
                className={cn('group-item', { active: activeGroup === category.value && !search.trim() })}
                key={category.value}
                onClick={handleGroupClick(category.value)}>
                {category.label}
              </div>
            ))}
          </div>
          <div className="toggle-btn" onClick={toggleCategoryExpand}>
            {isCategoryExpanded ? (
              <>
                {t('notes.collapse')}
                <ChevronUp size={12} />
              </>
            ) : (
              <>
                {t('notes.expand')}
                <ChevronDown size={12} />
              </>
            )}
          </div>
        </AgentCategoryWrap>

        <AgentsListContainer>
          <AgentsListHeader>
            {/*<AgentsListTitle>
              {search.trim() ? (
                <>
                  <AssistantPresetGroupIcon groupName="搜索" size={24} />
                  {search.trim()}{' '}
                </>
              ) : (
                <>
                  <AssistantPresetGroupIcon groupName={activeGroup} size={24} />
                  {getLocalizedGroupName(activeGroup)}
                </>
              )}

              {
                <CustomTag color="#A0A0A0" size={10}>
                  {filteredPresets.length}
                </CustomTag>
              }
            </AgentsListTitle>*/}

            <Flex gap={16} align="center" justify="space-between">
              {/*{isSearchExpanded ? (
                <Input
                  placeholder={t('common.search')}
                  className="nodrag"
                  style={{ width: 200, height: 28, borderRadius: 15, paddingLeft: 12 }}
                  size="small"
                  variant="filled"
                  allowClear
                  onClear={handleSearchClear}
                  suffix={<Search size={14} color="var(--color-icon)" onClick={handleSearchIconClick} />}
                  value={searchInput}
                  maxLength={50}
                  onChange={handleSearchInputChange}
                  onPressEnter={handleSearch}
                  onBlur={handleSearchInputBlur}
                  autoFocus
                />
              ) : (
                isTopNavbar && (
                  <Button
                    type="text"
                    onClick={handleSearchIconClick}
                    icon={<Search size={18} color="var(--color-icon)" />}>
                    {t('common.search')}
                  </Button>
                )
              )}*/}
              <Button type="primary" onClick={handleAddAgent} icon={<Plus size={18} />}>
                {t('assistants.presets.add.title')}
              </Button>
              <Button type="primary" onClick={handleManageAgents} icon={<UserCog size={18} />}>
                {t('assistants.presets.manage.title')}
              </Button>
              <Button type="primary" onClick={handleImportAgent} icon={<FolderInput size={18} />}>
                {t('assistants.presets.import.title')}
              </Button>
            </Flex>

            <Flex align="center" gap={16}>
              <Input
                placeholder={t('common.search')}
                className="nodrag"
                style={{ height: 28, borderRadius: 6, paddingLeft: 12 }}
                size="small"
                allowClear
                onClear={handleSearchClear}
                suffix={<Search size={14} color="var(--color-icon)" onClick={handleSearch} />}
                value={searchInput}
                maxLength={50}
                onChange={handleSearchInputChange}
                onPressEnter={handleSearch}
                onBlur={handleSearchInputBlur}
              />
            </Flex>
          </AgentsListHeader>

          <Divider style={{ margin: '0' }} />

          {filteredPresets.length > 0 ? (
            <AgentsList>
              {filteredPresets.map((agent, index) => (
                <AssistantPresetCard
                  key={agent.id || index}
                  onClick={() => onAddPresetConfirm(getPresetFromSystemPreset(agent))}
                  onAddAssistant={() => createAssistantFromAgent(getPresetFromSystemPreset(agent), workspace)}
                  preset={agent}
                  workspace={workspace}
                  activegroup={activeGroup}
                  getLocalizedGroupName={getLocalizedGroupName}
                />
              ))}
            </AgentsList>
          ) : (
            <EmptyView>
              <Empty description={t('assistants.presets.search.no_results')} />
            </EmptyView>
          )}
        </AgentsListContainer>
      </Main>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
`

/*const AgentsGroupList = styled(Scrollbar)`
  min-width: 160px;
  height: calc(100vh - var(--navbar-height) - 10px);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
  border-right: 0.5px solid var(--color-border);
  border-top-left-radius: inherit;
  border-bottom-left-radius: inherit;
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`*/

const Main = styled.div`
  //flex: 1;
  //display: flex;
  background-color: var(--color-background);
`

const AgentsListContainer = styled.div`
  height: calc(100vh - var(--navbar-height) - 10px);
  flex: 1;
  display: flex;
  flex-direction: column;
`

const AgentsListHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 12px;
`

/*const AgentsListTitle = styled.div`
  font-size: 16px;
  line-height: 18px;
  font-weight: 500;
  color: var(--color-text-1);
  display: flex;
  align-items: center;
  gap: 8px;
`*/

const AgentsList = styled(Scrollbar)`
  flex: 1;
  padding: 8px 16px 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  grid-auto-rows: 160px;
  gap: 16px;
`

const AgentDescription = styled.div`
  color: var(--color-text-2);
  font-size: 12px;
`

const AgentPrompt = styled.div`
  max-height: 60vh;
  overflow-y: scroll;
  background-color: var(--color-background-soft);
  padding: 8px;
  border-radius: 10px;
`

const EmptyView = styled.div`
  height: 100%;
  display: flex;
  flex: 1;
  justify-content: center;
  align-items: center;
  font-size: 16px;
  color: var(--color-text-secondary);
`

const AgentCategoryWrap = styled.div`
  display: flex;
  padding: 10px;
  position: relative;
  &::after{
    display: block;
    content: "";
    width: 100%;
    height: 1px;
    background-color: var(--color-background-mute);
    margin-top: 10px;
    position: absolute;
    bottom: 0;
    left: 0;
  }
  .category-list{
    display: flex;
    flex-wrap: wrap;
    gap: 5px 10px;
    overflow: hidden;
    max-height: 100px;
    transition: max-height 0.3s ease;
  }
  &.collapsed .category-list{
    max-height: 30px;
  }
  .group-item{
    line-height: 1;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    flex-shrink: 0;
    &.active{
      background-color: var(--color-list-item);
      color: var(--color-primary);
    }
  }
  .toggle-btn{
    height: 22px;
    display: flex;
    align-items: center;
    gap: 4px;
    line-height: 1;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    color: var(--color-text-3);
    cursor: pointer;
    user-select: none;
    flex-shrink: 0;
    &:hover{
      color: var(--color-primary);
      background-color: var(--color-background-soft);
    }
  }
`

export default AssistantPresetsPage
