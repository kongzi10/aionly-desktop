import { ChevronDown, X } from 'lucide-react'
import type { FC } from 'react'
import styled from 'styled-components'

interface Props {
  logo?: string
  name: string
  removeLabel: string
  onOpen: () => void
  onRemove: () => void
}

const RoundtableModelChip: FC<Props> = ({ logo, name, removeLabel, onOpen, onRemove }) => (
  <Container>
    <Selector type="button" aria-label={name} onClick={onOpen}>
      <ModelLogo src={logo} alt={name} />
      <ModelName>{name}</ModelName>
      <ChevronDown size={16} strokeWidth={2} />
    </Selector>
    <RemoveButton type="button" aria-label={removeLabel} onClick={onRemove}>
      <X size={11} strokeWidth={3} color="rgba(255, 255, 255, 1)" />
    </RemoveButton>
  </Container>
)

const Container = styled.div`
  position: relative;
  flex: 0 0 auto;
  padding: 2px 4px 0 0;
`

const Selector = styled.button`
  height: 32px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  border: 0;
  border-radius: 16px;
  color: rgba(0, 94, 255, 1);
  background-color: rgba(235, 242, 255, 1);
  font-family: 'Source Han Sans CN', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  cursor: pointer;
`

const ModelLogo = styled.img`
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  border-radius: 50%;
  object-fit: cover;
`

const ModelName = styled.span`
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const RemoveButton = styled.button`
  position: absolute;
  top: 0;
  right: 0;
  width: 16px;
  height: 16px;
  display: flex;
  padding: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  color: rgba(255, 255, 255, 1);
  background-color: rgba(0, 94, 255, 1);
  cursor: pointer;
`

export default RoundtableModelChip
