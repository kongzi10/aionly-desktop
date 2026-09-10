import { HStack } from '@renderer/components/Layout'
import MultiSelectActionPopup from '@renderer/components/Popups/MultiSelectionPopup'
import { QuickPanelProvider } from '@renderer/components/QuickPanel'
import { useAssistant } from '@renderer/hooks/useAssistant'
import { useChatContext } from '@renderer/hooks/useChatContext'
import { useNavbarPosition } from '@renderer/hooks/useSettings'
import Inputbar from '@renderer/pages/home/Inputbar/Inputbar'
import Messages from '@renderer/pages/home/Messages/Messages'
import type { Assistant, Topic } from '@renderer/types'
import { Flex } from 'antd'
import type { FC } from 'react'
import styled from 'styled-components'

interface Props {
  assistant: Assistant
  activeTopic: Topic
  setActiveTopic: (topic: Topic) => void
}

const RoundtableChat: FC<Props> = ({ assistant: sourceAssistant, activeTopic, setActiveTopic }) => {
  const { assistant } = useAssistant(sourceAssistant.id)
  const { isMultiSelectMode } = useChatContext(activeTopic)
  const { isTopNavbar } = useNavbarPosition()
  const mainHeight = isTopNavbar ? 'calc(100vh - var(--navbar-height) - 6px)' : 'calc(100vh - var(--navbar-height))'

  return (
    <Container id="roundtable-chat">
      <HStack flex={1} style={{ width: '100%', minWidth: 0 }}>
        <Main vertical flex={1} justify="space-between" style={{ height: mainHeight, width: '100%' }}>
          <QuickPanelProvider>
            <Content style={{ height: `calc(${mainHeight} - var(--navbar-height))` }}>
              <Messages assistant={assistant} topic={activeTopic} setActiveTopic={setActiveTopic} mode="roundtable" />
              <BottomArea>
                <Inputbar assistant={assistant} setActiveTopic={setActiveTopic} topic={activeTopic} mode="roundtable" />
              </BottomArea>
              {isMultiSelectMode && <MultiSelectActionPopup topic={activeTopic} />}
            </Content>
          </QuickPanelProvider>
        </Main>
      </HStack>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex: 1;
  height: calc(100vh - var(--navbar-height) - 10px);
  overflow: hidden;
  border-radius: var(--base-border-radius);
  background-color: var(--color-background);
`

const Main = styled(Flex)`
  position: relative;
  transform: translateZ(0);
`

const Content = styled.div`
  width: 100%;
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
`

const BottomArea = styled.div`
  flex-shrink: 0;
  z-index: 2;

  .inputbar > div:first-child {
    max-width: none;
  }
`

export default RoundtableChat
