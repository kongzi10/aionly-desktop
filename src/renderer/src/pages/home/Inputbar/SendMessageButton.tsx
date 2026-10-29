import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  disabled: boolean
  sendMessage: () => void
  isLoading?: boolean
  onStop?: () => void
}

const SendMessageButton: FC<Props> = ({ disabled, sendMessage, isLoading = false, onStop }) => {
  const { t } = useTranslation()
  const label = t(isLoading ? 'chat.input.stop' : 'chat.input.send')

  return (
    <SendButton
      type="button"
      disabled={isLoading ? !onStop : disabled}
      $loading={isLoading}
      aria-label={label}
      title={label}
      onClick={isLoading ? onStop : sendMessage}>
      {isLoading ? <StopMark aria-hidden="true" /> : <i className="iconfont icon-fasongguanli" />}
    </SendButton>
  )
}

const SendButton = styled.button<{ $loading: boolean }>`
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  background-color: ${({ $loading }) => ($loading ? '#3b82f6' : 'var(--color-primary)')};
  color: var(--color-white);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.2s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  &:disabled {
    background-color: var(--color-disabled-1);
    cursor: not-allowed;
  }

  .iconfont {
    font-size: 16px;
    margin-top: 1px;
    margin-right: 2px;
  }
`

const StopMark = styled.span`
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: #fff;
`

export default SendMessageButton
